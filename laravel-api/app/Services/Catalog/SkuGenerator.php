<?php

namespace App\Services\Catalog;

use App\Exceptions\ResourceConflictException;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Support\Str;

/**
 * Builds readable, collision-free SKUs for the product form's generate icon.
 *
 * A product SKU is `<PREFIX>-<CODE>` (e.g. `OFFICE-CHAIR-7K2P`) whose prefix
 * comes from the English name, then the brand, then the model. A variant SKU
 * is `<PRODUCT>-<VARIANT NAME>` (e.g. `CHAIR-001-RED-M`), falling back to
 * `V1`, `V2`, … when the variant name has no A-Z0-9 characters to keep, which
 * is the normal case for a Burmese label.
 *
 * Every candidate is compared with the stored values plus the rows the form
 * has not saved yet, so whatever lands in the field can be submitted as-is.
 * `product_variants.sku` carries a per-product unique index, while
 * `products.sku` does not — the product-side check is a best-effort guard
 * that keeps generated codes from repeating.
 */
class SkuGenerator
{
    /** Both `sku` columns are `string(100)`. */
    private const MAX_LENGTH = 100;

    /** I, O, 0 and 1 are left out so a code never reads as another one. */
    private const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    private const CODE_LENGTH = 4;

    private const CODE_ATTEMPTS = 25;

    /** The form allows 50 variant rows, so this budget is never reached. */
    private const SUFFIX_ATTEMPTS = 999;

    /**
     * `<PREFIX>-<CODE>`, e.g. `OFFICE-CHAIR-7K2P`.
     *
     * @param  array<string, mixed>  $data  validated GenerateSkuRequest payload
     *
     * @throws ResourceConflictException when no free value can be found
     */
    public function generateForProduct(array $data): string
    {
        $prefix = $this->firstSegment([
            $data['name_en'] ?? null,
            $data['brand'] ?? null,
            $data['model'] ?? null,
        ]) ?? 'SKU';

        for ($attempt = 0; $attempt < self::CODE_ATTEMPTS; $attempt++) {
            $candidate = $this->join($prefix, $this->randomCode());

            if (! $this->productSkuIsTaken($candidate)) {
                return $candidate;
            }
        }

        // Every random code collided (not reachable with real randomness):
        // count off the prefix instead of returning a duplicate.
        for ($step = 1; $step <= self::SUFFIX_ATTEMPTS; $step++) {
            $candidate = $this->join($prefix, (string) $step);

            if (! $this->productSkuIsTaken($candidate)) {
                return $candidate;
            }
        }

        throw new ResourceConflictException('A free SKU could not be generated. Adjust the name and try again.');
    }

    /**
     * `<PRODUCT>-<VARIANT NAME>`, e.g. `CHAIR-001-RED-M`.
     *
     * The prefix prefers `base` — the SKU currently in the form, which may not
     * be saved yet — over the stored product row, so an unsaved edit still
     * shapes the generated value.
     *
     * @param  array<string, mixed>  $data  validated GenerateSkuRequest payload
     *
     * @throws ResourceConflictException when no free value can be found
     */
    public function generateForVariant(array $data, ?Product $product = null): string
    {
        $base = $this->firstSegment([
            $data['base'] ?? null,
            $product?->sku,
            $data['name_en'] ?? null,
            $product?->name_en,
            $data['brand'] ?? null,
            $product?->brand,
            $data['model'] ?? null,
            $product?->model,
        ]) ?? 'SKU';

        $suffix = $this->firstSegment([$data['variant_name'] ?? null])
            ?? 'V'.max(1, (int) ($data['variant_index'] ?? 1));

        $taken = $this->takenVariantSkus($product, $data);

        $candidate = $this->join($base, $suffix);

        if (! in_array(Str::lower($candidate), $taken, true)) {
            return $candidate;
        }

        for ($step = 2; $step <= self::SUFFIX_ATTEMPTS; $step++) {
            $candidate = $this->join($base, $suffix.'-'.$step);

            if (! in_array(Str::lower($candidate), $taken, true)) {
                return $candidate;
            }
        }

        throw new ResourceConflictException('A free SKU could not be generated. Rename the variant and try again.');
    }

