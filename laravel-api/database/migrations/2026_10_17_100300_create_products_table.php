<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('supplier_id')->constrained()->restrictOnDelete();
            $table->foreignId('category_id')->constrained()->restrictOnDelete();
            $table->string('name_mm');
            $table->string('name_en')->nullable();
            $table->string('slug')->unique();
            $table->string('sku')->nullable();
            $table->string('brand')->nullable();
            $table->string('model')->nullable();
            $table->text('description')->nullable();
            $table->text('specification')->nullable();
            $table->string('size')->nullable();
            $table->string('color')->nullable();
            $table->string('unit');
            $table->string('package_size')->nullable();
            $table->string('photo');
            $table->string('status')->default('DRAFT');
            $table->foreignId('created_by_admin_id')->constrained('admins')->restrictOnDelete();
            $table->timestamps();

            $table->index('category_id');
            $table->index('supplier_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
