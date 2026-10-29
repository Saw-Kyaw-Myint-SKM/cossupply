<?php

namespace Database\Seeders;

use App\Enums\DeliveryStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Enums\ProductStatus;
use App\Enums\QuotationAction as QuotationActionEnum;
use App\Enums\QuotationRequestStatus;
use App\Enums\QuotationVersionStatus;
use App\Enums\StockStatus;
use App\Enums\SupplierStatus;
use App\Models\Admin;
use App\Models\AuditLog;
use App\Models\CashPayment;
use App\Models\Category;
use App\Models\Customer;
use App\Models\CustomerAddress;
use App\Models\Delivery;
use App\Models\EmailLog;
use App\Models\Notification;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStatusHistory;
use App\Models\Product;
use App\Models\ProductPrice;
use App\Models\ProductStock;
use App\Models\Quotation;
use App\Models\QuotationAction;
use App\Models\QuotationItem;
use App\Models\QuotationPdf;
use App\Models\QuotationRequest;
use App\Models\QuotationVersionItem;
use App\Models\Supplier;
use App\Models\SupplierCommunication;
use App\Services\Order\OrderNumberGenerator;
use App\Services\Quotation\QuotationNumberGenerator;
use Illuminate\Database\Seeder;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Deterministic demo/fake dataset covering every table in
 * specification/DatabaseFlow.md so Tasks 06-11 can be built and QA'd
 * against realistic data.
 *
 * Local/testing only. It truncates and rebuilds the 22 mutable domain
 * tables on every run to keep ids stable (1, 2, 3, ...). The `admins`
 * and `settings` tables are never truncated: the `AdminSeeder` super
 * admin and the master settings must survive.
 */
class DemoDataSeeder extends Seeder
{
    /**
     * Fixed faker seed so every run produces the same values.
     */
    private const FAKER_SEED = 20261018;

    /**
     * Resolved lazily because the seeder is also instantiated with
     * `new` (no constructor arguments) beside the DI container.
     */
    private ?QuotationNumberGenerator $quotationNumbers = null;

    private ?OrderNumberGenerator $orderNumbers = null;

    private function quotationNumbers(): QuotationNumberGenerator
    {
        return $this->quotationNumbers ??= app(QuotationNumberGenerator::class);
    }

    private function orderNumbers(): OrderNumberGenerator
    {
        return $this->orderNumbers ??= app(OrderNumberGenerator::class);
    }

    /**
     * Number of placeholder images written to the public disk.
     */
    private const PRODUCT_IMAGE_COUNT = 6;

    private const SUPPLIER_LOGO_COUNT = 8;

    /**
     * The 22 mutable domain tables, in FK-safe truncate order (children
     * before parents). `admins` and `settings` are intentionally absent.
     *
     * @var list<string>
     */
    private const TRUNCATABLE_TABLES = [
        'notifications',
        'email_logs',
        'audit_logs',
        'order_status_histories',
        'cash_payments',
        'deliveries',
        'order_items',
        'orders',
        'quotation_actions',
        'quotation_pdfs',
        'quotation_version_items',
        'quotations',
        'supplier_communications',
        'quotation_items',
        'quotation_requests',
        'product_stocks',
        'product_prices',
        'products',
        'suppliers',
        'customer_addresses',
        'customers',
        'categories',
    ];

    /**
     * Two extra demo admins added on top of the default super admin.
     *
     * @var list<array<string, string>>
     */
    private const DEMO_ADMINS = [
        ['email' => 'admin.demo@cos.local', 'name' => 'Demo Admin', 'phone' => '09111111111', 'role' => 'admin'],
        ['email' => 'ops.demo@cos.local', 'name' => 'Ops Admin', 'phone' => '09222222222', 'role' => 'admin'],
    ];

    /**
     * Four parent categories.
     *
     * @var list<array<string, mixed>>
     */
    private const PARENT_CATEGORIES = [
        ['name_mm' => 'အီလက်ထရောနစ်', 'name_en' => 'Electronics', 'slug' => 'electronics', 'sort_order' => 1, 'status' => Category::STATUS_ACTIVE],
        ['name_mm' => 'အိမ်သုံးပစ္စည်း', 'name_en' => 'Home & Living', 'slug' => 'home-living', 'sort_order' => 2, 'status' => Category::STATUS_ACTIVE],
        ['name_mm' => 'ရုံးသုံးပစ္စည်း', 'name_en' => 'Office Supplies', 'slug' => 'office-supplies', 'sort_order' => 3, 'status' => Category::STATUS_ACTIVE],
        ['name_mm' => 'ဆောက်လုပ်ရေးပစ္စည်း', 'name_en' => 'Construction Materials', 'slug' => 'construction-materials', 'sort_order' => 4, 'status' => Category::STATUS_ACTIVE],
    ];

    /**
     * Eight child categories. `parent_slug` links to a parent; one child
     * (Furniture) is inactive to exercise the public visibility filter.
     *
     * @var list<array<string, mixed>>
     */
    private const CHILD_CATEGORIES = [
        ['parent_slug' => 'electronics', 'name_mm' => 'မိုဘိုင်းဆက်စပ်', 'name_en' => 'Mobile Accessories', 'slug' => 'mobile-accessories', 'sort_order' => 1, 'status' => Category::STATUS_ACTIVE],
        ['parent_slug' => 'electronics', 'name_mm' => 'ကွန်ပျူတာဆက်စပ်', 'name_en' => 'Computer Peripherals', 'slug' => 'computer-peripherals', 'sort_order' => 2, 'status' => Category::STATUS_ACTIVE],
        ['parent_slug' => 'home-living', 'name_mm' => 'မီးဖိုချောင်ပစ္စည်း', 'name_en' => 'Kitchenware', 'slug' => 'kitchenware', 'sort_order' => 1, 'status' => Category::STATUS_ACTIVE],
        ['parent_slug' => 'home-living', 'name_mm' => 'ပရိဘောဂ', 'name_en' => 'Furniture', 'slug' => 'furniture', 'sort_order' => 2, 'status' => Category::STATUS_INACTIVE],
        ['parent_slug' => 'office-supplies', 'name_mm' => 'စာရေးကိရိယာ', 'name_en' => 'Stationery', 'slug' => 'stationery', 'sort_order' => 1, 'status' => Category::STATUS_ACTIVE],
        ['parent_slug' => 'office-supplies', 'name_mm' => 'ပရင်တာဆက်စပ်', 'name_en' => 'Printer Consumables', 'slug' => 'printer-consumables', 'sort_order' => 2, 'status' => Category::STATUS_ACTIVE],
        ['parent_slug' => 'construction-materials', 'name_mm' => 'လျှပ်စစ်ကိရိယာ', 'name_en' => 'Power Tools', 'slug' => 'power-tools', 'sort_order' => 1, 'status' => Category::STATUS_ACTIVE],
        ['parent_slug' => 'construction-materials', 'name_mm' => 'လုံခြုံရေးပစ္စည်း', 'name_en' => 'Safety Equipment', 'slug' => 'safety-equipment', 'sort_order' => 2, 'status' => Category::STATUS_ACTIVE],
    ];

