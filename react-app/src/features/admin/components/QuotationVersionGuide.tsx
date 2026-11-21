/**
 * Myanmar-language guide for creating or editing a quotation version.
 *
 * The page starts from the customer's request items, so the copy explains the
 * confirmed unit prices, the quotation-wide terms, the totals preview, and
 * what happens after the draft is saved (PDF, send, customer decision).
 */
import { AdminGuideDialog } from './AdminGuideDialog';

interface GuideRow {
  term: string;
  description: string;
}

interface GuideSection {
  title: string;
  intro?: string;
  rows: GuideRow[];
}

const BURMESE_DIGITS = ['၁', '၂', '၃', '၄', '၅', '၆', '၇', '၈', '၉'];

const QUICK_START = [
  'ပစ္စည်းတစ်ခုချင်းစီရဲ့ Quantity နဲ့ Confirmed unit price ကို ပေးသွင်းသူ အတည်ပြုချက်အတိုင်း ထည့်ပါ။',
  'လျှော့ပေးမယ်ဆိုရင် Line discount ကို ဖြည့်ပါ။',
  'Supplier delivery date နဲ့ Warranty note ကို ဖြည့်ပါ။',
  'Service fee, Valid until, Delivery fee နဲ့ Payment terms ကို သတ်မှတ်ပါ။',
  'Totals preview မှာ Total ကို ပြန်စစ်ပါ။',
  'Create draft နှိပ်ပြီး သိမ်းပါ။ ပြီးရင် PDF ထုတ်ကာ ဖောက်သည်ထံ ပို့ပါ။',
];

