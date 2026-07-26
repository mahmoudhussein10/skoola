import Image from "next/image";
import Link from "next/link";
import { Menu } from "lucide-react";
import { NotificationBell, PushBootstrap } from "./notifications/push-client";

export function Brand({ compact = false, inverse = false }: { compact?: boolean; inverse?: boolean }) {
  return <Link className={`brand skoolaBrand${compact ? " compact" : ""}${inverse ? " inverse" : ""}`} href="/" aria-label="Skoola — الصفحة الرئيسية">
    <span className="skoolaLogoFrame"><Image src="/skoola-logo.png" alt="Skoola" width={240} height={240} priority /></span>
    {!compact && <span className="skoolaWordmark"><strong>Skoola</strong><small>Teach · Learn · Grow</small></span>}
  </Link>;
}

export function Top() {
  return <header><nav className="wrap nav"><Brand /><div className="links"><Link href="/#features">المميزات</Link><Link href="/#solutions">الحلول</Link><Link href="/#pricing">الأسعار</Link><Link href="/#faq">الأسئلة</Link></div><div className="actions"><Link href="/#pricing">خطط المنصة</Link><Link className="btn primary" href="/login?role=teacher">دخول المدرس</Link></div></nav></header>;
}
export function Side({ active = "الرئيسية" }: { active?: string }) {
  const items = [["الرئيسية", "/dashboard"], ["كورساتي", "/dashboard#my-courses"], ["تفعيل كورس", "/dashboard#activate-course"], ["الاختبارات", "/dashboard#exam-results"], ["الإشعارات", "/notifications"]];
  return <aside className="side"><Brand inverse/><nav>{items.map(([label, href]) => <Link key={label} className={active === label ? "active" : ""} href={href}><span>•</span>{label}</Link>)}</nav><form action="/api/auth/logout" method="post" className="sideLogout"><button type="submit" suppressHydrationWarning>تسجيل الخروج</button></form><footer>تحتاج مساعدة؟<b>تواصل مع فريق Skoola</b></footer></aside>;
}

export function AppTop({ title, sub = "نتمنى لك يومًا مليئًا بالإنجاز", userName }: { title: string; sub?: string; userName?: string }) {
  return <div className="appTop"><div className="appTopIdentity"><details className="studentMobileNav"><summary aria-label="فتح قائمة الطالب"><Menu size={21}/><span>القائمة</span></summary><div className="studentMobileNavPanel"><nav><Link href="/dashboard">الرئيسية</Link><Link href="/dashboard#my-courses">كورساتي</Link><Link href="/dashboard#activate-course">تفعيل كورس</Link><Link href="/dashboard#exam-results">الاختبارات والنتائج</Link></nav><form action="/api/auth/logout" method="post"><button type="submit">تسجيل الخروج</button></form></div></details><div><h1>{title}</h1><p>{sub}</p></div></div><div className="user"><NotificationBell role="student"/><i>{userName?.charAt(0) ?? "S"}</i><b>{userName ?? "الحساب"}</b></div><PushBootstrap role="student"/></div>;
}