    /**
     * Eight suppliers with full business fields.
     *
     * @var list<array<string, mixed>>
     */
    private const SUPPLIERS = [
        [
            'shop_name' => 'Yangon Electronics Trading',
            'company_name' => 'Yangon Electronics Co., Ltd.',
            'contact_person' => 'U Myint Aung',
            'phone' => '09310000001',
            'viber_phone' => '09310000001',
            'email' => 'sales@yangon-electronics.demo',
            'logo' => 1,
            'address' => 'No. 25, Bo Gyoke Road, Pabedan',
            'city' => 'Yangon',
            'township' => 'Pabedan',
            'business_description' => 'Wholesale distributor of consumer electronics and mobile accessories.',
            'delivery_area' => 'Yangon metropolitan area',
            'delivery_time' => '1-2 business days',
            'warranty_policy' => '12-month manufacturer warranty on all sealed products.',
            'return_policy' => '7-day return for factory defects with original packaging.',
            'status' => SupplierStatus::ACTIVE->value,
            'verified' => true,
        ],
        [
            'shop_name' => 'Mandalay Home Mart',
            'company_name' => 'Mandalay Home Mart Co., Ltd.',
            'contact_person' => 'Daw Hla Hla',
            'phone' => '09310000002',
            'viber_phone' => '09310000002',
            'email' => 'order@mandalay-homemart.demo',
            'logo' => 2,
            'address' => 'Block 4, 78th Street, Chan Aye Tharzan',
            'city' => 'Mandalay',
            'township' => 'Chan Aye Tharzan',
            'business_description' => 'Household and kitchenware supplier for retail and HORECA buyers.',
            'delivery_area' => 'Mandalay, Naypyidaw',
            'delivery_time' => '2-4 business days',
            'warranty_policy' => 'Replacement within 3 days for transit damage.',
            'return_policy' => 'Return accepted for unopened cartons only.',
            'status' => SupplierStatus::ACTIVE->value,
            'verified' => true,
        ],
        [
            'shop_name' => 'Thiri Office Supply',
            'company_name' => 'Thiri Office Supply Co., Ltd.',
            'contact_person' => 'U Ko Ko Naing',
            'phone' => '09310000003',
            'viber_phone' => '09310000003',
            'email' => 'hello@thiri-office.demo',
            'logo' => 3,
            'address' => 'No. 102, University Avenue, Kamayut',
            'city' => 'Yangon',
            'township' => 'Kamayut',
            'business_description' => 'Office stationery, printer consumables and corporate supply contracts.',
            'delivery_area' => 'Yangon',
            'delivery_time' => '1 business day',
            'warranty_policy' => 'Toner cartridges guaranteed against leakage for 30 days.',
            'return_policy' => 'Sealed items returnable within 14 days.',
            'status' => SupplierStatus::ACTIVE->value,
            'verified' => true,
        ],
        [
            'shop_name' => 'Shwe Construction Supply',
            'company_name' => 'Shwe Construction Supply Co., Ltd.',
            'contact_person' => 'U Zaw Min',
            'phone' => '09310000004',
            'viber_phone' => '09310000004',
            'email' => 'supply@shwe-construction.demo',
            'logo' => 4,
            'address' => 'Plot 17, Bayint Naung Road, Insein',
            'city' => 'Yangon',
            'township' => 'Insein',
            'business_description' => 'Power tools, safety equipment and construction consumables.',
            'delivery_area' => 'Nationwide',
            'delivery_time' => '3-5 business days',
            'warranty_policy' => '6-month warranty on power tools from date of invoice.',
            'return_policy' => 'Defective tools replaced within 7 days.',
            'status' => SupplierStatus::ACTIVE->value,
            'verified' => true,
        ],
        [
            'shop_name' => 'Ayeyar Digital World',
            'company_name' => 'Ayeyar Digital World',
            'contact_person' => 'Daw Su Su Kyi',
            'phone' => '09310000005',
            'viber_phone' => '09310000005',
            'email' => 'info@ayeyar-digital.demo',
            'logo' => null,
            'address' => 'No. 8, Bogyoke Street, Hlaing',
            'city' => 'Yangon',
            'township' => 'Hlaing',
            'business_description' => 'Authorised reseller of computer peripherals and audio devices.',
            'delivery_area' => 'Yangon',
            'delivery_time' => '1-3 business days',
            'warranty_policy' => 'Manufacturer warranty terms apply.',
            'return_policy' => 'Return within 7 days for DOA units.',
            'status' => SupplierStatus::ACTIVE->value,
            'verified' => false,
        ],
        [
            'shop_name' => 'Naypyidaw Kitchen House',
            'company_name' => 'Naypyidaw Kitchen House Co., Ltd.',
            'contact_person' => 'U Aye Lwin',
            'phone' => '09310000006',
            'viber_phone' => '09310000006',
            'email' => 'chef@npt-kitchen.demo',
            'logo' => 6,
            'address' => 'No. 3, Yazathingaha Road, Zabuthiri',
            'city' => 'Naypyidaw',
            'township' => 'Zabuthiri',
            'business_description' => 'Commercial kitchenware and stainless steel cookware supplier.',
            'delivery_area' => 'Naypyidaw, Mandalay',
            'delivery_time' => '2-3 business days',
            'warranty_policy' => 'Craftsmanship warranty for 60 days.',
            'return_policy' => 'Return for damage on arrival within 48 hours.',
            'status' => SupplierStatus::ACTIVE->value,
            'verified' => true,
        ],
        [
            'shop_name' => 'Hlaing Safety Depot',
            'company_name' => null,
            'contact_person' => 'U Thura Aung',
            'phone' => '09310000007',
            'viber_phone' => null,
            'email' => null,
            'logo' => null,
            'address' => 'No. 44, Insein Road, Hlaing',
            'city' => 'Yangon',
            'township' => 'Hlaing',
            'business_description' => 'Personal protective equipment and site safety supplies.',
            'delivery_area' => 'Yangon',
            'delivery_time' => '2 business days',
            'warranty_policy' => 'Not applicable for consumable safety gear.',
            'return_policy' => 'No return on opened safety equipment.',
            'status' => SupplierStatus::INACTIVE->value,
            'verified' => false,
        ],
        [
            'shop_name' => 'Bago Tool Center',
            'company_name' => 'Bago Tool Center Co., Ltd.',
            'contact_person' => 'Daw Nwe Nwe',
            'phone' => '09310000008',
            'viber_phone' => '09310000008',
            'email' => 'tools@bago-toolcenter.demo',
            'logo' => 8,
            'address' => 'No. 61, Yangon-Mandalay Highway, Bago',
            'city' => 'Bago',
            'township' => 'Bago',
            'business_description' => 'Hand tools, power tools and workshop equipment wholesaler.',
            'delivery_area' => 'Nationwide',
            'delivery_time' => '3-6 business days',
            'warranty_policy' => '90-day warranty against manufacturing defects.',
            'return_policy' => 'Replacement for defective goods within 14 days.',
            'status' => SupplierStatus::ACTIVE->value,
            'verified' => true,
        ],
    ];

    /**
     * Product blueprints cycled to build the ~48 product catalog.
     *
     * Each blueprint: [name_en, name_mm, category_slug, brand, unit].
     *
     * @var list<array<string, string>>
     */
    private const PRODUCT_BLUEPRINTS = [
        ['name_en' => 'USB-C Fast Charger 30W', 'name_mm' => 'USB-C အမြန်အားသွင်းစက် 30W', 'category_slug' => 'mobile-accessories', 'brand' => 'Anker', 'unit' => 'pcs'],
        ['name_en' => 'Wireless Optical Mouse', 'name_mm' => 'ကြိုးမဲ့ အော်ပတီကယ် မောက်စ်', 'category_slug' => 'computer-peripherals', 'brand' => 'Logitech', 'unit' => 'pcs'],
        ['name_en' => 'Stainless Steel Stock Pot', 'name_mm' => 'စတီးအိုးကြီး', 'category_slug' => 'kitchenware', 'brand' => 'Zebra', 'unit' => 'pcs'],
        ['name_en' => 'A4 Spiral Notebook', 'name_mm' => 'A4 မှတ်စုစာအုပ်', 'category_slug' => 'stationery', 'brand' => 'Elephant', 'unit' => 'pack'],
        ['name_en' => 'Laser Toner Cartridge', 'name_mm' => 'လေဆာ တိုနာကာထရစ်', 'category_slug' => 'printer-consumables', 'brand' => 'HP', 'unit' => 'pcs'],
        ['name_en' => 'Cordless Impact Drill', 'name_mm' => 'ကြိုးမဲ့ လျှပ်စစ်တူးစက်', 'category_slug' => 'power-tools', 'brand' => 'Bosch', 'unit' => 'pcs'],
        ['name_en' => 'Industrial Safety Helmet', 'name_mm' => 'လုပ်ငန်းသုံး ခေါင်းအုံး', 'category_slug' => 'safety-equipment', 'brand' => '3M', 'unit' => 'pcs'],
        ['name_en' => 'Bluetooth Earbuds Pro', 'name_mm' => 'ဘလူးတုသ် နားကြပ် Pro', 'category_slug' => 'mobile-accessories', 'brand' => 'Sony', 'unit' => 'pcs'],
    ];