    /**
     * Four characters from an alphabet without I, O, 0 and 1.
     *
     * Protected so tests can drive a deterministic sequence.
     */
    protected function randomCode(): string
    {
        $last = strlen(self::CODE_ALPHABET) - 1;
        $code = '';

        for ($position = 0; $position < self::CODE_LENGTH; $position++) {
            $code .= self::CODE_ALPHABET[random_int(0, $last)];
        }

        return $code;
    }

    /**
     * First value that normalizes into a usable A-Z0-9 segment.
     *
     * @param  array<int, mixed>  $values
     */
    private function firstSegment(array $values): ?string
    {
        foreach ($values as $value) {
            if (! is_string($value)) {
                continue;
            }

            $segment = $this->segment($value);

            if ($segment !== null) {
                return $segment;
            }
        }

        return null;
    }

    /**
     * Uppercase, hyphen-joined A-Z0-9, or null when nothing usable is left.
     *
     * Only Latin-authored text becomes a code. `Str::ascii()` would turn
     * 'ကုန်ပစ္စည်း' into 'KONPSSI', which reads like a typo in a field where
     * admins expect a deliberate code, so non-Latin input is dropped and the
     * caller falls through to the next source (or the `V1` row fallback).
     */
    private function segment(string $value): ?string
    {
        if (! $this->isLatinAuthored($value)) {
            return null;
        }

        $normalized = Str::upper(Str::ascii($value));
        $normalized = (string) preg_replace('/[^A-Z0-9]+/', '-', $normalized);
        $normalized = trim($normalized, '-');

        return $normalized === '' ? null : $normalized;
    }

    /**
     * True when ASCII letters and digits carry the string: a couple of
     * diacritics are fine ('Café' folds to 'CAFE'), a string that is mostly
     * another script is not.
     */
    private function isLatinAuthored(string $value): bool
    {
        $latin = (int) preg_match_all('/[A-Za-z0-9]/', $value);
        $other = (int) preg_match_all('/[^\x00-\x7F]/u', $value);

        return $latin > 0 && $latin >= $other;
    }

    /**
     * `<prefix>-<suffix>` trimmed to the column length, always leaving room
     * for part of both sides even when a variant name runs long.
     */
    private function join(string $prefix, string $suffix): string
    {
        $suffix = Str::limit($suffix, self::MAX_LENGTH - 10, '');
        $maxPrefix = self::MAX_LENGTH - strlen($suffix) - 1;

        return Str::limit($prefix, $maxPrefix, '').'-'.$suffix;
    }

    /**
     * Best-effort duplicate guard for `products.sku`, which has no unique
     * index. LOWER() keeps it case-insensitive on every driver.
     */
    private function productSkuIsTaken(string $candidate): bool
    {
        return Product::query()
            ->whereRaw('LOWER(sku) = ?', [Str::lower($candidate)])
            ->exists();
    }

    /**
     * Stored variant SKUs plus the rows still sitting in the form, both
     * lower-cased so the comparison matches MySQL's case-insensitive unique
     * index on (`product_id`, `sku`).
     *
     * @param  array<string, mixed>  $data
     * @return list<string>
     */
    private function takenVariantSkus(?Product $product, array $data): array
    {
        $taken = [];

        foreach ((array) ($data['existing_skus'] ?? []) as $sku) {
            $taken[] = Str::lower(trim((string) $sku));
        }

        if ($product !== null) {
            $query = $product->variants();

            // Regenerating this row's own code must not treat it as taken.
            if (! empty($data['exclude_variant_id'])) {
                $query->whereKeyNot($data['exclude_variant_id']);
            }

            foreach ($query->pluck('sku') as $sku) {
                $taken[] = Str::lower((string) $sku);
            }
        }

        return array_values(
            array_filter(array_unique($taken), fn (string $sku): bool => $sku !== ''),
        );
    }
}
