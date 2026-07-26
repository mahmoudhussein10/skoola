
"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, BarChart3, BookOpenCheck, CheckCircle2, ChevronDown, CircleHelp, CreditCard, FileQuestion, Palette, Settings, ShieldCheck, UserCog, Users, Video } from "lucide-react";

type HelpItem = { id: string; category: string; question: string; answer: string; href: string; actionLabel: string; keywords: string };

const categories = [
  { id: "all", label: "كل الموضوعات", Icon: CircleHelp },
  { id: "getting-started", label: "البداية والإعداد", Icon: Settings },
  { id: "courses", label: "الكورسات والمحتوى", Icon: BookOpenCheck },
  { id: "exams", label: "الامتحانات", Icon: FileQuestion },
  { id: "students", label: "الطلاب والاشتراكات", Icon: Users },
  { id: "payments", label: "الدفع والتحويلات", Icon: CreditCard },
  { id: "branding", label: "شكل الأكاديمية", Icon: Palette },
  { id: "reports", label: "التقارير والمتابعة", Icon: BarChart3 },
  { id: "security", label: "الفريق والأمان", Icon: ShieldCheck },
];

const quickActions = [
  { title: "إنشاء كورس جديد", description: "أضف بيانات الكورس والغلاف والسعر.", href: "/teacher/courses", Icon: BookOpenCheck },
  { title: "رفع فيديو أو ملف", description: "ارفع الوسائط واربطها بالكورس والدرس.", href: "/teacher/media", Icon: Video },
  { title: "إنشاء امتحان", description: "أضف كويزًا وأسئلة داخل قسم الكورس.", href: "/teacher/courses", Icon: FileQuestion },
  { title: "مراجعة طلبات الدفع", description: "وافق على التحويلات أو ارفضها مع السبب.", href: "/teacher/payments", Icon: CreditCard },
  { title: "إضافة رقم التحويل", description: "حدد رقم المحفظة الذي يظهر للطلاب.", href: "/teacher/settings", Icon: Settings },
  { title: "دعوة عضو للفريق", description: "أضف عضوًا وحدد صلاحياته المناسبة.", href: "/teacher/staff", Icon: UserCog },
];