    /**
     * Catalog size: ~40 published, 3 draft, 3 hidden, 2 out of stock.
     */
    private const PRODUCT_COUNT = 48;

    private const PUBLISHED_PRODUCT_COUNT = 40;

    /**
     * Five demo customers. The second is a business customer.
     *
     * @var list<array<string, mixed>>
     */
    private const CUSTOMERS = [
        ['name' => 'Aung Aung', 'company_name' => null, 'email' => 'customer1@cos.local', 'phone' => '09100000001', 'customer_type' => 'individual'],
        ['name' => 'Su Su Trading', 'company_name' => 'Su Su Trading Co., Ltd.', 'email' => 'customer2@cos.local', 'phone' => '09100000002', 'customer_type' => 'business'],
        ['name' => 'Kyaw Kyaw', 'company_name' => null, 'email' => 'customer3@cos.local', 'phone' => '09100000003', 'customer_type' => 'individual'],
        ['name' => 'Nilar Win', 'company_name' => null, 'email' => 'customer4@cos.local', 'phone' => '09100000004', 'customer_type' => 'individual'],
        ['name' => 'Zaw Zaw', 'company_name' => null, 'email' => 'customer5@cos.local', 'phone' => '09100000005', 'customer_type' => 'individual'],
    ];

    /**
     * Quotation request statuses for the 12 demo requests.
     *
     * @var array<int, QuotationRequestStatus>
     */
    private const REQUEST_STATUSES = [
        1 => QuotationRequestStatus::NEW,
        2 => QuotationRequestStatus::CONTACTING_SUPPLIER,
        3 => QuotationRequestStatus::SUPPLIER_RESPONSE_PENDING,
        4 => QuotationRequestStatus::PREPARING_QUOTATION,
        5 => QuotationRequestStatus::QUOTATION_SENT,
        6 => QuotationRequestStatus::CUSTOMER_REVIEWING,
        7 => QuotationRequestStatus::CHANGE_REQUESTED,
        8 => QuotationRequestStatus::ACCEPTED,
        9 => QuotationRequestStatus::ACCEPTED,
        10 => QuotationRequestStatus::REJECTED,
        11 => QuotationRequestStatus::EXPIRED,
        12 => QuotationRequestStatus::CANCELLED,
    ];

    /**
     * Run the demo data seeds.
     */
    public function run(): void
    {
        // `db:seed --class=DemoDataSeeder` bypasses the DatabaseSeeder env
        // guard, so guard here as well.
        if (app()->environment('production')) {
            throw new RuntimeException('DemoDataSeeder is restricted to local/testing environments and must not run in production.');
        }

        fake()->seed(self::FAKER_SEED);

        $this->writePlaceholderMedia();

        Schema::disableForeignKeyConstraints();

        try {
            foreach (self::TRUNCATABLE_TABLES as $table) {
                DB::table($table)->truncate();
            }

            $admins = $this->seedAdmins();
            $categories = $this->seedCategories();
            $suppliers = $this->seedSuppliers($admins);
            $products = $this->seedProducts($admins, $categories, $suppliers);
            $catalog = $this->seedProductPricesAndStocks($products, $admins);
            $customers = $this->seedCustomers();
            $this->seedCustomerAddresses($customers);
            $requests = $this->seedQuotationRequests($admins, $customers);
            $this->seedQuotationItems($requests, $products, $catalog['prices'], $catalog['stocks']);
            $this->seedSupplierCommunications($requests, $suppliers, $admins);
            $quotations = $this->seedQuotations($admins, $requests, $products, $catalog['prices']);
            $this->seedQuotationPdfs($quotations, $admins);
            $this->seedQuotationActions($quotations, $customers);
            $orders = $this->seedOrders();
            $this->seedOrderItems($orders);
            $this->seedOrderStatusHistories($orders, $admins);
            $this->seedDeliveriesAndPayments($orders);
            $this->seedNotifications($admins, $customers, $quotations, $orders, $requests);
            $this->seedEmailLogs($quotations, $orders);
            $this->seedAuditLogs($admins, $products, $suppliers);
        } finally {
            Schema::enableForeignKeyConstraints();
        }

        $this->reportRowCounts();
    }

    /**
     * Write real placeholder media files to the public disk.
     *
     * Product photos come from the remote demo photo (a real product
     * shot); supplier logos use a small embedded base64 PNG so the
     * seeder never depends on GD or an image package.
     */
    private function writePlaceholderMedia(): void
    {
        $disk = Storage::disk('public');

        $productImageBytes = $this->fetchProductImage();

        for ($i = 1; $i <= self::PRODUCT_IMAGE_COUNT; $i++) {
            $disk->put('products/demo-product-'.$i.'.png', $productImageBytes);
        }

        for ($i = 1; $i <= self::SUPPLIER_LOGO_COUNT; $i++) {
            $disk->put('suppliers/demo-logo-'.$i.'.png', $this->decodePng(self::SUPPLIER_LOGO_BASE64));
        }
    }

    /**
     * Fetch the demo product photo, falling back to the embedded PNG.
     *
     * A failed fetch (offline box, CDN hiccup) must never hard-fail the
     * seed run — the 16x16 fallback keeps the fixtures valid instead.
     */
    private function fetchProductImage(): string
    {
        $fallback = $this->decodePng(self::PRODUCT_IMAGE_BASE64);

        try {
            $response = Http::timeout(15)->get(self::PRODUCT_IMAGE_URL);

            if ($response->failed()) {
                return $fallback;
            }

            $bytes = $response->body();

            // PNG magic number: reject HTML error pages or empty bodies.
            if (! str_starts_with($bytes, "\x89PNG\r\n\x1a\n")) {
                return $fallback;
            }

            return $bytes;
        } catch (ConnectionException|RequestException) {
            $this->command?->warn('Demo product photo download failed; using the embedded placeholder instead.');

            return $fallback;
        }
    }

    /**
     * Decode an embedded base64 PNG into binary image bytes.
     */
    private function decodePng(string $base64): string
    {
        $binary = base64_decode($base64, true);

        if ($binary === false) {
            throw new RuntimeException('Embedded placeholder image is not valid base64.');
        }

        return $binary;
    }

    /**
     * Add the two extra demo admins, leaving existing admins untouched.
     *
     * @return list<Admin>
     */
    private function seedAdmins(): array
    {
        foreach (self::DEMO_ADMINS as $admin) {
            Admin::updateOrCreate(
                ['email' => $admin['email']],
                [
                    'name' => $admin['name'],
                    'phone' => $admin['phone'],
                    'password' => Hash::make('password'),
                    'role' => $admin['role'],
                    'status' => 'active',
                ],
            );
        }

        return Admin::query()->orderBy('id')->get()->all();
    }

    /**
     * Seed 4 parent and 8 child categories.
     *
     * @return array{parents: array<string, Category>, children: array<string, Category>}
     */
    private function seedCategories(): array
    {
        $parents = [];

        foreach (self::PARENT_CATEGORIES as $parent) {
            $parents[$parent['slug']] = Category::create([
                'parent_id' => null,
                'name_mm' => $parent['name_mm'],
                'name_en' => $parent['name_en'],
                'slug' => $parent['slug'],
                'description' => $parent['name_en'].' catalog category.',
                'image' => null,
                'sort_order' => $parent['sort_order'],
                'status' => $parent['status'],
            ]);
        }

        $children = [];

        foreach (self::CHILD_CATEGORIES as $child) {
            $children[$child['slug']] = Category::create([
                'parent_id' => $parents[$child['parent_slug']]->id,
                'name_mm' => $child['name_mm'],
                'name_en' => $child['name_en'],
                'slug' => $child['slug'],
                'description' => $child['name_en'].' sub-category.',
                'image' => null,
                'sort_order' => $child['sort_order'],
                'status' => $child['status'],
            ]);
        }

        return ['parents' => $parents, 'children' => $children];
    }

