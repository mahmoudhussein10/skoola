"use client";

import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="systemStatePage" dir="rtl"><section className="systemStateCard" role="alert"><span className="systemStateIcon error"><AlertTriangle size={30}/></span><small>تعذر إكمال الطلب</small><h1>حدث خطأ غير متوقع</h1><p>بياناتك محفوظة. جرّب تحميل الصفحة مرة أخرى، أو ارجع للصفحة الرئيسية إذا استمرت المشكلة.</p><div className="systemStateActions"><button className="btn primary" onClick={reset}><RefreshCw size={17}/> إعادة المحاولة</button><Link className="btn systemStateSecondary" href="/">العودة للرئيسية</Link></div></section></main>;
}