"use client";

import { motion, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useRef } from "react";

export function SkoolaExperience({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const dashboardRoute = pathname.startsWith("/teacher") || pathname.startsWith("/super-admin");
  const previousPath = useRef(pathname);


  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    window.requestAnimationFrame(() => {
      document.getElementById("main-content")?.focus({ preventScroll: true });
    });
  }, [pathname]);

  return <>
    <motion.div id="main-content" tabIndex={-1} key={pathname} className="routeMotion" initial={reduceMotion ? false : dashboardRoute ? { opacity: .9 } : { opacity: .82, y: 4 }} animate={dashboardRoute ? { opacity: 1 } : { opacity: 1, y: 0 }} transition={{ duration: .14, ease: "easeOut" }}>{children}</motion.div>
  </>;
}

export function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduceMotion = useReducedMotion();
  return <motion.div className={className} initial={reduceMotion ? false : { opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .16 }} transition={{ duration: .55, delay, ease: [0.22, 1, 0.36, 1] }}>{children}</motion.div>;
}

export function AnimatedNumber({ value }: { value: number }) {
  const spring = useSpring(0, { stiffness: 70, damping: 22 });
  const rounded = useTransform(spring, (latest) => Math.round(latest).toLocaleString("en-US"));
  useEffect(() => spring.set(value), [spring, value]);
  return <motion.span>{rounded}</motion.span>;
}