    /**
     * Seed 8 suppliers with full business fields and logos.
     *
     * @param  list<Admin>  $admins
     * @return list<Supplier>
     */
    private function seedSuppliers(array $admins): array
    {
        $suppliers = [];

        foreach (self::SUPPLIERS as $index => $data) {
            $suppliers[] = Supplier::create([
                'shop_name' => $data['shop_name'],
                'company_name' => $data['company_name'],
                'contact_person' => $data['contact_person'],
                'phone' => $data['phone'],
                'viber_phone' => $data['viber_phone'],
                'email' => $data['email'],
                'logo' => $data['logo'] !== null ? 'suppliers/demo-logo-'.$data['logo'].'.png' : null,
                'address' => $data['address'],
                'city' => $data['city'],
                'township' => $data['township'],
                'business_description' => $data['business_description'],
                'delivery_area' => $data['delivery_area'],
                'delivery_time' => $data['delivery_time'],
                'warranty_policy' => $data['warranty_policy'],
                'return_policy' => $data['return_policy'],
                'status' => $data['status'],
                'verified' => $data['verified'],
                'created_by_admin_id' => $admins[$index % count($admins)]->id,
            ]);
        }

        return $suppliers;
    }

    /**
     * Seed the catalog across categories and suppliers.
     *
     * @param  list<Admin>  $admins
     * @param  array{parents: array<string, Category>, children: array<string, Category>}  $categories
     * @param  list<Supplier>  $suppliers
     * @return list<Product>
     */
    private function seedProducts(array $admins, array $categories, array $suppliers): array
    {
        $products = [];
        $sizes = ['S', 'M', 'L', 'XL'];
        $colors = ['Black', 'White', 'Blue', 'Red', 'Silver'];

        for ($i = 0; $i < self::PRODUCT_COUNT; $i++) {
            $blueprint = self::PRODUCT_BLUEPRINTS[$i % count(self::PRODUCT_BLUEPRINTS)];
            $model = 'MDL-'.str_pad((string) ($i + 1), 4, '0', STR_PAD_LEFT);
            $supplier = $suppliers[$i % count($suppliers)];

            $products[] = Product::create([
                'supplier_id' => $supplier->id,
                'category_id' => $categories['children'][$blueprint['category_slug']]->id,
                'name_mm' => $blueprint['name_mm'].' '.$model,
                'name_en' => $blueprint['name_en'].' '.$model,
                'slug' => Str::slug($blueprint['name_en']).'-'.strtolower($model),
                'sku' => 'SKU-'.str_pad((string) ($i + 1), 4, '0', STR_PAD_LEFT),
                'brand' => $blueprint['brand'],
                'model' => $model,
                'description' => fake()->paragraph(),
                'specification' => fake()->sentence(),
                'size' => $sizes[$i % count($sizes)],
                'color' => $colors[$i % count($colors)],
                'unit' => $blueprint['unit'],
                'package_size' => $blueprint['unit'] === 'pack' ? '10' : '1',
                'photo' => $this->productPhoto($i),
                'status' => $this->productStatus($i),
                'created_by_admin_id' => $admins[$i % count($admins)]->id,
            ]);
        }

        return $products;
    }

    /**
     * Resolve the stored photo path for a product index.
     *
     * The last four published products intentionally have no photo so the
     * UI empty state can be exercised. `products.photo` is NOT NULL, so
     * the empty state is an empty string, which the public resource maps
     * to a null photo_url.
     */
    private function productPhoto(int $index): string
    {
        $isPublished = $index < self::PUBLISHED_PRODUCT_COUNT;
        $isPhotoEmptyStateSample = $index >= (self::PUBLISHED_PRODUCT_COUNT - 4) && $isPublished;

        if ($isPhotoEmptyStateSample) {
            return '';
        }

        return 'products/demo-product-'.(($index % self::PRODUCT_IMAGE_COUNT) + 1).'.png';
    }

    /**
     * Resolve the product status for a product index.
     */
    private function productStatus(int $index): string
    {
        return match (true) {
            $index < 40 => ProductStatus::PUBLISHED->value,
            $index < 43 => ProductStatus::DRAFT->value,
            $index < 46 => ProductStatus::HIDDEN->value,
            default => ProductStatus::OUT_OF_STOCK->value,
        };
    }

    /**
     * Seed one price row and one stock row per product.
     *
     * @param  list<Product>  $products
     * @param  list<Admin>  $admins
     * @return array{prices: array<int, ProductPrice>, stocks: array<int, ProductStock>}
     */
    private function seedProductPricesAndStocks(array $products, array $admins): array
    {
        $prices = [];
        $stocks = [];

        foreach ($products as $i => $product) {
            $retail = 2000 + (($i * 1373) % 98000);

            $wholesale = $i % 3 === 0 ? (int) (floor($retail * 0.85)) : null;
            $discount = $i % 4 === 0 && $retail > 1500 ? $retail - 500 : null;

            $prices[$product->id] = ProductPrice::create([
                'product_id' => $product->id,
                'retail_price' => $retail,
                'wholesale_price' => $wholesale,
                'discount_price' => $discount,
                'minimum_order_quantity' => $i % 5 === 0 ? 5 : 1,
                'price_valid_until' => $i % 6 === 0 ? now()->addDays(30)->toDateString() : null,
                'last_updated_at' => now(),
                'updated_by_admin_id' => $admins[$i % count($admins)]->id,
            ]);

            $stocks[$product->id] = $this->seedProductStock($product, $i, $admins);
        }

        return ['prices' => $prices, 'stocks' => $stocks];
    }

    /**
     * Seed a stock row covering the StockStatus spread.
     *
     * @param  list<Admin>  $admins
     */
    private function seedProductStock(Product $product, int $index, array $admins): ProductStock
    {
        $status = match (true) {
            $product->status === ProductStatus::OUT_OF_STOCK => StockStatus::OUT_OF_STOCK,
            $index % 11 === 3 => StockStatus::OUT_OF_STOCK,
            $index % 5 === 0 => StockStatus::IN_STOCK,
            $index % 5 === 1 => StockStatus::LOW_STOCK,
            $index % 5 === 2 => StockStatus::IN_STOCK,
            $index % 5 === 3 => StockStatus::PRE_ORDER,
            default => StockStatus::SUPPLIER_CONFIRMATION_REQUIRED,
        };

        $quantity = match ($status) {
            StockStatus::IN_STOCK => 50 + (($index * 7) % 400),
            StockStatus::LOW_STOCK => 5,
            StockStatus::OUT_OF_STOCK => 0,
            default => null,
        };

        $confirmed = in_array($status, [StockStatus::IN_STOCK, StockStatus::LOW_STOCK, StockStatus::OUT_OF_STOCK], true);

        return ProductStock::create([
            'product_id' => $product->id,
            'supplier_id' => $product->supplier_id,
            'stock_quantity' => $quantity,
            'stock_status' => $status->value,
            'last_confirmed_at' => $confirmed ? now() : null,
            'confirmed_by_admin_id' => $confirmed ? $admins[$index % count($admins)]->id : null,
            'supplier_note' => in_array($status, [StockStatus::LOW_STOCK, StockStatus::SUPPLIER_CONFIRMATION_REQUIRED, StockStatus::PRE_ORDER], true)
                ? 'Supplier confirmation pending for the next restock.'
                : null,
        ]);
    }

    /**
     * Seed 5 customers.
     *
     * @return list<Customer>
     */
    private function seedCustomers(): array
    {
        $customers = [];

        foreach (self::CUSTOMERS as $index => $data) {
            $customers[] = Customer::create([
                'name' => $data['name'],
                'company_name' => $data['company_name'],
                'email' => $data['email'],
                'phone' => $data['phone'],
                'password' => Hash::make('password'),
                'customer_type' => $data['customer_type'],
                'status' => 'active',
                'email_verified_at' => now(),
                'phone_verified_at' => $index === 0 ? now() : null,
            ]);
        }

        return $customers;
    }

