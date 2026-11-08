/**
 * Flat variant selector for the buy box. Each variant carries a directly
 * typed name, so the selector is a simple chip group rather than a matrix.
 */
import type { PublicProductVariant } from '../../../api/catalog';

interface VariantSelectorProps {
  variants: PublicProductVariant[];
  selectedVariant: PublicProductVariant | null;
  onSelect: (variant: PublicProductVariant) => void;
}

function variantName(variant: PublicProductVariant): string {
  const name = (variant.name ?? '').trim();

  if (name !== '') return name;

  const attributes = Object.entries(variant.variant_attributes ?? {})
    .map(([attributeName, value]) => `${attributeName}: ${value}`)
    .join(', ');

  return attributes !== '' ? attributes : `Variant ${variant.id}`;
}

export default function VariantSelector({
  variants,
  selectedVariant,
  onSelect,
}: VariantSelectorProps) {
  if (variants.length === 0) return null;

  return (
    <fieldset className="mt-2.5">
      <legend className="text-[13px] font-medium text-ink">
        Select variant
        {selectedVariant ? (
          <span className="font-normal text-muted"> — {variantName(selectedVariant)}</span>
        ) : null}
      </legend>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {variants.map((variant) => {
          const isSelected = selectedVariant?.id === variant.id;
          const isUnavailable = variant.stock_status === 'OUT_OF_STOCK';

          return (
            <button
              key={variant.id}
              type="button"
              onClick={() => onSelect(variant)}
              aria-pressed={isSelected}
              disabled={isUnavailable && !isSelected}
              className={`inline-flex items-center rounded-full border px-3 py-1 text-[13px] font-medium transition focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                isSelected
                  ? 'border-primary bg-primary text-white shadow-sm'
                  : 'border-line bg-white text-ink hover:border-primary hover:text-primary'
              } ${
                isUnavailable && !isSelected
                  ? 'cursor-not-allowed opacity-40 line-through'
                  : ''
              }`}
            >
              {variantName(variant)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
