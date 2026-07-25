"use client";

import { AnimatePresence, motion, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useRef, useState } from "react";

export function SkoolaExperience({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const [targetPath, setTargetPath] = useState<string | null>(null);
  const previousPath = useRef(pathname);
  const navigating = Boolean(targetPath && targetPath !== pathname);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest("a") : null;
      if (!target || target.target === "_blank" || target.hasAttribute("download")) return;
      const href = target.getAttribute("href");
      if (!href || !href.startsWith("/") || href.startsWith("//")) return;
      const next = href.split("#")[0].split("?")[0];
      if (next && next !== pathname) setTargetPath(next);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname]);

  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    window.requestAnimationFrame(() => {
      document.getElementById("main-content")?.focus({ preventScroll: true });
    });
  }, [pathname]);

  return <>
    <AnimatePresence>{navigating && <motion.div className="skoolaNavProgress" initial={{ scaleX: .08, opacity: 0 }} animate={{ scaleX: .82, opacity: 1 }} exit={{ scaleX: 1, opacity: 0 }} transition={{ duration: .22 }} />}</AnimatePresence>
    <motion.div id="main-content" tabIndex={-1} key={pathname} className="routeMotion" initial={reduceMotion ? false : { opacity: .82, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .14, ease: "easeOut" }}>{children}</motion.div>
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