    /**
     * Seed 6 customer addresses with exactly two defaults.
     *
     * @param  list<Customer>  $customers
     */
    private function seedCustomerAddresses(array $customers): void
    {
        $addresses = [
            ['customer' => 0, 'is_default' => true, 'township' => 'Hlaing', 'ward' => '12'],
            ['customer' => 0, 'is_default' => false, 'township' => 'Mayangone', 'ward' => '5'],
            ['customer' => 1, 'is_default' => true, 'township' => 'Sanchaung', 'ward' => '3'],
            ['customer' => 2, 'is_default' => false, 'township' => 'Insein', 'ward' => '8'],
            ['customer' => 3, 'is_default' => false, 'township' => 'Kamayut', 'ward' => '2'],
            ['customer' => 4, 'is_default' => false, 'township' => 'Pabedan', 'ward' => '7'],
        ];

        foreach ($addresses as $address) {
            $customer = $customers[$address['customer']];

            CustomerAddress::create([
                'customer_id' => $customer->id,
                'contact_name' => $customer->name,
                'phone' => $customer->phone,
                'city' => 'Yangon',
                'township' => $address['township'],
                'ward' => $address['ward'],
                'street' => fake()->streetName(),
                'building_no' => fake()->buildingNumber(),
                'landmark' => null,
                'full_address' => 'No. '.fake()->buildingNumber().', '.fake()->streetName().", {$address['township']}, Yangon",
                'is_default' => $address['is_default'],
            ]);
        }
    }

    /**
     * Seed the 12 quotation requests spanning all statuses.
     *
     * @param  list<Admin>  $admins
     * @param  list<Customer>  $customers
     * @return list<QuotationRequest>
     */
    private function seedQuotationRequests(array $admins, array $customers): array
    {
        $requests = [];
        $townships = ['Hlaing', 'Mayangone', 'Sanchaung', 'Insein', 'Kamayut'];

        foreach (self::REQUEST_STATUSES as $number => $status) {
            $customer = $customers[($number - 1) % count($customers)];
            $assignedAdmin = $status === QuotationRequestStatus::NEW
                ? null
                : $admins[$number % count($admins)]->id;

            // quotation_number is NOT NULL, so the row is first persisted
            // with a unique placeholder and immediately re-keyed to the
            // id-derived number, matching the API contract format
            // `QT-YYYY-####` (LogicFlow §5).
            $request = QuotationRequest::create([
                'quotation_number' => Str::uuid()->toString(),
                'customer_id' => $customer->id,
                'customer_name' => $customer->name,
                'company_name' => $customer->company_name,
                'phone' => $customer->phone,
                'email' => $customer->email,
                'delivery_address' => 'No. '.fake()->buildingNumber().', '.fake()->streetName().', Yangon',
                'city' => 'Yangon',
                'township' => $townships[$number % count($townships)],
                'landmark' => null,
                'required_delivery_date' => now()->addDays(7 + $number)->toDateString(),
                'customer_note' => $number % 3 === 0 ? 'Please include bulk pricing where applicable.' : null,
                'status' => $status->value,
                'assigned_admin_id' => $assignedAdmin,
            ]);

            $request->update(['quotation_number' => $this->quotationNumbers()->generate($request)]);

            $requests[] = $request;
        }

        return $requests;
    }

    /**
     * Seed the original request-time item snapshots.
     *
     * @param  list<QuotationRequest>  $requests
     * @param  list<Product>  $products
     * @param  array<int, ProductPrice>  $prices
     * @param  array<int, ProductStock>  $stocks
     */
    private function seedQuotationItems(array $requests, array $products, array $prices, array $stocks): void
    {
        $catalog = $this->publishedProducts($products);

        foreach ($requests as $request) {
            $itemCount = 1 + ($request->id % 4);

            for ($k = 0; $k < $itemCount; $k++) {
                $product = $catalog[($request->id * 2 + $k) % count($catalog)];
                $price = $prices[$product->id];

                QuotationItem::create([
                    'quotation_request_id' => $request->id,
                    'product_id' => $product->id,
                    'supplier_id' => $product->supplier_id,
                    'product_name_snapshot' => $product->name_en,
                    'specification_snapshot' => $product->specification,
                    'quantity' => 1 + (($k + $request->id) % 5),
                    'display_price' => (int) ($price->discount_price ?? $price->retail_price),
                    'stock_status' => $stocks[$product->id]->stock_status->value,
                ]);
            }
        }
    }

    /**
     * Seed supplier communication logs for the requests in the
     * supplier-contact stages, mixing answered and pending rows.
     *
     * @param  list<QuotationRequest>  $requests
     * @param  list<Supplier>  $suppliers
     * @param  list<Admin>  $admins
     */
    private function seedSupplierCommunications(array $requests, array $suppliers, array $admins): void
    {
        $targets = [2, 3];

        foreach ($targets as $number) {
            $request = $requests[$number - 1];
            $admin = $admins[$number % count($admins)];

            for ($k = 0; $k < 2; $k++) {
                $supplier = $suppliers[($number + $k) % count($suppliers)];
                $responded = $number === 3 || $k === 1;

                SupplierCommunication::create([
                    'quotation_request_id' => $request->id,
                    'supplier_id' => $supplier->id,
                    'admin_id' => $admin->id,
                    'contact_method' => $k % 2 === 0 ? 'VIBER' : 'PHONE',
                    'message_text' => 'Hello, please confirm availability and best price for request '.$request->quotation_number.'.',
                    'supplier_response' => $responded ? 'Available. We can supply within the requested lead time.' : null,
                    'attachment_path' => null,
                    'contacted_at' => now()->subDays(3 - $k),
                    'responded_at' => $responded ? now()->subDays(2 - $k) : null,
                ]);
            }
        }
    }

