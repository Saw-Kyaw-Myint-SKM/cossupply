<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * MVP supports full delivery only; partial delivery is not modelled.
     */
    public function up(): void
    {
        Schema::create('deliveries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->restrictOnDelete();
            $table->foreignId('supplier_id')->nullable()->constrained()->restrictOnDelete();
            $table->string('delivery_contact_name');
            $table->string('delivery_phone');
            $table->text('delivery_address');
            $table->string('city');
            $table->string('township')->nullable();
            $table->string('landmark')->nullable();
            $table->unsignedBigInteger('delivery_fee')->default(0);
            $table->string('delivery_partner')->nullable();
            $table->string('tracking_number')->nullable();
            $table->date('estimated_delivery_date')->nullable();
            $table->timestamp('shipped_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->string('received_by')->nullable();
            $table->text('customer_note')->nullable();
            $table->string('delivery_status')->default('NOT_ASSIGNED');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('deliveries');
    }
};
