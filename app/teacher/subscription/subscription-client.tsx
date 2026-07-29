"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Check, Clock3, Copy, CreditCard, Crown, HardDrive, Rocket, ShieldCheck, Sparkles, TrendingUp, Upload, Users, X } from "lucide-react";
import styles from "./subscription.module.css";

export type PlanView = {
  id: string; code: string; name: string; monthlyPrice: number | null; activeStudentLimit: number | null; storageLimitGb: number | null; isCustom: boolean;
  quotes: Array<{ billingCycle: "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL"; originalAmountEgp: number; discountAmountEgp: number; prorationCreditEgp: number; amountEgp: number; discountPercent: number; months: number; changeType?: string }>;
};
export type PaymentView = { id: string; status: string; amount: number; originalAmount: number; discountAmount: number; billingCycle: string; paymentMethod: string | null; createdAt: string; reviewedAt: string | null; rejectionReason: string | null; planName: string };
export type SubscriptionView = { status: string; planName: string; planCode: string; trialEndsAt: string; currentPeriodEnd: string | null; trialOfferDismissedAt: string | null; activeStudents: number; activeStudentLimit: number | null; storageGb: number; storageLimitGb: number | null };
export type PaymentSettingsView = { vodafoneCashEnabled: boolean; vodafoneCashNumber: string | null; instaPayEnabled: boolean; instaPayAddress: string | null; accountName: string | null; instructions: string | null; supportPhone: string | null; supportWhatsApp: string | null; supportEmail: string | null };

const cycleLabels: Record<string, string> = { MONTHLY: "شهري", QUARTERLY: "3 شهور", SEMIANNUAL: "6 شهور", ANNUAL: "سنوي" };
const statusLabels: Record<string, string> = { TRIALING: "تجربة مجانية", ACTIVE: "نشط", GRACE_PERIOD: "فترة سماح", PAST_DUE: "مطلوب تجديد", EXPIRED: "انتهى", CANCELLED: "ملغي", PENDING: "قيد المراجعة", NEEDS_REVIEW: "يحتاج مراجعة", APPROVED: "تمت الموافقة", REJECTED: "مرفوض" };

function Countdown({ endsAt, compact = false }: { endsAt: string; compact?: boolean }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);
  if (now === null) return <span className={compact ? styles.compactCountdown : styles.countdown} dir="ltr">--:--:--</span>;
  const remaining = Math.max(0, new Date(endsAt).getTime() - now);
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  return <span className={compact ? styles.compactCountdown : styles.countdown} dir="ltr">{hours.toString().padStart(2, "0")}:{minutes.toString().padStart(2, "0")}:{seconds.toString().padStart(2, "0")}</span>;
}

const planPresentation: Record<string, { tagline: string; icon: typeof Rocket }> = {
  STARTER: { tagline: "بداية ذكية لأكاديميتك", icon: Rocket },
  GROWTH: { tagline: "الأفضل للنمو المستمر", icon: TrendingUp },
  PRO: { tagline: "قوة أكبر للاحتراف", icon: Crown },
  ENTERPRISE: { tagline: "حل مصمم على احتياجك", icon: Building2 },
};

