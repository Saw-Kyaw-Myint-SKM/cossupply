<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Append-only log: rows are created by Admin when contacting a
     * supplier and are never updated, so only created_at exists.
     */
    public function up(): void
    {
        Schema::create('supplier_communications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quotation_request_id')->constrained()->restrictOnDelete();
            $table->foreignId('supplier_id')->constrained()->restrictOnDelete();
            $table->foreignId('admin_id')->constrained('admins')->restrictOnDelete();
            $table->string('contact_method');
            $table->text('message_text')->nullable();
            $table->text('supplier_response')->nullable();
            $table->string('attachment_path')->nullable();
            $table->timestamp('contacted_at');
            $table->timestamp('responded_at')->nullable();
            $table->timestamp('created_at')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('supplier_communications');
    }
};
