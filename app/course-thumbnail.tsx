"use client";

/* External teacher-provided URLs need a native image element with a safe fallback. */
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { BookOpen, ImagePlus } from "lucide-react";
import { MediaUploader } from "./components/media-uploader";

export function CourseThumbnail({ src, alt, className = "" }: { src?: string | null; alt: string; className?: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) {
    return <div className={"courseThumbnailPlaceholder " + className} role="img" aria-label={src ? "تعذر تحميل صورة الكورس" : "لم تتم إضافة صورة للكورس"}><BookOpen /><span>{src ? "تعذر تحميل الصورة" : "لا توجد صورة للكورس"}</span></div>;
  }

  return <div className={"courseThumbnail " + className}><img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedSrc(src)} /></div>;
}

export function CourseImageField({ initialUrl = "", courseId }: { initialUrl?: string | null; courseId?: string }) {
  const [url, setUrl] = useState(initialUrl ?? "");
  return <div className="courseImageField bunnyCourseImageField">
    <input name="thumbnailUrl" type="hidden" value={url} />
    <div className="bunnyFieldHeading"><ImagePlus size={18}/><span><b>غلاف الكورس عبر Bunny</b><small>اختر الصورة من جهازك؛ سيتم تحسينها وحفظها تلقائيًا داخل مساحة أكاديميتك.</small></span></div>
    <MediaUploader resourceType="course_cover" courseId={courseId} aspectRatio={16/9} onUploadComplete={(asset) => setUrl(asset.publicUrl ?? "")} />
    {url ? <CourseThumbnail src={url} alt="معاينة غلاف الكورس" className="courseImagePreview" /> : null}
  </div>;
}