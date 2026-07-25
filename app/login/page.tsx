import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthVisual } from "../auth-visual";
import { Brand } from "../ui";
import { LoginForm } from "../auth-form";
import { getAuthContext, homeForRole } from "../../lib/auth";

export const metadata = { title: "تسجيل الدخول" };

type LoginRole = "student" | "teacher";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const auth = await getAuthContext();
  if (auth) redirect(homeForRole(auth.user.role));
  const query = await searchParams;
  const role: LoginRole = query.role === "teacher" ? "teacher" : "student";
  const isTeacher = role === "teacher";
  return <main className="authPage skoolaAuthPage">
    <AuthVisual variant={isTeacher ? "default" : "student"}/>
    <section className="authCard"><div className="authMobileBrand"><Brand/></div><div className="authCardInner">
      <span className="skoolaPill">{isTeacher ? "مساحة المدرس" : "مساحة الطالب"}</span>
      <h1>{isTeacher ? "دخول المدرس إلى منصته" : "دخول الطالب إلى منصته"}</h1>
      <p>{isTeacher ? "أدر كورساتك وطلابك ومحتواك من لوحة الأكاديمية." : "واصل دروسك وامتحاناتك ونتائجك من حيث توقفت."}</p>
      <div className="authRoleTabs" aria-label="اختيار نوع الحساب">
        <Link className={!isTeacher ? "active" : ""} href="/login?role=student">طالب</Link>
        <Link className={isTeacher ? "active" : ""} href="/login?role=teacher">مدرس</Link>
      </div>
      <LoginForm portal={role}/>
    </div></section>
  </main>;
}