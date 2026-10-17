<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Final quotation version item snapshot sent to the customer.
     * order_items are copied from these rows only.
     */
    public function up(): void
    {
        Schema::create('quotation_version_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quotation_id')->constrained()->restrictOnDelete();
            $table->foreignId('product_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignId('supplier_id')->nullable()->constrained()->restrictOnDelete();
            $table->string('product_name_snapshot');
            $table->string('sku_snapshot')->nullable();
            $table->text('specification_snapshot')->nullable();
            $table->unsignedInteger('quantity');
            $table->unsignedBigInteger('unit_price');
            $table->unsignedBigInteger('discount')->default(0);
            $table->unsignedBigInteger('line_total');
            $table->date('delivery_date')->nullable();
            $table->text('warranty_note')->nullable();
            $table->text('supplier_note')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('quotation_version_items');
    }
};