    /**
     * Seed quotation versions across the status spread, including one
     * request with v1 SUPERSEDED and v2 SENT. Every version carries item
     * rows so the header subtotal always reconciles.
     *
     * @param  list<Admin>  $admins
     * @param  list<QuotationRequest>  $requests
     * @param  list<Product>  $products
     * @param  array<int, ProductPrice>  $prices
     * @return list<Quotation>
     */
    private function seedQuotations(array $admins, array $requests, array $products, array $prices): array
    {
        $specs = [
            4 => [
                ['version' => 1, 'status' => QuotationVersionStatus::DRAFT, 'is_current' => true],
            ],
            5 => [
                ['version' => 1, 'status' => QuotationVersionStatus::SUPERSEDED, 'is_current' => false],
                ['version' => 2, 'status' => QuotationVersionStatus::SENT, 'is_current' => true],
            ],
            6 => [
                ['version' => 1, 'status' => QuotationVersionStatus::VIEWED, 'is_current' => true],
            ],
            7 => [
                ['version' => 1, 'status' => QuotationVersionStatus::CHANGE_REQUESTED, 'is_current' => true],
            ],
            8 => [
                ['version' => 1, 'status' => QuotationVersionStatus::ACCEPTED, 'is_current' => true],
            ],
            9 => [
                ['version' => 1, 'status' => QuotationVersionStatus::ACCEPTED, 'is_current' => true],
            ],
            10 => [
                ['version' => 1, 'status' => QuotationVersionStatus::REJECTED, 'is_current' => true],
            ],
            11 => [
                ['version' => 1, 'status' => QuotationVersionStatus::EXPIRED, 'is_current' => true],
            ],
        ];

        $catalog = $this->publishedProducts($products);
        $quotations = [];

        foreach ($specs as $requestNumber => $versions) {
            $request = $requests[$requestNumber - 1];

            foreach ($versions as $spec) {
                $version = $spec['version'];
                $status = $spec['status'];

                $itemPayloads = [];
                $subtotal = 0;

                for ($k = 0; $k < 1 + (($requestNumber + $version) % 3); $k++) {
                    $product = $catalog[(($requestNumber * 3) + $version + $k) % count($catalog)];
                    $price = $prices[$product->id];
                    $unitPrice = (int) ($price->discount_price ?? $price->retail_price);
                    $quantity = 1 + (($k + $version) % 4);
                    $discount = $k === 0 && $version > 1 ? 500 : 0;
                    $lineTotal = ($quantity * $unitPrice) - $discount;

                    $subtotal += $lineTotal;

                    $itemPayloads[] = [
                        'product_id' => $product->id,
                        'supplier_id' => $product->supplier_id,
                        'product_name_snapshot' => $product->name_en,
                        'sku_snapshot' => $product->sku,
                        'specification_snapshot' => $product->specification,
                        'quantity' => $quantity,
                        'unit_price' => $unitPrice,
                        'discount' => $discount,
                        'line_total' => $lineTotal,
                        'delivery_date' => now()->addDays(7)->toDateString(),
                        'warranty_note' => 'Warranty per supplier policy.',
                        'supplier_note' => null,
                    ];
                }

                $deliveryFee = $requestNumber % 2 === 0 ? 3000 : 0;
                $serviceFeePercentage = $requestNumber === 9 ? 2 : 0;
                $headerDiscount = $requestNumber % 4 === 0 ? 1000 : 0;
                $serviceFee = intdiv($subtotal * $serviceFeePercentage, 100);
                $total = $subtotal - $headerDiscount + $deliveryFee + $serviceFee;
                $timestamps = $this->quotationTimestamps($status);

                $quotation = Quotation::create([
                    'quotation_request_id' => $request->id,
                    'quotation_number' => $version > 1
                        ? $request->quotation_number.'-V'.$version
                        : $request->quotation_number,
                    'version' => $version,
                    'status' => $status->value,
                    'is_current' => $spec['is_current'],
                    'subtotal' => $subtotal,
                    'discount' => $headerDiscount,
                    'delivery_fee' => $deliveryFee,
                    'service_fee_percentage' => $serviceFeePercentage,
                    'service_fee' => $serviceFee,
                    'total_amount' => $total,
                    'payment_method' => 'CASH_ON_DELIVERY',
                    'payment_terms' => 'Full payment on delivery (COD).',
                    'valid_until' => $status === QuotationVersionStatus::EXPIRED
                        ? now()->subDay()->toDateString()
                        : now()->addDays(7)->toDateString(),
                    'admin_note' => null,
                    'sent_at' => $timestamps['sent_at'],
                    'viewed_at' => $timestamps['viewed_at'],
                    'accepted_at' => $timestamps['accepted_at'],
                    'rejected_at' => $timestamps['rejected_at'],
                    'created_by_admin_id' => $admins[$requestNumber % count($admins)]->id,
                ]);

                foreach ($itemPayloads as $payload) {
                    QuotationVersionItem::create($payload + ['quotation_id' => $quotation->id]);
                }

                $quotations[] = $quotation;
            }
        }

        return $quotations;
    }

    /**
     * Resolve the version lifecycle timestamps for a status.
     *
     * @return array{sent_at: mixed, viewed_at: mixed, accepted_at: mixed, rejected_at: mixed}
     */
    private function quotationTimestamps(QuotationVersionStatus $status): array
    {
        $empty = ['sent_at' => null, 'viewed_at' => null, 'accepted_at' => null, 'rejected_at' => null];

        return match ($status) {
            QuotationVersionStatus::SUPERSEDED => array_merge($empty, ['sent_at' => now()->subDays(10), 'viewed_at' => now()->subDays(9)]),
            QuotationVersionStatus::SENT => array_merge($empty, ['sent_at' => now()->subDays(2)]),
            QuotationVersionStatus::VIEWED => array_merge($empty, ['sent_at' => now()->subDays(3), 'viewed_at' => now()->subDays(2)]),
            QuotationVersionStatus::CHANGE_REQUESTED => array_merge($empty, ['sent_at' => now()->subDays(5), 'viewed_at' => now()->subDays(4)]),
            QuotationVersionStatus::ACCEPTED => array_merge($empty, ['sent_at' => now()->subDays(6), 'viewed_at' => now()->subDays(5), 'accepted_at' => now()->subDays(4)]),
            QuotationVersionStatus::REJECTED => array_merge($empty, ['sent_at' => now()->subDays(5), 'viewed_at' => now()->subDays(4), 'rejected_at' => now()->subDays(3)]),
            QuotationVersionStatus::EXPIRED => array_merge($empty, ['sent_at' => now()->subDays(20), 'viewed_at' => now()->subDays(19)]),
            default => $empty,
        };
    }

    /**
     * Seed a PDF record and a placeholder file for every sent version.
     *
     * @param  list<Quotation>  $quotations
     * @param  list<Admin>  $admins
     */
    private function seedQuotationPdfs(array $quotations, array $admins): void
    {
        $disk = Storage::disk('local');

        foreach ($quotations as $index => $quotation) {
            if ($quotation->sent_at === null) {
                continue;
            }

            $fileName = 'quotation-'.$quotation->quotation_number.'-v'.$quotation->version.'.pdf';
            $path = 'quotation-pdfs/'.$fileName;

            $disk->put($path, self::QUOTATION_PDF_CONTENT);

            QuotationPdf::create([
                'quotation_id' => $quotation->id,
                'file_path' => $path,
                'file_name' => $fileName,
                'generated_by_admin_id' => $admins[$index % count($admins)]->id,
                'generated_at' => $quotation->sent_at,
            ]);
        }
    }

    /**
     * Seed the customer action trail for reviewed quotation versions.
     *
     * @param  list<Quotation>  $quotations
     * @param  list<Customer>  $customers
     */
    private function seedQuotationActions(array $quotations, array $customers): void
    {
        foreach ($quotations as $quotation) {
            $request = QuotationRequest::query()->find($quotation->quotation_request_id);

            if ($request === null) {
                continue;
            }

            $action = match ($quotation->status) {
                QuotationVersionStatus::VIEWED => QuotationActionEnum::VIEWED,
                QuotationVersionStatus::ACCEPTED => QuotationActionEnum::ACCEPTED,
                QuotationVersionStatus::REJECTED => QuotationActionEnum::REJECTED,
                QuotationVersionStatus::CHANGE_REQUESTED => QuotationActionEnum::REQUESTED_CHANGE,
                default => null,
            };

            if ($action === null) {
                continue;
            }

            QuotationAction::create([
                'quotation_id' => $quotation->id,
                'action' => $action->value,
                'customer_note' => match ($action) {
                    QuotationActionEnum::REQUESTED_CHANGE => 'Please reduce the delivery time and confirm bulk pricing.',
                    QuotationActionEnum::REJECTED => 'Price is above our budget for this order.',
                    default => null,
                },
                'actor_type' => 'CUSTOMER',
                'actor_id' => $request->customer_id,
                'ip_address' => '203.0.113.'.(($quotation->id % 200) + 10),
                'created_at' => $quotation->accepted_at
                    ?? $quotation->rejected_at
                    ?? $quotation->viewed_at
                    ?? $quotation->sent_at,
            ]);
        }
    }

