<?php

namespace App\Services\Admin;

use App\Exceptions\ResourceConflictException;
use App\Models\Admin;
use App\Models\QuotationRequest;
use App\Services\Audit\AuditLogService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\QueryException;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

/**
 * Super-admin management of admin accounts.
 *
 * Every create/update/delete/password-reset is audited with the prior and
 * new values (never the password itself). Deletion and demotion are guarded:
 * an admin cannot remove themselves, cannot remove or demote the last active
 * super admin, and cannot be removed while quotation requests are assigned
 * to them.
 */
class AdminManagementService
{
    private const UPDATABLE_FIELDS = ['name', 'email', 'phone', 'role', 'status'];

    public function __construct(
        private readonly AuditLogService $auditLogs,
    ) {}

    /**
     * Paginate admin accounts with optional filters.
     *
     * @param  array<string, mixed>  $filters
     */
    public function paginate(array $filters): LengthAwarePaginator
    {
        $sortBy = in_array($filters['sort_by'] ?? null, ['created_at'], true)
            ? $filters['sort_by']
            : null;
        $sortDirection = ($filters['sort_direction'] ?? null) === 'asc' ? 'asc' : 'desc';

        $query = Admin::query()
            ->when(filled($filters['role'] ?? null), fn (Builder $query): Builder => $query->where('role', $filters['role']))
            ->when(filled($filters['status'] ?? null), fn (Builder $query): Builder => $query->where('status', $filters['status']))
            ->when(filled($filters['search'] ?? null), function (Builder $query) use ($filters): void {
                $search = $filters['search'];

                $query->where(function (Builder $query) use ($search): void {
                    $query->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('phone', 'like', "%{$search}%");
                });
            });

        if ($sortBy === 'created_at') {
            return $query->orderBy('created_at', $sortDirection)
                ->orderBy('id', $sortDirection)
                ->paginate($this->perPage($filters));
        }

        return $query->orderBy('name')
            ->orderBy('id')
            ->paginate($this->perPage($filters));
    }

    /**
     * Create an admin account and audit the change.
     *
     * @param  array<string, mixed>  $data
     */
    public function create(array $data, Admin $actor, ?string $ip = null): Admin
    {
        return DB::transaction(function () use ($data, $actor, $ip): Admin {
            $adminUser = Admin::create([
                'name' => $data['name'],
                'email' => $data['email'],
                'phone' => $data['phone'] ?? null,
                'password' => $data['password'],
                'role' => $data['role'] ?? 'admin',
                'status' => $data['status'] ?? 'active',
            ]);

            $this->auditLogs->log(
                $actor,
                'admin.created',
                'admin',
                (string) $adminUser->id,
                [],
                $this->snapshot($adminUser),
                $ip,
            );

            return $adminUser;
        });
    }

    /**
     * Update an admin account, auditing the changed values.
     *
     * @param  array<string, mixed>  $data
     *
     * @throws ResourceConflictException
     */
    public function update(Admin $adminUser, array $data, Admin $actor, ?string $ip = null): Admin
    {
        $oldData = $this->snapshot($adminUser);

        return DB::transaction(function () use ($adminUser, $data, $actor, $oldData, $ip): Admin {
            $attributes = Arr::only($data, self::UPDATABLE_FIELDS);

            $losesSuperAdmin = $adminUser->isSuperAdmin()
                && (
                    (($attributes['role'] ?? $adminUser->role) !== 'super_admin')
                    || (($attributes['status'] ?? $adminUser->status) !== 'active')
                );

            if ($losesSuperAdmin) {
                $this->guardAgainstLosingLastSuperAdmin($adminUser);
            }

            $adminUser->update($attributes);

            $newData = $this->snapshot($adminUser);

            if ($newData !== $oldData) {
                $this->auditLogs->log(
                    $actor,
                    'admin.updated',
                    'admin',
                    (string) $adminUser->id,
                    $oldData,
                    $newData,
                    $ip,
                );
            }

            return $adminUser;
        });
    }

    /**
     * Replace an admin account's password and audit the reset.
     *
     * The password itself is never written to the audit trail. Existing
     * sessions of the target account are revoked so the old password stops
     * working immediately; the acting admin keeps their own session.
     *
     * @throws ResourceConflictException
     */
    public function resetPassword(Admin $adminUser, string $password, Admin $actor, ?string $ip = null): Admin
    {
        return DB::transaction(function () use ($adminUser, $password, $actor, $ip): Admin {
            $adminUser->update(['password' => $password]);

            if (! $adminUser->is($actor)) {
                $adminUser->tokens()->delete();
            }

            $this->auditLogs->log(
                $actor,
                'admin.password_reset',
                'admin',
                (string) $adminUser->id,
                [],
                ['password' => '***', 'sessions_revoked' => ! $adminUser->is($actor)],
                $ip,
            );

            return $adminUser;
        });
    }

    /**
     * Delete an admin account and audit the change.
     *
     * @throws ResourceConflictException
     */
    public function delete(Admin $adminUser, Admin $actor, ?string $ip = null): void
    {
        DB::transaction(function () use ($adminUser, $actor, $ip): void {
            if ($adminUser->is($actor)) {
                throw new ResourceConflictException('You cannot delete your own admin account.');
            }

            if ($adminUser->isSuperAdmin()) {
                $this->guardAgainstLosingLastSuperAdmin($adminUser);
            }

            if (QuotationRequest::query()->where('assigned_admin_id', $adminUser->id)->exists()) {
                throw new ResourceConflictException(
                    'Admin user cannot be deleted because quotation requests are assigned to them. Reassign them first.',
                );
            }

            $snapshot = $this->snapshot($adminUser);

            try {
                $adminUser->delete();
            } catch (QueryException $exception) {
                throw new ResourceConflictException(
                    'Admin user cannot be deleted because their account is referenced by existing records. Set the status to inactive instead.',
                    previous: $exception,
                );
            }

            $this->auditLogs->log(
                $actor,
                'admin.deleted',
                'admin',
                (string) $adminUser->id,
                $snapshot,
                [],
                $ip,
            );
        });
    }

    /**
     * Block removing the last active super admin from the platform.
     *
     * @throws ResourceConflictException
     */
    private function guardAgainstLosingLastSuperAdmin(Admin $adminUser): void
    {
        $anotherActiveSuperAdminExists = Admin::query()
            ->where('role', 'super_admin')
            ->where('status', 'active')
            ->whereKeyNot($adminUser->id)
            ->exists();

        if (! $anotherActiveSuperAdminExists) {
            throw new ResourceConflictException(
                'The last active super admin cannot be deleted or demoted. Promote another super admin first.',
            );
        }
    }

    /**
     * Audit-friendly account representation (never includes the password).
     *
     * @return array<string, mixed>
     */
    private function snapshot(Admin $adminUser): array
    {
        return [
            'name' => $adminUser->name,
            'email' => $adminUser->email,
            'phone' => $adminUser->phone,
            'role' => $adminUser->role,
            'status' => $adminUser->status,
        ];
    }

    /**
     * Clamp the requested page size to the allowed range.
     *
     * @param  array<string, mixed>  $filters
     */
    private function perPage(array $filters): int
    {
        return max(1, min(100, (int) ($filters['per_page'] ?? 15)));
    }
}
