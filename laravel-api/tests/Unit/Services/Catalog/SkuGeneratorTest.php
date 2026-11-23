<?php

namespace Tests\Unit\Services\Catalog;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\Catalog\SkuGenerator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SkuGeneratorTest extends TestCase
{
    use RefreshDatabase;

    public function test_product_sku_starts_with_the_english_name_and_ends_with_a_four_character_code(): void
    {
        $sku = $this->generator(['7K2P'])->generateForProduct([
            'name_en' => 'Office Chair',
            'brand' => 'Acme',
            'model' => 'M-1',
        ]);

        $this->assertSame('OFFICE-CHAIR-7K2P', $sku);
    }

    public function test_product_sku_falls_back_to_brand_then_model_then_sku(): void
    {
        $this->assertSame(
            'ACME-A1B2',
            $this->generator(['A1B2'])->generateForProduct(['name_en' => '', 'brand' => 'Acme', 'model' => 'M-1']),
        );

        $this->assertSame(
            'MODEL-M1-C3D4',
            $this->generator(['C3D4'])->generateForProduct(['model' => 'Model M1']),
        );

        // A product with no ASCII in name, brand or model still gets a code.
        $this->assertSame(
            'SKU-E5F6',
            $this->generator(['E5F6'])->generateForProduct(['name_mm' => 'မြန်မာစာ']),
        );
    }

    public function test_product_sku_skips_stored_codes_and_counts_when_they_keep_colliding(): void
    {
        Product::factory()->create(['sku' => 'OFFICE-CHAIR-AAAA']);
        Product::factory()->create(['sku' => 'OFFICE-CHAIR-BBBB']);

        $this->assertSame(
            'OFFICE-CHAIR-CCCC',
            $this->generator(['AAAA', 'BBBB', 'CCCC'])->generateForProduct(['name_en' => 'Office Chair']),
        );

        // A generator that can only ever produce a taken code counts instead.
        $this->assertSame(
            'OFFICE-CHAIR-1',
            $this->generator([])->generateForProduct(['name_en' => 'Office Chair']),
        );
    }

    public function test_variant_sku_combines_the_product_sku_and_the_variant_name(): void
    {
        $product = Product::factory()->create(['sku' => 'CHAIR-001']);

        $sku = $this->generator()->generateForVariant([
            'variant_name' => 'Red / M',
            'variant_index' => 1,
        ], $product);

        $this->assertSame('CHAIR-001-RED-M', $sku);
    }

    public function test_variant_sku_prefers_the_sku_still_in_the_form_over_the_stored_one(): void
    {
        $product = Product::factory()->create(['sku' => 'CHAIR-001']);

        $sku = $this->generator()->generateForVariant([
            'base' => 'CHAIR-002',
            'variant_name' => 'Red',
        ], $product);

        $this->assertSame('CHAIR-002-RED', $sku);
    }

    public function test_variant_sku_avoids_codes_in_the_form_and_in_the_database(): void
    {
        $product = Product::factory()->create(['sku' => 'CHAIR-001']);

        // Rows typed into the same form but not saved yet.
        $this->assertSame(
            'CHAIR-001-RED-M-2',
            $this->generator()->generateForVariant([
                'variant_name' => 'Red / M',
                'existing_skus' => ['CHAIR-001-RED-M'],
            ], $product),
        );

        // The same rows, compared the way MySQL's unique index would.
        $this->assertSame(
            'CHAIR-001-RED-M-2',
            $this->generator()->generateForVariant([
                'variant_name' => 'Red / M',
                'existing_skus' => ['chair-001-red-m'],
            ], $product),
        );

        // The stored row.
        $variant = ProductVariant::factory()->create([
            'product_id' => $product->id,
            'sku' => 'CHAIR-001-RED-M',
        ]);

        $this->assertSame(
            'CHAIR-001-RED-M-2',
            $this->generator()->generateForVariant(['variant_name' => 'Red / M'], $product),
        );

        // Regenerating this very row's code must not treat it as taken.
        $this->assertSame(
            'CHAIR-001-RED-M',
            $this->generator()->generateForVariant([
                'variant_name' => 'Red / M',
                'exclude_variant_id' => $variant->id,
            ], $product),
        );
    }

    public function test_variant_sku_counts_from_the_row_number_when_the_name_has_no_ascii_characters(): void
    {
        $product = Product::factory()->create(['sku' => 'CHAIR-001']);

        $sku = $this->generator()->generateForVariant([
            'variant_name' => 'အနီ',
            'variant_index' => 3,
        ], $product);

        $this->assertSame('CHAIR-001-V3', $sku);

        // A mixed label is not Latin-authored either: no half-transliterated
        // fragments end up in a code admins have to read.
        $this->assertSame(
            'CHAIR-001-V4',
            $this->generator()->generateForVariant([
                'variant_name' => 'အနီ / M',
                'variant_index' => 4,
            ], $product),
        );
    }

    public function test_product_sku_folds_diacritics_but_not_other_scripts(): void
    {
        $this->assertSame(
            'CAFE-TABLE-A1B2',
            $this->generator(['A1B2'])->generateForProduct(['name_en' => 'Café Table']),
        );

        // A Burmese-only name_en must not become a mangled prefix: the model
        // is Latin, so it takes over.
        $this->assertSame(
            'MDL-1-C3D4',
            $this->generator(['C3D4'])->generateForProduct(['name_en' => 'ကုန်ပစ္စည်း', 'model' => 'MDL 1']),
        );
    }

    public function test_variant_sku_falls_back_to_the_product_name(): void
    {
        $product = Product::factory()->create(['sku' => null, 'name_en' => 'Office Chair']);

        $sku = $this->generator()->generateForVariant([
            'variant_name' => 'Blue',
        ], $product);

        $this->assertSame('OFFICE-CHAIR-BLUE', $sku);
    }

    public function test_variant_sku_stays_within_the_column_length(): void
    {
        $product = Product::factory()->create(['sku' => 'CHAIR-001']);

        $sku = $this->generator()->generateForVariant([
            'base' => str_repeat('A', 100),
            'variant_name' => str_repeat('B', 255),
        ], $product);

        $this->assertSame(100, strlen($sku));
        $this->assertSame(str_repeat('A', 9).'-'.str_repeat('B', 90), $sku);
    }

    /**
     * Generator driven by a fixed code sequence; an exhausted sequence keeps
     * returning the last code so the counting path can be exercised.
     *
     * @param  list<string>  $codes
     */
    private function generator(array $codes = []): SkuGenerator
    {
        return new class($codes) extends SkuGenerator
        {
            /** @var list<string> */
            private array $codes;

            /** @param list<string> $codes */
            public function __construct(array $codes)
            {
                $this->codes = $codes;
            }

            protected function randomCode(): string
            {
                $code = array_shift($this->codes);

                return $code ?? 'AAAA';
            }
        };
    }
}
