<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Give each variant a directly editable name. Existing rows are
     * backfilled from their attribute map so they keep a readable label.
     */
    public function up(): void
    {
        Schema::table('product_variants', function (Blueprint $table) {
            $table->string('name')->nullable()->after('id');
        });

        DB::table('product_variants')
            ->orderBy('id')
            ->chunkById(100, function ($variants): void {
                foreach ($variants as $variant) {
                    $attributes = json_decode((string) $variant->variant_attributes, true);
                    $attributes = is_array($attributes) ? $attributes : [];

                    $label = collect($attributes)
                        ->map(fn ($value, $key): string => "{$key}: {$value}")
                        ->implode(', ');

                    DB::table('product_variants')
                        ->where('id', $variant->id)
                        ->update(['name' => $label !== '' ? $label : 'Variant '.$variant->id]);
                }
            });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('product_variants', function (Blueprint $table) {
            $table->dropColumn('name');
        });
    }
};
