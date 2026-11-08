/**
 * Product information panel.
 *
 * Description and specifications share one compact panel so the page never
 * leaves a large empty column. Supplier details live in the buy box.
 */
import type { PublicProduct } from '../../../api/catalog';

interface ProductInfoProps {
  product: PublicProduct;
  selectedSku: string | null;
}

export default function ProductInfo({ product, selectedSku }: ProductInfoProps) {
  const specifications: Array<[string, string]> = [
    ['Specification', product.specification ?? ''],
    ['Size', product.size ?? ''],
    ['Colour', product.color ?? ''],
    ['Unit', product.unit],
    ['Package size', product.package_size ?? ''],
    ['Brand', product.brand ?? ''],
    ['Model', product.model ?? ''],
    ['SKU', selectedSku ?? ''],
  ].filter((entry): entry is [string, string] => entry[1].trim() !== '');

  const description = (product.description ?? '').trim();
  const hasDescription = description !== '';
  const hasSpecifications = specifications.length > 0;

  if (!hasDescription && !hasSpecifications) return null;

  return (
    <section className="rounded-2xl border border-rule/80 bg-white p-3.5 shadow-[0_6px_24px_-16px_rgba(0,142,204,0.35)] sm:p-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
        {hasDescription ? (
          <div className="lg:col-span-5">
            <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
              <span className="h-3 w-1 rounded-full bg-primary" aria-hidden="true" />
              Description
            </h2>
            <p className="mt-1.5 whitespace-pre-line text-sm leading-5 text-ink">{description}</p>
          </div>
        ) : null}

        {hasSpecifications ? (
          <div className={hasDescription ? 'lg:col-span-7' : 'lg:col-span-12'}>
            <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
              <span className="h-3 w-1 rounded-full bg-primary" aria-hidden="true" />
              Specifications
            </h2>
            <dl className="mt-1.5 divide-y divide-rule overflow-hidden rounded-lg border border-rule">
              {specifications.map(([label, value]) => (
                <div
                  key={label}
                  className="grid grid-cols-3 gap-3 px-3 py-1.5 text-[13px] even:bg-paper/60"
                >
                  <dt className="font-medium text-muted">{label}</dt>
                  <dd className="col-span-2 text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </div>
    </section>
  );
}
