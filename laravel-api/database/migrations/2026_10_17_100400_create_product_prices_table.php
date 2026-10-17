<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * All amounts are integer MMK values. The table intentionally has no
     * created_at/updated_at pair; product_prices.last_updated_at tracks
     * the last price change instead.
     */
    public function up(): void
    {
        Schema::create('product_prices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->unsignedBigInteger('retail_price');
            $table->unsignedBigInteger('wholesale_price')->nullable();
            $table->unsignedBigInteger('discount_price')->nullable();
            $table->unsignedInteger('minimum_order_quantity')->default(1);
            $table->date('price_valid_until')->nullable();
            $table->timestamp('last_updated_at');
            $table->foreignId('updated_by_admin_id')->constrained('admins')->restrictOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('product_prices');
    }
};