const helpItems: HelpItem[] = [
  { id: "start", category: "getting-started", question: "أبدأ تجهيز الأكاديمية منين؟", answer: "ابدأ بإضافة اسم الأكاديمية وبيانات التواصل من الإعدادات، ثم ارفع الشعار وصورة الواجهة. بعد ذلك أنشئ أول كورس، أضف الأقسام والدروس، وانشر الكورس عندما يصبح جاهزًا.", href: "/teacher/settings", actionLabel: "فتح إعدادات الأكاديمية", keywords: "بداية تجهيز أول مرة اسم وصف تواصل" },
  { id: "public-link", category: "getting-started", question: "أين أجد رابط الأكاديمية الذي أرسله للطلاب؟", answer: "ستجد زر عرض الأكاديمية للطلاب أسفل القائمة الجانبية. الرابط يستخدم الرابط الفريد لأكاديميتك ويعرض هويتك وكورساتك المنشورة فقط.", href: "/teacher", actionLabel: "العودة للوحة التحكم", keywords: "رابط الأكاديمية مشاركة طالب url slug" },
  { id: "public-hidden", category: "getting-started", question: "لماذا الصفحة العامة أو الكورس لا يظهران للطلاب؟", answer: "تأكد من تفعيل نشر الصفحة العامة من الإعدادات، ومن أن حالة الكورس منشور وليست مسودة أو مؤرشف. المحتوى غير المنشور يظل محفوظًا للمدرس ولا يظهر للطلاب.", href: "/teacher/settings", actionLabel: "مراجعة إعدادات النشر", keywords: "صفحة لا تظهر نشر إخفاء مسودة منشور" },

  { id: "create-course", category: "courses", question: "كيف أنشئ كورسًا جديدًا؟", answer: "افتح الكورسات واضغط إنشاء كورس. اكتب الاسم والرابط والوصف والصف والمادة والسعر، وارفع غلافًا واضحًا. يمكنك حفظه كمسودة أو نشره مباشرة.", href: "/teacher/courses", actionLabel: "إنشاء كورس", keywords: "إضافة كورس سعر صف مادة غلاف" },
  { id: "course-structure", category: "courses", question: "كيف أنظم الكورس إلى أقسام ودروس؟", answer: "افتح الكورس وأنشئ قسمًا لكل وحدة أو باب، ثم أضف داخله الدروس بالترتيب المطلوب. استخدم أسماء قصيرة وواضحة ليعرف الطالب مساره والخطوة التالية.", href: "/teacher/courses", actionLabel: "إدارة الكورسات", keywords: "قسم وحدة باب درس ترتيب محتوى" },
  { id: "video-file", category: "courses", question: "كيف أرفع فيديو أو PDF أو صورة للدرس؟", answer: "أنشئ الدرس واحفظه أولًا، ثم افتحه للتعديل واستخدم رفع الفيديو أو المرفق أو الصورة. تتم معالجة الفيديو تلقائيًا، ويظهر الملف للطالب بعد أن تصبح حالته جاهزًا.", href: "/teacher/media", actionLabel: "فتح مكتبة الوسائط", keywords: "فيديو pdf ملف مذكرة صورة bunny معالجة" },

  { id: "create-exam", category: "exams", question: "كيف أنشئ امتحانًا أو كويزًا؟", answer: "افتح الكورس والقسم المطلوب واختر إنشاء كويز. حدد العنوان والمدة ودرجة النجاح وعدد المحاولات، ثم أضف الأسئلة وحدد الإجابات الصحيحة واحفظ الامتحان.", href: "/teacher/courses", actionLabel: "فتح إدارة الكورسات", keywords: "إنشاء امتحان كويز quiz سؤال" },
  { id: "question-image", category: "exams", question: "كيف أضيف صورة للسؤال؟ وهل يستطيع الطالب تكبيرها؟", answer: "من محرر السؤال استخدم رفع صورة السؤال واخترها من جهازك. تظهر الصورة داخل السؤال، ويمكن للطالب الضغط عليها لتكبيرها في شاشة كاملة وإغلاقها بزر Esc.", href: "/teacher/courses", actionLabel: "فتح محرر الامتحان", keywords: "صورة سؤال تكبير رفع image zoom" },
  { id: "exam-settings", category: "exams", question: "كيف أحدد الوقت والنجاح والمحاولات وأرى النتائج؟", answer: "حدد المدة ونسبة النجاح والحد الأقصى للمحاولات داخل إعدادات الامتحان. الطالب يرى المعلومات قبل بدء العداد، وتظهر درجات الطلاب ومحاولاتهم في صفحة الامتحانات والنتائج.", href: "/teacher/exams", actionLabel: "عرض نتائج الامتحانات", keywords: "وقت مدة نجاح محاولات نتيجة درجة timer" },
  { id: "exam-answers", category: "exams", question: "هل يمكن إظهار الإجابة الصحيحة والشرح بعد التسليم؟", answer: "نعم. فعّل إظهار الإجابات بعد التسليم وأضف شرحًا للسؤال. بعد التسليم يرى الطالب إجابته والصحيح والشرح وفق الإعدادات التي اخترتها.", href: "/teacher/courses", actionLabel: "تعديل الامتحان", keywords: "إجابة صحيحة شرح مراجعة بعد التسليم" },

  { id: "student-register", category: "students", question: "كيف ينشئ الطالب حسابًا ويشترك في كورس؟", answer: "أرسل له رابط الأكاديمية ليضغط حساب جديد. بعد الدخول يفتح تفاصيل الكورس ويرسل طلب الاشتراك، ويظهر الطلب عندك في الدفع والاشتراكات للمراجعة.", href: "/teacher/payments", actionLabel: "طلبات الاشتراك", keywords: "تسجيل طالب حساب اشتراك كورس" },
  { id: "activation-code", category: "students", question: "كيف أفعّل كورسًا للطالب بكود؟", answer: "أنشئ كود تفعيل مرتبطًا بكورس وحدد عدد الاستخدامات وتاريخ الانتهاء، ثم أرسله للطالب ليستخدمه داخل حسابه بدل طلب التحويل اليدوي.", href: "/teacher/activation-codes", actionLabel: "إنشاء أكواد تفعيل", keywords: "كود تفعيل كوبون اشتراك code" },
  { id: "student-password", category: "students", question: "الطالب نسي كلمة المرور، كيف أساعده؟", answer: "افتح الطلاب واختر الطالب ثم استخدم إعادة تعيين كلمة المرور. عند إنشاء كلمة جديدة تنتهي الجلسات القديمة لحماية الحساب.", href: "/teacher/students", actionLabel: "فتح الطلاب", keywords: "نسيت كلمة المرور باسورد reset" },
  { id: "student-progress", category: "students", question: "كيف أعرف تقدم ونشاط طالب معين؟", answer: "افتح ملف الطالب لمراجعة اشتراكاته، واستخدم التقارير ونتائج الامتحانات لمراجعة نشاط المشاهدة والدرجات والمحاولات الفعلية.", href: "/teacher/students", actionLabel: "عرض الطلاب", keywords: "تقدم نشاط مشاهدة ملف درجات" },

  { id: "payment-phone", category: "payments", question: "كيف أضيف رقم الهاتف الذي يحول عليه الطلاب؟", answer: "افتح إعدادات المنصة وقسم الدفع، اكتب رقم المحفظة وفعّل ظهوره للطلاب ثم احفظ. يظهر الرقم مع زر نسخ داخل نافذة الاشتراك.", href: "/teacher/settings", actionLabel: "إضافة رقم التحويل", keywords: "رقم هاتف محفظة فودافون كاش تحويل" },
  { id: "payment-methods", category: "payments", question: "هل يمكن إضافة InstaPay أو حساب بنكي؟", answer: "نعم. من إعدادات الدفع فعّل InstaPay أو التحويل البنكي وأدخل البيانات واسم المستفيد. لا تظهر أي وسيلة للطلاب إلا بعد تفعيلها.", href: "/teacher/settings", actionLabel: "إعداد طرق الدفع", keywords: "instapay بنك iban حساب تحويل" },
  { id: "payment-review", category: "payments", question: "كيف أوافق أو أرفض طلب دفع؟", answer: "راجع اسم الطالب والكورس وبيانات التحويل من صفحة الدفع. الموافقة تفعّل اشتراك الكورس، والرفض لا يفعّله ويمكنك تسجيل سبب واضح للمراجعة.", href: "/teacher/payments", actionLabel: "مراجعة طلبات الدفع", keywords: "موافقة رفض إيصال تحويل approve reject" },

  { id: "brand-images", category: "branding", question: "كيف أغير الشعار وصورة المدرس والواجهة؟", answer: "افتح صور الأكاديمية وارفع شعارًا مربعًا وصورة Hero بنسبة 16:9 وصورة واضحة للمدرس. تحفظ الملفات داخل مساحة أكاديميتك وتظهر في الصفحات العامة والتسجيل.", href: "/teacher/branding", actionLabel: "تعديل صور الأكاديمية", keywords: "شعار لوجو صورة مدرس hero" },
  { id: "brand-theme", category: "branding", question: "كيف أغير الألوان والخط وشكل البطاقات؟", answer: "من استوديو الهوية اختر ثيمًا جاهزًا أو عدّل الألوان والخطوط والبطاقات والأزرار. راجع المعاينة الحية قبل الحفظ للتأكد من وضوح النصوص.", href: "/teacher/branding", actionLabel: "فتح استوديو الهوية", keywords: "لون خط ثيم theme card button" },
  { id: "homepage-copy", category: "branding", question: "كيف أغير عنوان ووصف الصفحة الرئيسية؟", answer: "عدّل اسم المنصة والعنوان والوصف من الإعدادات، ويمكنك تخصيص نصوص الواجهة وترتيب الأقسام من استوديو الهوية.", href: "/teacher/settings", actionLabel: "تعديل بيانات الصفحة", keywords: "عنوان وصف الصفحة hero subtitle" },

  { id: "reports", category: "reports", question: "أين أرى ملخص أداء الأكاديمية؟", answer: "لوحة البداية تعرض أهم المؤشرات، وصفحة التقارير تجمع أرقام الطلاب والاشتراكات والتقدم. استخدم صفحة الامتحانات لتحليل الدرجات والمحاولات.", href: "/teacher/reports", actionLabel: "فتح التقارير", keywords: "تقارير إحصائيات أداء analytics" },
  { id: "lesson-viewers", category: "reports", question: "كيف أعرف من شاهد درسًا معينًا؟", answer: "افتح الكورس والدرس المطلوب ثم صفحة مشاهدات الدرس. ستجد الطلاب الذين تم تسجيل نشاط مشاهدة فعلي لهم.", href: "/teacher/courses", actionLabel: "اختيار كورس ودرس", keywords: "مشاهدة درس فيديو viewers" },

  { id: "invite-staff", category: "security", question: "كيف أضيف مدرسًا مساعدًا أو عضوًا للفريق؟", answer: "افتح فريق العمل وأرسل دعوة إلى بريد العضو ثم اختر الدور المناسب. استخدم أقل صلاحيات يحتاجها الشخص، ويمكنك إيقاف وصوله لاحقًا.", href: "/teacher/staff", actionLabel: "إدارة فريق العمل", keywords: "دعوة مدرس مساعد عضو role" },
  { id: "roles", category: "security", question: "ما الفرق بين أدوار فريق العمل؟", answer: "المالك يملك كل الصلاحيات، والمسؤول يدير أغلب العمليات، والمحرر يركز على المحتوى والوسائط والامتحانات، وموظف الدعم لديه وصول قراءة محدود.", href: "/teacher/staff", actionLabel: "مراجعة الفريق", keywords: "صلاحيات مالك مسؤول محرر دعم" },
  { id: "account-security", category: "security", question: "كيف أحافظ على أمان الحساب وبيانات الطلاب؟", answer: "استخدم كلمة مرور قوية ولا تشارك حساب المالك. أضف كل شخص كعضو مستقل، راجع الصلاحيات بانتظام، وسجّل الخروج من الأجهزة غير المستخدمة.", href: "/teacher/staff", actionLabel: "مراجعة الأعضاء", keywords: "أمان حماية حساب كلمة مرور أجهزة" },
];

