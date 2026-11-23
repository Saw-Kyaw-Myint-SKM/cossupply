<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * The text-only hero gives each banner its own background palette, and an
     * image is no longer required to publish a banner.
     */
    public function up(): void
    {
        Schema::table('banners', function (Blueprint $table) {
            $table->string('background_style', 20)->default('ink')->after('status');
            $table->string('image')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('banners', function (Blueprint $table) {
            $table->dropColumn('background_style');
            $table->string('image')->nullable(false)->change();
        });
    }
};
