"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface PrintableStatement {
  statementNumber?: string;
  issueDate?: string | Date;
  periodStart?: string | Date;
  periodEnd?: string | Date;
  billableStudents?: number;
  pricePerStudent?: number;
  subtotal?: number;
  adjustments?: number;
  discount?: number;
  finalAmount?: number;
}

export interface TenantData {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string | Date;
  owner?: {
    fullName?: string;
    phone?: string;
    email?: string | null;
    username?: string;
    lastLoginAt?: string | Date | null;
  } | null;
  theme?: {
    primaryColor?: string;
    secondaryColor?: string;
  } | null;
  billingSettings?: {
    studentLimit?: number;
    subscriptionStart?: string | Date;
    subscriptionEnd?: string | Date | null;
    internalNotes?: string | null;
  } | null;
  auditLogs?: Record<string, unknown>[];
  billingStatements?: Record<string, unknown>[];
  teacherPayments?: Record<string, unknown>[];
}

export interface TeacherDetailProps {
  tenant: TenantData;
  stats: {
    totalStudents: number;
    activeStudents: number;
    inactiveStudents: number;
    totalCourses: number;
    totalLessons: number;
    totalVideos: number;
    totalExams: number;
    totalAssignments: number;
    totalActivationCodes: number;
    usedCodes: number;
    availableCodes: number;
  };
  financial: {
    pricePerStudent: number;
    activeStudents: number;
    calculatedAmountDue: number;
    totalPaid: number;
    outstandingBalance: number;
  };
}

function formatDate(value?: string | Date) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("ar-EG");
}