export function TeacherHelpCenter({ academyName }: { academyName: string }) {
  const [activeCategory, setActiveCategory] = useState("all");
  const filteredItems = activeCategory === "all"
    ? helpItems
    : helpItems.filter((item) => item.category === activeCategory);

  return (
    <div className="teacherHelpCenter">
      <section className="helpHero">
        <div className="helpHeroCopy">
          <span><CircleHelp size={18} /> دليل استخدام {academyName}</span>
          <h2>عايز تعمل إيه؟ هتلاقي الخطوات والمكان هنا.</h2>
          <p>اختر القسم المناسب للوصول بسرعة إلى الخطوات التي تحتاجها داخل لوحة المدرس.</p>
        </div>
        <div className="helpTrustRow">
          <span><CheckCircle2 size={16} /> إجابات مرتبطة بلوحة التحكم</span>
          <span><CheckCircle2 size={16} /> خطوات واضحة للموبايل والكمبيوتر</span>
          <span><CheckCircle2 size={16} /> روابط مباشرة لكل مهمة</span>
        </div>
      </section>

      <section className="helpQuickSection" aria-labelledby="quick-help-title">
        <div className="helpSectionHeading"><div><span>اختصارات عملية</span><h3 id="quick-help-title">أكثر حاجات هتحتاج تعملها</h3></div></div>
        <div className="helpQuickGrid">
          {quickActions.map(({ title, description, href, Icon }) => (
            <Link href={href} className="helpQuickCard" key={title}>
              <i><Icon size={22} /></i><span><b>{title}</b><small>{description}</small></span><ArrowLeft size={18} />
            </Link>
          ))}
        </div>
      </section>

      <section className="helpKnowledgeSection" aria-labelledby="help-faq-title">
        <div className="helpSectionHeading">
          <div><span>دليل شامل</span><h3 id="help-faq-title">الأسئلة والخطوات</h3></div>
          <small><b>{filteredItems.length}</b> إجابة متاحة</small>
        </div>
        <div className="helpCategoryRail" role="tablist" aria-label="أقسام دليل استخدام المنصة">
          {categories.map(({ id, label, Icon }) => (
            <button type="button" role="tab" aria-selected={activeCategory === id} className={activeCategory === id ? "active" : ""} onClick={() => setActiveCategory(id)} key={id}>
              <Icon size={17} /> {label}
            </button>
          ))}
        </div>
          <div className="helpFaqList">
            {filteredItems.map((item) => {
              const category = categories.find((entry) => entry.id === item.category);
              const Icon = category?.Icon ?? CircleHelp;
              return (
                <details className="helpFaqItem" key={item.id}>
                  <summary><i><Icon size={19} /></i><span><small>{category?.label}</small><b>{item.question}</b></span><ChevronDown size={19} className="helpChevron" /></summary>
                  <div className="helpFaqAnswer"><p>{item.answer}</p><Link href={item.href}>{item.actionLabel} <ArrowLeft size={16} /></Link></div>
                </details>
              );
            })}
          </div>
      </section>

      <section className="helpSafetyCallout">
        <div><ShieldCheck size={26} /><span><b>نصيحة مهمة للأمان</b><small>أضف فريقك بحسابات مستقلة وصلاحيات مناسبة بدل مشاركة حساب مالك الأكاديمية.</small></span></div>
        <Link href="/teacher/staff">إدارة الفريق <ArrowLeft size={16} /></Link>
      </section>
    </div>
  );
}
