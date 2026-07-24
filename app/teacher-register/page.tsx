import Link from "next/link";
import { Brand } from "../ui";
import { TeacherSignupForm } from "./teacher-form";

export const metadata = { title: "إنشاء منصة مدرس" };

export default function TeacherRegisterPage() {
  return <main className="simpleAuth teacherSignupPage"><Brand /><section className="panel teacherSignupCard"><span className="tag orange">ابدأ منصتك التعليمية</span><h1>حساب المدرس ومساحة عمل مستقلة</h1><p>سيتم إنشاء رابط خاص وبيانات معزولة بالكامل لمنصتك.</p><TeacherSignupForm /><Link className="backLink" href="/login">لديك حساب؟ سجّل الدخول</Link></section></main>;
}