    /**
     * Create one order per accepted quotation version.
     *
     * @return list<Order>
     */
    private function seedOrders(): array
    {
        $accepted = Quotation::query()
            ->where('status', QuotationVersionStatus::ACCEPTED->value)
            ->orderBy('id')
            ->get();

        // Lifecycle per accepted order (index 0 is the fully completed one,
        // index 1 is still being prepared).
        $lifecycles = [
            [
                'order_status' => OrderStatus::COMPLETED,
                'payment_status' => PaymentStatus::PAYMENT_CONFIRMED,
                'delivery_status' => DeliveryStatus::DELIVERED,
            ],
            [
                'order_status' => OrderStatus::PREPARING,
                'payment_status' => PaymentStatus::NOT_PAID,
                'delivery_status' => DeliveryStatus::PREPARING,
            ],
        ];

        $orders = [];

        foreach ($accepted->values() as $index => $quotation) {
            $request = QuotationRequest::query()->find($quotation->quotation_request_id);
            $lifecycle = $lifecycles[$index % count($lifecycles)];

            $order = Order::create([
                'order_number' => Str::uuid()->toString(),
                'quotation_id' => $quotation->id,
                'quotation_request_id' => $quotation->quotation_request_id,
                'customer_id' => $request->customer_id,
                'customer_name' => $request->customer_name,
                'company_name' => $request->company_name,
                'phone' => $request->phone,
                'email' => $request->email,
                'delivery_address' => $request->delivery_address,
                'city' => $request->city,
                'township' => $request->township,
                'landmark' => $request->landmark,
                'subtotal' => $quotation->subtotal,
                'discount' => $quotation->discount,
                'delivery_fee' => $quotation->delivery_fee,
                'service_fee_percentage' => $quotation->service_fee_percentage,
                'service_fee' => $quotation->service_fee,
                'total_amount' => $quotation->total_amount,
                'payment_method' => $quotation->payment_method,
                'payment_status' => $lifecycle['payment_status']->value,
                'order_status' => $lifecycle['order_status']->value,
                'delivery_status' => $lifecycle['delivery_status']->value,
                'customer_note' => $request->customer_note,
            ]);

            $order->update(['order_number' => $this->orderNumbers()->orderNumber($order)]);

            $orders[] = $order;
        }

        return $orders;
    }

