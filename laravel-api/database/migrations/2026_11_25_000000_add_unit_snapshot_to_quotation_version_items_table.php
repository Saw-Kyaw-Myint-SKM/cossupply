<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Freeze the product unit on the quotation version line so a later product
     * edit cannot change what a sent quotation promised. Existing rows stay
     * NULL and fall back to the linked product when rendered.
     */
    public function up(): void
    {
        Schema::table('quotation_version_items', function (Blueprint $table) {
            $table->string('unit_snapshot')->nullable()->after('sku_snapshot');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('quotation_version_items', function (Blueprint $table) {
            $table->dropColumn('unit_snapshot');
        });
    }
};
