import type { Metadata } from "next";
import "./globals.css";
import "./skoola.css";
import "./product-polish.css";
import "./visual-wow.css";
import { SkoolaExperience } from "./skoola-motion";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001"),
  title: { default: "Skoola — Teach. Learn. Grow.", template: "%s | Skoola" },
  description: "Skoola هي منصة SaaS تعليمية متكاملة للمدرسين والطلاب وإدارة الأكاديميات الرقمية.",
  icons: { icon: "/skoola-logo.png", apple: "/skoola-logo.png" },
  openGraph: { title: "Skoola — Teach. Learn. Grow.", description: "أنشئ أكاديميتك، علّم بذكاء، وتابع نمو طلابك من مكان واحد.", type: "website", locale: "ar_EG", images: [{ url: "/skoola-logo.png", width: 1254, height: 1254, alt: "Skoola" }] },
  twitter: { card: "summary_large_image", title: "Skoola — Teach. Learn. Grow.", description: "منصة التعليم الحديثة للمدرسين والطلاب.", images: ["/skoola-logo.png"] },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="ar" dir="rtl" data-scroll-behavior="smooth"><body><SkoolaExperience>{children}</SkoolaExperience></body></html>;
}