const GUIDE_SECTIONS: GuideSection[] = [
  {
    title: 'Confirmed quotation lines (အတည်ပြုဈေးနှုန်း လိုင်းများ)',
    intro:
      'ပစ္စည်းစာရင်းက ဖောက်သည်ရဲ့ တောင်းဆိုမှုကနေ အလိုအလျောက် လာပါတယ်။ ဒီစာမျက်နှာမှာ ပစ္စည်းအသစ် ထပ်ထည့်လို့မရပါ။',
    rows: [
      {
        term: 'Product name / metadata',
        description:
          'ပစ္စည်းနာမည်၊ SKU၊ ပေးသွင်းသူနဲ့ specification။ ဖောက်သည်တောင်းထားတဲ့ပစ္စည်းနဲ့ ကိုက်ညီမှုကို စစ်ပါ။',
      },
      {
        term: 'Quantity',
        description:
          'ပေးသွင်းသူ အတည်ပြုတဲ့ အရေအတွက်။ အနည်းဆုံး ၁ ဖြစ်ရပါမယ်။ ဖောက်သည်တောင်းထားတာထက် လျှော့ရမယ်ဆိုရင် ဖောက်သည်ကို အသိပေးပါ။',
      },
      {
        term: 'Confirmed unit price (MMK)',
        description:
          'တစ်ခုချင်း အတည်ပြုဈေးနှုန်း။ ပေးသွင်းသူ ပြောတဲ့ဈေးအတိုင်း မြန်မာကျပ် (MMK) နဲ့ ထည့်ပါ။',
      },
      {
        term: 'Line discount (MMK)',
        description:
          'ဒီပစ္စည်းအတွက် လျှော့ပေးမယ့် ပမာဏ။ လျှော့ငွေက အဲဒီလိုင်းတန်ဖိုးထက် မကြီးရပါ။',
      },
      {
        term: 'Line total',
        description:
          'အရေအတွက် × ဈေးနှုန်း − လျှော့ငွေ။ စနစ်က အလိုအလျောက် တွက်ပြပါတယ်။',
      },
      {
        term: 'Supplier delivery date',
        description:
          'ပေးသွင်းသူ ပို့မယ့် ရက်စွဲ။ ဖောက်သည်ကို ကတိပေးမယ့်ရက်နဲ့ ကိုက်ညီအောင် ထည့်ပါ။',
      },
      {
        term: 'Warranty note',
        description:
          'အာမခံကာလ သို့မဟုတ် အာမခံအချက်အလက်။ PDF မှာ ဖောက်သည်မြင်ရပါမယ်။',
      },
      {
        term: 'Supplier note',
        description:
          'ပေးသွင်းသူရဲ့ မှတ်ချက်။ ဥပမာ - အရောင်၊ အရွယ်အစား သို့မဟုတ် ပို့ဆောင်မှု အတည်ပြုချက်။',
      },
      {
        term: 'Remove line',
        description:
          'ပေးသွင်းသူ မပေးနိုင်တဲ့ ပစ္စည်းကို ဖယ်ရှားရန်။ ဖယ်ရှားပြီးရင် ဖောက်သည်ကို ဖုန်းနဲ့ အသိပေးပါ။',
      },
    ],
  },
  {
    title: 'Quotation terms (ဈေးနှုန်း စည်းကမ်းချက်များ)',
    rows: [
      {
        term: 'Service fee percentage',
        description:
          'ဝန်ဆောင်ခ ရာခိုင်နှုန်း။ Master Settings က default ကို ယူထားပြီး ဒီ version အတွက် လိုအပ်ရင် ပြင်နိုင်ပါတယ်။',
      },
      {
        term: 'Valid until',
        description:
          'ဈေးနှုန်း သက်တမ်းကုန်ရက်။ ဒီရက်ကျော်ရင် ဖောက်သည်က လက်ခံလို့မရတော့ပါ။',
      },
      {
        term: 'Quotation discount (MMK)',
        description:
          'တစ်ခုလုံး quotation အတွက် လျှော့ငွေ။ လိုင်းတစ်ခုချင်း Line discount နဲ့ သီးခြားဖြစ်ပါတယ်။',
      },
      {
        term: 'Delivery fee (MMK)',
        description: 'ပို့ဆောင်ခ။ ပို့ဆောင်မှု အခြေအနေပေါ်မူတည်ပြီး သတ်မှတ်ပါ။ ၀ လည်း ထည့်နိုင်ပါတယ်။',
      },
      {
        term: 'Payment terms',
        description:
          'ငွေပေးချေမှု စည်းကမ်း။ ငွေပေးချေနည်းက Cash on Delivery (COD) သတ်မှတ်ထားပါတယ်။',
      },
      {
        term: 'Note to customer',
        description:
          'PDF နဲ့ အီးမေးလ်မှာ ပါမယ့် မှတ်ချက်။ ပို့ချိန် သို့မဟုတ် အထူးအချက်အလက် ထည့်နိုင်ပါတယ်။',
      },
    ],
  },
  {
    title: 'Totals preview (စုစုပေါင်း ကြိုတွက်ချက်)',
    intro: 'ဒီအပိုင်းက preview သာဖြစ်ပြီး သိမ်းတဲ့အခါ ဆာဗာက အတိအကျ ပြန်တွက်ပါတယ်။',
    rows: [
      {
        term: 'Subtotal',
        description: 'လိုင်းအားလုံးရဲ့ တန်ဖိုး ပေါင်းငွေ (လျှော့ငွေ မနှုတ်ရသေး)။',
      },
      {
        term: 'Discount',
        description: 'Quotation discount ပမာဏ။',
      },
      {
        term: 'Delivery fee',
        description: 'ပို့ဆောင်ခ။',
      },
      {
        term: 'Service fee',
        description: 'Subtotal (discount နှုတ်ပြီး) ပေါ်က ဝန်ဆောင်ခ ရာခိုင်နှုန်းအတိုင်း တွက်ထားတဲ့ငွေ။',
      },
      {
        term: 'Total',
        description: 'ဖောက်သည်က ပေးရမယ့် စုစုပေါင်း (COD)။ မပို့ခင် ဒီဂဏန်းကို ပြန်စစ်ပါ။',
      },
    ],
  },
  {
    title: 'Save draft (မူကြမ်း သိမ်းခြင်း)',
    rows: [
      {
        term: 'Create draft / Save draft changes',
        description:
          'ဈေးနှုန်းမူကြမ်းကို သိမ်းပါ။ မူကြမ်းကို ဖောက်သည်က မမြင်ရသေးပါ။ သိမ်းပြီးရင် version detail စာမျက်နှာကို ရောက်ပါမယ်။',
      },
      {
        term: 'နောက်တစ်ဆင့်',
        description:
          'Version detail မှာ Generate PDF နှိပ်ပြီး စစ်ဆေးကာ Send to customer နှိပ်ပါ။ ပို့ပြီးမှ ဖောက်သည်က မြင်ရပါမယ်။',
      },
      {
        term: 'ပို့ပြီးသား version',
        description:
          'ပို့ပြီးသား version ကို ပြင်လို့မရပါ။ ဈေးနှုန်း ပြင်ချင်ရင် version အသစ် ဖန်တီးပါ။',
      },
      {
        term: 'Cancel',
        description: 'မသိမ်းဘဲ ပြန်ထွက်ရန်။ ရိုက်ထားတဲ့ ပြင်ဆင်ချက်တွေ ပျက်သွားပါမယ်။',
      },
    ],
  },
  {
    title: 'မဖြစ်မနေ စစ်ဆေးရန်',
    rows: [
      {
        term: 'ဈေးနှုန်း',
        description: 'ဈေးနှုန်း၊ လျှော့ငွေ၊ ပို့ဆောင်ခ အားလုံးကို မြန်မာကျပ် (MMK) နဲ့ပဲ ထည့်ပါ။',
      },
      {
        term: 'ပေးသွင်းသူ အတည်ပြုချက်',
        description:
          'ပေးသွင်းသူ အတည်မပြုရသေးတဲ့ ဈေးနှုန်း သို့မဟုတ် လက်ကျန်ကို မထည့်ပါနဲ့။ Supplier contact မှတ်တမ်းနဲ့ ကိုက်ညီအောင် ထည့်ပါ။',
      },
      {
        term: 'အရေအတွက်နှင့် ရက်စွဲ',
        description:
          'Quantity နဲ့ Supplier delivery date ကို ဖောက်သည်တောင်းဆိုချက်နဲ့ ကိုက်ညီအောင် စစ်ပါ။ မကိုက်ရင် ဖောက်သည်ကို အသိပေးပါ။',
      },
      {
        term: 'ဖောက်သည်ထံ အသိပေး',
        description:
          'ဈေးနှုန်းပို့ပြီးတိုင်း ဖုန်း သို့မဟုတ် Viber နဲ့ပါ အသိပေးပါ။ အီးမေးလ်တစ်ခုတည်းနဲ့ လွတ်သွားတာမျိုး မဖြစ်ပါစေနဲ့။',
      },
    ],
  },
];

