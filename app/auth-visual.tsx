import Image from "next/image";
import { BarChart3, BookOpenCheck, ShieldCheck, Sparkles, Users } from "lucide-react";
import { Brand } from "./ui";

export function AuthVisual({ variant = "default" }: { variant?: "default" | "admin" | "student" }) {
  const admin = variant === "admin";
  return <section className={`authVisual skoolaAuthVisual ${admin ? "admin" : ""}`}><Brand inverse={admin}/><div className="authOrb one"/><div className="authOrb two"/><div className="authVisualContent"><span className="authVisualPill"><Sparkles size={15}/>{admin ? "Skoola Enterprise" : "Teach · Learn · Grow"}</span><h2>{admin ? <>إدارة أذكى.<br/>نمو أوضح.</> : <>مكان واحد<br/>لكل رحلة تعليم.</>}</h2><p>{admin ? "مركز قيادة آمن لإدارة المنصات والنمو والعمليات الحساسة بثقة." : "تجربة تعليمية حديثة تجمع المحتوى والتقدم والتواصل في مساحة هادئة."}</p><div className="authVisualStats"><span><i><Users size={18}/></i><b>كل طلابك</b><small>في مساحة واحدة</small></span><span><i><BookOpenCheck size={18}/></i><b>كل محتواك</b><small>منظم وسهل</small></span><span><i>{admin ? <ShieldCheck size={18}/> : <BarChart3 size={18}/>}</i><b>{admin ? "أمان كامل" : "نمو واضح"}</b><small>{admin ? "وصول محسوب" : "تقارير مباشرة"}</small></span></div></div><div className="authLogoWatermark"><Image src="/skoola-logo.png" alt="" width={460} height={460}/></div></section>;
}