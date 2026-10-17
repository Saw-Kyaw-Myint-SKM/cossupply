<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\Supplier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductCartAvailabilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_available_for_cart_includes_published_products_with_missing_or_eligible_stock(): void
    {
        $supplier = Supplier::factory()->create();
        $category = Category::factory()->create();

        $eligibleProducts = collect([
            'IN_STOCK',
            'LOW_STOCK',
            'PRE_ORDER',
            'SUPPLIER_CONFIRMATION_REQUIRED',
        ])->map(fn (string $stockStatus): Product => Product::factory()
            ->for($supplier)
            ->for($category)
            ->published()
            ->withStock(['stock_status' => $stockStatus])
            ->create())
            ->push(
                Product::factory()->for($supplier)->for($category)->published()->create(),
            );

        $available = Product::availableForCart()->pluck('id')->all();

        $this->assertEqualsCanonicalizing(
            $eligibleProducts->pluck('id')->all(),
            $available,
        );
    }

    public function test_available_for_cart_excludes_out_of_stock_and_unpublished_products(): void
    {
        $supplier = Supplier::factory()->create();
        $category = Category::factory()->create();

        // Published but the stock record is OUT_OF_STOCK.
        Product::factory()->for($supplier)->for($category)->published()
            ->withStock(['stock_status' => 'OUT_OF_STOCK'])
            ->create();

        // Published without a stock record stays eligible; DRAFT/HIDDEN never are.
        Product::factory()->for($supplier)->for($category)->create();

        Product::factory()->for($supplier)->for($category)->hidden()
            ->withStock(['stock_status' => 'IN_STOCK'])
            ->create();

        // Product-level OUT_OF_STOCK status also excludes it.
        Product::factory()->for($supplier)->for($category)->outOfStock()
            ->withStock(['stock_status' => 'IN_STOCK'])
            ->create();

        $this->assertSame([], Product::availableForCart()->pluck('id')->all());
    }
}