export function QuotationVersionGuide() {
  return (
    <AdminGuideDialog
      eyebrow="နောက်ဆုံးဈေးနှုန်း မူကြမ်း"
      title="Quotation version ဖန်တီးရန် လမ်းညွှန်"
      description="ပေးသွင်းသူ အတည်ပြုထားတဲ့ ဈေးနှုန်းတွေကို ဒီမှာ ထည့်ပြီး ဖောက်သည်ထံ ပို့မယ့် quotation version ကို ဖန်တီးပါတယ်။ အင်္ဂလိပ်စာနဲ့ ပြထားတဲ့ field နာမည်တွေက မျက်နှာပြင်ပေါ်က စာသားအတိုင်း ဖြစ်ပါတယ်။"
      triggerLabel="Quotation version ဖန်တီးပုံ လမ်းညွှန် ဖွင့်ရန်"
      triggerTitle="Quotation version လမ်းညွှန်"
      footerNote="မူကြမ်းကို သိမ်းပြီးမှ PDF ထုတ်ကာ ဖောက်သည်ထံ ပို့နိုင်ပါတယ်။"
    >
      <div>
        <div className="rounded-xl border border-primary/20 bg-primary-light/60 p-4">
          <p className="text-sm font-semibold text-ink">အမြန်စတင်ရန်</p>
          <ol className="mt-2 grid gap-1.5 text-sm text-muted sm:grid-cols-2 sm:gap-x-6">
            {QUICK_START.map((step, index) => (
              <li key={step}>
                {BURMESE_DIGITS[index] ?? index + 1}။ {step}
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-5 space-y-4">
          {GUIDE_SECTIONS.map((section) => (
            <section
              key={section.title}
              className="rounded-xl border border-rule bg-paper/60 p-4"
            >
              <h3 className="text-sm font-semibold text-ink">{section.title}</h3>
              {section.intro ? (
                <p className="mt-1 text-xs leading-5 text-muted">{section.intro}</p>
              ) : null}

              <dl className="mt-3 space-y-2.5">
                {section.rows.map((row) => (
                  <div
                    key={row.term}
                    className="grid gap-0.5 sm:grid-cols-[190px_1fr] sm:gap-4"
                  >
                    <dt className="text-sm font-medium text-ink">{row.term}</dt>
                    <dd className="text-sm leading-6 text-muted">{row.description}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </AdminGuideDialog>
  );
}
