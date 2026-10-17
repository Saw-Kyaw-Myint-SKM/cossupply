<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * One request may have many versions. Exactly one version may be the
     * current one; that rule is enforced in application code with a
     * transaction and row lock (no partial unique indexes here).
     */
    public function up(): void
    {
        Schema::create('quotations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quotation_request_id')->constrained()->restrictOnDelete();
            $table->string('quotation_number');
            $table->unsignedInteger('version')->default(1);
            $table->string('status')->default('DRAFT');
            $table->boolean('is_current')->default(false);
            $table->unsignedBigInteger('subtotal');
            $table->unsignedBigInteger('discount')->default(0);
            $table->unsignedBigInteger('delivery_fee')->default(0);
            $table->unsignedTinyInteger('service_fee_percentage')->default(0);
            $table->unsignedBigInteger('service_fee')->default(0);
            $table->unsignedBigInteger('total_amount');
            $table->string('payment_method')->default('CASH_ON_DELIVERY');
            $table->text('payment_terms');
            $table->date('valid_until');
            $table->text('admin_note')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('viewed_at')->nullable();
            $table->timestamp('accepted_at')->nullable();
            $table->timestamp('rejected_at')->nullable();
            $table->foreignId('created_by_admin_id')->constrained('admins')->restrictOnDelete();
            $table->timestamps();

            $table->unique(['quotation_request_id', 'version']);
            $table->index('status');
            $table->index('is_current');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('quotations');
    }
};
