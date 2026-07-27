import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, BarChart3, BookOpenCheck, Check, ChevronLeft, GraduationCap, Layers3, LockKeyhole, Palette, ShieldCheck, Sparkles, Users, Zap } from "lucide-react";
import { prisma } from "../lib/prisma";
import { getAuthContext, homeForRole } from "../lib/auth";
import { AnimatedNumber, Reveal } from "./skoola-motion";
import { Brand } from "./ui";

export const metadata: Metadata = { title: "Skoola — منصتك التعليمية تبدأ هنا", description: "أنشئ أكاديميتك التعليمية وأدر الطلاب والكورسات والفريق من منصة واحدة." };

async function getPlatformStats() {
  try {
    const [teachers, students, courses] = await Promise.all([
      prisma.tenant.count({ where: { status: { not: "ARCHIVED" } } }),
      prisma.tenantMember.count({ where: { role: "STUDENT", status: "ACTIVE" } }),
      prisma.course.count({ where: { status: { not: "ARCHIVED" } } }),
    ]);
    return { teachers, students, courses, connected: true };
  } catch (error) {
    console.error("Skoola stats unavailable", error);
    return { teachers: 0, students: 0, courses: 0, connected: false };
  }
}

const features = [
  { icon: Layers3, title: "أكاديمية مستقلة", text: "رابط وهوية ومحتوى وطلاب مستقلون لكل مدرس، مع عزل صارم للبيانات." },
  { icon: BookOpenCheck, title: "تعليم متكامل", text: "كورسات ودروس واختبارات وواجبات وأكواد تفعيل في رحلة تعليم واحدة." },
  { icon: BarChart3, title: "قرارات مبنية على بيانات", text: "متابعة واضحة للنشاط والتقدم والنمو من لوحات تحليل سهلة القراءة." },
  { icon: Palette, title: "هوية تشبهك", text: "خصّص ألوان منصتك وشعارها ضمن نظام يحافظ دائمًا على جودة التجربة." },
  { icon: Users, title: "فريق بصلاحيات دقيقة", text: "أضف فريق العمل وحدد من يرى أو يعدّل كل جزء من مساحة الأكاديمية." },
  { icon: ShieldCheck, title: "أمان بمستوى SaaS", text: "جلسات محمية وسجل تدقيق وعزل لكل مؤسسة من الخادم وحتى قاعدة البيانات." },
];

const plans = [
  { name: "Starter", price: "تفعيل إداري", note: "لبداية أكاديمية منظمة ببياناتك الحقيقية", features: ["مساحة مدرس مستقلة", "هوية خاصة بمنصتك", "إدارة الكورسات والطلاب", "بدون بيانات تجريبية"] },
  { name: "Pro", price: "حسب احتياجك", note: "للأكاديميات التي تحتاج سعة وأدوات أكبر", featured: true, features: ["إدارة مرنة للمحتوى", "تخصيص كامل للهوية", "فريق وصلاحيات", "تقارير من النشاط الفعلي"] },
  { name: "Scale", price: "تواصل معنا", note: "للفرق والمؤسسات ذات المتطلبات الخاصة", features: ["كل مزايا Pro", "إعداد يناسب المؤسسة", "دعم أولوية", "إدارة وتقارير متقدمة"] },
];

