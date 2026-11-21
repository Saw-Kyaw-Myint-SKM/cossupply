/**
 * Myanmar-language guide for the admin quotation request workspace.
 *
 * The `?` button in the page header opens a dialog that walks through the
 * whole flow: assignment, supplier contact, workflow status, the quotation
 * draft, PDF/email delivery, and the customer's decision. UI labels stay in
 * English so they match the buttons on screen; everything else is Myanmar.
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

const GUIDE_SECTIONS: GuideSection[] = [
  {
    title: 'တောင်းဆိုမှု အချက်အလက် (Request)',
    intro:
      'ဖောက်သည်တင်ထားတဲ့ တောင်းဆိုမှုကို မဆက်သွယ်ခင် အရင်စစ်ပါ။',
    rows: [
      {
        term: 'Quotation number',
        description:
          'စနစ်က အလိုအလျောက် ပေးထားတဲ့ တောင်းဆိုမှုနံပါတ်။ ဖောက်သည်နဲ့ ဖုန်း/Viber/အီးမေးလ် ဆက်သွယ်တိုင်း ဒီနံပါတ်ကို ပြောပါ။',
      },
      {
        term: 'Status',
        description:
          'လက်ရှိ အခြေအနေ။ အောက်က Workflow status ကနေ နောက်အဆင့်ကို ရွှေ့ပါ။ အဆင့်တွေကို ကျော်ပြီး မရွှေ့နိုင်ပါ။',
      },
      {
        term: 'Customer',
        description:
          'ဖောက်သည်နာမည်၊ ကုမ္ပဏီ၊ ဖုန်း၊ အီးမေးလ်နဲ့ ပို့ဆောင်ရမယ့် လိပ်စာ။ ပစ္စည်းပို့ရမယ့် လိပ်စာနဲ့ ဖုန်းနံပါတ်ကို သေချာစစ်ပါ။',
      },
      {
        term: 'Items',
        description:
          'ဖောက်သည်တောင်းထားတဲ့ ပစ္စည်းစာရင်း၊ အရေအတွက်နဲ့ လိုချင်တဲ့ ရက်စွဲ။ ပေးသွင်းသူတွေဆီ ဒီစာရင်းအတိုင်း မေးပါ။',
      },
      {
        term: 'Customer note',
        description:
          'ဖောက်သည်ထည့်ထားတဲ့ မှတ်ချက်။ အထူးတောင်းဆိုချက် (အရောင်၊ အရွယ်အစား၊ ပို့ချိန်) ရှိရင် ဒီမှာ ဖတ်ပါ။',
      },
    ],
  },
  {
    title: 'တာဝန်ပေးခြင်း (Assignment)',
    rows: [
      {
        term: 'Responsible Admin',
        description:
          'ဒီတောင်းဆိုမှုကို ကိုင်တွယ်မယ့် admin ကို ရွေးပါ။ တစ်ယောက်တည်း ကိုင်တွယ်မယ်ဆိုရင် “Assign to me” ကို နှိပ်လိုက်ရုံပါ။',
      },
      {
        term: 'Save assignment',
        description:
          'ရွေးချယ်မှုကို သိမ်းပါ။ အဖွဲ့ထဲက တခြားသူတွေ ဘယ်သူကိုင်နေတယ်ဆိုတာ သိရအောင် တောင်းဆိုမှုတိုင်းမှာ တာဝန်ရှိသူ သတ်မှတ်ထားပါ။',
      },
    ],
  },
  {
    title: 'Workflow status (အဆင့်ဆင့် လုပ်ငန်းစဉ်)',
    intro:
      'ခလုတ်တွေက လက်ရှိအဆင့်အလိုက် ပေါ်ပါတယ်။ အောက်ပါအစဉ်အတိုင်း ရွှေ့ပါ။',
    rows: [
      {
        term: 'Start supplier contact',
        description:
          'ပေးသွင်းသူတွေကို စတင်ဆက်သွယ်တဲ့အဆင့်။ ဖုန်း၊ Viber သို့မဟုတ် အီးမေးလ်နဲ့ ဆက်သွယ်ပြီးမှ နှိပ်ပါ။',
      },
      {
        term: 'Awaiting responses',
        description:
          'ပေးသွင်းသူဆီ ပို့ပြီး တုံ့ပြန်ချက် စောင့်နေတဲ့အဆင့်။ ပြန်မရသေးရင် “Contacting again” နဲ့ ပြန်ဆက်သွယ်နိုင်ပါတယ်။',
      },
      {
        term: 'Ready to prepare quote',
        description:
          'ဈေးနှုန်း၊ လက်ကျန်နဲ့ ပို့ချိန် ရပြီဆိုရင် ဒီခလုတ်နဲ့ ဈေးနှုန်းမူကြမ်း ပြင်ဆင်တဲ့အဆင့်ကို ရွှေ့ပါ။',
      },
      {
        term: 'Final quotation',
        description:
          'စာမျက်နှာအပေါ်ဘက်က ဒီခလုတ်က လက်ရှိ version ကို ဖွင့်ပါတယ်။ version မရှိသေးရင် အသစ်ဖန်တီးတဲ့ စာမျက်နှာကို ရောက်ပါမယ်။',
      },
      {
        term: 'Customer reviewing',
        description:
          'ဖောက်သည်ထံ ပို့ပြီး ပြန်ကြည့်နေတဲ့အဆင့်။ ဖောက်သည်ရဲ့ ဆုံးဖြတ်ချက်ကို စောင့်ပါ။ ဖုန်းနဲ့ လိုက်ပြီး အသိပေးပါ။',
      },
      {
        term: 'Prepare revision',
        description:
          'ဖောက်သည်က ပြင်ဆင်ချင်တာရှိလို့ ပြန်တောင်းထားတာပါ။ version အသစ် ဖန်တီးပြီး ပြန်ပို့ပါ။',
      },
      {
        term: 'Prepare new version',
        description:
          'ဈေးနှုန်း သက်တမ်းကုန်သွားရင် ဒီခလုတ်နဲ့ version အသစ် ဖန်တီးပါ။',
      },
      {
        term: 'Mark accepted / Mark rejected',
        description:
          'ဖောက်သည်နဲ့ ဖုန်းအဆက်အသွယ်ပြီး အတည်ပြုချင်ရင် သုံးပါ။ ပုံမှန်အားဖြင့် ဖောက်သည်ကိုယ်တိုင် Accept/Reject လုပ်ပါစေ — ဖောက်သည်ကိုယ်တိုင် Accept လုပ်မှ order အလိုအလျောက် ဖန်တီးပါတယ်။',
      },
      {
        term: 'Cancel request',
        description:
          'မလုပ်တော့ဘူးဆိုမှသာ နှိပ်ပါ။ Cancel လုပ်ပြီးရင် ပြန်မရနိုင်ပါ။',
      },
    ],
  },
  {
    title: 'ပေးသွင်းသူ ဆက်သွယ်မှု (Supplier contact)',
    intro:
      'ပစ္စည်းတွေကို ပေးသွင်းသူအလိုက် အုပ်စုဖွဲ့ပြထားပါတယ်။ အုပ်စုတစ်ခုချင်းစီမှာ ဆက်သွယ်မှု မှတ်တမ်း ထည့်နိုင်ပါတယ်။',
    rows: [
      {
        term: 'Message sent to supplier',
        description:
          'ပေးသွင်းသူဆီ ပို့ခဲ့တဲ့ စာသား။ ပစ္စည်း၊ အရေအတွက်၊ လိုချင်တဲ့ ရက်စွဲနဲ့ မေးခွန်းတွေကို ထည့်ပါ။',
      },
      {
        term: 'Supplier response',
        description:
          'ပေးသွင်းသူ ပြန်ဖြေတဲ့ ဈေးနှုန်း၊ လက်ကျန်၊ ပို့ချိန် သို့မဟုတ် အာမခံအချက်အလက်။ ရတဲ့အတိုင်း အတိအကျ မှတ်တမ်းတင်ပါ။',
      },
      {
        term: 'Attachment',
        description:
          'ပေးသွင်းသူရဲ့ စာရွက်စာတမ်း သို့မဟုတ် ဓာတ်ပုံ။ PDF, JPG, PNG, WebP ဖိုင်များ ၅ MB အထိ တင်နိုင်ပါတယ်။',
      },
      {
        term: 'Log contact',
        description:
          'မှတ်တမ်း သိမ်းပါ။ မှတ်တမ်းတွေက ဖျက်လို့မရဘဲ အစဉ်လိုက် သိမ်းထားတာကြောင့် နောက်ပိုင်း ပြဿနာရှိရင် ပြန်စစ်နိုင်ပါတယ်။',
      },
    ],
  },
  {
    title: 'နောက်ဆုံးဈေးနှုန်း (Final quotation)',
    intro:
      'Final Quotation ကနေ version အသစ် ဖန်တီးပြီး ပစ္စည်းတစ်ခုချင်းစီရဲ့ အတည်ပြုဈေးနှုန်းကို ဖြည့်ပါ။',
    rows: [
      {
        term: 'Quantity',
        description: 'ပေးသွင်းသူ အတည်ပြုတဲ့ အရေအတွက်။ ဖောက်သည်တောင်းထားတာထက် လျှော့ရမယ်ဆိုရင် ဖောက်သည်ကို အသိပေးပါ။',
      },
      {
        term: 'Confirmed unit price (MMK)',
        description: 'တစ်ခုချင်း အတည်ပြုဈေးနှုန်း။ အားလုံးကို မြန်မာကျပ် (MMK) နဲ့ ထည့်ပါ။',
      },
      {
        term: 'Line discount (MMK)',
        description: 'ဒီပစ္စည်းအတွက် လျှော့ပေးမယ့် ပမာဏ။ လျှော့ငွေက အဲဒီလိုင်းတန်ဖိုးထက် မကြီးရပါ။',
      },
      {
        term: 'Line total',
        description: 'အရေအတွက် × ဈေးနှုန်း − လျှော့ငွေ။ စနစ်က အလိုအလျောက် တွက်ပြပါတယ်။',
      },
      {
        term: 'Supplier delivery date',
        description: 'ပေးသွင်းသူ ပို့မယ့် ရက်စွဲ။ ဖောက်သည်ကို ကတိပေးမယ့်ရက်နဲ့ ကိုက်ညီအောင် ထည့်ပါ။',
      },
      {
        term: 'Warranty note / Supplier note',
        description: 'အာမခံအချက်အလက်နဲ့ ပေးသွင်းသူရဲ့ မှတ်ချက်။ PDF မှာ ဖောက်သည်မြင်ရပါမယ်။',
      },
      {
        term: 'Remove line',
        description:
          'ပေးသွင်းသူ မပေးနိုင်တဲ့ ပစ္စည်းကို ဖယ်ရှားရန်။ ဖယ်ရှားပြီးရင် ဖောက်သည်ကို ဖုန်းနဲ့ အသိပေးပါ။',
      },
      {
        term: 'Service fee percentage',
        description:
          'ဝန်ဆောင်ခ ရာခိုင်နှုန်း။ Master Settings က default ကို ယူပြီး ဒီ version အတွက် လိုအပ်ရင် ပြင်နိုင်ပါတယ်။',
      },
      {
        term: 'Valid until',
        description: 'ဈေးနှုန်း သက်တမ်းကုန်ရက်။ ဒီရက်ကျော်ရင် ဖောက်သည်က လက်ခံလို့မရတော့ပါ။',
      },
      {
        term: 'Quotation discount (MMK)',
        description: 'တစ်ခုလုံး quotation အတွက် လျှော့ငွေ။ လိုင်းတစ်ခုချင်း လျှော့ငွေနဲ့ မတူပါ။',
      },
      {
        term: 'Delivery fee (MMK)',
        description: 'ပို့ဆောင်ခ။ ပို့ဆောင်မှု အခြေအနေပေါ်မူတည်ပြီး သတ်မှတ်ပါ။',
      },
      {
        term: 'Payment terms',
        description:
          'ငွေပေးချေမှု စည်းကမ်း။ ငွေပေးချေနည်းက Cash on Delivery (COD) သတ်မှတ်ထားပါတယ်။',
      },
      {
        term: 'Note to customer',
        description: 'PDF နဲ့ အီးမေးလ်မှာ ပါမယ့် မှတ်ချက်။ ပို့ချိန် သို့မဟုတ် အထူးအချက်အလက် ထည့်နိုင်ပါတယ်။',
      },
      {
        term: 'Totals preview',
        description:
          'Subtotal, discount, delivery fee, service fee နဲ့ Total ကို ပြထားပါတယ်။ ဒါက preview သာဖြစ်ပြီး သိမ်းတဲ့အခါ ဆာဗာက ပြန်တွက်ပါတယ်။',
      },
      {
        term: 'Create draft / Save draft changes',
        description:
          'ဈေးနှုန်းမူကြမ်းကို သိမ်းပါ။ မပို့မချင်း ပြင်လို့ရပါတယ်။ မူကြမ်းကို ဖောက်သည်က မမြင်ရပါ။',
      },
    ],
  },
  {
    title: 'PDF နှင့် ဖောက်သည်ထံ ပို့ခြင်း',
    rows: [
      {
        term: 'Generate PDF',
        description: 'ဈေးနှုန်းစာရွက် PDF ဖန်တီးပါ။ ဖောက်သည်ထံ မပို့ခင် အကြိမ်ကြိမ် စစ်ပါ။',
      },
      {
        term: 'Download PDF',
        description:
          'PDF ကို ဒေါင်းလုဒ်လုပ်ပါ။ Viber သို့မဟုတ် Telegram နဲ့ ကိုယ်တိုင် မျှဝေလိုရင် ဒီဖိုင်ကို သုံးပါ။',
      },
      {
        term: 'Send to customer',
        description:
          'PDF ဖန်တီး၊ version ကို lock လုပ်ပြီး ဖောက်သည်ထံ အီးမေးလ် ပို့ပါတယ်။ ပို့ပြီးရင် ဒီ version ကို ပြင်လို့မရတော့ပါ။',
      },
      {
        term: 'Resend email',
        description:
          'အီးမေးလ် မရောက်ရင် ပြန်ပို့ပါ။ မရသေးရင် Admin → Email delivery log မှာ error ကို စစ်ပါ။',
      },
      {
        term: 'New version',
        description:
          'ဈေးနှုန်း ပြင်ချင်ရင် version အသစ် ဖန်တီးပါ။ အသစ်က current ဖြစ်သွားပြီး အဟောင်းက superseded ဖြစ်ပါမယ်။',
      },
      {
        term: 'Share PDF',
        description:
          'CoSupply က အီးမေးလ်ကိုပဲ အလိုအလျောက် ပို့ပါတယ်။ Viber/Telegram ကနေ မျှဝေချင်ရင် PDF ကို ဒေါင်းလုဒ်လုပ်ပြီး ကိုယ်တိုင် တွဲပို့ပါ။',
      },
    ],
  },
  {
    title: 'ဖောက်သည်ရဲ့ တုံ့ပြန်မှု',
    rows: [
      {
        term: 'Accept',
        description:
          'ဖောက်သည်က လက်ခံရင် order အလိုအလျောက် ဖန်တီးပါတယ်။ ပြီးရင် Admin → Orders မှာ ဆက်လုပ်နိုင်ပါတယ်။',
      },
      {
        term: 'Reject',
        description: 'ငြင်းပယ်ရင် ဒီတောင်းဆိုမှု ပြီးဆုံးပါမယ်။ ဘာကြောင့်ငြင်းတာလဲဆိုတာ ဖုန်းနဲ့ မေးပြီး မှတ်ထားပါ။',
      },
      {
        term: 'Change requested',
        description:
          'ဖောက်သည်က မှတ်ချက်နဲ့ ပြင်ဆင်ချင်တာကို ပြန်တောင်းပါမယ်။ version အသစ် ဖန်တီးပြီး ပြန်ပို့ပါ။',
      },
      {
        term: 'Expired',
        description:
          'သက်တမ်းကျော်သွားတဲ့ ဈေးနှုန်း။ လိုအပ်ရင် version အသစ် ဖန်တီးပြီး သက်တမ်းအသစ် သတ်မှတ်ပါ။',
      },
    ],
  },
  {
    title: 'သတိပြုရန်',
    rows: [
      {
        term: 'ငွေပမာဏ',
        description: 'ဈေးနှုန်း၊ လျှော့ငွေ၊ ပို့ဆောင်ခ အားလုံးကို မြန်မာကျပ် (MMK) နဲ့ပဲ ထည့်ပါ။',
      },
      {
        term: 'ပို့ပြီးသား version',
        description:
          'ပို့ပြီးသား version ကို ပြင်လို့မရပါ။ ပြင်ချင်ရင် version အသစ် ဖန်တီးပါ။',
      },
      {
        term: 'မှတ်တမ်းများ',
        description: 'Supplier contact မှတ်တမ်းတွေကို ဖျက်လို့မရပါ။ မှန်ကန်တာကို သေချာပြီးမှ သိမ်းပါ။',
      },
      {
        term: 'Status အစဉ်',
        description:
          'Workflow status တွေကို အစဉ်လိုက် ရွှေ့ပါ။ ကျော်လိုက်ရင် စနစ်က ငြင်းပါလိမ့်မယ်။',
      },
      {
        term: 'ဖောက်သည်ထံ အသိပေး',
        description:
          'ဈေးနှုန်းပို့ပြီးတိုင်း ဖုန်း သို့မဟုတ် Viber နဲ့ပါ အသိပေးပါ။ အီးမေးလ်တစ်ခုတည်းနဲ့ လွတ်သွားတာမျိုး မဖြစ်ပါစေနဲ့။',
      },
    ],
  },
];

const BURMESE_DIGITS = ['၁', '၂', '၃', '၄', '၅', '၆', '၇', '၈', '၉'];

const QUICK_START = [
  'တောင်းဆိုမှု အချက်အလက်နဲ့ ပစ္စည်းစာရင်းကို စစ်ပါ။',
  'Responsible Admin မှာ ကိုင်တွယ်မယ့်သူကို ရွေးပြီး Save assignment နှိပ်ပါ။',
  'Start supplier contact နှိပ်ပြီး ပေးသွင်းသူတွေကို ဆက်သွယ်ပါ။',
  'Supplier contact မှာ ပို့ခဲ့တဲ့စာနဲ့ တုံ့ပြန်ချက်ကို မှတ်တမ်းတင်ပါ။',
  'Ready to prepare quote နှိပ်ပြီး Final quotation ကနေ ဈေးနှုန်း မူကြမ်း ဖန်တီးပါ။',
  'PDF ထုတ်ပြီး Send to customer နှိပ်ကာ ဖောက်သည်ထံ ပို့ပါ။',
];

export function QuotationRequestGuide() {
  return (
    <AdminGuideDialog
      eyebrow="Quotation အလုပ်အသွားအလာ"
      title="Quotation တောင်းဆိုမှု လမ်းညွှန်"
      description="ဖောက်သည်ရဲ့ တောင်းဆိုမှုကို စစ်ဆေးတာကနေ နောက်ဆုံးဈေးနှုန်း ပို့ပြီး order ဖြစ်တဲ့အထိ အဆင့်တစ်ခုချင်း ရှင်းပြထားပါတယ်။ အင်္ဂလိပ်စာနဲ့ ပြထားတဲ့ ခလုတ်နာမည်တွေက မျက်နှာပြင်ပေါ်က စာသားအတိုင်း ဖြစ်ပါတယ်။"
      triggerLabel="Quotation အသုံးပြုပုံ လမ်းညွှန် ဖွင့်ရန်"
      triggerTitle="Quotation လမ်းညွှန်"
      footerNote="ဖောက်သည်နဲ့ ပေးသွင်းသူ အချက်အလက် ပြောင်းရင် ဒီစာမျက်နှာကို ပြန်ဖွင့်ပြီး စစ်ပါ။"
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
