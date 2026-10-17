<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class SettingSeeder extends Seeder
{
    /**
     * The minimum documented master settings.
     *
     * @var array<int, array<string, mixed>>
     */
    private const SETTINGS = [
        [
            'key' => 'company_name',
            'value' => 'CoSupply',
            'value_type' => 'string',
            'group_name' => 'company',
            'label' => 'Company Name',
            'description' => 'Displayed on quotations, orders, and receipts.',
            'is_public' => true,
        ],
        [
            'key' => 'company_phone',
            'value' => '09-000000000',
            'value_type' => 'string',
            'group_name' => 'company',
            'label' => 'Company Phone',
            'description' => 'Public contact phone number of the company.',
            'is_public' => true,
        ],
        [
            'key' => 'company_email',
            'value' => 'info@cos.local',
            'value_type' => 'string',
            'group_name' => 'company',
            'label' => 'Company Email',
            'description' => 'Public contact email address of the company.',
            'is_public' => true,
        ],
        [
            'key' => 'company_address',
            'value' => 'Yangon, Myanmar',
            'value_type' => 'string',
            'group_name' => 'company',
            'label' => 'Company Address',
            'description' => 'Public business address of the company.',
            'is_public' => true,
        ],
        [
            'key' => 'default_currency',
            'value' => 'MMK',
            'value_type' => 'string',
            'group_name' => 'localization',
            'label' => 'Default Currency',
            'description' => 'All monetary values use Myanmar Kyat (MMK).',
            'is_public' => false,
        ],
        [
            'key' => 'timezone',
            'value' => 'Asia/Yangon',
            'value_type' => 'string',
            'group_name' => 'localization',
            'label' => 'Timezone',
            'description' => 'Timezone used for business dates across the system.',
            'is_public' => false,
        ],
        [
            'key' => 'quotation_number_prefix',
            'value' => 'QT',
            'value_type' => 'string',
            'group_name' => 'quotation',
            'label' => 'Quotation Number Prefix',
            'description' => 'Prefix used when generating quotation numbers.',
            'is_public' => false,
        ],
        [
            'key' => 'quotation_validity_days',
            'value' => '7',
            'value_type' => 'integer',
            'group_name' => 'quotation',
            'label' => 'Quotation Validity (Days)',
            'description' => 'Default number of days a sent quotation stays valid.',
            'is_public' => false,
        ],
        [
            'key' => 'quotation_service_fee_percentage',
            'value' => '0',
            'value_type' => 'integer',
            'group_name' => 'quotation',
            'label' => 'Quotation Service Fee (%)',
            'description' => 'Default service fee percentage copied into new quotation versions.',
            'is_public' => false,
        ],
        [
            'key' => 'order_number_prefix',
            'value' => 'ORD',
            'value_type' => 'string',
            'group_name' => 'order',
            'label' => 'Order Number Prefix',
            'description' => 'Prefix used when generating order numbers.',
            'is_public' => false,
        ],
        [
            'key' => 'default_delivery_fee',
            'value' => '0',
            'value_type' => 'integer',
            'group_name' => 'order',
            'label' => 'Default Delivery Fee',
            'description' => 'Default delivery fee in integer MMK for new quotations.',
            'is_public' => false,
        ],
        [
            'key' => 'delivery_fee_mode',
            'value' => 'MANUAL_PER_QUOTATION',
            'value_type' => 'string',
            'group_name' => 'order',
            'label' => 'Delivery Fee Mode',
            'description' => 'Delivery fee is entered manually for each quotation.',
            'is_public' => false,
        ],
        [
            'key' => 'payment_method',
            'value' => 'CASH_ON_DELIVERY',
            'value_type' => 'string',
            'group_name' => 'payment',
            'label' => 'Payment Method',
            'description' => 'MVP supports cash on delivery only.',
            'is_public' => false,
        ],
        [
            'key' => 'require_full_payment',
            'value' => '1',
            'value_type' => 'boolean',
            'group_name' => 'payment',
            'label' => 'Require Full Payment',
            'description' => 'Partial payment is not allowed; full COD amount must be collected.',
            'is_public' => false,
        ],
        [
            'key' => 'require_receipt_number',
            'value' => '1',
            'value_type' => 'boolean',
            'group_name' => 'payment',
            'label' => 'Require Receipt Number',
            'description' => 'Cash collection must record a receipt number.',
            'is_public' => false,
        ],
    ];

    /**
     * Run the database seeds.
     *
     * Idempotent: existing keys are updated, new keys are created.
     */
    public function run(): void
    {
        foreach (self::SETTINGS as $setting) {
            Setting::updateOrCreate(
                ['key' => $setting['key']],
                $setting,
            );
        }

        $this->command->info(count(self::SETTINGS).' master settings seeded.');
    }
}
