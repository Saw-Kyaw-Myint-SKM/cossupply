<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\ExposesPublicMedia;
use App\Models\Supplier;
use App\Services\Setting\SettingService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Public supplier representation exposed on product pages.
 *
 * Supplier contact details (phone, Viber, email, address, contact person)
 * stay private per RolesPermissions §3: only what a buyer needs to decide
 * on an offer is exposed.
 *
 * The `storefront_supplier_display` master setting narrows this payload:
 * `NAME` keeps the shop name only, while `CARD` returns the full public
 * profile. `HIDDEN` is enforced by the controllers, which never hand a
 * supplier to this resource in that mode.
 *
 * @mixin Supplier
 */
class PublicSupplierResource extends JsonResource
{
    use ExposesPublicMedia;

    /**
     * Transform the supplier into an API representation.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $display = app(SettingService::class)->supplierDisplay();

        if ($display === SettingService::SUPPLIER_DISPLAY_NAME) {
            return [
                'id' => $this->id,
                'shop_name' => $this->shop_name,
            ];
        }

        return [
            'id' => $this->id,
            'shop_name' => $this->shop_name,
            'company_name' => $this->company_name,
            'logo' => $this->logo,
            'logo_url' => $this->publicMediaUrl($this->logo),
            'business_description' => $this->business_description,
            'delivery_area' => $this->delivery_area,
            'delivery_time' => $this->delivery_time,
            'verified' => (bool) $this->verified,
        ];
    }
}
