import { useEffect } from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { FiRefreshCw, FiWifiOff } from 'react-icons/fi';
import { useI18n } from '../lib/i18n-context';

const COPY = {
  en: {
    offlineTitle: "You're offline",
    offlineBody:
      'This page is not available offline yet. Reconnect to the internet, then try again.',
    updateTitle: 'This page needs a refresh',
    updateBody:
      'The app was updated while this page was open, or a file could not be downloaded. Reload to get the latest version.',
    genericTitle: 'Something went wrong',
    genericBody:
      'This page could not be displayed. Try reloading. If the problem continues, go back to the home page.',
    notFoundTitle: 'Page not found',
    notFoundBody: 'The page you requested does not exist or has moved.',
    reload: 'Reload',
    home: 'Go to home',
  },
  my: {
    offlineTitle: 'အော့ဖ်လိုင်း ဖြစ်နေပါသည်',
    offlineBody:
      'ဤစာမျက်နှာကို အော့ဖ်လိုင်းတွင် မရနိုင်သေးပါ။ အင်တာနက် ပြန်ချိတ်ပြီး ထပ်စမ်းပါ။',
    updateTitle: 'စာမျက်နှာကို ပြန်ဖွင့်ရန် လိုအပ်ပါသည်',
    updateBody:
      'အက်ပ် အသစ်ပြောင်းထားသည် သို့မဟုတ် ဖိုင်တစ်ခု ဒေါင်းလုဒ် မရဖြစ်နေသည်။ နောက်ဆုံးဗားရှင်း ရဖို့ ပြန်ဖွင့်ပါ။',
    genericTitle: 'တစ်ခုခု မှားယွင်းနေပါသည်',
    genericBody:
      'ဤစာမျက်နှာကို ပြသနိုင်ခြင်း မရှိပါ။ ပြန်ဖွင့်ကြည့်ပါ။ မပြေလည်ပါက ပင်မစာမျက်နှာသို့ သွားပါ။',
    notFoundTitle: 'စာမျက်နှာ မတွေ့ပါ',
    notFoundBody: 'သင်တောင်းထားသော စာမျက်နှာ မရှိပါ သို့မဟုတ် နေရာပြောင်းထားပါသည်။',
    reload: 'ပြန်ဖွင့်ရန်',
    home: 'ပင်မသို့',
  },
} as const;

function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');

  return /failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module/i.test(
    message,
  );
}

/**
 * Router-level error boundary.
 *
 * Covers chunk-load failures that happen when a lazy route is opened while
 * offline, and stale chunks after a deployment. It deliberately avoids
 * exposing stack traces in production.
 */
export function RouteErrorPage() {
  const error = useRouteError();
  const { locale } = useI18n();
  const copy = COPY[locale];
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;
  const chunkError = isChunkLoadError(error);
  const status = isRouteErrorResponse(error) ? error.status : null;

  useEffect(() => {
    if (!offline) return;

    const reloadWhenBackOnline = () => window.location.reload();
    window.addEventListener('online', reloadWhenBackOnline);

    return () => window.removeEventListener('online', reloadWhenBackOnline);
  }, [offline]);

  const title =
    status === 404
      ? copy.notFoundTitle
      : offline
        ? copy.offlineTitle
        : chunkError
          ? copy.updateTitle
          : copy.genericTitle;

  const body =
    status === 404
      ? copy.notFoundBody
      : offline
        ? copy.offlineBody
        : chunkError
          ? copy.updateBody
          : copy.genericBody;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
          <FiWifiOff aria-hidden="true" className="h-6 w-6" />
        </div>

        <h1 className="mt-4 text-xl font-bold text-slate-900 sm:text-2xl">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>

        {import.meta.env.DEV && error instanceof Error ? (
          <pre className="mt-4 overflow-auto rounded-lg bg-slate-950 p-3 text-left text-xs text-slate-200">
            {error.message}
          </pre>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            <FiRefreshCw aria-hidden="true" className="h-4 w-4" />
            {copy.reload}
          </button>
          <a
            href="/"
            className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            {copy.home}
          </a>
        </div>
      </div>
    </div>
  );
}