export default async function PlatformHome() {
  const auth = await getAuthContext();
  if (auth) redirect(homeForRole(auth.user.role));
  const stats = await getPlatformStats();
  return <main className="skoolaHome">
    <header className="skoolaHeader"><nav className="skoolaWrap skoolaNav"><Brand /><div className="skoolaNavLinks"><Link href="#features">المميزات</Link><Link href="#solutions">الحلول</Link><Link href="#pricing">الأسعار</Link><Link href="#faq">الأسئلة</Link></div><div className="skoolaNavActions"><Link href="#pricing">خطط المنصة</Link><Link className="skoolaBtn small" href="/login?role=teacher">دخول المدرس <ArrowLeft size={16} /></Link></div></nav></header>

    <section className="skoolaHero skoolaWrap">
      <div className="skoolaBlob blobOne" /><div className="skoolaBlob blobTwo" />
      <Reveal className="skoolaHeroCopy"><span className="skoolaPill"><Sparkles size={15} /> منصة التعليم العربية الجديدة</span><h1>علّم بطريقتك.<br /><span>وانمُ بلا حدود.</span></h1><p>Skoola تمنحك كل ما تحتاجه لبناء أكاديمية رقمية احترافية، إدارة طلابك، نشر محتواك، وقياس النمو من مكان واحد.</p><div className="skoolaHeroActions"><Link className="skoolaBtn" href="/teacher-register">دخول لوحة المدرس <ArrowLeft size={19} /></Link><Link className="skoolaVideoBtn" href="#pricing"><i><ShieldCheck size={17} /></i> التفعيل عبر الإدارة</Link></div><div className="skoolaProof"><span><Check size={15} /> حسابات موثّقة</span><span><Check size={15} /> إعداد بواسطة الإدارة</span><span><Check size={15} /> عربي وRTL</span></div></Reveal>
      <Reveal className="skoolaHeroProduct" delay={.12}><div className="productGlow" /><div className="productWindow"><div className="productTop"><span><i /><i /><i /></span><b>لوحة تحكم Skoola</b><small>متصل الآن</small></div><div className="productBody"><aside><Brand compact /><i className="active" /><i /><i /><i /></aside><div className="productCanvas"><div className="productWelcome"><span>أهلًا بعودتك 👋</span><strong>أكاديميتك تنمو اليوم</strong></div><div className="productKpis"><span><small>الطلاب</small><b>—</b></span><span><small>النمو</small><b>—</b></span><span><small>الكورسات</small><b>—</b></span></div><div className="productChart"><div className="chartTitle"><b>بيانات الأداء</b><small>بعد بدء الاستخدام</small></div><div className="productEmptyChart">ستظهر بيانات الأداء الحقيقية هنا بعد بدء استخدام منصتك.</div></div></div></div></div><div className="floatingCard students"><Users size={20}/><span><b>بياناتك فقط</b><small>تظهر بعد بدء الاستخدام</small></span></div><div className="floatingCard success"><Zap size={20}/><span><b>متابعة فعلية</b><small>بدون أرقام تجريبية</small></span></div></Reveal>
    </section>

    <section className="skoolaStats skoolaWrap" aria-label="إحصاءات Skoola"><div><b><AnimatedNumber value={stats.teachers} /></b><span>أكاديمية على Skoola</span></div><div><b><AnimatedNumber value={stats.students} /></b><span>طالب نشط</span></div><div><b><AnimatedNumber value={stats.courses} /></b><span>كورس منشور</span></div><div><b>{stats.connected ? "متصل" : "—"}</b><span>جاهزية النظام</span></div></section>

    <section className="skoolaSection skoolaWrap" id="solutions"><Reveal className="skoolaSectionHead"><span>لكل رحلة تعليمية</span><h2>مدخل واضح لكل شخص.<br />وتجربة مصممة لدوره.</h2><p>من أول تسجيل المدرس حتى متابعة آخر طالب، كل خطوة متصلة وسهلة.</p></Reveal><div className="solutionGrid"><Reveal className="solutionCard teacherSolution"><div className="solutionIcon"><GraduationCap /></div><small>للمدرسين والأكاديميات</small><h3>حوّل خبرتك إلى أكاديمية متكاملة</h3><p>أنشئ المنصة، أضف المحتوى، كوّن فريقك، وتابع أداء طلابك من لوحة واحدة.</p><Link href="/login?role=teacher">دخول لوحة المدرس <ChevronLeft size={17}/></Link></Reveal><Reveal className="solutionCard studentSolution" delay={.08}><div className="solutionIcon"><BookOpenCheck /></div><small>للطلاب</small><h3>تعلّم بوضوح وواصل تقدمك</h3><p>كل كورساتك ونتائجك وواجباتك وإشعاراتك في مساحة تعليمية هادئة.</p><Link href="/login?role=student">دخول الطالب <ChevronLeft size={17}/></Link></Reveal><Reveal className="solutionCard adminSolution" delay={.16}><div className="solutionIcon"><LockKeyhole /></div><small>للإدارة العليا</small><h3>تحكم مؤسسي بلا فوضى</h3><p>راقب النمو والمنصات والأمان والإعلانات من مركز قيادة محمي.</p><Link href="/super-admin/login">دخول Super Admin <ChevronLeft size={17}/></Link></Reveal></div></section>

    <section className="skoolaFeatureBand" id="features"><div className="skoolaWrap"><Reveal className="skoolaSectionHead light"><span>مصمم للنمو</span><h2>قوة المنتج الكبير.<br />وبساطة الأدوات التي تحبها.</h2><p>تجربة نظيفة وسريعة تحافظ على تركيز المدرس والطالب.</p></Reveal><div className="skoolaFeatureGrid">{features.map((feature, index) => { const Icon = feature.icon; return <Reveal className="skoolaFeatureCard" delay={index * .04} key={feature.title}><i><Icon size={22}/></i><h3>{feature.title}</h3><p>{feature.text}</p></Reveal>; })}</div></div></section>

    <section className="skoolaSection skoolaWrap" id="pricing"><Reveal className="skoolaSectionHead centered"><span>خطط مرنة</span><h2>ابدأ بما يناسبك. وتوسّع عندما تنمو.</h2><p>اختر مستوى الخدمة المناسب بعد التواصل، بدون عرض أسعار افتراضية.</p></Reveal><div className="pricingGrid">{plans.map((plan, index) => <Reveal className={`priceCard${plan.featured ? " featured" : ""}`} delay={index * .07} key={plan.name}>{plan.featured && <span className="popular">الأكثر اختيارًا</span>}<small>{plan.name}</small><h3>{plan.price}</h3><p>{plan.note}</p><ul>{plan.features.map((feature) => <li key={feature}><Check size={16}/>{feature}</li>)}</ul><Link className={plan.featured ? "skoolaBtn" : "skoolaOutlineBtn"} href="/login?role=teacher">لديك منصة؟ سجّل الدخول <ArrowLeft size={17}/></Link></Reveal>)}</div></section>

    <section className="skoolaSection skoolaFaq skoolaWrap" id="faq"><Reveal className="skoolaSectionHead"><span>الأسئلة الشائعة</span><h2>كل ما تحتاج معرفته<br />قبل أن تبدأ.</h2></Reveal><div className="faqList"><details><summary>هل أحتاج خبرة تقنية لإنشاء منصتي؟ <b>+</b></summary><p>لا. صممنا Skoola لتبدأ وتضيف محتواك وتدير طلابك من دون كتابة أي كود.</p></details><details><summary>هل لكل مدرس رابط وهوية مستقلة؟ <b>+</b></summary><p>نعم، لكل مدرس مساحة مستقلة ببياناته ورابطه وألوانه وفريقه، مع الحفاظ على معايير تجربة Skoola.</p></details><details><summary>هل تعمل المنصة على الهاتف؟ <b>+</b></summary><p>نعم، كل الصفحات ولوحات التحكم مصممة لتعمل بسلاسة على الهاتف والتابلت والكمبيوتر.</p></details><details><summary>كيف يتم حماية بيانات الطلاب؟ <b>+</b></summary><p>نطبق عزلًا كاملًا بين المنصات وصلاحيات دقيقة وسجلًا للعمليات الإدارية الحساسة.</p></details></div></section>

    <section className="skoolaCta"><div className="skoolaWrap"><div><span>حسابات مدرسين موثّقة</span><h2>منصتك تُجهّز لك بواسطة إدارة Skoola.</h2><p>بعد التفعيل تستلم رابط دخول مخصصًا وبيانات حسابك، ثم تبدأ إدارة أكاديميتك مباشرة.</p></div><Link className="skoolaBtn light" href="/login?role=teacher">دخول المدرس <ArrowLeft size={19}/></Link></div></section>
    <footer className="skoolaFooter"><div className="skoolaWrap footerGrid"><div><Brand inverse/><p>Teach · Learn · Grow<br/>منصة تعليم حديثة تنمو معك.</p></div><div><b>المنتج</b><Link href="#features">المميزات</Link><Link href="#pricing">الأسعار</Link><Link href="/login?role=teacher">دخول المدرسين</Link></div><div><b>الحساب</b><Link href="/login?role=teacher">دخول المدرس</Link><Link href="/login?role=student">دخول الطالب</Link><Link href="/forgot-password">استعادة الحساب</Link></div><div><b>الإدارة</b><Link href="/super-admin/login">Super Admin</Link><span>إنشاء المنصات بواسطة الإدارة</span></div></div><div className="skoolaWrap footerBottom"><span>© {new Date().getFullYear()} Skoola. جميع الحقوق محفوظة.</span><span>Teach · Learn · Grow</span></div></footer>
  </main>;
}