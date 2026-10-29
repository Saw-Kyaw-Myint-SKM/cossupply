<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\NotificationResource;
use App\Http\Traits\PaginationMeta;
use App\Models\Admin;
use App\Models\Customer;
use App\Models\Notification;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Authenticated notification API (LogicFlow §14, DatabaseFlow §7).
 *
 * The recipient is always derived from the bearer token — never from a query
 * parameter — so a Customer or Admin can only list, count and mark their own
 * notifications. A foreign notification id answers 404, never 403.
 */
class NotificationController extends Controller
{
    use PaginationMeta;

    /**
     * Paginated list plus the unread count the React badge polls.
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'unread' => ['nullable', 'boolean'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $query = $this->recipientQuery($request);

        if ($request->boolean('unread')) {
            $query->where('is_read', false);
        }

        $notifications = $query->orderByDesc('id')->paginate($filters['per_page'] ?? 20);
        $unreadCount = $this->unreadCountQuery($request)->count();

        return $this->successResponse([
            'notifications' => NotificationResource::collection($notifications->items()),
            'unread_count' => $unreadCount,
            'meta' => $this->paginationMeta($notifications),
        ]);
    }

    /**
     * Lightweight endpoint used by the 60-second polling provider.
     */
    public function unreadCount(Request $request): JsonResponse
    {
        return $this->successResponse([
            'unread_count' => $this->unreadCountQuery($request)->count(),
        ]);
    }

    /**
     * Mark one owned notification as read (idempotent).
     */
    public function markRead(Request $request, Notification $notification): JsonResponse
    {
        if (! $this->owns($request, $notification)) {
            return $this->notFoundResponse('Notification not found.');
        }

        if (! $notification->is_read) {
            $notification->update([
                'is_read' => true,
                'read_at' => now(),
            ]);
        }

        return $this->successResponse([
            'notification' => new NotificationResource($notification->refresh()),
            'unread_count' => $this->unreadCountQuery($request)->count(),
        ]);
    }

    /**
     * Mark every unread notification owned by the recipient as read.
     */
    public function markAllRead(Request $request): JsonResponse
    {
        $marked = $this->unreadCountQuery($request)->update([
            'is_read' => true,
            'read_at' => now(),
            'updated_at' => now(),
        ]);

        return $this->successResponse([
            'marked' => $marked,
            'unread_count' => 0,
        ], 'Notifications marked as read.');
    }

    private function recipientQuery(Request $request): Builder
    {
        [$type, $id] = $this->recipient($request);

        return Notification::query()
            ->where('recipient_type', $type)
            ->where('recipient_id', $id);
    }

    private function unreadCountQuery(Request $request): Builder
    {
        return $this->recipientQuery($request)->where('is_read', false);
    }

    private function owns(Request $request, Notification $notification): bool
    {
        [$type, $id] = $this->recipient($request);

        return $notification->recipient_type === $type
            && (int) $notification->recipient_id === $id;
    }

    /**
     * @return array{0: string, 1: int}
     */
    private function recipient(Request $request): array
    {
        $user = $request->user();

        if ($user instanceof Admin) {
            return ['ADMIN', (int) $user->id];
        }

        if ($user instanceof Customer) {
            return ['CUSTOMER', (int) $user->id];
        }

        abort(403, 'Unsupported recipient.');
    }
}
