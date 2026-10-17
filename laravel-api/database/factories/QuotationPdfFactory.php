<?php

namespace Database\Factories;

use App\Models\Admin;
use App\Models\Quotation;
use App\Models\QuotationPdf;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<QuotationPdf>
 */
class QuotationPdfFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $fileName = 'quotation-'.fake()->unique()->numerify('######').'.pdf';

        return [
            'quotation_id' => Quotation::factory(),
            'file_path' => 'quotation-pdfs/'.$fileName,
            'file_name' => $fileName,
            'generated_by_admin_id' => Admin::factory(),
            'generated_at' => now(),
            'created_at' => now(),
        ];
    }

    /**
     * Attach the PDF to the given quotation version.
     */
    public function forQuotation(Quotation $quotation): static
    {
        $fileName = 'quotation-'.$quotation->id.'-v'.$quotation->version.'.pdf';

        return $this->state(fn (array $attributes) => [
            'quotation_id' => $quotation->id,
            'file_path' => 'quotation-pdfs/'.$fileName,
            'file_name' => Str::of($fileName)->replace('/', '-')->toString(),
        ]);
    }
}
