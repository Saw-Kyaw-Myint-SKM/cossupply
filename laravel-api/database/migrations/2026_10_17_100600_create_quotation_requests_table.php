<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * quotation_requests.customer_id is NOT NULL: guests may browse the
     * catalog and keep a cart, but cannot submit a quotation request.
     */
    public function up(): void
    {
        Schema::create('quotation_requests', function (Blueprint $table) {
            $table->id();
            $table->string('quotation_number')->unique();
            $table->foreignId('customer_id')->constrained()->restrictOnDelete();
            $table->string('customer_name');
            $table->string('company_name')->nullable();
            $table->string('phone');
            $table->string('email')->nullable();
            $table->text('delivery_address');
            $table->string('city');
            $table->string('township')->nullable();
            $table->string('landmark')->nullable();
            $table->date('required_delivery_date')->nullable();
            $table->text('customer_note')->nullable();
            $table->string('status')->default('NEW');
            $table->foreignId('assigned_admin_id')->nullable()->constrained('admins')->restrictOnDelete();
            $table->timestamps();

            $table->index('customer_id');
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('quotation_requests');
    }
};
