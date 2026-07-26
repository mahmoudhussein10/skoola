import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthVisual } from "../auth-visual";
import { Brand } from "../ui";
import { getAuthContext, homeForRole } from "../../lib/auth";
import { TeacherSignupForm } from "./teacher-form";

export const metadata = {
  title: "إنشاء منصة مدرس",
  description: "أنشئ حساب المدرس ومنصتك التعليمية على Skoola في خطوات بسيطة.",
};

export default async function TeacherRegisterPage() {
  const auth = await getAuthContext();
  if (auth) redirect(homeForRole(auth.user.role));

  return (
    <main id="main-content" className="authPage skoolaAuthPage teacherSelfSignupPage">
      <AuthVisual variant="default" />
      <section className="authCard teacherSelfSignupShell">
        <div className="authMobileBrand"><Brand /></div>
        <div className="authCardInner teacherSelfSignupCard">
          <div className="teacherSignupIntro">
            <span className="skoolaPill">ابدأ أكاديميتك</span>
            <h1>أنشئ منصة المدرس</h1>
            <p>أدخل بياناتك مرة واحدة، وارفع صورتك، ثم أكمل تجهيز منصتك من لوحة التحكم.</p>
          </div>
          <TeacherSignupForm />
          <p className="teacherSignupLogin">لديك حساب بالفعل؟ <Link href="/login?role=teacher">دخول المدرس</Link></p>
        </div>
      </section>
    </main>
  );
}
