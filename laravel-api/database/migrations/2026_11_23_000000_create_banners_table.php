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
        Schema::create('banners', function (Blueprint $table) {
            $table->id();
            $table->string('title_mm');
            $table->string('title_en');
            $table->string('subtitle_mm')->nullable();
            $table->string('subtitle_en')->nullable();
            $table->string('cta_label_mm', 60)->nullable();
            $table->string('cta_label_en', 60)->nullable();
            $table->string('link_url', 2048)->nullable();
            $table->string('image');
            $table->unsignedInteger('sort_order')->default(0);
            $table->string('status')->default('ACTIVE');
            $table->timestamps();

            $table->index(['status', 'sort_order']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('banners');
    }
};
