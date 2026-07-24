"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Eye,
  FileImage,
  Filter,
  Landmark,
  RefreshCw,
  Search,
  Smartphone,
  X,
  XCircle,
} from "lucide-react";

type PaymentItem = {
  id: string;
  studentName: string;
  studentPhone: string;
  grade: string;
  courseId: string;
  courseTitle: string;
  amount: number;
  paymentMethod: string;
  referenceNumber: string | null;
  proofUrl: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason: string | null;
  reviewerName: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

type PaymentStats = {
  pending: number;
  approved: number;
  rejected: number;
};

const methodLabels: Record<string, { label: string; icon: any }> = {
  VODAFONE_CASH: { label: "Vodafone Cash", icon: Smartphone },
  INSTAPAY: { label: "InstaPay", icon: Landmark },
  CASH: { label: "تحويل يدوي / نقدي", icon: CreditCard },
  OTHER: { label: "تحويل بنكي / آخر", icon: Landmark },
};

const gradeLabels: Record<string, string> = {
  FIRST_SECONDARY: "الأول الثانوي",
  SECOND_SECONDARY: "الثاني الثانوي",
  THIRD_SECONDARY: "الثالث الثانوي",
};

export function TeacherPaymentsClient({
  initialPayments,
  stats: initialStats,
}: {
  initialPayments: PaymentItem[];
  stats: PaymentStats;
}) {
  const router = useRouter();
  const [payments, setPayments] = useState<PaymentItem[]>(initialPayments);
  const [stats, setStats] = useState<PaymentStats>(initialStats);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("ALL");
  const [search, setSearch] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<PaymentItem | null>(null);

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState("");
  const [rejectModalPayment, setRejectModalPayment] = useState<PaymentItem | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const filtered = payments.filter((p) => {
    if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        p.studentName.toLowerCase().includes(q) ||
        p.studentPhone.includes(q) ||
        p.courseTitle.toLowerCase().includes(q) ||
        (p.referenceNumber && p.referenceNumber.toLowerCase().includes(q))
      );
    }
    return true;
  });

  async function handleApprove(payment: PaymentItem) {
    if (processingId) return;
    setProcessingId(payment.id);
    setMessage(null);

    try {
      const res = await fetch(`/api/teacher/payments/${payment.id}/approve`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ text: "تم قبول طلب الدفع وتفعيل الكورس للطالب بنجاح!", type: "success" });
        setPayments((prev) =>
          prev.map((item) =>
            item.id === payment.id
              ? { ...item, status: "APPROVED", reviewedAt: new Date().toISOString() }
              : item
          )
        );
        setStats((prev) => ({
          ...prev,
          pending: Math.max(0, prev.pending - (payment.status === "PENDING" ? 1 : 0)),
          approved: prev.approved + 1,
        }));
        if (selectedPayment?.id === payment.id) {
          setSelectedPayment((prev) => (prev ? { ...prev, status: "APPROVED" } : null));
        }
        router.refresh();
      } else {
        setMessage({ text: data.message || "تعذر قبول طلب الدفع", type: "error" });
      }
    } catch {
      setMessage({ text: "حدث خطأ في الاتصال بالسيرفر", type: "error" });
    } finally {
      setProcessingId(null);
    }
  }

  async function handleRejectSubmit() {
    if (!rejectModalPayment || processingId) return;
    setProcessingId(rejectModalPayment.id);
    setMessage(null);

    try {
      const res = await fetch(`/api/teacher/payments/${rejectModalPayment.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReasonInput }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ text: "تم رفض طلب الدفع وإخطار الطالب", type: "success" });
        const reason = rejectReasonInput.trim() || "تعذر التأكد من التحويل";
        setPayments((prev) =>
          prev.map((item) =>
            item.id === rejectModalPayment.id
              ? { ...item, status: "REJECTED", rejectionReason: reason, reviewedAt: new Date().toISOString() }
              : item
          )
        );
        setStats((prev) => ({
          ...prev,
          pending: Math.max(0, prev.pending - (rejectModalPayment.status === "PENDING" ? 1 : 0)),
          rejected: prev.rejected + 1,
        }));
        setRejectModalPayment(null);
        setRejectReasonInput("");
        if (selectedPayment?.id === rejectModalPayment.id) {
          setSelectedPayment((prev) => (prev ? { ...prev, status: "REJECTED", rejectionReason: reason } : null));
        }
        router.refresh();
      } else {
        setMessage({ text: data.message || "تعذر رفض طلب الدفع", type: "error" });
      }
    } catch {
      setMessage({ text: "حدث خطأ في الاتصال بالسيرفر", type: "error" });
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="teacherPaymentsWorkspace">
      {/* Toast Notice */}
      {message && (
        <div className={`toastNotice ${message.type}`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Analytics KPI Row */}
      <div className="analyticsGrid">
        <div className="kpiCard">
          <div className="icon blue">
            <CreditCard size={22} />
          </div>
          <div>
            <b>{payments.length}</b>
            <small>إجمالي الطلبات المستلمة</small>
          </div>
        </div>

        <div className="kpiCard">
          <div className="icon orange">
            <Clock size={22} />
          </div>
          <div>
            <b>{stats.pending}</b>
            <small>طلبات بانتظار المراجعة</small>
          </div>
        </div>

        <div className="kpiCard">
          <div className="icon green">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <b>{stats.approved}</b>
            <small>طلبات اشتراك معتمدة</small>
          </div>
        </div>

        <div className="kpiCard">
          <div className="icon violet">
            <XCircle size={22} />
          </div>
          <div>
            <b>{stats.rejected}</b>
            <small>طلبات مرفوضة</small>
          </div>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="saasPanel">
        <div className="resultsHeader">
          <div className="filtersRow">
            <button
              className={`filterPill ${statusFilter === "ALL" ? "active" : ""}`}
              onClick={() => setStatusFilter("ALL")}
            >
              الكل ({payments.length})
            </button>
            <button
              className={`filterPill pending ${statusFilter === "PENDING" ? "active" : ""}`}
              onClick={() => setStatusFilter("PENDING")}
            >
              قيد المراجعة ({stats.pending})
            </button>
            <button
              className={`filterPill approved ${statusFilter === "APPROVED" ? "active" : ""}`}
              onClick={() => setStatusFilter("APPROVED")}
            >
              المعتمدة ({stats.approved})
            </button>
            <button
              className={`filterPill rejected ${statusFilter === "REJECTED" ? "active" : ""}`}
              onClick={() => setStatusFilter("REJECTED")}
            >
              المرفوضة ({stats.rejected})
            </button>
          </div>

          <div className="searchBox">
            <Search size={18} />
            <input
              type="text"
              placeholder="ابحث باسم الطالب أو الهاتف أو رقم التحويل..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Payments Table */}
        {filtered.length ? (
          <div className="responsiveTable">
            <table className="resultsTable">
              <thead>
                <tr>
                  <th>الطالب</th>
                  <th>الكورس المطلوب</th>
                  <th>المبلغ</th>
                  <th>وسيلة الدفع</th>
                  <th>رقم التحويل / المرجع</th>
                  <th>الحالة</th>
                  <th>التاريخ</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const methodObj = methodLabels[item.paymentMethod] || methodLabels.OTHER;
                  const Icon = methodObj.icon;

                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="userCell">
                          <b>{item.studentName}</b>
                          <small dir="ltr">{item.studentPhone}</small>
                        </div>
                      </td>
                      <td>
                        <b>{item.courseTitle}</b>
                      </td>
                      <td>
                        <strong className="amountText">{item.amount.toLocaleString("en-US")} ج.م</strong>
                      </td>
                      <td>
                        <span className="methodTag">
                          <Icon size={14} /> {methodObj.label}
                        </span>
                      </td>
                      <td>
                        {item.referenceNumber ? (
                          <code className="refCode" dir="ltr">{item.referenceNumber}</code>
                        ) : (
                          <small className="mutedTxt">غير مدخل</small>
                        )}
                      </td>
                      <td>
                        {item.status === "PENDING" && <span className="passTag fail">قيد المراجعة</span>}
                        {item.status === "APPROVED" && <span className="passTag pass">مقبول ومفعل ✓</span>}
                        {item.status === "REJECTED" && <span className="passTag fail">مرفوض ✕</span>}
                      </td>
                      <td>
                        <small>{new Date(item.createdAt).toLocaleDateString("ar-EG")}</small>
                      </td>
                      <td>
                        <div className="actionBtnGroup">
                          <button
                            className="btn sm outline"
                            title="عرض تفاصيل الإثبات"
                            onClick={() => setSelectedPayment(item)}
                          >
                            <Eye size={15} /> التفاصيل
                          </button>

                          {item.status === "PENDING" && (
                            <>
                              <button
                                className="btn sm primary"
                                title="قبول الطلب وتفعيل الكورس"
                                disabled={processingId === item.id}
                                onClick={() => handleApprove(item)}
                              >
                                <Check size={15} /> قبول
                              </button>
                              <button
                                className="btn sm danger"
                                title="رفض الطلب"
                                disabled={processingId === item.id}
                                onClick={() => setRejectModalPayment(item)}
                              >
                                <X size={15} /> رفض
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="compactEmpty">
            <h3>لا توجد طلبات دفع تطابق البحث.</h3>
            <p>ستظهر هنا طلبات الاشتراكات فور قيام الطلاب برفع تحويلاتهم.</p>
          </div>
        )}
      </div>

      {/* Payment Details Drawer / Modal */}
      {selectedPayment && (
        <div className="modalOverlay" onClick={() => setSelectedPayment(null)}>
          <div className="modalSheet paymentDetailSheet" onClick={(e) => e.stopPropagation()}>
            <header className="modalHeader">
              <h3>تفاصيل طلب الاشتراك والدفع</h3>
              <button className="iconBtn" onClick={() => setSelectedPayment(null)}>
                <X size={20} />
              </button>
            </header>

            <div className="modalBody grid">
              <div className="detailSection">
                <h4>بيانات الطالب والكورس</h4>
                <div className="detailRow">
                  <span>اسم الطالب:</span>
                  <b>{selectedPayment.studentName}</b>
                </div>
                <div className="detailRow">
                  <span>رقم الهاتف:</span>
                  <b dir="ltr">{selectedPayment.studentPhone}</b>
                </div>
                <div className="detailRow">
                  <span>الصف الدراسي:</span>
                  <b>{gradeLabels[selectedPayment.grade] ?? selectedPayment.grade}</b>
                </div>
                <div className="detailRow">
                  <span>الكورس المطلوب:</span>
                  <b>{selectedPayment.courseTitle}</b>
                </div>
                <div className="detailRow">
                  <span>المبلغ المطلوب:</span>
                  <b className="amountHighlight">{selectedPayment.amount.toLocaleString("en-US")} ج.م</b>
                </div>
              </div>

              <div className="detailSection">
                <h4>تفاصيل التحويل</h4>
                <div className="detailRow">
                  <span>وسيلة الدفع:</span>
                  <b>{methodLabels[selectedPayment.paymentMethod]?.label ?? selectedPayment.paymentMethod}</b>
                </div>
                <div className="detailRow">
                  <span>رقم العملية / المرجع:</span>
                  <b dir="ltr">{selectedPayment.referenceNumber || "غير متوفر"}</b>
                </div>
                <div className="detailRow">
                  <span>تاريخ الطلب:</span>
                  <b>{new Date(selectedPayment.createdAt).toLocaleString("ar-EG")}</b>
                </div>
                {selectedPayment.rejectionReason && (
                  <div className="detailRow errorRow">
                    <span>سبب الرفض:</span>
                    <b>{selectedPayment.rejectionReason}</b>
                  </div>
                )}
              </div>

              {selectedPayment.proofUrl && (
                <div className="proofSection">
                  <h4>صورة إثبات الدفع / الإيصال:</h4>
                  <a href={selectedPayment.proofUrl} target="_blank" rel="noreferrer" className="proofPreviewLink">
                    <FileImage size={24} /> فتح الإيصال في نافذة جديدة
                  </a>
                </div>
              )}
            </div>

            <footer className="modalFooter">
              {selectedPayment.status === "PENDING" ? (
                <>
                  <button
                    className="btn outline danger"
                    onClick={() => {
                      setRejectModalPayment(selectedPayment);
                      setSelectedPayment(null);
                    }}
                  >
                    رفض الطلب
                  </button>
                  <button
                    className="btn primary"
                    disabled={processingId === selectedPayment.id}
                    onClick={() => handleApprove(selectedPayment)}
                  >
                    قبول الطلب وتفعيل الكورس فورًا
                  </button>
                </>
              ) : (
                <button className="btn outline" onClick={() => setSelectedPayment(null)}>
                  إغلاق
                </button>
              )}
            </footer>
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectModalPayment && (
        <div className="modalOverlay" onClick={() => setRejectModalPayment(null)}>
          <div className="modalSheet confirmSheet" onClick={(e) => e.stopPropagation()}>
            <h3>رفض طلب الاشتراك</h3>
            <p>
              سيتم إخطار الطالب <b>{rejectModalPayment.studentName}</b> بعدم قبول التحويل لكورس{" "}
              <b>{rejectModalPayment.courseTitle}</b>.
            </p>

            <label className="reasonLabel">
              <span>سبب الرفض (سيظهر للطالب):</span>
              <input
                type="text"
                placeholder="مثال: رقم العملية غير مسجل بالرصيد / لم نصلنا تحويل بهذا الرقم"
                value={rejectReasonInput}
                onChange={(e) => setRejectReasonInput(e.target.value)}
              />
            </label>

            <div className="confirmActions">
              <button
                className="btn outline"
                onClick={() => setRejectModalPayment(null)}
                disabled={Boolean(processingId)}
              >
                إلغاء
              </button>
              <button
                className="btn danger"
                onClick={handleRejectSubmit}
                disabled={Boolean(processingId)}
              >
                {processingId ? "جارٍ الرفض..." : "تأكيد الرفض والإخطار"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
