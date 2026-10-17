<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Version-specific PDF records. Old PDFs are never overwritten when a
     * new quotation version is created, so rows are append-only.
     */
    public function up(): void
    {
        Schema::create('quotation_pdfs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quotation_id')->constrained()->restrictOnDelete();
            $table->string('file_path');
            $table->string('file_name');
            $table->foreignId('generated_by_admin_id')->constrained('admins')->restrictOnDelete();
            $table->timestamp('generated_at');
            $table->timestamp('created_at')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('quotation_pdfs');
    }
};
