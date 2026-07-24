"use client";

/* External teacher-provided URLs need a native image element with a safe fallback. */
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { BookOpen } from "lucide-react";

export function CourseThumbnail({ src, alt, className = "" }: { src?: string | null; alt: string; className?: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) {
    return <div className={"courseThumbnailPlaceholder " + className} role="img" aria-label={src ? "تعذر تحميل صورة الكورس" : "لم تتم إضافة صورة للكورس"}><BookOpen /><span>{src ? "تعذر تحميل الصورة" : "لا توجد صورة للكورس"}</span></div>;
  }

  return <div className={"courseThumbnail " + className}><img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedSrc(src)} /></div>;
}

export function CourseImageField({ initialUrl = "" }: { initialUrl?: string | null }) {
  const [url, setUrl] = useState(initialUrl ?? "");
  return <label className="courseImageField">رابط صورة الكورس
    <input name="thumbnailUrl" type="url" dir="ltr" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/course-image.jpg" />
    <small>استخدم رابط صورة مباشر يبدأ بـ http:// أو https://</small>
    <CourseThumbnail src={url} alt="معاينة صورة الكورس" className="courseImagePreview" />
  </label>;
}