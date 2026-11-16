/**
 * "Order journey" band on the customer order detail page.
 *
 * One band answers the buyer's first question — where is my order and what do
 * I do next — before the page drops into the four detail cards. It shows the
 * current status in plain language, the next step from the customer's side,
 * the four-step track, and the payment / delivery sub-statuses.
 *
 * Statuses outside the linear workflow (supplier unavailable, delivery failed,
 * returned, cancelled) have no position on the track, so the band shows the
 * explanation and next step without a misleading "nothing reached" line.
 */
import { FiArrowRight, FiCheck } from 'react-icons/fi';
import { StatusBadge } from '../../../components/catalog-ui/CatalogUi';
import { useI18n } from '../../../lib/i18n-context';
import {
  ORDER_PROGRESS_STEP_KEYS,
  orderJourneyNextStep,
  orderProgress,
  orderStatusHint,
  orderStatusLabel,
  type OrderProgressTone,
} from '../lib/orderDisplay';

const MICRO_LABEL = 'text-[10.5px] font-semibold uppercase tracking-[0.14em] text-subtle';

const TONE_STYLES: Record<
  OrderProgressTone,
  { reached: string; line: string; current: string; label: string }
> = {
  progress: {
    reached: 'border-primary bg-primary text-white',
    line: 'bg-primary',
    current: 'border-primary bg-white text-primary ring-4 ring-primary/15',
    label: 'text-primary',
  },
  done: {
    reached: 'border-success bg-success text-white',
    line: 'bg-success',
    current: 'border-success bg-white text-success ring-4 ring-success/15',
    label: 'text-success',
  },
  issue: {
    reached: 'border-error bg-error text-white',
    line: 'bg-error',
    current: 'border-error bg-white text-error ring-4 ring-error/15',
    label: 'text-error',
  },
  muted: {
    reached: 'border-line bg-line text-white',
    line: 'bg-line',
    current: 'border-line bg-white text-muted',
    label: 'text-muted',
  },
};

interface OrderJourneyProps {
  status: string;
  paymentStatus: string;
  deliveryStatus: string;
}

export function OrderJourney({
  status,
  paymentStatus,
  deliveryStatus,
}: OrderJourneyProps) {
  const { t } = useI18n();
  const progress = orderProgress(status);
  const tone = TONE_STYLES[progress.tone];

  return (
    <section aria-labelledby="order-journey-heading" className="glass-panel overflow-hidden">
      <div
        aria-hidden="true"
        className="h-0.5 w-full bg-gradient-to-r from-primary via-sky-400 to-warm/70"
      />

      <div className="flex flex-col gap-5 px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="max-w-[62ch]">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-primary">
              {t('journeyLabel')}
            </p>
            <h2
              id="order-journey-heading"
              className="mt-1 text-lg font-semibold leading-snug text-ink sm:text-xl"
            >
              {orderStatusLabel(status, t)}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              {orderStatusHint(status, t)}
            </p>
          </div>

          <dl className="flex flex-wrap gap-x-5 gap-y-2">
            <div>
              <dt className={MICRO_LABEL}>{t('payment')}</dt>
              <dd className="mt-1">
                <StatusBadge status={paymentStatus} />
              </dd>
            </div>
            <div>
              <dt className={MICRO_LABEL}>{t('delivery')}</dt>
              <dd className="mt-1">
                <StatusBadge status={deliveryStatus} />
              </dd>
            </div>
          </dl>
        </div>

        {progress.stage !== null ? (
          <div className="rounded-2xl border border-line/40 bg-white/50 px-3 py-3.5 sm:px-5">
            <ol aria-label={t('journeyLabel')} className="flex items-start">
              {ORDER_PROGRESS_STEP_KEYS.map((key, index) => {
                const stage = progress.stage ?? 0;
                const isReached = index < stage;
                const isCurrent = progress.tone === 'progress' && index === stage;

                return (
                  <li
                    key={key}
                    aria-current={isCurrent ? 'step' : undefined}
                    className="relative flex flex-1 flex-col items-center text-center"
                  >
                    {index > 0 ? (
                      <span
                        aria-hidden="true"
                        className={`absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2 ${
                          index < stage ? tone.line : 'bg-line/60'
                        }`}
                      />
                    ) : null}

                    <span
                      aria-hidden="true"
                      className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-[11px] font-bold tabular-nums ${
                        isReached
                          ? tone.reached
                          : isCurrent
                            ? tone.current
                            : 'border-line bg-white text-subtle'
                      }`}
                    >
                      {isReached ? <FiCheck className="h-3.5 w-3.5" /> : index + 1}
                    </span>

                    <span
                      className={`mt-2 text-[10.5px] leading-snug sm:text-[11.5px] ${
                        isReached || isCurrent
                          ? `font-semibold ${tone.label}`
                          : 'text-subtle'
                      }`}
                    >
                      {t(key)}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        ) : null}

        <div className="flex items-start gap-3 rounded-xl bg-warm-soft px-3.5 py-3 ring-1 ring-inset ring-warm/25">
          <span
            aria-hidden="true"
            className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-white text-warm ring-1 ring-inset ring-warm/30"
          >
            <FiArrowRight className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-warm">
              {t('journeyNextLabel')}
            </p>
            <p className="mt-0.5 text-sm font-medium leading-relaxed text-ink">
              {orderJourneyNextStep(status, t)}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
