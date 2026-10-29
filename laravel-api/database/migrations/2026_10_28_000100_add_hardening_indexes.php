<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Task 12 query hardening: index the read paths used by the audit log,
     * email log and notification list so Admin screens stay paginated and
     * cheap as the append-only tables grow.
     */
    public function up(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->index('action', 'audit_logs_action_index');
            $table->index(['entity_type', 'entity_id'], 'audit_logs_entity_index');
            $table->index('created_at', 'audit_logs_created_at_index');
            $table->index(['admin_id', 'created_at'], 'audit_logs_admin_created_at_index');
        });

        Schema::table('email_logs', function (Blueprint $table) {
            $table->index('status', 'email_logs_status_index');
            $table->index('email_type', 'email_logs_type_index');
            $table->index(['related_type', 'related_id'], 'email_logs_related_index');
        });

        Schema::table('notifications', function (Blueprint $table) {
            $table->index(['recipient_type', 'recipient_id', 'id'], 'notifications_recipient_id_index');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropIndex('notifications_recipient_id_index');
        });

        Schema::table('email_logs', function (Blueprint $table) {
            $table->dropIndex('email_logs_status_index');
            $table->dropIndex('email_logs_type_index');
            $table->dropIndex('email_logs_related_index');
        });

        Schema::table('audit_logs', function (Blueprint $table) {
            $table->dropIndex('audit_logs_action_index');
            $table->dropIndex('audit_logs_entity_index');
            $table->dropIndex('audit_logs_created_at_index');
            $table->dropIndex('audit_logs_admin_created_at_index');
        });
    }
};
