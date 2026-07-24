import Link from "next/link";
import { AuthVisual } from "../auth-visual";
import { Brand } from "../ui";

export const metadata = { title: "إنشاء حساب طالب" };

export default function RegisterPage() {
  return (
    <main className="authPage skoolaAuthPage registerPage">
      <AuthVisual variant="student" />
      <section className="authCard">
        <div className="authMobileBrand">
          <Brand />
        </div>
        <div className="authCardInner wide" style={{ textAlign: "center", padding: "40px 20px" }}>
          <span className="skoolaPill" style={{ color: "#dc2626", background: "#fef2f2", borderColor: "#fecaca" }}>
            رابط المدرس مطلوب
          </span>
          <h1 style={{ marginTop: "16px" }}>المدرس غير محدد</h1>
          <p style={{ maxWidth: "460px", margin: "12px auto 24px", lineHeight: "1.8", color: "#64748b" }}>
            لتسجيل حساب طالب جديد، يجب استخدام الرابط الخاص بمدرسك (مثال: <code>/t/اسم-المدرس/register</code> أو <code>/t/اسم-المدرس</code>).
          </p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            <Link className="btn primary" href="/login">
              تسجيل الدخول ←
            </Link>
            <Link className="btn outline" href="/">
              الرئيسية
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}