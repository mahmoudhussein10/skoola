"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  CreditCard,
  KeyRound,
  Landmark,
  ShieldCheck,
  Smartphone,
  Sparkles,
  X,
} from "lucide-react";

type ActivePaymentMethod = {
  type: "vodafone" | "instapay" | "bank";
  title: string;
  value: string;
  bankName?: string;
  iban?: string | null;
  holder?: string | null;
};

export function StudentCheckoutClient({
  courseId,
  courseTitle,
  coursePrice,
  teacherName,
  paymentMethods,
  paymentInstructions,
}: {
  courseId: string;
  courseTitle: string;
  coursePrice: number;
  teacherName: string;
  paymentMethods: ActivePaymentMethod[];
  paymentInstructions?: string | null;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"transfer" | "code">(
    paymentMethods.length > 0 ? "transfer" : "code"
  );
  const [selectedMethod, setSelectedMethod] = useState<ActivePaymentMethod | null>(
    paymentMethods[0] || null
  );

  const [referenceNumber, setReferenceNumber] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [activationCode, setActivationCode] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [activationSuccess, setActivationSuccess] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopiedIndex(key);
    setTimeout(() => setCopiedIndex(null), 2000);
  }

  async function handleTransferSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setMessage(null);

    const enumMap: Record<string, string> = {
      vodafone: "VODAFONE_CASH",
      instapay: "INSTAPAY",
      bank: "OTHER",
    };

    try {
      const res = await fetch("/api/student/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          paymentMethod: selectedMethod ? enumMap[selectedMethod.type] || "VODAFONE_CASH" : "VODAFONE_CASH",
          referenceNumber: referenceNumber.trim() || null,
          proofUrl: proofUrl.trim() || null,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSubmittedSuccess(true);
        router.refresh();
      } else {
        setMessage({ text: data.message || "تعذر تقديم طلب الاشتراك", type: "error" });
      }
    } catch {
      setMessage({ text: "حدث خطأ في الاتصال بالخادم", type: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!activationCode.trim()) {
      setMessage({ text: "يرجى أدخل كود التفعيل المكون من حروف وأرقام", type: "error" });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch("/api/student/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: activationCode.trim() }),
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setActivationSuccess(true);
        router.refresh();
      } else {
        setMessage({ text: data?.message || "الكود غير صحيح أو مستخدم سابقاً", type: "error" });
      }
    } catch {
      setMessage({ text: "حدث خطأ غير متوقع أثناء الفحص، يرجى المحاولة لاحقاً", type: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  const modalJSX = modalOpen ? (
    <div className="modalOverlay checkoutPortalOverlay" onClick={() => setModalOpen(false)}>
      <div className="modalSheet checkoutSheet" onClick={(e) => e.stopPropagation()}>
        <header className="modalHeader">
          <div>
            <span className="skoolaPill">اشتراك مباشر</span>
            <h3>طرق دفع وتفعيل كورس: {courseTitle}</h3>
          </div>
          <button type="button" className="iconBtn" onClick={() => setModalOpen(false)}>
            <X size={20} />
          </button>
        </header>

        {!submittedSuccess && !activationSuccess ? (
          <div className="modalBody">
            <div className="checkoutCourseBanner">
              <div>
                <small>سعر الكورس</small>
                <b className="checkoutPrice">
                  {coursePrice === 0 ? "مجاني بالكامل" : `${coursePrice.toLocaleString("en-US")} ج.م`}
                </b>
              </div>
              <span className="teacherTag">المدرس: {teacherName}</span>
            </div>

            <div className="checkoutModeSwitch">
              <button
                type="button"
                className={`modeBtn ${activeTab === "transfer" ? "active" : ""}`}
                onClick={() => {
                  setActiveTab("transfer");
                  setMessage(null);
                }}
              >
                <Smartphone size={17} />
                تحويل مالية (فودافون كاش / إنستا باي)
              </button>
              <button
                type="button"
                className={`modeBtn ${activeTab === "code" ? "active" : ""}`}
                onClick={() => {
                  setActiveTab("code");
                  setMessage(null);
                }}
              >
                <KeyRound size={17} />
                تفعيل باستخدام كود
              </button>
            </div>

            {activeTab === "transfer" ? (
              paymentMethods.length > 0 ? (
                <>
                  <div className="methodTabs">
                    {paymentMethods.map((m, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className={`methodTab ${selectedMethod?.type === m.type ? "active" : ""}`}
                        onClick={() => setSelectedMethod(m)}
                      >
                        {m.type === "vodafone" && <Smartphone size={16} />}
                        {m.type === "instapay" && <Landmark size={16} />}
                        {m.type === "bank" && <CreditCard size={16} />}
                        <span>{m.title}</span>
                      </button>
                    ))}
                  </div>

                  {selectedMethod && (
                    <div className="methodDetailCard">
                      <div className="copyRow">
                        <div>
                          <small>{selectedMethod.type === "bank" ? selectedMethod.bankName : selectedMethod.title}</small>
                          <b dir="ltr" className="copyValue">{selectedMethod.value}</b>
                        </div>
                        <button
                          type="button"
                          className="btn sm outline copyBtn"
                          onClick={() => copyToClipboard(selectedMethod.value, "val")}
                        >
                          <Copy size={15} />
                          {copiedIndex === "val" ? "تم النسخ ✓" : "نسخ الرقم"}
                        </button>
                      </div>

                      {selectedMethod.iban && (
                        <div className="copyRow">
                          <div>
                            <small>رقم IBAN</small>
                            <b dir="ltr" className="copyValue">{selectedMethod.iban}</b>
                          </div>
                          <button
                            type="button"
                            className="btn sm outline copyBtn"
                            onClick={() => copyToClipboard(selectedMethod.iban!, "iban")}
                          >
                            <Copy size={15} />
                            {copiedIndex === "iban" ? "تم النسخ ✓" : "نسخ IBAN"}
                          </button>
                        </div>
                      )}

                      {selectedMethod.holder && (
                        <div className="holderInfo">
                          <span>صاحب الحساب: <b>{selectedMethod.holder}</b></span>
                        </div>
                      )}
                    </div>
                  )}

                  {paymentInstructions && (
                    <div className="paymentInstructionsBox">
                      <b>إرشادات المدرس للتحويل:</b>
                      <p>{paymentInstructions}</p>
                    </div>
                  )}

                  <form className="studentPaymentForm" onSubmit={handleTransferSubmit}>
                    <h4>تقديم إثبات الدفع والتحويل:</h4>

                    <label>
                      <span>رقم التحويل / رقم المحفظة المحول منها / رقم المرجع:</span>
                      <input
                        type="text"
                        dir="ltr"
                        placeholder="مثال: 01012345678 أو رقم العملية 987654"
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                      />
                    </label>

                    <label>
                      <span>رابط صورة إثبات الدفع / الإيصال (اختياري):</span>
                      <input
                        type="text"
                        dir="ltr"
                        placeholder="https://..."
                        value={proofUrl}
                        onChange={(e) => setProofUrl(e.target.value)}
                      />
                    </label>

                    {message && (
                      <p className={message.type === "success" ? "formNotice" : "formError"}>
                        {message.text}
                      </p>
                    )}

                    <button className="btn primary lg fullWidth" disabled={submitting}>
                      {submitting ? "جارٍ إرسال الطلب..." : "تأكيد وإرسال طلب التفعيل ←"}
                    </button>
                  </form>
                </>
              ) : (
                <div className="compactEmpty" style={{ margin: "20px" }}>
                  <h3>لم يقم المدرس بإضافة وسائل تحويل إلكترونية بعد.</h3>
                  <p>يمكنك استخدام تبويب "تفعيل باستخدام كود" بالأعلى إذا حصلت على كود تفعيل من المدرس.</p>
                </div>
              )
            ) : (
              <form className="activationCodeForm" onSubmit={handleCodeSubmit}>
                <div className="codeIntro">
                  <KeyRound size={28} />
                  <div>
                    <b>أدخل كود تفعيل الكورس</b>
                    <p>الكود يمنحك وصولاً فورياً وبدون مراجعة يدوبة لكافة دروس واختبارات الكورس.</p>
                  </div>
                </div>

                <label>
                  <span>كود التفعيل (أدخل الكود المطبوع على كارتك):</span>
                  <input
                    type="text"
                    dir="ltr"
                    className="codeInputField"
                    placeholder="مثال: MATH-7829-901"
                    value={activationCode}
                    onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
                    required
                  />
                </label>

                {message && (
                  <p className={message.type === "success" ? "formNotice" : "formError"}>
                    {message.text}
                  </p>
                )}

                <button className="btn primary lg fullWidth" disabled={submitting}>
                  {submitting ? "جارٍ التفعيل..." : "تفعيل الكورس فوراً ←"}
                </button>
              </form>
            )}
          </div>
        ) : activationSuccess ? (
          <div className="modalBody successView" style={{ padding: "30px 24px" }}>
            <div className="successIconFrame glow">
              <Sparkles size={48} />
            </div>
            <h3>مبروك! تم تفعيل الاشتراك في الكورس بنجاح 🎉</h3>
            <p>
              تم تفعيل كورس <b>{courseTitle}</b> في حسابك. يمكنك الآن البدء مباشرة في مشاهدة الدروس وتأدية الامتحانات.
            </p>
            <button
              type="button"
              className="btn primary lg"
              onClick={() => {
                setModalOpen(false);
                router.push(`/course?courseId=${courseId}`);
              }}
            >
              انتقل لمشاهدة الدروس الآن ←
            </button>
          </div>
        ) : (
          <div className="modalBody successView" style={{ padding: "30px 24px" }}>
            <div className="successIconFrame">
              <CheckCircle2 size={48} />
            </div>
            <h3>تم تقديم طلب الدفع والاشتراك بنجاح!</h3>
            <p>
              تم إرسال بيانات التحويل إلى المدرس <b>{teacherName}</b>. يتم مراجعة التحويل وتفعيل الكورس في حسابك قريباً.
            </p>
            <button
              type="button"
              className="btn primary lg"
              onClick={() => {
                setModalOpen(false);
                router.push("/dashboard");
              }}
            >
              الذهاب للوحة التحكم والمتابعة ←
            </button>
          </div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      <button className="btn tenantPrimary lg fullCtaBtn" onClick={() => setModalOpen(true)}>
        <Sparkles size={19} />
        الاشتراك الآن وتفعيل الكورس
        <ArrowLeft size={18} />
      </button>

      {mounted && modalJSX ? createPortal(modalJSX, document.body) : null}
    </>
  );
}
