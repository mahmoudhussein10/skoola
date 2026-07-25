import Link from "next/link";
import { ArrowRight, SearchX } from "lucide-react";

export default function NotFound() {
  return <main className="systemStatePage" dir="rtl"><section className="systemStateCard"><span className="systemStateIcon"><SearchX size={30}/></span><small>404</small><h1>الصفحة غير موجودة</h1><p>قد يكون الرابط غير صحيح أو تم نقل الصفحة. ارجع إلى الصفحة السابقة أو ابدأ من الرئيسية.</p><div className="systemStateActions"><Link className="btn primary" href="/"><ArrowRight size={17}/> الصفحة الرئيسية</Link><Link className="btn systemStateSecondary" href="/login">تسجيل الدخول</Link></div></section></main>;
}