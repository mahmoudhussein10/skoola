"use client";

import type { ComponentType, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BadgeDollarSign, BarChart3, BookOpen, CheckCircle2, ChevronRight, CircleHelp, CreditCard, KeyRound, Images, LayoutDashboard, LogOut, Megaphone, Menu, PanelRightClose, Settings, ShieldCheck, UserCog, Users, X } from "lucide-react";
import { Brand } from "./ui";
import { NotificationBell, PushBootstrap } from "./notifications/push-client";

type NavItem = { href: string; label: string; icon: ComponentType<{ size?: number; strokeWidth?: number }> };

export function DashboardShell({ children, kind, title, subtitle, userName, tenantSlug, supportMode = false }: { children: ReactNode; kind: "teacher" | "super"; title: string; subtitle: string; userName: string; tenantSlug?: string; supportMode?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);
  const teacherNav: NavItem[] = [
    { href: "/teacher", label: "نظرة عامة", icon: LayoutDashboard },
    { href: "/teacher/help", label: "دليل استخدام المنصة", icon: CircleHelp },
    { href: "/teacher/courses", label: "الكورسات", icon: BookOpen },
    { href: "/teacher/students", label: "الطلاب", icon: Users },
    { href: "/teacher/subscription", label: "اشتراك Skoola", icon: BadgeDollarSign },    { href: "/teacher/payments", label: "طلبات الدفع والاشتراكات", icon: CreditCard },
    { href: "/teacher/exams", label: "الامتحانات والنتائج", icon: CheckCircle2 },
    { href: "/teacher/assignments", label: "الواجبات", icon: BookOpen },
    { href: "/teacher/activation-codes", label: "أكواد التفعيل", icon: KeyRound },
    { href: "/teacher/reports", label: "التقارير والإحصائيات", icon: BarChart3 },
    { href: "/teacher/staff", label: "فريق العمل", icon: UserCog },
    { href: "/teacher/media", label: "مكتبة الوسائط", icon: Images },
    { href: "/teacher/branding", label: "صور الأكاديمية", icon: Images },
    { href: "/teacher/notifications", label: "الإشعارات", icon: Megaphone },
    { href: "/teacher/settings", label: "إعدادات المنصة", icon: Settings },
  ];
  const superNav: NavItem[] = [
    { href: "/super-admin", label: "نظرة عامة", icon: BarChart3 }, { href: "/super-admin/teachers", label: "المدرسون", icon: Users }, { href: "/super-admin/subscriptions", label: "اشتراكات المدرسين", icon: BadgeDollarSign }, { href: "/super-admin/audit-logs", label: "سجل التدقيق", icon: ShieldCheck }, { href: "/super-admin/announcements", label: "الإعلانات", icon: Megaphone }, { href: "/super-admin/settings", label: "إعدادات النظام", icon: Settings },
  ];
  const nav = kind === "teacher" ? teacherNav : superNav;
  const isActive = (href: string) => pathname === href || (href !== "/teacher" && href !== "/super-admin" && pathname.startsWith(href + "/"));
  const activeItem = nav.find((item) => isActive(item.href));
  const courseArea = kind === "teacher" && pathname.startsWith("/teacher/courses");
  useEffect(() => {
    if (!mobileOpen) return;
    const scrollY = window.scrollY;
    const previousBodyStyles = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    };
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const menuTrigger = menuButtonRef.current;
    const focusableSelector = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";
    const focusDrawer = window.requestAnimationFrame(() => drawerRef.current?.querySelector<HTMLElement>(".sideCloseMobile")?.focus());
    const handleDrawerKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = Array.from(drawerRef.current.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => !element.hasAttribute("disabled") && element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.documentElement.classList.add("dashboardMenuOpen");
    document.body.classList.add("dashboardMenuOpen");
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.addEventListener("keydown", handleDrawerKeys);
    return () => {
      window.cancelAnimationFrame(focusDrawer);
      document.documentElement.classList.remove("dashboardMenuOpen");
      document.body.classList.remove("dashboardMenuOpen");
      document.body.style.overflow = previousBodyStyles.overflow;
      document.body.style.position = previousBodyStyles.position;
      document.body.style.top = previousBodyStyles.top;
      document.body.style.width = previousBodyStyles.width;
      document.removeEventListener("keydown", handleDrawerKeys);
      window.requestAnimationFrame(() => window.scrollTo(0, scrollY));
      (previousFocus ?? menuTrigger)?.focus();
    };
  }, [mobileOpen]);

  useEffect(() => {
    const closeAtDesktop = () => { if (window.innerWidth > 900) setMobileOpen(false); };
    window.addEventListener("resize", closeAtDesktop);
    return () => window.removeEventListener("resize", closeAtDesktop);
  }, []);

  useEffect(() => {
    const hrefs = kind === "teacher"
      ? ["/teacher", "/teacher/courses", "/teacher/students", "/teacher/subscription", "/teacher/payments", "/teacher/exams", "/teacher/assignments", "/teacher/activation-codes", "/teacher/reports", "/teacher/staff", "/teacher/media", "/teacher/branding", "/teacher/help", "/teacher/notifications", "/teacher/settings"]
      : ["/super-admin", "/super-admin/teachers", "/super-admin/subscriptions", "/super-admin/audit-logs", "/super-admin/announcements", "/super-admin/settings"];
    hrefs.forEach((href) => router.prefetch(href));
  }, [kind, router]);
  return <div className={`saasShell ${kind}${courseArea ? " courseArea" : ""}${collapsed ? " isCollapsed" : ""}`}>

    <AnimatePresence>{mobileOpen && <motion.button className="sideOverlay" aria-label="إغلاق القائمة" onClick={() => setMobileOpen(false)} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} />}</AnimatePresence>
    <motion.aside ref={drawerRef} id="dashboard-navigation" aria-label="التنقل الرئيسي" aria-modal={mobileOpen ? "true" : undefined} className={`saasSide${mobileOpen ? " mobileOpen" : ""}`} animate={reduceMotion ? undefined : { width: collapsed ? 92 : 280 }} transition={{type:"spring",stiffness:260,damping:28}}>
      <div className="saasSideHead"><Brand compact={collapsed}/><button className="sideCloseMobile" onClick={() => setMobileOpen(false)} aria-label="إغلاق القائمة"><X size={21}/></button><button className="sideCollapse" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "توسيع القائمة" : "طي القائمة"}>{collapsed ? <ChevronRight size={18}/> : <PanelRightClose size={18}/>}</button></div>
      {!collapsed && <div className="sideMobileProfile"><b>{userName.slice(0, 1)}</b><span><strong dir="auto">{userName}</strong><small>{kind === "super" ? "الإدارة العليا" : "مسؤول الأكاديمية"}</small></span></div>}
      {!collapsed && <span className="workspaceLabel">{kind === "super" ? "إدارة Skoola" : "مساحة الأكاديمية"}</span>}
      <nav aria-label={kind === "super" ? "أقسام الإدارة العليا" : "أقسام لوحة المدرس"}>{nav.map((item) => { const Icon = item.icon; const active = isActive(item.href); return <Link href={item.href} key={item.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined} onClick={() => setMobileOpen(false)} prefetch>{active && <motion.i className="activeRail" layoutId="active-nav" />}<Icon size={20} strokeWidth={1.9}/>{!collapsed && <span>{item.label}</span>}</Link>; })}</nav>
      <div className="sideFooter">{tenantSlug && !collapsed ? <Link className="publicTenantLink" href={`/t/${tenantSlug}`} target="_blank">عرض الأكاديمية للطلاب <ChevronRight size={16}/></Link> : null}<form action="/api/auth/logout" method="post"><input type="hidden" name="next" value={kind === "super" ? "/super-admin/login" : tenantSlug ? `/login/${tenantSlug}` : "/login?role=teacher"}/><button className="saasLogout"><LogOut size={19}/>{!collapsed && <span>تسجيل الخروج</span>}</button></form></div>
      {!collapsed && kind === "super" && <div className="sideUpgrade"><SparkleIcon/><b>إدارة النظام</b><p>تحكم في إعدادات وأمان Skoola.</p><Link href="/super-admin/settings">إعدادات النظام</Link></div>}
    </motion.aside>
    <main className="saasMain">{supportMode ? <div className="supportModeBanner"><span><b>وضع دعم آمن</b> — قراءة فقط، وينتهي تلقائيًا خلال 30 دقيقة.</span><form action="/api/super-admin/support/end" method="post"><button>إنهاء وضع الدعم</button></form></div> : null}<header className="saasTop"><div className="saasTopIdentity"><button ref={menuButtonRef} className="mobileMenuButton" onClick={() => setMobileOpen(true)} aria-label="فتح قائمة التنقل" aria-controls="dashboard-navigation" aria-expanded={mobileOpen}><Menu size={21}/><span>القائمة</span></button><div className="saasTopCopy"><span className="saasBreadcrumb">Skoola / {kind === "super" ? "الإدارة العليا" : "لوحة المدرس"}</span><span className="saasMobileSection">{activeItem?.label ?? (kind === "super" ? "الإدارة العليا" : "لوحة التحكم")}</span><strong className="saasMobileGreeting">أهلاً، <b dir="auto">{userName}</b></strong><h1 dir="auto">{title}</h1><p>{subtitle}</p></div></div><div className="saasTopActions">{kind === "super" ? <Link className="saasTopIconLink" aria-label="إدارة الإعلانات" href="/super-admin/announcements"><Megaphone size={19}/></Link> : <NotificationBell role="teacher"/>}<span className="saasUser"><b>{userName.slice(0, 1)}</b><span dir="auto">{userName}<small>{kind === "super" ? "Super Admin" : "مسؤول الأكاديمية"}</small></span></span></div></header>{children}{kind === "teacher" ? <PushBootstrap role="teacher"/> : null}</main>
  </div>;
}

function SparkleIcon() { return <div className="sideUpgradeIcon"><span>✦</span></div>; }
