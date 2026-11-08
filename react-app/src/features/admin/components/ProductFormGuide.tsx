/**
 * Field guide for the admin product form.
 *
 * A quiet `?` button in the page header opens a dialog that explains every
 * field, grouped the same way as the form itself. Field names stay in English
 * so they match the form labels; the explanations are written in Myanmar.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { FiHelpCircle, FiX } from 'react-icons/fi';
import { primaryButtonClass } from '../../../components/catalog-ui/CatalogUi';

interface GuideField {
  name: string;
  required?: boolean;
  description: ReactNode;
}

interface GuideSection {
  title: string;
  intro?: string;
  fields: GuideField[];
}

function guideSections(isEdit: boolean): GuideSection[] {
  const sections: GuideSection[] = [
    {
      title: 'Product details (ကုန်ပစ္စည်း အချက်အလက်)',
      intro: 'ဖောက်သည်တွေ မြင်ရမယ့် အခြေခံအချက်အလက်တွေ ဖြစ်ပါတယ်။',
      fields: [
        {
          name: 'Supplier',
          required: true,
          description:
            'ဒီကုန်ပစ္စည်းကို ပေးသွင်းမယ့် supplier ကို ရွေးပါ။ Publish လုပ်ဖို့အတွက် supplier က Active ဖြစ်ရပါမယ်။',
        },
        {
          name: 'Category',
          required: true,
          description:
            'ဖောက်သည်တွေ ရှာဖွေမယ့် catalog အမျိုးအစားကို ရွေးပါ။ Publish လုပ်ဖို့အတွက် category က Active ဖြစ်ရပါမယ်။',
        },
        {
          name: 'Name (Burmese)',
          required: true,
          description:
            'ဖောက်သည်တွေ မြင်ရမယ့် မြန်မာစာနာမည်။ စာလုံး ၂၅၅ လုံးအထိ ရိုက်နိုင်ပါတယ်။',
        },
        {
          name: 'Name (English)',
          description:
            'ရွေးချယ်နိုင်တဲ့ အင်္ဂလိပ်နာမည်။ Slug ကို မဖြည့်ထားရင် ဒီနာမည်ကနေ slug ကို အလိုအလျောက် ဖန်တီးပါမယ်။',
        },
        {
          name: 'Slug',
          description:
            'URL အတွက် ရွေးချယ်နိုင်တဲ့ identifier။ စာလုံးအသေး၊ ဂဏန်းနဲ့ တစ်ခုတည်းသော hyphen (-) ကို သုံးပါ။ ဥပမာ - office-chair။ မဖြည့်ထားရင် အင်္ဂလိပ်နာမည်ကနေ အလိုအလျောက် ဖန်တီးပါမယ်။',
        },
        {
          name: 'SKU',
          description:
            'ရွေးချယ်နိုင်တဲ့ ကုန်ပစ္စည်းကုဒ်။ ထပ်မနေအောင် သတိထားပြီး ထည့်ပါ။',
        },
        {
          name: 'Brand',
          description: 'ရွေးချယ်နိုင်တဲ့ အမှတ်တံဆိပ် သို့မဟုတ် ထုတ်လုပ်သူနာမည်။',
        },
        {
          name: 'Model',
          description: 'ရွေးချယ်နိုင်တဲ့ မော်ဒယ်နံပါတ် သို့မဟုတ် မော်ဒယ်ကုဒ်။',
        },
        {
          name: 'Unit',
          required: true,
          description:
            'မဖြစ်မနေ ဖြည့်ရမယ့် ရောင်းချယူနစ်။ ဥပမာ - တစ်ခု၊ အစုံ၊ သေတ္တာ။ စာလုံး ၅၀ အထိ ရိုက်နိုင်ပါတယ်။',
        },
        {
          name: 'Package size',
          description:
            'ရွေးချယ်နိုင်တဲ့ ထုပ်ပိုးအချက်အလက်။ ဥပမာ - တစ်သေတ္တာလျှင် ၁၀ ခု။',
        },
        {
          name: 'Size',
          description:
            'ရွေးချယ်နိုင်တဲ့ အရွယ်အစား။ ဥပမာ - A4 သို့မဟုတ် ၃၀ × ၄၀ စင်တီမီတာ။',
        },
        {
          name: 'Color',
          description: 'ရွေးချယ်နိုင်တဲ့ အရောင် သို့မဟုတ် finish။',
        },
      ],
    },
    {
      title: 'Description (ဖော်ပြချက်)',
      fields: [
        {
          name: 'Description',
          description:
            'ရွေးချယ်နိုင်တဲ့ ဖောက်သည်မြင်ရမယ့် ဖော်ပြချက်။ ကုန်ပစ္စည်းက ဘာလဲ၊ ဘယ်သူအတွက်လဲ၊ ဘာတွေပါဝင်လဲ ရေးပါ။ စာလုံး ၅,၀၀၀ အထိ ရိုက်နိုင်ပါတယ်။',
        },
        {
          name: 'Specification',
          description:
            'ရွေးချယ်နိုင်တဲ့ နည်းပညာအချက်အလက်၊ ပစ္စည်း၊ တိုင်းတာမှု သို့မဟုတ် အာမခံအချက်အလက်။ စာလုံး ၅,၀၀၀ အထိ ရိုက်နိုင်ပါတယ်။',
        },
      ],
    },
    {
      title: 'Photo (ဓာတ်ပုံ)',
      fields: [
        {
          name: 'Product photo',
          required: !isEdit,
          description: isEdit
            ? 'JPEG, PNG သို့မဟုတ် WebP၊ ၂ MB အထိ။ လက်ရှိပုံကို ထားချင်ရင် မရွေးပါနဲ့။ ပုံအသစ်တင်ရင် လက်ရှိပုံကို အစားထိုးပါမယ်။'
            : 'JPEG, PNG သို့မဟုတ် WebP၊ ၂ MB အထိ။ ကုန်ပစ္စည်းအသစ်ဖန်တီးဖို့ မဖြစ်မနေ လိုအပ်ပါတယ်။ ကုန်ပစ္စည်းကို ကောင်းကောင်းမြင်ရပြီး အလင်းရောင်ကောင်းတဲ့ ပုံကို သုံးပါ။',
        },
      ],
    },
    {
      title: 'Variants (ရွေးချယ်စရာများ)',
      intro:
        'ရွေးချယ်နိုင်တဲ့အပိုင်း။ တူညီတဲ့ကုန်ပစ္စည်းကို အရောင်၊ အရွယ်အစား သို့မဟုတ် option များနဲ့ ရောင်းချရင် “This product has variants” ကို အမှန်ခြစ်ပါ။ တစ်ခုတည်းသော ကုန်ပစ္စည်းဆိုရင် မခြစ်ထားပါနဲ့။',
      fields: [
        {
          name: 'Variant name',
          required: true,
          description:
            'ဖောက်သည်တွေ မှတ်မိလွယ်တဲ့ သီးခြား option နာမည်။ ဥပမာ - အနီ / M။',
        },
        {
          name: 'Variant image',
          description: 'ရွေးချယ်နိုင်တဲ့အပိုင်း။ မထည့်ထားရင် ကုန်ပစ္စည်းပုံကို သုံးပါမယ်။',
        },
        {
          name: 'Variant SKU',
          description: 'ဒီ variant အတွက် ရွေးချယ်နိုင်တဲ့ ကုဒ်။',
        },
        {
          name: 'Retail (MMK)',
          required: true,
          description:
            'ဒီ variant အတွက် မဖြစ်မနေ ဖြည့်ရမယ့် လက်လီစျေးနှုန်း။ ၀ ထက်ကြီးရပါမယ်။',
        },
        {
          name: 'Wholesale / Discount',
          description:
            'ရွေးချယ်နိုင်တဲ့ variant စျေးနှုန်းများ (MMK)။ လျှော့စျေးက variant လက်လီစျေးထက် မကြီးရပါ။',
        },
        {
          name: 'MOQ',
          description:
            'ဒီ variant အတွက် ဖောက်သည်တွေ အနည်းဆုံး မှာယူနိုင်တဲ့ အရေအတွက်။',
        },
        {
          name: 'Stock status / quantity',
          description: 'ဒီ variant အတွက် ရွေးချယ်နိုင်တဲ့ စတော့အချက်အလက်။',
        },
      ],
    },
    {
      title: 'Pricing (စျေးနှုန်း)',
      intro:
        'စျေးနှုန်းများကို MMK နဲ့ ဖြည့်ပါ။ လက်လီစျေးက မဖြစ်မနေ လိုအပ်ပြီး ကျန်တာ ရွေးချယ်နိုင်ပါတယ်။',
      fields: [
        {
          name: 'Retail price',
          required: true,
          description:
            'မဖြစ်မနေ ဖြည့်ရမယ့် ရောင်းချစျေးနှုန်း (MMK)။ ၀ ထက်ကြီးရပါမယ်။',
        },
        {
          name: 'Wholesale price',
          description: 'ရွေးချယ်နိုင်တဲ့ လက်ကားစျေးနှုန်း (MMK)။',
        },
        {
          name: 'Discount price',
          description:
            'ရွေးချယ်နိုင်တဲ့ လျှော့စျေးနှုန်း။ လက်လီစျေးထက် မကြီးရပါ။',
        },
        {
          name: 'Minimum order quantity',
          description:
            'ရွေးချယ်နိုင်တဲ့ ဖောက်သည်တွေ အနည်းဆုံး မှာယူနိုင်တဲ့ အရေအတွက်။',
        },
        {
          name: 'Price valid until',
          description:
            'စျေးနှုန်းကို ပြန်စစ်ဆေးရမယ့် ရွေးချယ်နိုင်တဲ့ ရက်စွဲ။ သက်တမ်းမရှိရင် မဖြည့်ပါနဲ့။',
        },
      ],
    },
    {
      title: 'Stock (စတော့)',
      intro:
        'ရွေးချယ်နိုင်တဲ့အပိုင်း။ စတော့အချက်အလက် မဖြည့်ချင်ရင် ကွက်လပ်ထားပါ။',
      fields: [
        {
          name: 'Stock status',
          description:
            'In stock (လက်ကျန်ရှိ)၊ low stock (လက်ကျန်နည်း)၊ out of stock (ကုန်သွား) သို့မဟုတ် pre-order (ကြိုမှာယူ)။ မဖြည့်ချင်ရင် “Not set” ကို ထားပါ။ Edit လုပ်ရင် “Not set” ထားရင် လက်ရှိအခြေအနေကို ထိန်းထားပါမယ်။',
        },
        {
          name: 'Stock quantity',
          description: 'လက်ကျန်အရေအတွက်။ မသိရင် ကွက်လပ်ထားပါ။',
        },
        {
          name: 'Supplier note',
          description:
            'supplier အတည်ပြုထားတဲ့အချက်။ ဥပမာ - လက်ကျန်ရှိ/မရှိ၊ ပို့ဆောင်ချိန် သို့မဟုတ် အာမခံအချက်အလက်။',
        },
      ],
    },
  ];

  if (isEdit) {
    sections.push({
      title: 'Status (အခြေအနေ)',
      intro: 'သိမ်းပြီးနောက် Status ကို products list ကနေ စီမံပါတယ်။',
      fields: [
        {
          name: 'Current status',
          description:
            'Publish လုပ်၊ Hide လုပ်၊ out of stock သတ်မှတ် သို့မဟုတ် draft ပြန်ရွှေ့ချင်ရင် products list ရဲ့ action menu ကို သုံးပါ။',
        },
      ],
    });
  } else {
    sections.push({
      title: 'Status (အခြေအနေ)',
      intro: 'ကုန်ပစ္စည်းကို catalog ထဲ ဘယ်လိုထည့်မလဲ ရွေးပါ။',
      fields: [
        {
          name: 'Status',
          required: true,
          description:
            'Draft ကို ရွေးရင် ဖောက်သည်တွေ မမြင်ရသေးဘဲ နောက်မှ Publish လုပ်နိုင်ပါတယ်။ Published ကို ရွေးရင် catalog မှာ ချက်ချင်းပေါ်ပါမယ်။ Publish လုပ်ဖို့ supplier နဲ့ category က Active ဖြစ်ရမယ်၊ ပုံရှိရမယ်၊ လက်လီစျေးက ၀ ထက်ကြီးရပါမယ်။',
        },
      ],
    });
  }

  return sections;
}

export function ProductFormGuide({ isEdit }: { isEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusFirstControl = () => {
      dialogRef.current?.querySelector<HTMLElement>('button')?.focus();
    };
    const frame = window.requestAnimationFrame(focusFirstControl);

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ),
      );

      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const sections = guideSections(isEdit);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="ကုန်ပစ္စည်း field လမ်းညွှန် ဖွင့်ရန်"
        aria-haspopup="dialog"
        title="Field လမ်းညွှန်"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-gray-500 shadow-sm hover:border-primary/30 hover:bg-accent-soft hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-safe:transition-colors"
      >
        <FiHelpCircle aria-hidden="true" className="h-5 w-5" />
      </button>

      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-[120] flex items-center justify-center bg-ink/45 p-3 sm:p-6"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) close();
              }}
            >
              <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                tabIndex={-1}
                className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-2xl outline-none sm:max-h-[calc(100vh-3rem)]"
              >
                <header className="flex items-start justify-between gap-4 border-b border-rule px-5 py-4 sm:px-6">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                      {isEdit ? 'ကုန်ပစ္စည်း ပြင်ဆင်ရန်' : 'ကုန်ပစ္စည်းအသစ်'}
                    </p>
                    <h2 id={titleId} className="mt-0.5 text-xl font-semibold text-ink">
                      ကုန်ပစ္စည်း ဖြည့်စွက်ရန် လမ်းညွှန်
                    </h2>
                    <p id={descriptionId} className="mt-1 text-sm text-muted">
                      အောက်က form ရဲ့ field တစ်ခုချင်းစီမှာ ဘာဖြည့်ရမလဲဆိုတာ အစုအဖွဲ့လိုက်
                      ဖော်ပြထားပါတယ်။
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={close}
                    aria-label="လမ်းညွှန် ပိတ်ရန်"
                    className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 motion-safe:transition-colors"
                  >
                    <FiX aria-hidden="true" className="h-5 w-5" />
                  </button>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                  <div className="rounded-xl border border-primary/20 bg-primary-light/60 p-4">
                    <p className="text-sm font-semibold text-ink">အမြန်စတင်ရန်</p>
                    <ol className="mt-2 grid gap-1.5 text-sm text-muted sm:grid-cols-2 sm:gap-x-6">
                      <li>၁။ အသုံးပြုနေတဲ့ supplier နဲ့ category ကို ရွေးပါ။</li>
                      <li>၂။ မြန်မာစာနာမည်နဲ့ ရောင်းချမယ့် ယူနစ်ကို ထည့်ပါ။</li>
                      <li>၃။ ကုန်ပစ္စည်းပုံကို ရှင်းရှင်းလင်းလင်း တင်ပါ။</li>
                      <li>၄။ လက်လီစျေးနှုန်းကို MMK နဲ့ သတ်မှတ်ပါ။</li>
                      <li>၅။ ကုန်ပစ္စည်းမှာ option များရှိမှသာ Variants ကို ဖြည့်ပါ။</li>
                      <li>၆။ အားလုံးအဆင်သင့်ဖြစ်ရင် Draft အဖြစ်သိမ်းပါ သို့မဟုတ် Publish လုပ်ပါ။</li>
                    </ol>
                    <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-muted">
                      <span aria-hidden="true" className="text-base leading-none text-error">
                        *
                      </span>
                      မဖြစ်မနေ ဖြည့်ရန်
                    </p>
                  </div>

                  <div className="mt-5 space-y-4">
                    {sections.map((section) => (
                      <section
                        key={section.title}
                        className="rounded-xl border border-rule bg-paper/60 p-4"
                      >
                        <h3 className="text-sm font-semibold text-ink">{section.title}</h3>
                        {section.intro ? (
                          <p className="mt-1 text-xs leading-5 text-muted">{section.intro}</p>
                        ) : null}

                        <dl className="mt-3 space-y-2.5">
                          {section.fields.map((field) => (
                            <div
                              key={field.name}
                              className="grid gap-0.5 sm:grid-cols-[170px_1fr] sm:gap-4"
                            >
                              <dt className="text-sm font-medium text-ink">
                                {field.name}
                                {field.required ? (
                                  <>
                                    <span aria-hidden="true" className="ml-0.5 text-error">
                                      *
                                    </span>
                                    <span className="sr-only"> (မဖြစ်မနေ ဖြည့်ရန်)</span>
                                  </>
                                ) : null}
                              </dt>
                              <dd className="text-sm leading-6 text-muted">
                                {field.description}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </section>
                    ))}
                  </div>
                </div>

                <footer className="flex items-center justify-between gap-3 border-t border-rule bg-white px-5 py-3 sm:px-6">
                  <p className="text-xs text-subtle">
                    သိမ်းပြီးနောက် ဒီအချက်အလက်တွေကို ပြင်ဆင်နိုင်ပါတယ်။
                  </p>
                  <button type="button" onClick={close} className={primaryButtonClass}>
                    နားလည်ပါပြီ
                  </button>
                </footer>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
