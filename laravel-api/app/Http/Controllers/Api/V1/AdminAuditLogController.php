<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\AuditLogResource;
use App\Http\Traits\PaginationMeta;
use App\Models\Admin;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Read-only Admin audit trail (LogicFlow §15, RolesPermissions §2).
 *
 * Audit rows are append-only: this controller can list and filter them but
 * never creates, updates or deletes entries. The trail records the acting
 * Admin, the entity, the before/after snapshot and the request IP.
 */
class AdminAuditLogController extends Controller
{
    use PaginationMeta;

    /**
     * Paginated audit trail with action, entity, admin and date filters.
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'action' => ['nullable', 'string', 'max:100'],
            'entity_type' => ['nullable', 'string', 'max:100'],
            'admin_id' => ['nullable', 'integer', 'exists:admins,id'],
            'search' => ['nullable', 'string', 'max:100'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $query = AuditLog::query()->with('admin:id,name,email')->orderByDesc('id');

        if (isset($filters['action'])) {
            $query->where('action', $filters['action']);
        }

        if (isset($filters['entity_type'])) {
            $query->where('entity_type', $filters['entity_type']);
        }

        if (isset($filters['admin_id'])) {
            $query->where('admin_id', $filters['admin_id']);
        }

        if (isset($filters['search'])) {
            $search = trim($filters['search']);

            $query->where(function ($query) use ($search): void {
                $query->where('action', 'like', "%{$search}%")
                    ->orWhere('entity_id', 'like', "%{$search}%")
                    ->orWhere('ip_address', 'like', "%{$search}%");
            });
        }

        if (isset($filters['from'])) {
            $query->whereDate('created_at', '>=', $filters['from']);
        }

        if (isset($filters['to'])) {
            $query->whereDate('created_at', '<=', $filters['to']);
        }

        $logs = $query->paginate($filters['per_page'] ?? 25);

        return $this->successResponse([
            'audit_logs' => AuditLogResource::collection($logs->items()),
            'meta' => $this->paginationMeta($logs),
            'actions' => AuditLog::query()->distinct()->orderBy('action')->pluck('action'),
            'entity_types' => AuditLog::query()->distinct()->orderBy('entity_type')->pluck('entity_type'),
            'admins' => Admin::query()->orderBy('name')->get(['id', 'name', 'email']),
        ]);
    }
}
