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
        Schema::create('suppliers', function (Blueprint $table) {
            $table->id();
            $table->string('shop_name')->index();
            $table->string('company_name')->nullable();
            $table->string('contact_person');
            $table->string('phone');
            $table->string('viber_phone')->nullable();
            $table->string('email')->nullable();
            $table->string('logo')->nullable();
            $table->text('address');
            $table->string('city');
            $table->string('township')->nullable();
            $table->text('business_description')->nullable();
            $table->string('delivery_area')->nullable();
            $table->string('delivery_time')->nullable();
            $table->text('warranty_policy')->nullable();
            $table->text('return_policy')->nullable();
            $table->string('status')->default('ACTIVE');
            $table->boolean('verified')->default(false);
            $table->foreignId('created_by_admin_id')->constrained('admins')->restrictOnDelete();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('suppliers');
    }
};
