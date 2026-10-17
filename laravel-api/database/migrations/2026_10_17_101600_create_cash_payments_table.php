<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Full COD payment only in MVP: amount_due = orders.total_amount and
     * amount_remaining = amount_due - amount_collected. Partial payments
     * are not allowed.
     */
    public function up(): void
    {
        Schema::create('cash_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->restrictOnDelete();
            $table->foreignId('delivery_id')->nullable()->constrained()->restrictOnDelete();
            $table->string('receipt_number')->unique();
            $table->unsignedBigInteger('amount_due');
            $table->unsignedBigInteger('amount_collected')->default(0);
            $table->unsignedBigInteger('amount_remaining');
            $table->string('received_by')->nullable();
            $table->timestamp('collected_at')->nullable();
            $table->string('customer_name')->nullable();
            $table->string('customer_signature_path')->nullable();
            $table->string('receipt_file_path')->nullable();
            $table->text('note')->nullable();
            $table->string('status')->default('NOT_PAID');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('cash_payments');
    }
};
