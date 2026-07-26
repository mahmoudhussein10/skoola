import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Skoola",
    short_name: "Skoola",
    description: "منصة Skoola للتعليم وإدارة الأكاديميات",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#6366f1",
    lang: "ar",
    dir: "rtl",
    icons: [
      { src: "/skoola-logo.png", sizes: "1254x1254", type: "image/png", purpose: "maskable" },
    ],
  };
}
