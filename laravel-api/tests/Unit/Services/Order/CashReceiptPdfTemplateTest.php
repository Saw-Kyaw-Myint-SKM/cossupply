<?php

namespace Tests\Unit\Services\Order;

use App\Models\CashPayment;
use App\Models\Order;
use App\Models\OrderItem;
use App\Services\Order\CashReceiptPdfTemplate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CashReceiptPdfTemplateTest extends TestCase
{
    use RefreshDatabase;

    public function test_keeps_burmese_customer_delivery_and_item_text_intact(): void
    {
        [$payment, $order] = $this->receipt();

        $html = app(CashReceiptPdfTemplate::class)->html($payment, $order, now());

        $this->assertStringContainsString('ဦးအောင်အောင်', $html);
        $this->assertStringContainsString('ရန်ကုန်', $html);
        $this->assertStringContainsString('တီရှပ်', $html);
    }

    public function test_prints_the_receipt_number_totals_and_payment_rows(): void
    {
        [$payment, $order] = $this->receipt();

        $html = app(CashReceiptPdfTemplate::class)->html($payment, $order, now());

        $this->assertStringContainsString('CASH RECEIPT', $html);
        $this->assertStringContainsString('RCP-2026-0001', $html);
        $this->assertStringContainsString('TOTAL (COD)', $html);
        $this->assertStringContainsString('20,000 MMK', $html);
        $this->assertStringContainsString('PAYMENT RECEIVED', $html);
        $this->assertStringContainsString('Amount collected', $html);
        $this->assertStringContainsString('Partial payment is not accepted.', $html);
    }

    /**
     * @return array{0: CashPayment, 1: Order}
     */
    private function receipt(): array
    {
        $order = Order::factory()
            ->priced(20000)
            ->create([
                'customer_name' => 'ဦးအောင်အောင်',
                'city' => 'ရန်ကုန်',
                'township' => 'လှိုင်',
                'delivery_address' => 'အမှတ် ၁၂၃၊ လှိုင်မြို့နယ်',
            ]);

        OrderItem::factory()
            ->forOrder($order)
            ->create([
                'product_name_snapshot' => 'တီရှပ်',
                'sku_snapshot' => 'SKU-0001',
                'quantity' => 2,
                'unit_price' => 10000,
                'line_total' => 20000,
            ]);

        $payment = CashPayment::factory()
            ->forOrder($order)
            ->confirmed()
            ->create([
                'receipt_number' => 'RCP-2026-0001',
                'note' => 'ကျေးဇူးတင်ပါသည်။',
            ]);

        return [$payment->fresh(), $order->fresh(['items'])];
    }
}