export function TeacherDetailClient({ tenant, stats, financial }: TeacherDetailProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"overview" | "stats" | "financial" | "subscription" | "branding" | "security">("overview");

  const [loadingAction, setLoadingAction] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Edit / Action States
  const [pricePerStudent, setPricePerStudent] = useState(financial.pricePerStudent);
  const billingSettings = tenant.billingSettings as Record<string, unknown> | undefined;
  const [studentLimit, setStudentLimit] = useState(Number(billingSettings?.studentLimit ?? 100));
  const [internalNotes, setInternalNotes] = useState(String(billingSettings?.internalNotes ?? ""));
  const [tempPassword, setTempPassword] = useState("");

  // Statement Creation Modal State
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [periodStart, setPeriodStart] = useState(() => new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split("T")[0]);
  const [periodEnd, setPeriodEnd] = useState(() => new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(() => new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split("T")[0]);
  const [adjustments, setAdjustments] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [statementNote, setStatementNote] = useState("");

  // Payment Recording Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payAmount, setPayAmount] = useState(financial.outstandingBalance || 100);
  const [payMethod, setPayMethod] = useState("CASH");
  const [payRef, setPayRef] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [selectedStatementId] = useState<string | null>(null);

  // Printable Statement State
  const [activePrintStatement, setActivePrintStatement] = useState<PrintableStatement | null>(null);

  async function copyTeacherLoginLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/login/${tenant.slug}`);
    setMsg({ type: "success", text: "تم نسخ رابط دخول المدرس. أرسله مع بيانات الحساب." });
  }
  // Status toggle handler
  async function handleStatusChange(newStatus: string) {
    setLoadingAction(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/super-admin/tenants/${tenant.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || "فشل تغيير الحالة");
      setMsg({ type: "success", text: `تم تغيير حالة المنصة إلى ${newStatus}` });
      router.refresh();
    } catch (err: unknown) {
      setMsg({ type: "error", text: err instanceof Error ? err.message : "حدث خطأ" });
    } finally {
      setLoadingAction(false);
    }
  }

  // Update Settings handler
  async function handleSaveSettings() {
    setLoadingAction(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/super-admin/tenants/${tenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pricePerStudent: Number(pricePerStudent),
          studentLimit: Number(studentLimit),
          internalNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || "فشل الحفظ");
      setMsg({ type: "success", text: "تم تحديث البيانات المالية وإعدادات الاشتراك بنجاح" });
      router.refresh();
    } catch (err: unknown) {
      setMsg({ type: "error", text: err instanceof Error ? err.message : "حدث خطأ" });
    } finally {
      setLoadingAction(false);
    }
  }

  // Password Reset handler
  async function handleResetPassword() {
    if (!tempPassword || tempPassword.length < 6) {
      setMsg({ type: "error", text: "كلمة المرور يجب ألا تقل عن 6 أحرف" });
      return;
    }
    setLoadingAction(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/super-admin/tenants/${tenant.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: tempPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || "فشل تعيين كلمة المرور");
      setMsg({ type: "success", text: "تم إعادة تعيين كلمة مرور المدرس بنجاح" });
      setTempPassword("");
    } catch (err: unknown) {
      setMsg({ type: "error", text: err instanceof Error ? err.message : "حدث خطأ" });
    } finally {
      setLoadingAction(false);
    }
  }

  // Issue Statement handler
  async function handleGenerateStatement() {
    setLoadingAction(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/super-admin/tenants/${tenant.id}/billing?action=generate_statement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodStart,
          periodEnd,
          dueDate,
          adjustments: Number(adjustments),
          discount: Number(discount),
          internalNote: statementNote,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || "فشل إصدار المطالبة المالية");
      setMsg({ type: "success", text: "تم إصدار الفاتورة والمطالبة المالية بنجاح" });
      setShowStatementModal(false);
      router.refresh();
    } catch (err: unknown) {
      setMsg({ type: "error", text: err instanceof Error ? err.message : "حدث خطأ" });
    } finally {
      setLoadingAction(false);
    }
  }

  // Record Payment handler
  async function handleRecordPayment() {
    setLoadingAction(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/super-admin/tenants/${tenant.id}/billing?action=record_payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statementId: selectedStatementId,
          amount: Number(payAmount),
          paymentMethod: payMethod,
          referenceNumber: payRef,
          notes: payNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || "فشل تسجيل الدفعة");
      setMsg({ type: "success", text: "تم تسجيل الدفعة المالية بنجاح" });
      setShowPaymentModal(false);
      router.refresh();
    } catch (err: unknown) {
      setMsg({ type: "error", text: err instanceof Error ? err.message : "حدث خطأ" });
    } finally {
      setLoadingAction(false);
    }
  }

  // Support Mode Access
  async function handleStartSupport() {
    setLoadingAction(true);
    try {
      const res = await fetch("/api/super-admin/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: tenant.id }),
      });
      const data = await res.json();
      if (data.ok) {
        window.location.href = "/teacher";
      } else {
        alert(data.message || "فشل دخول وضع الدعم");
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "حدث خطأ");
    } finally {
      setLoadingAction(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      {msg && (
        <div
          style={{
            padding: "1rem",
            borderRadius: "8px",
            background: msg.type === "success" ? "#dcfce7" : "#fef2f2",
            color: msg.type === "success" ? "#15803d" : "#991b1b",
            border: `1px solid ${msg.type === "success" ? "#bbf7d0" : "#fecaca"}`,
          }}
        >
          {msg.text}
        </div>
      )}

      {/* Tabs Navigation */}
      <div style={{ display: "flex", borderBottom: "2px solid #e2e8f0", gap: "0.5rem", overflowX: "auto", paddingBottom: "0.25rem" }}>
        {[
          { id: "overview", label: "📌 النظرة العامة (Overview)" },
          { id: "stats", label: "📊 إحصائيات المنصة (Stats)" },
          { id: "financial", label: "💰 الحساب المالي والفوترة (Billing)" },
          { id: "subscription", label: "⏳ الاشتراك والحدود (Subscription)" },
          { id: "branding", label: "🎨 الهوية والرابط (Branding)" },
          { id: "security", label: "🔒 الأمان والوصول (Security)" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as "overview" | "stats" | "financial" | "subscription" | "branding" | "security")}
            style={{
              padding: "0.75rem 1.25rem",
              fontWeight: 600,
              fontSize: "0.95rem",
              borderRadius: "8px 8px 0 0",
              border: "none",
              background: activeTab === tab.id ? "#1565f5" : "transparent",
              color: activeTab === tab.id ? "#ffffff" : "#475569",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB A: OVERVIEW */}
      {activeTab === "overview" && (
        <section className="saasGrid">
          <div className="saasPanel">
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1rem" }}>بيانات المدرس والمنصة</h3>
            <dl className="detailList">
              <div><dt>اسم المدرس</dt><dd>{tenant.owner?.fullName ?? "غير محدد"}</dd></div>
              <div><dt>اسم المنصة</dt><dd>{tenant.name}</dd></div>
              <div><dt>رقم الهاتف</dt><dd dir="ltr">{tenant.owner?.phone ?? "—"}</dd></div>
              <div><dt>البريد الإلكتروني / المستخدم</dt><dd dir="ltr">{tenant.owner?.email ?? tenant.owner?.username ?? "—"}</dd></div>
              <div><dt>رابط دخول المدرس</dt><dd dir="ltr">/login/{tenant.slug}</dd></div>
              <div><dt>رابط دخول الطلاب</dt><dd dir="ltr">/t/{tenant.slug}/login</dd></div>
              <div><dt>تاريخ الإنشاء</dt><dd>{new Date(tenant.createdAt).toLocaleDateString("ar-EG")}</dd></div>
              <div><dt>آخر تسجيل دخول للمدرس</dt><dd>{tenant.owner?.lastLoginAt ? new Date(tenant.owner.lastLoginAt).toLocaleString("ar-EG") : "لم يدخل بعد"}</dd></div>
            </dl>
          </div>

          <div className="saasPanel">
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1rem" }}>حالة المنصة والاشتراك</h3>
            <dl className="detailList">
              <div><dt>حالة الحساب</dt><dd><span className={`tenantStatus ${tenant.status.toLowerCase()}`}>{tenant.status}</span></dd></div>
              <div><dt>تاريخ بداية الاشتراك</dt><dd>{tenant.billingSettings?.subscriptionStart ? new Date(tenant.billingSettings.subscriptionStart).toLocaleDateString("ar-EG") : "—"}</dd></div>
              <div><dt>تاريخ الانتهاء</dt><dd>{tenant.billingSettings?.subscriptionEnd ? new Date(tenant.billingSettings.subscriptionEnd).toLocaleDateString("ar-EG") : "مفتوح"}</dd></div>
              <div><dt>سعر الطالب المحسوب</dt><dd>{financial.pricePerStudent.toLocaleString("en-US")} ج.م</dd></div>
              <div><dt>الطلاب النشطون حاليًا</dt><dd>{stats.activeStudents.toLocaleString("en-US")} طالب</dd></div>
            </dl>

            <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <a href={`/t/${tenant.slug}`} target="_blank" rel="noreferrer" className="btn secondary">
                معاينة المنصة العامة ↗
              </a>
              <button type="button" onClick={copyTeacherLoginLink} className="btn secondary">
                نسخ رابط دخول المدرس
              </button>
              <button type="button" onClick={handleStartSupport} disabled={loadingAction} className="btn primary">
                دخول المنصة بوضع الدعم 🛠
              </button>
            </div>
          </div>
        </section>
      )}

      {/* TAB B: PLATFORM STATISTICS */}
      {activeTab === "stats" && (
        <div style={{ display: "grid", gap: "1.5rem" }}>
          <section className="saasKpis">
            <article><span>إجمالي الطلاب</span><b>{stats.totalStudents.toLocaleString("en-US")}</b><small>{stats.activeStudents} نشط · {stats.inactiveStudents} موقوف</small></article>
            <article><span>الكورسات والدروس</span><b>{stats.totalCourses.toLocaleString("en-US")} كورس</b><small>{stats.totalLessons} درس · {stats.totalVideos} فيديو</small></article>
            <article><span>الامتحانات والواجبات</span><b>{stats.totalExams.toLocaleString("en-US")} امتحان</b><small>{stats.totalAssignments} واجب دائم</small></article>
            <article><span>أكواد التفعيل</span><b>{stats.totalActivationCodes.toLocaleString("en-US")} كود</b><small>{stats.usedCodes} مستخدم · {stats.availableCodes} متاح</small></article>
          </section>

          <section className="saasPanel">
            <h3>نشاط المنصة الأخير وسجل التدقيق</h3>
            {tenant.auditLogs && (tenant.auditLogs as Record<string, unknown>[]).length ? (
              (tenant.auditLogs as Record<string, unknown>[]).map((log) => {
                const item = log as { id: string; action: string; actor?: { fullName?: string }; createdAt: string };
                return (
                  <div className="auditRow" key={item.id}>
                    <b>{item.action}</b>
                    <span>{item.actor?.fullName ?? "النظام"}</span>
                    <time>{new Date(item.createdAt).toLocaleString("ar-EG")}</time>
                  </div>
                );
              })
            ) : (
              <div className="compactEmpty">لا يوجد نشاط سابق مسجل.</div>
            )}
          </section>
        </div>
      )}

      {/* TAB C: FINANCIAL ACCOUNT AND BILLING */}
      {activeTab === "financial" && (
        <div style={{ display: "grid", gap: "1.5rem" }}>
          <section className="saasKpis">
            <article><span>سعر الطالب المحسوب</span><b>{financial.pricePerStudent.toLocaleString("en-US")} ج.م</b><small>لكل طالب نشط</small></article>
            <article><span>إجمالي مستحقات الدورة الحالية</span><b>{financial.calculatedAmountDue.toLocaleString("en-US")} ج.م</b><small>{financial.activeStudents} طالب × {financial.pricePerStudent} ج.م</small></article>
            <article><span>المسدد من المدرس</span><b style={{ color: "#16a34a" }}>{financial.totalPaid.toLocaleString("en-US")} ج.م</b><small>دفوعات مسجلة</small></article>
            <article><span>المتبقي غير المسدد</span><b style={{ color: financial.outstandingBalance > 0 ? "#dc2626" : "#16a34a" }}>{financial.outstandingBalance.toLocaleString("en-US")} ج.م</b><small>رصيد مستحق</small></article>
          </section>

          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setShowStatementModal(true)} className="btn primary">
              + إصدار فاتورة / مطالبة مالية
            </button>
            <button type="button" onClick={() => setShowPaymentModal(true)} className="btn secondary" style={{ background: "#22c55e", color: "#fff", border: "none" }}>
              💵 تسجيل دفعة مستلمة من المدرس
            </button>
          </div>

          {/* Billing Statements Table */}
          <section className="saasPanel">
            <h3>الفواتير والمطالبات الصادرة</h3>
            {tenant.billingStatements && (tenant.billingStatements as Record<string, unknown>[]).length ? (
              <div className="responsiveTable">
                <table>
                  <thead>
                    <tr>
                      <th>رقم المطالبة</th>
                      <th>الفترة</th>
                      <th>الطلاب المستحقون</th>
                      <th>الإجمالي النهائي</th>
                      <th>المسدد</th>
                      <th>الحالة</th>
                      <th>تاريخ الاستحقاق</th>
                      <th>الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(tenant.billingStatements as Record<string, unknown>[]).map((stmt) => (
                      <tr key={String(stmt.id)}>
                        <td><b>{String(stmt.statementNumber)}</b></td>
                        <td>{new Date(String(stmt.periodStart)).toLocaleDateString("ar-EG")} إلى {new Date(String(stmt.periodEnd)).toLocaleDateString("ar-EG")}</td>
                        <td>{Number(stmt.billableStudents)} طالب ({Number(stmt.pricePerStudent)} ج.م/طالب)</td>
                        <td><b>{Number(stmt.finalAmount).toLocaleString("en-US")} ج.م</b></td>
                        <td style={{ color: "#16a34a" }}>{Number(stmt.paidAmount).toLocaleString("en-US")} ج.م</td>
                        <td>
                          <span className={`tenantStatus ${String(stmt.status).toLowerCase()}`}>{String(stmt.status)}</span>
                        </td>
                        <td>{new Date(String(stmt.dueDate)).toLocaleDateString("ar-EG")}</td>
                        <td style={{ display: "flex", gap: "0.25rem" }}>
                          <button
                            type="button"
                            className="btn secondary"
                            style={{ padding: "0.2rem 0.5rem", fontSize: "0.8rem" }}
                            onClick={() => setActivePrintStatement(stmt as unknown as PrintableStatement)}
                          >
                            طباعة/عرض 📄
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="compactEmpty">لا توجد فواتير مطالبة صادرة بعد.</div>
            )}
          </section>

          {/* Payment History */}
          <section className="saasPanel">
            <h3>سجل الدفعات المستلمة من المدرس</h3>
            {tenant.teacherPayments && (tenant.teacherPayments as Record<string, unknown>[]).length ? (
              <div className="responsiveTable">
                <table>
                  <thead>
                    <tr>
                      <th>تاريخ الدفعة</th>
                      <th>المبلغ</th>
                      <th>طريقة الدفع</th>
                      <th>رقم المرجع / الإيصال</th>
                      <th>ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(tenant.teacherPayments as Record<string, unknown>[]).map((p) => (
                      <tr key={String(p.id)}>
                        <td>{new Date(String(p.paymentDate)).toLocaleDateString("ar-EG")}</td>
                        <td><b style={{ color: "#16a34a" }}>{Number(p.amount).toLocaleString("en-US")} ج.م</b></td>
                        <td>{String(p.paymentMethod)}</td>
                        <td dir="ltr">{String(p.referenceNumber || "—")}</td>
                        <td>{String(p.notes || "—")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="compactEmpty">لم يتم تسجيل أي دفعة مالية من هذا المدرس حتى الآن.</div>
            )}
          </section>
        </div>
      )}

      {/* TAB D: SUBSCRIPTION AND LIMITS */}
      {activeTab === "subscription" && (
        <section className="saasPanel">
          <h3 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "1rem" }}>تعديل خطة الاشتراك وسعر الطالب</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.25rem" }}>السعر لكل طالب نشط (ج.م)</label>
              <input type="number" min={0} value={pricePerStudent} onChange={(e) => setPricePerStudent(Number(e.target.value))} style={{ width: "100%", padding: "0.6rem", borderRadius: "8px", border: "1px solid #cbd5e1" }} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.25rem" }}>الحد الأقصى المسموح به للطلاب</label>
              <input type="number" min={10} value={studentLimit} onChange={(e) => setStudentLimit(Number(e.target.value))} style={{ width: "100%", padding: "0.6rem", borderRadius: "8px", border: "1px solid #cbd5e1" }} />
            </div>
          </div>

          <div style={{ marginTop: "1rem" }}>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.25rem" }}>ملاحظات داخلية خاصة بالإدارة فقط</label>
            <textarea rows={3} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} style={{ width: "100%", padding: "0.6rem", borderRadius: "8px", border: "1px solid #cbd5e1" }} />
          </div>

          <div style={{ marginTop: "1.5rem", display: "flex", gap: "1rem", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button type="button" onClick={() => handleStatusChange("ACTIVE")} disabled={loadingAction} className="btn primary" style={{ background: "#22c55e" }}>تفعيل الحساب (ACTIVE)</button>
              <button type="button" onClick={() => handleStatusChange("SUSPENDED")} disabled={loadingAction} className="btn secondary" style={{ background: "#ef4444", color: "#fff" }}>إيقاف مؤقت (SUSPEND)</button>
              <button type="button" onClick={() => handleStatusChange("DISABLED")} disabled={loadingAction} className="btn secondary">تعطيل كامل (DISABLE)</button>
            </div>

            <button type="button" onClick={handleSaveSettings} disabled={loadingAction} className="btn primary">
              {loadingAction ? "جاري الحفظ..." : "حفظ التغييرات المالية"}
            </button>
          </div>
        </section>
      )}

      {/* TAB E: BRANDING */}
      {activeTab === "branding" && (
        <section className="saasPanel">
          <h3>هوية منصة المدرس (Branding)</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.5rem", marginTop: "1rem" }}>
            <div style={{ padding: "1rem", borderRadius: "8px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <small style={{ color: "#64748b" }}>اللون الرئيسي</small>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem" }}>
                <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: tenant.theme?.primaryColor || "#1565f5" }} />
                <code>{tenant.theme?.primaryColor || "#1565f5"}</code>
              </div>
            </div>

            <div style={{ padding: "1rem", borderRadius: "8px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <small style={{ color: "#64748b" }}>اللون الثانوي</small>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem" }}>
                <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: tenant.theme?.secondaryColor || "#081b3a" }} />
                <code>{tenant.theme?.secondaryColor || "#081b3a"}</code>
              </div>
            </div>

            <div style={{ padding: "1rem", borderRadius: "8px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <small style={{ color: "#64748b" }}>روابط الوصول</small>
              <div style={{ fontWeight: 700, marginTop: "0.25rem" }} dir="ltr">مدرس: /login/{tenant.slug}</div>
              <div style={{ fontWeight: 700, marginTop: "0.25rem" }} dir="ltr">طلاب: /t/{tenant.slug}/login</div>
            </div>
          </div>
        </section>
      )}

      {/* TAB F: SECURITY AND ACCESS */}
      {activeTab === "security" && (
        <section className="saasPanel">
          <h3>إعادة تعيين كلمة مرور المدرس والأمان</h3>
          <p style={{ color: "#64748b", marginBottom: "1.5rem" }}>
            توليد كلمة مرور مؤقتة جديدة للمدرس وإبطال كافة الجلسات المفتوحة حاليًا.
          </p>

          <div style={{ maxWidth: "400px" }}>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.25rem" }}>كلمة المرور الجديدة</label>
            <input
              type="text"
              value={tempPassword}
              onChange={(e) => setTempPassword(e.target.value)}
              placeholder="مثال: NewPass2026"
              style={{ width: "100%", padding: "0.6rem", borderRadius: "8px", border: "1px solid #cbd5e1", marginBottom: "1rem" }}
            />
            <button type="button" onClick={handleResetPassword} disabled={loadingAction} className="btn primary" style={{ width: "100%" }}>
              {loadingAction ? "جاري التغيير..." : "تعيين كلمة المرور وطرد الجلسات"}
            </button>
          </div>
        </section>
      )}

      {/* MODAL 1: GENERATE BILLING STATEMENT */}
      {showStatementModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" }}>
          <div style={{ background: "#fff", padding: "2rem", borderRadius: "16px", maxWidth: "600px", width: "100%" }}>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "1rem" }}>إصدار فاتورة مطالبة مالية للمدرس</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600 }}>بداية الفترة</label>
                <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} style={{ width: "100%", padding: "0.5rem", borderRadius: "8px", border: "1px solid #cbd5e1" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600 }}>نهاية الفترة</label>
                <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} style={{ width: "100%", padding: "0.5rem", borderRadius: "8px", border: "1px solid #cbd5e1" }} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600 }}>إضافات/تسويات (ج.م)</label>
                <input type="number" value={adjustments} onChange={(e) => setAdjustments(Number(e.target.value))} style={{ width: "100%", padding: "0.5rem", borderRadius: "8px", border: "1px solid #cbd5e1" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600 }}>خصم خاص (ج.م)</label>
                <input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} style={{ width: "100%", padding: "0.5rem", borderRadius: "8px", border: "1px solid #cbd5e1" }} />
              </div>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600 }}>تاريخ السداد الأقصى (Due Date)</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ width: "100%", padding: "0.5rem", borderRadius: "8px", border: "1px solid #cbd5e1" }} />
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600 }}>ملاحظات المطالبة</label>
              <textarea rows={2} value={statementNote} onChange={(e) => setStatementNote(e.target.value)} style={{ width: "100%", padding: "0.5rem", borderRadius: "8px", border: "1px solid #cbd5e1" }} />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button type="button" className="btn secondary" onClick={() => setShowStatementModal(false)}>إلغاء</button>
              <button type="button" className="btn primary" onClick={handleGenerateStatement} disabled={loadingAction}>إصدار الفاتورة</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: RECORD PAYMENT */}
      {showPaymentModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" }}>
          <div style={{ background: "#fff", padding: "2rem", borderRadius: "16px", maxWidth: "500px", width: "100%" }}>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "1rem" }}>تسجيل دفعة مستلمة من المدرس</h3>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600 }}>المبلغ المستلم (ج.م) *</label>
              <input type="number" min={1} value={payAmount} onChange={(e) => setPayAmount(Number(e.target.value))} style={{ width: "100%", padding: "0.5rem", borderRadius: "8px", border: "1px solid #cbd5e1" }} />
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600 }}>طريقة الدفع</label>
              <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} style={{ width: "100%", padding: "0.5rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                <option value="CASH">نقدي (CASH)</option>
                <option value="VODAFONE_CASH">فودافون كاش</option>
                <option value="INSTAPAY">انستاباي Instapay</option>
                <option value="FAWRY">فورًا Fawry</option>
                <option value="OTHER">تحويل بنكي / آخر</option>
              </select>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600 }}>رقم المرجع / الإيصال</label>
              <input type="text" value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="مرجع التحويل" style={{ width: "100%", padding: "0.5rem", borderRadius: "8px", border: "1px solid #cbd5e1" }} />
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600 }}>ملاحظات إضافية</label>
              <input type="text" value={payNotes} onChange={(e) => setPayNotes(e.target.value)} style={{ width: "100%", padding: "0.5rem", borderRadius: "8px", border: "1px solid #cbd5e1" }} />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button type="button" className="btn secondary" onClick={() => setShowPaymentModal(false)}>إلغاء</button>
              <button type="button" className="btn primary" onClick={handleRecordPayment} disabled={loadingAction} style={{ background: "#22c55e" }}>تأكيد تسجيل الدفعة</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: PRINTABLE STATEMENT VIEW */}
      {activePrintStatement && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem", overflowY: "auto" }}>
          <div style={{ background: "#fff", padding: "2rem", borderRadius: "16px", maxWidth: "700px", width: "100%" }} className="printableInvoice">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #0f172a", paddingBottom: "1rem", marginBottom: "1.5rem" }}>
              <div>
                <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#1565f5" }}>Skoola · منصة سكولا</h1>
                <p style={{ color: "#64748b", fontSize: "0.85rem" }}>فاتورة مطالبة مالية - معلم منصة</p>
              </div>
              <div style={{ textAlign: "left" }} dir="ltr">
                <b style={{ fontSize: "1.1rem" }}>{activePrintStatement.statementNumber}</b>
                <p style={{ fontSize: "0.8rem", color: "#64748b" }}>تاريخ الإصدار: {formatDate(activePrintStatement.issueDate)}</p>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem", background: "#f8fafc", padding: "1rem", borderRadius: "8px" }}>
              <div>
                <small style={{ color: "#64748b" }}>بيانات المدرس والمنصة</small>
                <div><strong>المدرس:</strong> {tenant.owner?.fullName}</div>
                <div><strong>المنصة:</strong> {tenant.name}</div>
              </div>
              <div>
                <small style={{ color: "#64748b" }}>فترة الاستحقاق</small>
                <div>من: {formatDate(activePrintStatement.periodStart)}</div>
                <div>إلى: {formatDate(activePrintStatement.periodEnd)}</div>
              </div>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "1.5rem" }}>
              <thead>
                <tr style={{ background: "#f1f5f9", textAlign: "right" }}>
                  <th style={{ padding: "0.75rem" }}>البند</th>
                  <th style={{ padding: "0.75rem" }}>العدد / الكمية</th>
                  <th style={{ padding: "0.75rem" }}>الفئة</th>
                  <th style={{ padding: "0.75rem" }}>الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: "0.75rem", borderBottom: "1px solid #e2e8f0" }}>الطلاب النشطون المسجلون</td>
                  <td style={{ padding: "0.75rem", borderBottom: "1px solid #e2e8f0" }}>{activePrintStatement.billableStudents} طالب</td>
                  <td style={{ padding: "0.75rem", borderBottom: "1px solid #e2e8f0" }}>{activePrintStatement.pricePerStudent} ج.م</td>
                  <td style={{ padding: "0.75rem", borderBottom: "1px solid #e2e8f0" }}>{Number(activePrintStatement.subtotal).toLocaleString("en-US")} ج.م</td>
                </tr>
                {Number(activePrintStatement.adjustments) > 0 && (
                  <tr>
                    <td style={{ padding: "0.75rem", borderBottom: "1px solid #e2e8f0" }}>تسويات وإضافات</td>
                    <td style={{ padding: "0.75rem", borderBottom: "1px solid #e2e8f0" }}>—</td>
                    <td style={{ padding: "0.75rem", borderBottom: "1px solid #e2e8f0" }}>—</td>
                    <td style={{ padding: "0.75rem", borderBottom: "1px solid #e2e8f0" }}>+{Number(activePrintStatement.adjustments).toLocaleString("en-US")} ج.م</td>
                  </tr>
                )}
                {Number(activePrintStatement.discount) > 0 && (
                  <tr>
                    <td style={{ padding: "0.75rem", borderBottom: "1px solid #e2e8f0" }}>خصم خاص</td>
                    <td style={{ padding: "0.75rem", borderBottom: "1px solid #e2e8f0" }}>—</td>
                    <td style={{ padding: "0.75rem", borderBottom: "1px solid #e2e8f0" }}>—</td>
                    <td style={{ padding: "0.75rem", borderBottom: "1px solid #e2e8f0", color: "#dc2626" }}>-{Number(activePrintStatement.discount).toLocaleString("en-US")} ج.م</td>
                  </tr>
                )}
              </tbody>
            </table>

            <div style={{ background: "#0f172a", color: "#fff", padding: "1.25rem", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <span style={{ fontSize: "1.1rem" }}>المبلغ النهائي المستحق</span>
              <strong style={{ fontSize: "1.5rem" }}>{Number(activePrintStatement.finalAmount).toLocaleString("en-US")} ج.م</strong>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
              <button type="button" className="btn secondary" onClick={() => window.print()}>
                🖨 طباعة الفاتورة (Print)
              </button>
              <button type="button" className="btn primary" onClick={() => setActivePrintStatement(null)}>
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