function PlanCards({ plans, selected, onSelect, compact = false }: { plans: PlanView[]; selected?: string; onSelect?: (code: string) => void; compact?: boolean }) {
  return <div className={`${styles.planGrid} ${compact ? styles.planGridCompact : ""}`}>{plans.map((plan) => {
    const popular = plan.code === "GROWTH";
    const isSelected = selected === plan.code;
    const presentation = planPresentation[plan.code] ?? { tagline: "خطة مرنة لأكاديميتك", icon: Sparkles };
    const PlanIcon = presentation.icon;
    return <button
      type="button"
      key={plan.code}
      data-plan={plan.code.toLowerCase()}
      className={`${styles.planCard} ${isSelected ? styles.selected : ""}`}
      onClick={() => onSelect?.(plan.code)}
      disabled={!onSelect}
      aria-pressed={onSelect ? isSelected : undefined}
      aria-label={`خطة ${plan.name}${isSelected ? "، محددة حاليًا" : ""}`}
    >
      {popular ? <span className={styles.popular}><Sparkles size={13} aria-hidden /> الأكثر اختيارًا</span> : null}
      <span className={styles.planGlow} aria-hidden />
      <span className={styles.planCardTop}>
        <span className={styles.planIcon}><PlanIcon size={22} strokeWidth={1.9} aria-hidden /></span>
        <span className={styles.planHeading}><strong>{plan.name}</strong><small>{presentation.tagline}</small></span>
        <span className={styles.planCheck} aria-hidden>{isSelected ? <Check size={17} strokeWidth={3} /> : null}</span>
      </span>
      <span className={styles.planPrice}>
        {plan.monthlyPrice == null ? <strong>سعر مخصص</strong> : <><strong>{plan.monthlyPrice.toLocaleString("ar-EG")}</strong><span><b>ج.م</b><small>شهريًا</small></span></>}
      </span>
      <span className={styles.planDivider} aria-hidden />
      <span className={styles.planFeatures}>
        <span><i><Users size={16} aria-hidden /></i><span><small>الطلاب النشطون</small><b>{plan.activeStudentLimit == null ? "حسب احتياجك" : `حتى ${plan.activeStudentLimit.toLocaleString("ar-EG")} طالب`}</b></span></span>
        <span><i><HardDrive size={16} aria-hidden /></i><span><small>مساحة التخزين</small><b>{plan.storageLimitGb == null ? "مساحة مخصصة" : `${plan.storageLimitGb.toLocaleString("ar-EG")} جيجابايت`}</b></span></span>
      </span>
      {!compact && onSelect ? <span className={styles.planChoice}>{isSelected ? <><Check size={15} aria-hidden /> خطتك المختارة</> : "اختيار هذه الخطة"}</span> : null}
    </button>;
  })}</div>;
}

