<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Variants are optional: a product with no rows here is still a complete,
     * sellable product. Each variant carries its own price and stock snapshot
     * so the parent product does not need to change shape.
     */
    public function up(): void
    {
        Schema::create('product_variants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();

            $table->json('variant_attributes');
            $table->string('attributes_key', 512);
            $table->string('slug')->unique();
            $table->string('sku')->nullable();
            $table->string('photo')->nullable();

            $table->unsignedBigInteger('retail_price')->nullable();
            $table->unsignedBigInteger('wholesale_price')->nullable();
            $table->unsignedBigInteger('discount_price')->nullable();
            $table->unsignedInteger('minimum_order_quantity')->default(1);
            $table->date('price_valid_until')->nullable();
            $table->timestamp('price_updated_at')->nullable();
            $table->foreignId('price_updated_by_admin_id')->nullable()->constrained('admins')->nullOnDelete();

            $table->unsignedInteger('stock_quantity')->nullable();
            $table->string('stock_status')->default('SUPPLIER_CONFIRMATION_REQUIRED');
            $table->timestamp('stock_confirmed_at')->nullable();
            $table->foreignId('stock_confirmed_by_admin_id')->nullable()->constrained('admins')->nullOnDelete();
            $table->text('supplier_note')->nullable();

            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['product_id', 'sort_order']);
            $table->unique(['product_id', 'attributes_key']);
            $table->unique(['product_id', 'sku']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('product_variants');
    }
};
