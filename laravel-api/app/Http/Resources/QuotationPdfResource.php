<?php

namespace App\Http\Resources;

use App\Models\QuotationPdf;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Version-specific generated quotation PDF.
 *
 * @mixin QuotationPdf
 */
class QuotationPdfResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'file_name' => $this->file_name,
            'generated_at' => $this->generated_at?->toIso8601String(),
            'download_url' => '/admin/quotations/'.$this->quotation_id.'/pdf/download',
            'generated_by_admin' => $this->whenLoaded('generatedByAdmin', fn (): array => [
                'id' => $this->generatedByAdmin->id,
                'name' => $this->generatedByAdmin->name,
            ]),
        ];
    }
}
