<?php

namespace App\Services\Audit;

use App\Models\Admin;
use App\Models\AuditLog;

class AuditLogService
{
    /**
     * Record an admin action in the append-only audit trail.
     *
     * @param  array<string, mixed>  $oldData
     * @param  array<string, mixed>  $newData
     */
    public function log(
        Admin $admin,
        string $action,
        string $entityType,
        string $entityId,
        array $oldData = [],
        array $newData = [],
        ?string $ip = null,
    ): AuditLog {
        return AuditLog::create([
            'admin_id' => $admin->id,
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'old_data' => $oldData,
            'new_data' => $newData,
            'ip_address' => $ip,
        ]);
    }
}
