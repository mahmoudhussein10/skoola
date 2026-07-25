"use client";

import type { ComponentType, ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BarChart3, BookOpen, CheckCircle2, ChevronRight, CreditCard, KeyRound, Images, LayoutDashboard, LogOut, Megaphone, Menu, PanelRightClose, Settings, ShieldCheck, UserCog, Users, X } from "lucide-react";
import { Brand } from "./ui";

type NavItem = { href: string; label: string; icon: ComponentType<{ size?: number; strokeWidth?: number }> };

export function DashboardShell({ children, kind, title, subtitle, userName, tenantSlug, supportMode = false }: { children: ReactNode; kind: "teacher" | "super"; title: string; subtitle: string; userName: string; tenantSlug?: string; supportMode?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const teacherNav: NavItem[] = [
    { href: "/teacher", label: "نظرة عامة", icon: LayoutDashboard },
    { href: "/teacher/courses", label: "الكورسات", icon: BookOpen },
    { href: "/teacher/students", label: "الطلاب", icon: Users },
    { href: "/teacher/payments", label: "طلبات الدفع والاشتراكات", icon: CreditCard },
    { href: "/teacher/exams", label: "الامتحانات والنتائج", icon: CheckCircle2 },
    { href: "/teacher/assignments", label: "الواجبات", icon: BookOpen },
    { href: "/teacher/activation-codes", label: "أكواد التفعيل", icon: KeyRound },
    { href: "/teacher/reports", label: "التقارير والإحصائيات", icon: BarChart3 },
    { href: "/teacher/staff", label: "فريق العمل", icon: UserCog },
    { href: "/teacher/media", label: "مكتبة الوسائط", icon: Images },
    { href: "/teacher/branding", label: "صور الأكاديمية", icon: Images },
    { href: "/teacher/settings", label: "إعدادات المنصة", icon: Settings },
  ];
  const superNav: NavItem[] = [
    { href: "/super-admin", label: "نظرة عامة", icon: BarChart3 }, { href: "/super-admin/teachers", label: "المدرسون", icon: Users }, { href: "/super-admin/audit-logs", label: "سجل التدقيق", icon: ShieldCheck }, { href: "/super-admin/announcements", label: "الإعلانات", icon: Megaphone }, { href: "/super-admin/settings", label: "إعدادات النظام", icon: Settings },
  ];
  const nav = kind === "teacher" ? (supportMode ? teacherNav.filter((item) => ["/teacher", "/teacher/courses", "/teacher/students"].includes(item.href)) : teacherNav) : superNav;
  const isActive = (href: string) => pathname === href || (href !== "/teacher" && href !== "/super-admin" && pathname.startsWith(href + "/"));
  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setMobileOpen(false); };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileOpen]);

  useEffect(() => {
    const closeAtDesktop = () => { if (window.innerWidth > 900) setMobileOpen(false); };
    window.addEventListener("resize", closeAtDesktop);
    return () => window.removeEventListener("resize", closeAtDesktop);
  }, []);

  useEffect(() => {
    const hrefs = kind === "teacher"
      ? (supportMode ? ["/teacher", "/teacher/courses", "/teacher/students"] : ["/teacher", "/teacher/courses", "/teacher/students", "/teacher/exams", "/teacher/assignments", "/teacher/activation-codes", "/teacher/reports", "/teacher/staff", "/teacher/media", "/teacher/branding", "/teacher/settings"])
      : ["/super-admin", "/super-admin/teachers", "/super-admin/audit-logs", "/super-admin/announcements", "/super-admin/settings"];
    hrefs.forEach((href) => router.prefetch(href));
  }, [kind, supportMode, router]);
  return <div className={`saasShell ${kind}${collapsed ? " isCollapsed" : ""}`}>

    <AnimatePresence>{mobileOpen && <motion.button className="sideOverlay" aria-label="إغلاق القائمة" onClick={() => setMobileOpen(false)} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} />}</AnimatePresence>
    <motion.aside className={`saasSide${mobileOpen ? " mobileOpen" : ""}`} animate={reduceMotion ? undefined : { width: collapsed ? 92 : 280 }} transition={{type:"spring",stiffness:260,damping:28}}>
      <div className="saasSideHead"><Brand compact={collapsed}/><button className="sideCloseMobile" onClick={() => setMobileOpen(false)} aria-label="إغلاق"><X size={19}/></button><button className="sideCollapse" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "توسيع القائمة" : "طي القائمة"}>{collapsed ? <ChevronRight size={18}/> : <PanelRightClose size={18}/>}</button></div>
      {!collapsed && <span className="workspaceLabel">{kind === "super" ? "إدارة Skoola" : "مساحة الأكاديمية"}</span>}
      <nav>{nav.map((item) => { const Icon = item.icon; const active = isActive(item.href); return <Link href={item.href} key={item.href} className={active ? "active" : ""} onClick={() => setMobileOpen(false)} prefetch>{active && <motion.i className="activeRail" layoutId="active-nav" />}<Icon size={20} strokeWidth={1.9}/>{!collapsed && <span>{item.label}</span>}</Link>; })}</nav>
      {tenantSlug && !collapsed ? <Link className="publicTenantLink" href={`/t/${tenantSlug}`} target="_blank">عرض الأكاديمية العامة <ChevronRight size={16}/></Link> : null}
      <div className="sideSpacer"/><form action="/api/auth/logout" method="post"><button className="saasLogout"><LogOut size={19}/>{!collapsed && <span>تسجيل الخروج</span>}</button></form>
      {!collapsed && kind === "super" && <div className="sideUpgrade"><SparkleIcon/><b>إدارة النظام</b><p>تحكم في إعدادات وأمان Skoola.</p><Link href="/super-admin/settings">إعدادات النظام</Link></div>}
    </motion.aside>
    <main className="saasMain">{supportMode ? <div className="supportModeBanner"><span><b>وضع دعم آمن</b> — قراءة فقط، وينتهي تلقائيًا خلال 30 دقيقة.</span><form action="/api/super-admin/support/end" method="post"><button>إنهاء وضع الدعم</button></form></div> : null}<header className="saasTop"><div className="saasTopIdentity"><button className="mobileMenuButton" onClick={() => setMobileOpen(true)} aria-label="فتح قائمة التنقل" aria-expanded={mobileOpen}><Menu size={22}/><span>القائمة</span></button><div className="saasTopCopy"><span className="saasBreadcrumb">Skoola / {kind === "super" ? "الإدارة العليا" : "لوحة المدرس"}</span><h1>{title}</h1><p>{subtitle}</p></div></div><div className="saasTopActions"><Link className="saasTopIconLink" aria-label={kind === "super" ? "إدارة الإعلانات" : "الإشعارات"} href={kind === "super" ? "/super-admin/announcements" : "/teacher/notifications"}><Megaphone size={19}/><i/></Link><span className="saasUser"><b>{userName.slice(0, 1)}</b><span>{userName}<small>{kind === "super" ? "Super Admin" : "مسؤول الأكاديمية"}</small></span></span></div></header>{children}</main>
  </div>;
}

function SparkleIcon() { return <div className="sideUpgradeIcon"><span>✦</span></div>; }