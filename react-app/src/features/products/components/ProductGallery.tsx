/**
 * Product image gallery for the public detail page.
 *
 * The main image follows the selected variant and the thumbnail strip lets a
 * buyer switch variants directly.
 */
import type { PublicProduct, PublicProductVariant } from '../../../api/catalog';
import { FALLBACK_BANNER } from '../../../components/catalog-ui/CatalogUi';

interface ProductGalleryProps {
  product: PublicProduct;
  selectedVariant: PublicProductVariant | null;
  displayName: string;
  selectedVariantLabel: string | null;
  onSelect: (variant: PublicProductVariant) => void;
}

export default function ProductGallery({
  product,
  selectedVariant,
  displayName,
  selectedVariantLabel,
  onSelect,
}: ProductGalleryProps) {
  const variants = product.variants ?? [];

  return (
    <div className="flex flex-col gap-2.5">
      <div className="h-[280px] w-full overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5 lg:h-[320px]">
        <img
          key={selectedVariant?.id ?? 'product'}
          src={selectedVariant?.photo_url ?? product.photo_url ?? FALLBACK_BANNER}
          alt={
            selectedVariantLabel ? `${displayName} — ${selectedVariantLabel}` : displayName
          }
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover motion-safe:animate-rise-in"
        />
      </div>

      {variants.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {variants.map((variant) => {
            const isSelected = selectedVariant?.id === variant.id;
            const isUnavailable = variant.stock_status === 'OUT_OF_STOCK';

            return (
              <button
                key={variant.id}
                type="button"
                onClick={() => onSelect(variant)}
                aria-pressed={isSelected}
                aria-label={`View ${variant.name || `variant ${variant.id}`}`}
                className={`h-14 w-14 flex-none overflow-hidden rounded-lg border-2 bg-white shadow-sm transition ${
                  isSelected
                    ? 'border-primary ring-2 ring-primary/20'
                    : 'border-rule hover:border-primary/50'
                } ${isUnavailable ? 'opacity-45' : ''}`}
              >
                <img
                  src={variant.photo_url ?? product.photo_url ?? FALLBACK_BANNER}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