export function DashboardTrialExperience({ subscription, plans }: { subscription: SubscriptionView; plans: PlanView[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(subscription.status === "TRIALING" && !subscription.trialOfferDismissedAt);
  const [busy, setBusy] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => { const frame = window.requestAnimationFrame(() => setPortalReady(true)); return () => window.cancelAnimationFrame(frame); }, []);
  useEffect(() => {
    if (!open || subscription.status !== "TRIALING") return;
    const scrollY = window.scrollY;
    const root = document.documentElement;
    const body = document.body;
    const previous = { rootOverflow: root.style.overflow, bodyOverflow: body.style.overflow, bodyPosition: body.style.position, bodyTop: body.style.top, bodyWidth: body.style.width, bodyPaddingRight: body.style.paddingRight };
    const scrollbarGap = Math.max(0, window.innerWidth - root.clientWidth);
    root.classList.add("subscriptionModalOpen");
    body.classList.add("subscriptionModalOpen");
    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    if (scrollbarGap) body.style.paddingRight = `${scrollbarGap}px`;
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus({ preventScroll: true }));
    return () => {
      window.cancelAnimationFrame(focusFrame);
      root.classList.remove("subscriptionModalOpen");
      body.classList.remove("subscriptionModalOpen");
      root.style.overflow = previous.rootOverflow;
      body.style.overflow = previous.bodyOverflow;
      body.style.position = previous.bodyPosition;
      body.style.top = previous.bodyTop;
      body.style.width = previous.bodyWidth;
      body.style.paddingRight = previous.bodyPaddingRight;
      window.scrollTo(0, scrollY);
    };
  }, [open, subscription.status]);

  async function continueTrial() {
    setBusy(true);
    const response = await fetch("/api/teacher/subscription/dismiss-trial-offer", { method: "POST" });
    setBusy(false);
    if (response.ok) { setOpen(false); router.refresh(); }
  }
  if (subscription.status !== "TRIALING") return null;
  const trialModal = portalReady && open ? createPortal(<div className={styles.modalBackdrop} role="presentation"><section className={styles.welcomeModal} role="dialog" aria-modal="true" aria-labelledby="trial-welcome-title">
    <button ref={closeButtonRef} className={styles.modalClose} onClick={continueTrial} aria-label="إغلاق ومتابعة التجربة" disabled={busy}><X size={20} /></button>
    <header><i><Sparkles size={22} /></i><span><small>أهلاً بك في Skoola</small><h2 id="trial-welcome-title">ابدأ تجربتك المجانية لمدة 24 ساعة</h2><p>كل بياناتك ومحتواك محفوظان. اختر خطة الآن أو كمّل تجهيز الأكاديمية وقرر قبل انتهاء التجربة.</p></span></header>
    <PlanCards plans={plans} compact />
    <footer><button onClick={continueTrial} disabled={busy}>{busy ? "جارٍ المتابعة…" : "كمّل التجربة المجانية"}</button><Link href="/teacher/subscription">اختيار خطة الآن</Link></footer>
  </section></div>, document.body) : null;
  return <>
    <section className={styles.trialBanner} aria-label="مدة التجربة المجانية"><div><Clock3 size={20} /><span><b>تجربتك المجانية شغالة</b><small>استكمل إعداد أكاديميتك وأنشئ محتواك بشكل طبيعي.</small></span></div><div><Countdown endsAt={subscription.trialEndsAt} compact /><Link href="/teacher/subscription">عرض الخطط</Link></div></section>
    {trialModal}
  </>;
}
export function SubscriptionManager({ subscription, plans, payments, paymentSettings, canManage, blocked }: { subscription: SubscriptionView; plans: PlanView[]; payments: PaymentView[]; paymentSettings: PaymentSettingsView; canManage: boolean; blocked: boolean }) {
  const router = useRouter();
  const pending = payments.find((payment) => payment.status === "PENDING" || payment.status === "NEEDS_REVIEW");
  const initialPlan = plans.some((plan) => plan.code === subscription.planCode && !plan.isCustom) ? subscription.planCode : "STARTER";
  const [planCode, setPlanCode] = useState(initialPlan);
  const [cycle, setCycle] = useState<"MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL">("MONTHLY");
  const [method, setMethod] = useState<"VODAFONE_CASH" | "INSTAPAY">(paymentSettings.vodafoneCashEnabled ? "VODAFONE_CASH" : "INSTAPAY");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const plan = plans.find((item) => item.code === planCode) ?? plans[0];
  const quote = useMemo(() => plan?.quotes.find((item) => item.billingCycle === cycle), [plan, cycle]);
  const availableMethods = [{ key: "VODAFONE_CASH" as const, label: "فودافون كاش", value: paymentSettings.vodafoneCashNumber, enabled: paymentSettings.vodafoneCashEnabled }, { key: "INSTAPAY" as const, label: "إنستا باي", value: paymentSettings.instaPayAddress, enabled: paymentSettings.instaPayEnabled }].filter((item) => item.enabled && item.value);
  const selectedMethod = availableMethods.some((item) => item.key === method) ? method : (availableMethods[0]?.key ?? method);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setBusy(true); setMessage("");
    const response = await fetch("/api/teacher/subscription/payment-request", { method: "POST", body: new FormData(formElement) });
    const data = await response.json().catch(() => null); setBusy(false); setMessage(response.ok ? "تم إرسال طلب الدفع بأمان، وسنراجع التحويل في أقرب وقت." : data?.message ?? "تعذر إرسال الطلب");
    if (response.ok) { formElement.reset(); router.refresh(); }
  }
  async function copy(value: string) { await navigator.clipboard.writeText(value); setMessage("تم نسخ بيانات التحويل"); }

  return <main className={`${styles.subscriptionPage} ${blocked ? styles.blockedPage : ""}`} dir="rtl">
    <header className={styles.subscriptionHero}><div><span><ShieldCheck size={16} /> اشتراك Skoola</span><h1>{blocked ? "فعّل أكاديميتك وارجع لشغلك" : "إدارة اشتراك الأكاديمية"}</h1><p>{blocked ? "انتهت التجربة المجانية وتم إيقاف الأكاديمية مؤقتًا فقط. كل طلابك وكورساتك وملفاتك محفوظة." : "تابع خطتك واستهلاكك وجدّد أو طوّر اشتراكك من مكان واحد."}</p></div>{subscription.status === "TRIALING" ? <div className={styles.heroTimer}><small>متبقي من التجربة</small><Countdown endsAt={subscription.trialEndsAt} /></div> : <span className={`${styles.statusBadge} ${styles[subscription.status.toLowerCase()]}`}>{statusLabels[subscription.status] ?? subscription.status}</span>}</header>

    <section className={styles.currentGrid} aria-label="ملخص الاشتراك"><article><CreditCard size={20} /><span>الخطة الحالية<small>{statusLabels[subscription.status] ?? subscription.status}</small></span><b>{subscription.planName}</b></article><UsageCard icon={<Users size={20} />} label="الطلاب النشطون" value={subscription.activeStudents} limit={subscription.activeStudentLimit} suffix="طالب" /><UsageCard icon={<HardDrive size={20} />} label="المساحة المستخدمة" value={subscription.storageGb} limit={subscription.storageLimitGb} suffix="GB" /><article><Clock3 size={20} /><span>{subscription.status === "TRIALING" ? "نهاية التجربة" : "تاريخ الانتهاء"}<small>حسب توقيت القاهرة</small></span><b>{new Date(subscription.currentPeriodEnd ?? subscription.trialEndsAt).toLocaleDateString("ar-EG", { dateStyle: "medium" })}</b></article></section>
    <nav className={styles.manageActions} aria-label="إجراءات الاشتراك"><a href="#plans-title">تجديد الاشتراك</a><a href="#plans-title">ترقية الخطة</a></nav>

    {pending ? <section className={styles.pendingNotice}><Clock3 size={21} /><div><b>{statusLabels[pending.status]}</b><p>طلب {pending.planName} بقيمة {pending.amount.toLocaleString("ar-EG")} ج.م وصل للإدارة. لا تحتاج لإرسال طلب آخر.</p></div></section> : null}

    <section className={styles.checkoutSection} aria-labelledby="plans-title"><div className={styles.sectionHeading}><span>1</span><div><h2 id="plans-title">اختر الخطة المناسبة</h2><p>يمكنك التجديد على نفس الخطة أو الترقية في أي وقت.</p></div></div><PlanCards plans={plans} selected={planCode} onSelect={pending || !canManage ? undefined : setPlanCode} /></section>

    {plan?.isCustom ? <section className={styles.enterpriseContact}><Sparkles size={23} /><div><h2>خطة مصممة لأكاديميتك</h2><p>تواصل معنا لتحديد عدد الطلاب والمساحة والسعر المناسب.</p></div>{paymentSettings.supportWhatsApp || paymentSettings.supportPhone ? <a href={`https://wa.me/${(paymentSettings.supportWhatsApp ?? paymentSettings.supportPhone ?? "").replace(/\D/g, "")}`} target="_blank" rel="noreferrer">تواصل معنا</a> : paymentSettings.supportEmail ? <a href={`mailto:${paymentSettings.supportEmail}`}>تواصل معنا</a> : null}</section> : <form className={styles.checkoutForm} onSubmit={submit}>
      <input type="hidden" name="planCode" value={planCode} /><input type="hidden" name="billingCycle" value={cycle} /><input type="hidden" name="paymentMethod" value={selectedMethod} />
      <section className={styles.checkoutSection}><div className={styles.sectionHeading}><span>2</span><div><h2>اختر مدة الاشتراك</h2><p>السعر والخصم هنا صادران من نظام التسعير الآمن.</p></div></div><div className={styles.cycleGrid}>{(["MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL"] as const).map((item) => <button type="button" key={item} onClick={() => setCycle(item)} className={cycle === item ? styles.selectedCycle : ""} disabled={Boolean(pending) || !canManage}><b>{cycleLabels[item]}</b><small>{item === "MONTHLY" ? "بدون خصم" : item === "QUARTERLY" ? "خصم 5%" : item === "SEMIANNUAL" ? "خصم 10%" : "ادفع 10 شهور"}</small></button>)}</div>{quote ? <div className={styles.priceSummary}><span>السعر الأساسي <b>{quote.originalAmountEgp.toLocaleString("ar-EG")} ج.م</b></span>{quote.prorationCreditEgp > 0 ? <span className={styles.discount}>رصيد المدة الحالية <b>- {quote.prorationCreditEgp.toLocaleString("ar-EG")} ج.م</b></span> : null}{quote.discountAmountEgp > 0 ? <span className={styles.discount}>الخصم <b>- {quote.discountAmountEgp.toLocaleString("ar-EG")} ج.م</b></span> : null}<strong>الإجمالي المطلوب <b>{quote.amountEgp.toLocaleString("ar-EG")} ج.م</b></strong></div> : null}</section>
      <section className={styles.checkoutSection}><div className={styles.sectionHeading}><span>3</span><div><h2>حوّل وارفع الإيصال</h2><p>اختر وسيلة الدفع، ثم ارفع صورة واضحة للتحويل.</p></div></div>{availableMethods.length ? <><div className={styles.methodGrid}>{availableMethods.map((item) => <button type="button" key={item.key} onClick={() => setMethod(item.key)} className={selectedMethod === item.key ? styles.selectedMethod : ""} disabled={Boolean(pending) || !canManage}><span><b>{item.label}</b><small dir="ltr">{item.value}</small></span><span type-role="copy" onClick={(event) => { event.stopPropagation(); void copy(item.value!); }}><Copy size={16} /></span></button>)}</div>{paymentSettings.accountName ? <p className={styles.accountName}>اسم صاحب الحساب: <b>{paymentSettings.accountName}</b></p> : null}{paymentSettings.instructions ? <p className={styles.instructions}>{paymentSettings.instructions}</p> : null}<div className={styles.formGrid}><label>رقم العملية (اختياري)<input name="referenceNumber" maxLength={100} placeholder="مثال: 845217" /></label><label className={styles.uploadField}><span><Upload size={18} /> صورة إيصال التحويل</span><input name="proof" type="file" accept="image/jpeg,image/png,image/webp,image/avif" required /></label><label className={styles.fullField}>ملاحظة للإدارة (اختياري)<textarea name="notes" maxLength={500} rows={3} placeholder="أي معلومة تساعد في تأكيد التحويل" /></label></div></> : <div className={styles.noMethods}>وسائل دفع الاشتراك لم تُضبط بعد. تواصل مع دعم Skoola.</div>}
        <button className={styles.submitButton} disabled={busy || Boolean(pending) || !canManage || !availableMethods.length}>{busy ? "جارٍ رفع الإيصال…" : pending ? "لديك طلب قيد المراجعة" : !canManage ? "مالك الأكاديمية أو المدير فقط" : "إرسال طلب الاشتراك"}</button>{message ? <p className={styles.formMessage} role="status">{message}</p> : null}
      </section>
    </form>}

    <section className={styles.historySection}><div className={styles.sectionHeading}><span><CreditCard size={18} /></span><div><h2>سجل المدفوعات</h2><p>كل طلبات الاشتراك ونتائج مراجعتها.</p></div></div>{payments.length ? <div className={styles.paymentList}>{payments.map((payment) => <article key={payment.id}><div><b>{payment.planName} · {cycleLabels[payment.billingCycle] ?? payment.billingCycle}</b><small>{new Date(payment.createdAt).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" })}</small>{payment.rejectionReason ? <p>{payment.rejectionReason}</p> : null}</div><strong>{payment.amount.toLocaleString("ar-EG")} ج.م</strong><span className={`${styles.paymentStatus} ${styles[payment.status.toLowerCase()]}`}>{statusLabels[payment.status] ?? payment.status}</span></article>)}</div> : <div className={styles.emptyPayments}>لا توجد مدفوعات حتى الآن.</div>}</section>
  </main>;
}

function UsageCard({ icon, label, value, limit, suffix }: { icon: React.ReactNode; label: string; value: number; limit: number | null; suffix: string }) {
  const percent = limit ? Math.min(100, Math.round(value / limit * 100)) : 0;
  return <article>{icon}<span>{label}<small>{limit == null ? "بدون حد ثابت" : `${value.toLocaleString("ar-EG")} من ${limit.toLocaleString("ar-EG")} ${suffix}`}</small></span><b>{value.toLocaleString("ar-EG")}</b>{limit != null ? <i><span style={{ width: `${percent}%` }} /></i> : null}</article>;
}