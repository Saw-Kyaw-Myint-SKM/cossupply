<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Typed master settings. value is stored as a string and exposed as a
     * typed value (string/integer/boolean) through the SettingService.
     * Every changed setting is written to audit_logs.
     */
    public function up(): void
    {
        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->text('value');
            $table->string('value_type');
            $table->string('group_name');
            $table->string('label');
            $table->text('description')->nullable();
            $table->boolean('is_public')->default(false);
            $table->foreignId('updated_by_admin_id')->nullable()->constrained('admins')->restrictOnDelete();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('settings');
    }
};
