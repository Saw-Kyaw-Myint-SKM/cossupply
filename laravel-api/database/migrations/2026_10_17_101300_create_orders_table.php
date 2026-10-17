<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Orders are created only from an accepted quotation version.
     * orders.quotation_id is NOT NULL and UNIQUE (one order per quotation
     * version); orders.customer_id is NOT NULL.
     */
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->string('order_number')->unique();
            $table->foreignId('quotation_id')->unique()->constrained()->restrictOnDelete();
            $table->foreignId('quotation_request_id')->constrained()->restrictOnDelete();
            $table->foreignId('customer_id')->constrained()->restrictOnDelete();
            $table->string('customer_name');
            $table->string('company_name')->nullable();
            $table->string('phone');
            $table->string('email')->nullable();
            $table->text('delivery_address');
            $table->string('city');
            $table->string('township')->nullable();
            $table->string('landmark')->nullable();
            $table->unsignedBigInteger('subtotal');
            $table->unsignedBigInteger('discount')->default(0);
            $table->unsignedBigInteger('delivery_fee')->default(0);
            $table->unsignedTinyInteger('service_fee_percentage')->default(0);
            $table->unsignedBigInteger('service_fee')->default(0);
            $table->unsignedBigInteger('total_amount');
            $table->string('payment_method')->default('CASH_ON_DELIVERY');
            $table->string('payment_status')->default('NOT_PAID');
            $table->string('order_status')->default('SUPPLIER_CONFIRMATION_REQUIRED');
            $table->string('delivery_status')->default('NOT_ASSIGNED');
            $table->text('customer_note')->nullable();
            $table->timestamps();

            $table->index('customer_id');
            $table->index('order_status');
            $table->index('payment_status');
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('orders');
    }
};
