import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AuthVisual } from "../../auth-visual";
import { LoginForm } from "../../auth-form";
export const metadata = { title: "دخول Super Admin" };
export default function SuperAdminLoginPage() { return <main className="authPage skoolaAuthPage superAdminAuth"><AuthVisual variant="admin"/><section className="authCard"><div className="authCardInner"><span className="skoolaPill">الإدارة العليا</span><h1>دخول Super Admin</h1><p>بوابة Skoola المحمية لإدارة المنصات والنمو والأمان.</p><LoginForm variant="super-admin"/><Link className="backLink" href="/"><ArrowRight size={16}/> العودة للرئيسية</Link></div></section></main>; }