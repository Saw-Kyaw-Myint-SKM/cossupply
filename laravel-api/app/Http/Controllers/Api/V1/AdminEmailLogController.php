<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\EmailType;
use App\Http\Controllers\Controller;
use App\Http\Resources\EmailLogResource;
use App\Http\Traits\PaginationMeta;
use App\Models\Admin;
use App\Models\EmailLog;
use App\Services\Audit\AuditLogService;
use App\Services\Notification\EmailNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Admin email delivery log and resend actions (LogicFlow §14).
 *
 * Failed sends are visible here with their stored error; resending never
 * changes the original attempt row, it appends a new one.
 */
class AdminEmailLogController extends Controller
{
    use PaginationMeta;

    public function __construct(
        private readonly EmailNotificationService $emails,
        private readonly AuditLogService $auditLogs,
    ) {}

    /**
     * Paginated email log with status, type, recipient and error visibility.
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::in(['SENT', 'FAILED'])],
            'email_type' => ['nullable', Rule::in(EmailType::values())],
            'search' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $query = EmailLog::query()->orderByDesc('id');

        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (isset($filters['email_type'])) {
            $query->where('email_type', $filters['email_type']);
        }

        if (isset($filters['search'])) {
            $search = trim($filters['search']);

            $query->where(function ($query) use ($search): void {
                $query->where('recipient_email', 'like', "%{$search}%")
                    ->orWhere('subject', 'like', "%{$search}%");
            });
        }

        $logs = $query->paginate($filters['per_page'] ?? 20);

        return $this->successResponse([
            'email_logs' => EmailLogResource::collection($logs->items()),
            'meta' => $this->paginationMeta($logs),
            'statuses' => ['SENT', 'FAILED'],
            'email_types' => EmailType::values(),
        ]);
    }

    /**
     * Re-send one eligible transactional email and append a new log row.
     */
    public function resend(Request $request, EmailLog $emailLog): JsonResponse
    {
        /** @var Admin $admin */
        $admin = $request->user();

        $log = $this->emails->resend($emailLog);

        $this->auditLogs->log(
            $admin,
            'email.resent',
            'email_log',
            (string) $emailLog->id,
            [],
            [
                'email_type' => $log->email_type,
                'status' => $log->status,
                'new_email_log_id' => $log->id,
            ],
            $request->ip(),
        );

        return $this->successResponse(
            ['email' => new EmailLogResource($log)],
            'Email resent.',
        );
    }
}
