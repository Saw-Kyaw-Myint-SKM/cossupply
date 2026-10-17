<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Append-only customer/admin action trail for a quotation version.
     * actor_id is intentionally a plain nullable id because the actor can
     * be a customer or an admin (different tables).
     */
    public function up(): void
    {
        Schema::create('quotation_actions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quotation_id')->constrained()->restrictOnDelete();
            $table->string('action');
            $table->text('customer_note')->nullable();
            $table->string('actor_type');
            $table->unsignedBigInteger('actor_id')->nullable();
            $table->string('ip_address')->nullable();
            $table->timestamp('created_at')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('quotation_actions');
    }
};