    /**
     * Copy the accepted version items into immutable order item snapshots.
     *
     * @param  list<Order>  $orders
     */
    private function seedOrderItems(array $orders): void
    {
        foreach ($orders as $order) {
            $items = QuotationVersionItem::query()
                ->where('quotation_id', $order->quotation_id)
                ->orderBy('id')
                ->get();

            foreach ($items as $item) {
                OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $item->product_id,
                    'supplier_id' => $item->supplier_id,
                    'product_name_snapshot' => $item->product_name_snapshot,
                    'sku_snapshot' => $item->sku_snapshot,
                    'specification_snapshot' => $item->specification_snapshot,
                    'quantity' => $item->quantity,
                    'unit_price' => $item->unit_price,
                    'discount' => $item->discount,
                    'line_total' => $item->line_total,
                ]);
            }
        }
    }

    /**
     * Write a coherent status trail from the first status to the current
     * one for each order.
     *
     * @param  list<Order>  $orders
     * @param  list<Admin>  $admins
     */
    private function seedOrderStatusHistories(array $orders, array $admins): void
    {
        foreach ($orders as $orderIndex => $order) {
            $chain = $this->orderStatusChain($order->order_status);
            $previous = null;

            foreach ($chain as $step => $status) {
                OrderStatusHistory::create([
                    'order_id' => $order->id,
                    'old_status' => $previous,
                    'new_status' => $status,
                    'changed_by_type' => $step === 0 ? 'SYSTEM' : 'ADMIN',
                    'changed_by_id' => $step === 0 ? null : $admins[$orderIndex % count($admins)]->id,
                    'note' => $step === 0 ? 'Order created from accepted quotation.' : null,
                    'created_at' => now()->subDays(count($chain) - $step),
                ]);

                $previous = $status;
            }
        }
    }

    /**
     * Resolve the exhaustive status chain for a final order status.
     *
     * @return list<string>
     */
    private function orderStatusChain(OrderStatus $status): array
    {
        $chains = [
            OrderStatus::COMPLETED->value => [
                OrderStatus::SUPPLIER_CONFIRMATION_REQUIRED,
                OrderStatus::ORDER_CONFIRMED,
                OrderStatus::PREPARING,
                OrderStatus::READY_TO_SHIP,
                OrderStatus::OUT_FOR_DELIVERY,
                OrderStatus::DELIVERED,
                OrderStatus::COMPLETED,
            ],
            OrderStatus::PREPARING->value => [
                OrderStatus::SUPPLIER_CONFIRMATION_REQUIRED,
                OrderStatus::ORDER_CONFIRMED,
                OrderStatus::PREPARING,
            ],
        ];

        return array_map(
            static fn (OrderStatus $case): string => $case->value,
            $chains[$status->value] ?? [$status],
        );
    }

    /**
     * Create one full delivery for every order past ORDER_CONFIRMED, and a
     * confirmed COD payment for every delivered order.
     *
     * @param  list<Order>  $orders
     */
    private function seedDeliveriesAndPayments(array $orders): void
    {
        $deliveredOrders = [];

        foreach ($orders as $index => $order) {
            if (in_array($order->order_status, [OrderStatus::SUPPLIER_CONFIRMATION_REQUIRED, OrderStatus::SUPPLIER_UNAVAILABLE, OrderStatus::CANCELLED], true)) {
                continue;
            }

            $delivered = in_array($order->order_status, [OrderStatus::DELIVERED, OrderStatus::COMPLETED], true);

            $delivery = Delivery::create([
                'order_id' => $order->id,
                'supplier_id' => OrderItem::query()->where('order_id', $order->id)->value('supplier_id'),
                'delivery_contact_name' => $order->customer_name,
                'delivery_phone' => $order->phone,
                'delivery_address' => $order->delivery_address,
                'city' => $order->city,
                'township' => $order->township,
                'landmark' => $order->landmark,
                'delivery_fee' => $order->delivery_fee,
                'delivery_partner' => 'CoSupply Logistics',
                'tracking_number' => 'TRK-'.str_pad((string) ($index + 1), 6, '0', STR_PAD_LEFT),
                'estimated_delivery_date' => now()->addDays(2)->toDateString(),
                'shipped_at' => $delivered ? now()->subDay() : null,
                'delivered_at' => $delivered ? now() : null,
                'received_by' => $delivered ? $order->customer_name : null,
                'customer_note' => $order->customer_note,
                'delivery_status' => ($delivered ? DeliveryStatus::DELIVERED : DeliveryStatus::PREPARING)->value,
            ]);

            if ($delivered) {
                $deliveredOrders[] = [$order, $delivery];
            }
        }

        foreach ($deliveredOrders as [$order, $delivery]) {
            $payment = CashPayment::create([
                'order_id' => $order->id,
                'delivery_id' => $delivery->id,
                'receipt_number' => Str::uuid()->toString(),
                'amount_due' => $order->total_amount,
                'amount_collected' => $order->total_amount,
                'amount_remaining' => 0,
                'received_by' => $delivery->delivery_partner,
                'collected_at' => now(),
                'customer_name' => $order->customer_name,
                'customer_signature_path' => null,
                'receipt_file_path' => null,
                'note' => 'Full cash on delivery collected.',
                'status' => PaymentStatus::PAYMENT_CONFIRMED->value,
            ]);

            $payment->update(['receipt_number' => $this->orderNumbers()->receiptNumber($order)]);
        }
    }

    /**
     * Seed in-app notifications with mixed recipients and read state.
     *
     * @param  list<Admin>  $admins
     * @param  list<Customer>  $customers
     * @param  list<Quotation>  $quotations
     * @param  list<Order>  $orders
     */
    /**
     * @param  array<int, Quotation>  $quotations
     * @param  array<int, QuotationRequest>  $requests
     */
    private function seedNotifications(array $admins, array $customers, array $quotations, array $orders, array $requests): void
    {
        $sentQuotation = collect($quotations)->first(
            static fn (Quotation $quotation): bool => $quotation->status === QuotationVersionStatus::SENT,
        );
        $completedOrder = $orders !== [] ? $orders[0] : null;
        $preparingOrder = $orders[1] ?? null;
        $admin = $admins[0];

        $rows = [
            [
                'recipient_type' => 'CUSTOMER',
                'recipient_id' => $customers[0]->id,
                'customer_id' => $customers[0]->id,
                'admin_id' => null,
                'quotation_id' => $sentQuotation?->id,
                'order_id' => null,
                'type' => 'QUOTATION_SENT',
                'title' => 'Your quotation is ready',
                'message' => 'A new quotation version has been sent for your review.',
                'data' => ['quotation_number' => $sentQuotation?->quotation_number],
                'is_read' => false,
                'read_at' => null,
            ],
            [
                'recipient_type' => 'CUSTOMER',
                'recipient_id' => $customers[0]->id,
                'customer_id' => $customers[0]->id,
                'admin_id' => null,
                'quotation_id' => null,
                'order_id' => $completedOrder?->id,
                'type' => 'ORDER_DELIVERED',
                'title' => 'Your order was delivered',
                'message' => 'The cash on delivery payment has been confirmed. Thank you.',
                'data' => ['order_number' => $completedOrder?->order_number],
                'is_read' => true,
                'read_at' => now(),
            ],
            [
                'recipient_type' => 'CUSTOMER',
                'recipient_id' => $customers[1]->id,
                'customer_id' => $customers[1]->id,
                'admin_id' => null,
                'quotation_id' => null,
                'order_id' => $preparingOrder?->id,
                'type' => 'ORDER_STATUS_UPDATED',
                'title' => 'Your order is being prepared',
                'message' => 'We are preparing your order for delivery.',
                'data' => ['order_number' => $preparingOrder?->order_number],
                'is_read' => false,
                'read_at' => null,
            ],
            [
                'recipient_type' => 'ADMIN',
                'recipient_id' => $admin->id,
                'customer_id' => null,
                'admin_id' => $admin->id,
                'quotation_id' => null,
                'order_id' => null,
                'type' => 'QUOTATION_REQUEST_CREATED',
                'title' => 'New quotation request',
                'message' => 'A customer submitted a new quotation request.',
                'data' => ['request_number' => $requests !== [] ? $requests[0]->quotation_number : null],
                'is_read' => false,
                'read_at' => null,
            ],
            [
                'recipient_type' => 'ADMIN',
                'recipient_id' => $admin->id,
                'customer_id' => null,
                'admin_id' => $admin->id,
                'quotation_id' => null,
                'order_id' => $completedOrder?->id,
                'type' => 'PAYMENT_CONFIRMED',
                'title' => 'Cash payment confirmed',
                'message' => 'The delivery cash payment has been confirmed.',
                'data' => ['order_number' => $completedOrder?->order_number],
                'is_read' => true,
                'read_at' => now(),
            ],
        ];

        foreach ($rows as $row) {
            Notification::create($row);
        }
    }

    /**
     * Seed email delivery logs with mixed sent/failed outcomes.
     *
     * @param  list<Quotation>  $quotations
     * @param  list<Order>  $orders
     */
    private function seedEmailLogs(array $quotations, array $orders): void
    {
        foreach ($quotations as $quotation) {
            if ($quotation->sent_at === null) {
                continue;
            }

            $request = QuotationRequest::query()->find($quotation->quotation_request_id);

            EmailLog::create([
                'recipient_email' => $request->email ?? 'customer@cos.local',
                'related_type' => Quotation::class,
                'related_id' => $quotation->id,
                'email_type' => 'QUOTATION_SENT',
                'subject' => 'Quotation '.$quotation->quotation_number.' is ready',
                'status' => 'SENT',
                'sent_at' => $quotation->sent_at,
                'error_message' => null,
            ]);
        }

        if ($orders !== []) {
            $order = $orders[0];

            EmailLog::create([
                'recipient_email' => $order->email ?? 'customer@cos.local',
                'related_type' => Order::class,
                'related_id' => $order->id,
                'email_type' => 'ORDER_COMPLETED',
                'subject' => 'Order '.$order->order_number.' completed',
                'status' => 'SENT',
                'sent_at' => now(),
                'error_message' => null,
            ]);

            EmailLog::create([
                'recipient_email' => $order->email ?? 'customer@cos.local',
                'related_type' => Order::class,
                'related_id' => $order->id,
                'email_type' => 'ORDER_CONFIRMED',
                'subject' => 'Order '.$order->order_number.' confirmed',
                'status' => 'FAILED',
                'sent_at' => null,
                'error_message' => 'SMTP timeout while delivering the confirmation email.',
            ]);
        }
    }

    /**
     * Seed audit trail entries for catalog and settings changes.
     *
     * @param  list<Admin>  $admins
     * @param  list<Product>  $products
     * @param  list<Supplier>  $suppliers
     */
    private function seedAuditLogs(array $admins, array $products, array $suppliers): void
    {
        $admin = $admins[0];
        $product = $products[0];
        $supplier = $suppliers[0];

        $entries = [
            ['setting.updated', 'setting', '1', ['value' => 'CoSupply'], ['value' => 'CoSupply Myanmar']],
            ['category.created', 'category', '1', [], ['name_en' => 'Electronics']],
            ['supplier.created', 'supplier', (string) $supplier->id, [], ['shop_name' => $supplier->shop_name]],
            ['product.created', 'product', (string) $product->id, [], ['slug' => $product->slug]],
            ['product.price_updated', 'product', (string) $product->id, ['retail_price' => 1000], ['retail_price' => 2000]],
            ['product.stock_updated', 'product', (string) $product->id, ['stock_status' => 'IN_STOCK'], ['stock_status' => 'LOW_STOCK']],
            ['product.status_updated', 'product', (string) $product->id, ['status' => 'DRAFT'], ['status' => 'PUBLISHED']],
        ];

        foreach ($entries as $index => [$action, $entityType, $entityId, $oldData, $newData]) {
            AuditLog::create([
                'admin_id' => $admin->id,
                'action' => $action,
                'entity_type' => $entityType,
                'entity_id' => $entityId,
                'old_data' => $oldData,
                'new_data' => $newData,
                'ip_address' => '10.0.0.'.($index + 10),
                'created_at' => now()->subMinutes(count($entries) - $index),
            ]);
        }
    }

    /**
     * Filter the product list down to published products.
     *
     * @param  list<Product>  $products
     * @return list<Product>
     */
    private function publishedProducts(array $products): array
    {
        return array_values(array_filter(
            $products,
            static fn (Product $product): bool => $product->status === ProductStatus::PUBLISHED,
        ));
    }

    /**
     * Print a per-table row-count summary.
     */
    private function reportRowCounts(): void
    {
        $tables = [
            'admins', 'customers', 'customer_addresses', 'categories', 'suppliers',
            'products', 'product_prices', 'product_stocks', 'quotation_requests',
            'quotation_items', 'supplier_communications', 'quotations',
            'quotation_version_items', 'quotation_pdfs', 'quotation_actions',
            'orders', 'order_items', 'deliveries', 'cash_payments',
            'order_status_histories', 'notifications', 'email_logs', 'settings',
            'audit_logs',
        ];

        $this->command?->info('Demo data seeded. Row counts:');

        foreach ($tables as $table) {
            $this->command?->info(sprintf('  %-26s %d', $table, DB::table($table)->count()));
        }
    }

    /**
     * Demo product photo source. The seeder downloads this real product
     * photo and writes it to every demo-product slot; when the download
     * fails (offline dev box), it falls back to the embedded base64 PNG.
     */
    private const PRODUCT_IMAGE_URL = 'https://www.hbada.eu/cdn/shop/files/2132321_97d0cb09-bfdf-41ba-8bd8-2dd442c87b53.png?v=1761890676&width=756';

    /**
     * 16x16 placeholder PNG for product images (base64). Fallback only.
     */
    private const PRODUCT_IMAGE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAACXBIWXMAAA7EAAAOxAGVKw4bAAAANklEQVQoz2NUTX7NQApgYiARjEgNLMicW3NEkLlqKW+IskEt5Q1EKZr+0WDFGrhYg5WR1OQNABlVDX85FkVTAAAAAElFTkSuQmCC';

    /**
     * 16x16 placeholder PNG for supplier logos (base64).
     */
    private const SUPPLIER_LOGO_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAACXBIWXMAAA7EAAAOxAGVKw4bAAAANklEQVQoz2MUW+zFQApgYiARjEgNLMiclzFbkbniS7yJskF8iTdEKZr+0WDFGrhYg5WR1OQNABVdDC/EtA4OAAAAAElFTkSuQmCC';

    /**
     * Minimal placeholder PDF content for sent quotation versions.
     */
    private const QUOTATION_PDF_CONTENT = <<<'PDF'
%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>
endobj
trailer
<< /Root 1 0 R >>
%%EOF
PDF;
}
