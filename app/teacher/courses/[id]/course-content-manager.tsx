"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit3,
  Eye,
  EyeOff,
  FileText,
  HelpCircle,
  ClipboardCheck,
  PlayCircle,
  Paperclip,
  ImageIcon,
  ShieldCheck,
  Layers,
  Lock,
  Plus,
  Trash2,
  Unlock,
  Video,
  X,
} from "lucide-react";
import { CourseThumbnail } from "../../../course-thumbnail";
import { MediaUploader, type UploadedAsset } from "../../../components/media-uploader";
import { ONBOARDING_RETURN_PATH } from "../../../../lib/onboarding-progress";

type Question = {
  id?: string;
  text: string;
  imageUrl?: string | null;
  type: "MCQ" | "TRUE_FALSE" | "ESSAY";
  options: string[];
  correctAnswer: string;
  explanation?: string | null;
  points: number;
};

type Exam = {
  id: string;
  sectionId?: string | null;
  title: string;
  description?: string | null;
  durationMinutes: number;
  passingScore: number;
  maxAttempts: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showResultImmediately: boolean;
  showAnswersAfterSubmit: boolean;
  startDate?: string | null;
  endDate?: string | null;
  status: "DRAFT" | "PUBLISHED" | "HIDDEN";
  order: number;
  questions: Question[];
};

type Lesson = {
  id: string;
  sectionId: string;
  title: string;
  description?: string | null;
  content?: string | null;
  type: "VIDEO" | "TEXT" | "FILE" | "VIDEO_WITH_ATTACHMENT";
  videoId?: string | null;
  videoUrl?: string | null;
  attachmentUrl?: string | null;
  thumbnailUrl?: string | null;
  duration: number;
  order: number;
  isPreview: boolean;
  status: "DRAFT" | "PUBLISHED" | "HIDDEN";
};

type Section = {
  id: string;
  title: string;
  description?: string | null;
  order: number;
  status: "DRAFT" | "PUBLISHED" | "HIDDEN";
  lessons: Lesson[];
  exams: Exam[];
};

type Course = {
  id: string;
  title: string;
  slug: string;
  description: string;
  fullDescription?: string | null;
  thumbnailUrl?: string | null;
  price: number;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  grade: string;
  subject: string;
  tenantSlug: string;
  sections: Section[];
  unassignedExams: Exam[];
};

const lessonTypeLabels = {
  VIDEO: "فيديو",
  TEXT: "شرح نصي",
  FILE: "ملف / رابط",
  VIDEO_WITH_ATTACHMENT: "فيديو مع مرفقات",
} as const;

const subscribeToClient = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function CourseContentManager({ course, initialIntent, initialSectionId }: { course: Course; initialIntent?: "lesson" | "exam"; initialSectionId?: string }) {
  const router = useRouter();
  const [sections, setSections] = useState<Section[]>(course.sections);
  const [unassignedExams, setUnassignedExams] = useState<Exam[]>(course.unassignedExams);
  const [courseStatus, setCourseStatus] = useState(course.status);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    course.sections.forEach((s) => (initial[s.id] = true));
    return initial;
  });

  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const mounted = useSyncExternalStore(subscribeToClient, getClientSnapshot, getServerSnapshot);
  const lessonFormRef = useRef<HTMLFormElement>(null);
  const lessonDraftPromiseRef = useRef<Promise<string> | null>(null);


  // Modals state
  const [sectionModal, setSectionModal] = useState<{ open: boolean; data?: Section | null }>({ open: false });
  const [lessonModal, setLessonModal] = useState<{ open: boolean; sectionId?: string; data?: Lesson | null }>({ open: initialIntent === "lesson" && Boolean(initialSectionId), sectionId: initialSectionId });
  const [examModal, setExamModal] = useState<{ open: boolean; sectionId?: string | null; data?: Exam | null }>({ open: initialIntent === "exam", sectionId: initialSectionId ?? null });
  useEffect(() => {
    if (!examModal.open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [examModal.open]);
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; type: "section" | "lesson" | "exam"; id: string; name: string } | null>(null);

  // Exam question form temporary state
  const [examQuestions, setExamQuestions] = useState<Question[]>(() => initialIntent === "exam" ? [{ text: "", imageUrl: "", type: "MCQ", options: ["أ", "ب", "ج", "د"], correctAnswer: "أ", points: 1 }] : []);

  // Statistics calculation
  const totalLessons = sections.reduce((sum, s) => sum + s.lessons.length, 0);
  const totalExams = sections.reduce((sum, s) => sum + s.exams.length, 0) + unassignedExams.length;

  function toggleAccordion(sectionId: string) {
    setOpenSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  }

  function showMessage(text: string, type: "success" | "error" = "success") {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 5000);
  }

  function applyLessonAsset(kind: "video" | "attachment" | "thumbnail", asset: UploadedAsset) {
    const lessonId = lessonModal.data?.id;
    if (!lessonId) return;

    const patch: Partial<Lesson> = kind === "video"
      ? { videoUrl: asset.embedUrl ?? asset.playbackUrl ?? null, thumbnailUrl: asset.thumbnailUrl ?? lessonModal.data?.thumbnailUrl ?? null, ...(asset.durationSeconds ? { duration: Math.max(1, Math.ceil(asset.durationSeconds / 60)) } : {}) }
      : kind === "attachment"
        ? { attachmentUrl: asset.publicUrl ?? null }
        : { thumbnailUrl: asset.publicUrl ?? null };

    setLessonModal((current) => current.data?.id === lessonId ? { ...current, data: { ...current.data, ...patch } } : current);
    setSections((items) => items.map((section) => ({ ...section, lessons: section.lessons.map((lesson) => lesson.id === lessonId ? { ...lesson, ...patch } : lesson) })));
    showMessage(kind === "video" ? "تم تجهيز الفيديو وربطه بالدرس" : kind === "attachment" ? "تم رفع المرفق وربطه بالدرس" : "تم رفع صورة الدرس وربطها بنجاح");
  }

  // Toggle Course Publish status
  async function toggleCourseStatus() {
    const nextStatus = courseStatus === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    setLoading(true);
    const res = await fetch("/api/teacher/courses", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ courseId: course.id, status: nextStatus }),
    });
    setLoading(false);
    if (res.ok) {
      setCourseStatus(nextStatus);
      showMessage(nextStatus === "PUBLISHED" ? "تم نشر الكورس للطلاب بنجاح وأصبح متاحًا على المنصة." : "تم إخفاء الكورس من الطلاب وحفظه كمسودة.");
    } else {
      const err = await res.json().catch(() => null);
      showMessage(err?.message ?? "تعذر تغيير حالة الكورس", "error");
    }
  }

  // Save Section
  async function saveSection(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const payload = {
      sectionId: sectionModal.data?.id,
      title: String(form.get("title") ?? "").trim(),
      description: String(form.get("description") ?? "").trim(),
      status: String(form.get("status") ?? "PUBLISHED"),
    };

    const method = sectionModal.data ? "PUT" : "POST";
    const res = await fetch(`/api/teacher/courses/${course.id}/sections`, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);

    if (!res.ok) {
      const err = await res.json().catch(() => null);
      showMessage(err?.message ?? "تعذر حفظ القسم", "error");
    } else {
      const result = await res.json();
      if (sectionModal.data) {
        setSections((items) => items.map((s) => (s.id === sectionModal.data?.id ? { ...s, ...result.section } : s)));
        showMessage("تم تحديث القسم بنجاح");
      } else {
        setSections((items) => [...items, { ...result.section, lessons: [], exams: [] }]);
        setOpenSections((prev) => ({ ...prev, [result.section.id]: true }));
        showMessage("تم إضافة القسم بنجاح");
      }
      setSectionModal({ open: false });
    }
  }

  // Reorder Section
  async function moveSection(sectionId: string, direction: "up" | "down") {
    const res = await fetch(`/api/teacher/courses/${course.id}/sections`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sectionId, direction }),
    });

    if (res.ok) {
      const index = sections.findIndex((s) => s.id === sectionId);
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex >= 0 && targetIndex < sections.length) {
        const next = [...sections];
        const [moved] = next.splice(index, 1);
        next.splice(targetIndex, 0, moved);
        setSections(next);
      }
    }
  }

  // Delete Item Confirmation
  async function handleConfirmDelete() {
    if (!confirmDelete) return;
    setLoading(true);
    const { type, id } = confirmDelete;

    if (type === "section") {
      const res = await fetch(`/api/teacher/courses/${course.id}/sections`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sectionId: id }),
      });
      if (res.ok) {
        setSections((items) => items.filter((s) => s.id !== id));
        showMessage("تم حذف القسم");
      } else {
        showMessage("تعذر حذف القسم", "error");
      }
    } else if (type === "lesson") {
      const res = await fetch(`/api/teacher/courses/${course.id}/lessons`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lessonId: id }),
      });
      if (res.ok) {
        setSections((items) =>
          items.map((s) => ({ ...s, lessons: s.lessons.filter((l) => l.id !== id) }))
        );
        showMessage("تم حذف الدرس");
      } else {
        showMessage("تعذر حذف الدرس", "error");
      }
    } else if (type === "exam") {
      const res = await fetch(`/api/teacher/courses/${course.id}/exams`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ examId: id }),
      });
      if (res.ok) {
        setSections((items) =>
          items.map((s) => ({ ...s, exams: s.exams.filter((e) => e.id !== id) }))
        );
        setUnassignedExams((items) => items.filter((e) => e.id !== id));
        showMessage("تم حذف الامتحان");
      } else {
        showMessage("تعذر حذف الامتحان", "error");
      }
    }

    setLoading(false);
    setConfirmDelete(null);
  }

  async function ensureLessonForUpload() {
    if (lessonModal.data?.id) return { lessonId: lessonModal.data.id };
    if (lessonDraftPromiseRef.current) return { lessonId: await lessonDraftPromiseRef.current };

    const createDraft = async () => {
      const formElement = lessonFormRef.current;
      if (!formElement) throw new Error("تعذر قراءة بيانات الدرس. حاول مرة أخرى.");

      const form = new FormData(formElement);
      const title = String(form.get("title") ?? "").trim();
      if (title.length < 2) {
        formElement.querySelector<HTMLInputElement>('input[name="title"]')?.focus();
        throw new Error("اكتب عنوان الدرس أولًا، وبعدها ابدأ رفع الفيديو.");
      }

      const sectionId = lessonModal.sectionId ?? lessonModal.data?.sectionId;
      if (!sectionId) throw new Error("اختر القسم التابع له الدرس أولًا.");

      const response = await fetch(`/api/teacher/courses/${course.id}/lessons`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sectionId,
          title,
          description: String(form.get("description") ?? "").trim(),
          content: String(form.get("content") ?? "").trim(),
          type: "VIDEO",
          videoUrl: "",
          attachmentUrl: "",
          thumbnailUrl: "",
          duration: Number(form.get("duration") ?? 0),
          isPreview: form.get("isPreview") === "on",
          status: "DRAFT",
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.lesson?.id) {
        throw new Error(result?.message ?? "تعذر حفظ الدرس تلقائيًا قبل رفع الفيديو.");
      }

      setSections((items) => items.map((section) => section.id === sectionId && !section.lessons.some((lesson) => lesson.id === result.lesson.id)
        ? { ...section, lessons: [...section.lessons, result.lesson] }
        : section));
      setLessonModal((current) => ({ ...current, sectionId, data: result.lesson }));
      showMessage("تم حفظ الدرس تلقائيًا كمسودة، وبدأ رفع الفيديو.");
      return result.lesson.id as string;
    };

    lessonDraftPromiseRef.current = createDraft();
    try {
      return { lessonId: await lessonDraftPromiseRef.current };
    } finally {
      lessonDraftPromiseRef.current = null;
    }
  }
  // Save Lesson
  async function saveLesson(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const payload = {
      lessonId: lessonModal.data?.id,
      sectionId: lessonModal.sectionId ?? lessonModal.data?.sectionId,
      title: String(form.get("title") ?? "").trim(),
      description: String(form.get("description") ?? "").trim(),
      content: String(form.get("content") ?? "").trim(),
      type: "VIDEO",
      videoUrl: String(form.get("videoUrl") ?? "").trim(),
      attachmentUrl: String(form.get("attachmentUrl") ?? "").trim(),
      thumbnailUrl: String(form.get("thumbnailUrl") ?? "").trim(),
      duration: Number(form.get("duration") ?? 0),
      isPreview: form.get("isPreview") === "on",
      status: String(form.get("status") ?? "PUBLISHED"),
    };

    const method = lessonModal.data ? "PUT" : "POST";
    const res = await fetch(`/api/teacher/courses/${course.id}/lessons`, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);

    if (!res.ok) {
      const err = await res.json().catch(() => null);
      showMessage(err?.message ?? "تعذر حفظ الدرس", "error");
    } else {
      const result = await res.json();
      const targetSecId = payload.sectionId;

      setSections((items) =>
        items.map((s) => {
          if (s.id === targetSecId) {
            if (lessonModal.data) {
              return { ...s, lessons: s.lessons.map((l) => (l.id === lessonModal.data?.id ? result.lesson : l)) };
            } else {
              return { ...s, lessons: [...s.lessons, result.lesson] };
            }
          }
          return s;
        })
      );
      showMessage(payload.status === "PUBLISHED" ? (lessonModal.data ? "تم تحديث الدرس ونشره للطلاب بنجاح." : "تم إنشاء الدرس ونشره للطلاب بنجاح.") : (lessonModal.data ? "تم تحديث الدرس وحفظه كمسودة." : "تم إنشاء الدرس وحفظه كمسودة."));
      setLessonModal({ open: false });
      if (!lessonModal.data && new URLSearchParams(window.location.search).get("onboarding") === "first_lesson") {
        router.replace(ONBOARDING_RETURN_PATH);
      }
    }
  }

  // Move Lesson Up/Down
  async function moveLesson(lessonId: string, direction: "up" | "down") {
    const res = await fetch(`/api/teacher/courses/${course.id}/lessons`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lessonId, direction }),
    });

    if (res.ok) {
      setSections((items) =>
        items.map((s) => {
          const lIndex = s.lessons.findIndex((l) => l.id === lessonId);
          if (lIndex === -1) return s;
          const targetIndex = direction === "up" ? lIndex - 1 : lIndex + 1;
          if (targetIndex < 0 || targetIndex >= s.lessons.length) return s;
          const nextLessons = [...s.lessons];
          const [moved] = nextLessons.splice(lIndex, 1);
          nextLessons.splice(targetIndex, 0, moved);
          return { ...s, lessons: nextLessons };
        })
      );
    }
  }



  // Exam Question Helper Management
  function addQuestion() {
    setExamQuestions((qs) => [
      ...qs,
      {
        text: "",
        imageUrl: "",
        type: "MCQ",
        options: ["أ", "ب", "ج", "د"],
        correctAnswer: "أ",
        points: 1,
      },
    ]);
  }

  function updateQuestion(index: number, updated: Partial<Question>) {
    setExamQuestions((qs) => qs.map((q, i) => (i === index ? { ...q, ...updated } : q)));
  }

  function removeQuestion(index: number) {
    setExamQuestions((qs) => qs.filter((_, i) => i !== index));
  }

  // Open Exam Modal with initial questions
  function openExamModal(sectionId?: string | null, exam?: Exam | null) {
    setExamQuestions(
      exam?.questions.map((q) => ({
        ...q,
        imageUrl: q.imageUrl ?? "",
        options: q.type === "ESSAY" ? [] : (Array.isArray(q.options) && q.options.length ? (q.options as string[]) : (q.type === "TRUE_FALSE" ? ["صح", "خطأ"] : ["أ", "ب", "ج", "د"])),
        correctAnswer: typeof q.correctAnswer === "string" ? q.correctAnswer : String(q.correctAnswer),
      })) ?? [
        {
          text: "",
          imageUrl: "",
          type: "MCQ",
          options: ["أ", "ب", "ج", "د"],
          correctAnswer: "أ",
          points: 1,
        },
      ]
    );
    setExamModal({ open: true, sectionId, data: exam });
  }

  // Save Exam
  async function saveExam(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    if (!title) {
      showMessage("يرجى كتابة عنوان الكويز أو الامتحان", "error");
      return;
    }

    if (examQuestions.length === 0) {
      showMessage("يجب إضافة سؤال واحد على الأقل داخل الامتحان", "error");
      return;
    }

    setLoading(true);

    const sanitizedQuestions = examQuestions.map((q) => {
      const img = (q.imageUrl ?? "").trim();

      const cleanOpts = q.options.map((o) => o.trim()).filter(Boolean);
      const finalOpts = q.type === "ESSAY" ? [] : (cleanOpts.length >= 2 ? cleanOpts : (q.type === "TRUE_FALSE" ? ["صح", "خطأ"] : ["أ", "ب", "ج", "د"]));
      const finalCorrect = q.type === "ESSAY" ? "" : (finalOpts.includes(q.correctAnswer) ? q.correctAnswer : finalOpts[0]);
      return {
        ...q,
        text: q.text.trim() || (img ? "سؤال مصور (انظر الصورة)" : "سؤال بدون نص"),
        imageUrl: img || null,
        options: finalOpts,
        correctAnswer: finalCorrect,
      };
    });

    const payload = {
      examId: examModal.data?.id,
      sectionId: examModal.sectionId ?? examModal.data?.sectionId,
      title,
      description: String(form.get("description") ?? "").trim(),
      durationMinutes: Number(form.get("durationMinutes") ?? 30) || 30,
      passingScore: Number(form.get("passingScore") ?? 50) || 50,
      maxAttempts: 1,
      shuffleQuestions: form.get("shuffleQuestions") === "on",
      shuffleOptions: form.get("shuffleOptions") === "on",
      showResultImmediately: form.get("showResultImmediately") === "on",
      showAnswersAfterSubmit: form.get("showAnswersAfterSubmit") === "on",
      status: String(form.get("status") ?? "PUBLISHED"),
      questions: sanitizedQuestions,
    };

    const method = examModal.data ? "PUT" : "POST";
    const res = await fetch(`/api/teacher/courses/${course.id}/exams`, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);

    if (!res.ok) {
      const err = await res.json().catch(() => null);
      showMessage(err?.message ?? "تعذر حفظ الامتحان", "error");
    } else {
      const result = await res.json();
      const targetSecId = payload.sectionId;

      if (targetSecId) {
        setSections((items) =>
          items.map((s) => {
            if (s.id === targetSecId) {
              if (examModal.data) {
                return { ...s, exams: s.exams.map((eItem) => (eItem.id === examModal.data?.id ? result.exam : eItem)) };
              } else {
                return { ...s, exams: [...s.exams, result.exam] };
              }
            }
            return s;
          })
        );
      } else {
        if (examModal.data) {
          setUnassignedExams((items) => items.map((eItem) => (eItem.id === examModal.data?.id ? result.exam : eItem)));
        } else {
          setUnassignedExams((items) => [...items, result.exam]);
        }
      }

      showMessage(payload.status === "PUBLISHED" ? (examModal.data ? "تم تحديث الاختبار ونشره للطلاب بنجاح." : "تم إنشاء الاختبار ونشره للطلاب بنجاح.") : (examModal.data ? "تم تحديث الاختبار وحفظه كمسودة." : "تم إنشاء الاختبار وحفظه كمسودة."));
      setExamModal({ open: false });
      if (!examModal.data && new URLSearchParams(window.location.search).get("onboarding") === "first_exam") {
        router.replace(ONBOARDING_RETURN_PATH);
      }
    }
  }

  // Move Exam Up/Down
  async function moveExam(examId: string, direction: "up" | "down") {
    const res = await fetch(`/api/teacher/courses/${course.id}/exams`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ examId, direction }),
    });

    if (res.ok) {
      setSections((items) =>
        items.map((s) => {
          const eIndex = s.exams.findIndex((eItem) => eItem.id === examId);
          if (eIndex === -1) return s;
          const targetIndex = direction === "up" ? eIndex - 1 : eIndex + 1;
          if (targetIndex < 0 || targetIndex >= s.exams.length) return s;
          const nextExams = [...s.exams];
          const [moved] = nextExams.splice(eIndex, 1);
          nextExams.splice(targetIndex, 0, moved);
          return { ...s, exams: nextExams };
        })
      );
    }
  }

  return (
    <div className="courseContentManager wrap">
      {/* Top Header */}
      <header className="managerHeader">
        <div className="managerHeaderNav">
          <Link href="/teacher/courses" className="backBtn">
            <ArrowRight size={18} /> العودة للكورسات
          </Link>
          <span className={`statusBadge ${courseStatus.toLowerCase()}`}>
            {courseStatus === "PUBLISHED" ? "منشور للطلاب" : "مسودة"}
          </span>
        </div>

        <div className="managerHeaderMain">
          <div className="courseMeta">
            <div className="courseHeroPoster">
              {course.thumbnailUrl ? (
                <CourseThumbnail src={course.thumbnailUrl} alt={course.title} />
              ) : (
                <div className="metaGlyph">{course.subject.slice(0, 2)}</div>
              )}
            </div>
            <div className="courseMetaInfo">
              <span className="subTitle">{course.subject}</span>
              <h1>{course.title}</h1>
              <p>{course.description}</p>
            </div>
          </div>

          <div className="managerActions">
            <button
              className="btn secondary"
              onClick={toggleCourseStatus}
              disabled={loading}
            >
              {courseStatus === "PUBLISHED" ? <EyeOff size={18} /> : <Eye size={18} />}
              {courseStatus === "PUBLISHED" ? "إخفاء الكورس" : "نشر الكورس"}
            </button>
            <a
              className="btn outline"
              href={`/t/${course.tenantSlug}/courses/${course.slug || course.id}`}
              target="_blank"
              rel="noreferrer"
            >
              معاينة صفحة الكورس <ArrowLeft size={16} />
            </a>
          </div>
        </div>

        {/* Real Metrics Bar */}
        <div className="managerMetrics">
          <div className="metric">
            <Layers size={18} />
            <div>
              <b>{sections.length.toLocaleString("en-US")}</b>
              <small>أقسام تعليمية</small>
            </div>
          </div>
          <div className="metric">
            <PlayCircle size={20} />
            <div>
              <b>{totalLessons.toLocaleString("en-US")}</b>
              <small>دروس مضافة</small>
            </div>
          </div>
          <div className="metric">
            <ClipboardCheck size={20} />
            <div>
              <b>{totalExams.toLocaleString("en-US")}</b>
              <small>امتحانات أونلاين</small>
            </div>
          </div>
          <div className="metricActions">
            <button
              className="btn primary"
              onClick={() => setSectionModal({ open: true, data: null })}
            >
              <Plus size={18} /> إضافة قسم جديد
            </button>
          </div>
        </div>
      </header>

      {notice ? (
        <div className={`managerNotice ${notice.type}`}>
          {notice.text}
          <button onClick={() => setNotice(null)}>
            <X size={15} />
          </button>
        </div>
      ) : null}

      {/* Main Content Area */}
      <main className="managerMain">
        {sections.length === 0 ? (
          <div className="courseBuilderEmpty">
            <div className="builderEmptyIntro">
              <span className="builderEmptyIcon"><Layers size={29} /></span>
              <div><span>ابدأ بناء محتوى الكورس</span><h2>من قسم واحد تبدأ رحلة الطالب</h2><p>قسّم الكورس إلى وحدات واضحة، ثم ضع داخل كل وحدة فيديوهات المحاضر والكويزات بالترتيب الذي سيشاهده الطالب.</p></div>
              <button className="btn primary" onClick={() => setSectionModal({ open: true, data: null })}><Plus size={18} /> إنشاء أول قسم</button>
            </div>
            <div className="builderSteps" aria-label="خطوات بناء محتوى الكورس">
              <article><b>1</b><i><Layers size={22}/></i><div><strong>أنشئ قسمًا</strong><small>مثل: الوحدة الأولى أو الفصل الأول</small></div></article>
              <span className="builderConnector" aria-hidden="true" />
              <article><b>2</b><i><Video size={22}/></i><div><strong>أضف فيديو المحاضر</strong><small>الصق رابط YouTube أو Vimeo أو MP4</small></div></article>
              <span className="builderConnector" aria-hidden="true" />
              <article><b>3</b><i><HelpCircle size={22}/></i><div><strong>أنشئ كويزًا</strong><small>أضف الأسئلة وحدد الإجابة الصحيحة</small></div></article>
            </div>
          </div>
        ) : (
          <div className="accordionList">
            {sections.map((section, sIndex) => {
              const isOpen = openSections[section.id] ?? true;

              return (
                <article key={section.id} className="sectionAccordion">
                  <header className="sectionHeader">
                    <button
                      className="sectionToggle"
                      onClick={() => toggleAccordion(section.id)}
                    >
                      {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      <span className="sectionIndex">{sIndex + 1}</span>
                      <div>
                        <h3>{section.title}</h3>
                        {section.description ? <p>{section.description}</p> : null}
                      </div>
                    </button>

                    <div className="sectionMeta">
                      <span className="countBadge">
                        {section.lessons.length} دروس · {section.exams.length} امتحانات
                      </span>
                      <div className="actionBtns">
                        <button
                          title="تحريك لأعلى"
                          disabled={sIndex === 0}
                          onClick={() => moveSection(section.id, "up")}
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          title="تحريك لأسفل"
                          disabled={sIndex === sections.length - 1}
                          onClick={() => moveSection(section.id, "down")}
                        >
                          <ArrowDown size={16} />
                        </button>
                        <button
                          className="btn text"
                          onClick={() => setSectionModal({ open: true, data: section })}
                        >
                          <Edit3 size={16} /> تعديل
                        </button>
                        <button
                          className="btn text danger"
                          onClick={() =>
                            setConfirmDelete({
                              open: true,
                              type: "section",
                              id: section.id,
                              name: section.title,
                            })
                          }
                        >
                          <Trash2 size={16} /> حذف
                        </button>
                      </div>
                    </div>
                  </header>

                  {isOpen && (
                    <div className="sectionBody">
                      {/* Section toolbar */}
                      <div className="sectionToolbar">
                        <button
                          className="btn sm primary"
                          onClick={() =>
                            setLessonModal({ open: true, sectionId: section.id, data: null })
                          }
                        >
                          <PlayCircle size={16} /> إضافة درس للقسم
                        </button>
                        <button
                          className="btn sm secondary"
                          onClick={() => openExamModal(section.id, null)}
                        >
                          <ClipboardCheck size={16} /> إضافة امتحان للقسم
                        </button>
                      </div>

                      {/* Items list (Lessons & Exams) */}
                      {section.lessons.length === 0 && section.exams.length === 0 ? (
                        <div className="sectionEmptyActions">
                          <div><strong>القسم جاهز لإضافة المحتوى</strong><span>ابدأ بفيديو المحاضر، ثم أضف كويزًا لقياس الاستيعاب.</span></div>
                          <button className="contentChoice videoChoice" onClick={() => setLessonModal({ open: true, sectionId: section.id, data: null })}><i><Video size={21}/></i><span><b>إضافة فيديو أو درس</b><small>ارفع الفيديو وأضف الشرح</small></span><ArrowLeft size={18}/></button>
                          <button className="contentChoice quizChoice" onClick={() => openExamModal(section.id, null)}><i><ClipboardCheck size={22}/></i><span><b>إنشاء كويز</b><small>أسئلة اختيار من متعدد أو صح وخطأ</small></span><ArrowLeft size={18}/></button>
                        </div>
                      ) : (
                        <div className="itemsList">
                          {/* Lessons */}
                          {section.lessons.map((lesson, lIndex) => (
                            <div key={lesson.id} className="itemCard lessonCard">
                              <div className="itemLead">
                                <span className="itemIcon">
                                  {lesson.type === "VIDEO" || lesson.type === "VIDEO_WITH_ATTACHMENT" ? (
                                    <PlayCircle size={20} />
                                  ) : (
                                    <FileText size={18} />
                                  )}
                                </span>
                                <div>
                                  <h4>{lesson.title}</h4>
                                  <div className="itemTags">
                                    <span className="tag">{lessonTypeLabels[lesson.type]}</span>
                                    {lesson.duration > 0 ? (
                                      <span className="tag gray">
                                        <Clock size={12} /> {lesson.duration} دقيقة
                                      </span>
                                    ) : null}
                                    {lesson.isPreview ? (
                                      <span className="tag green">
                                        <Unlock size={12} /> معاينة مجانية
                                      </span>
                                    ) : (
                                      <span className="tag blue">
                                        <Lock size={12} /> للمشتركين
                                      </span>
                                    )}
                                    <span className={`tag status-${lesson.status.toLowerCase()}`}>
                                      {lesson.status === "PUBLISHED" ? "منشور" : "مسودة"}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="itemActions">
                                <Link className="btn text lessonViewersLink" href={`/teacher/courses/${course.id}/lessons/${lesson.id}/viewers`}><Eye size={15} /> المشاهدات</Link>
                                <button
                                  title="تحريك لأعلى"
                                  disabled={lIndex === 0}
                                  onClick={() => moveLesson(lesson.id, "up")}
                                >
                                  <ArrowUp size={15} />
                                </button>
                                <button
                                  title="تحريك لأسفل"
                                  disabled={lIndex === section.lessons.length - 1}
                                  onClick={() => moveLesson(lesson.id, "down")}
                                >
                                  <ArrowDown size={15} />
                                </button>
                                <button
                                  className="btn text"
                                  onClick={() =>
                                    setLessonModal({ open: true, sectionId: section.id, data: lesson })
                                  }
                                >
                                  تعديل
                                </button>
                                <button
                                  className="btn text danger"
                                  onClick={() =>
                                    setConfirmDelete({
                                      open: true,
                                      type: "lesson",
                                      id: lesson.id,
                                      name: lesson.title,
                                    })
                                  }
                                >
                                  حذف
                                </button>
                              </div>
                            </div>
                          ))}

                          {/* Section Exams */}
                          {section.exams.map((exam, eIndex) => (
                            <div key={exam.id} className="itemCard examCard">
                              <div className="itemLead">
                                <span className="itemIcon purple">
                                  <ClipboardCheck size={20} />
                                </span>
                                <div>
                                  <h4>{exam.title}</h4>
                                  <div className="itemTags">
                                    <span className="tag purple">امتحان</span>
                                    <span className="tag gray">{exam.durationMinutes} دقيقة</span>
                                    <span className="tag gray">نجاح من {exam.passingScore}%</span>
                                    <span className="tag gray">{exam.questions.length} أسئلة</span>
                                    <span className={`tag status-${exam.status.toLowerCase()}`}>
                                      {exam.status === "PUBLISHED" ? "منشور" : "مسودة"}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="itemActions">
                                <Link
                                  className="btn text"
                                  href={`/teacher/exams?examId=${exam.id}`}
                                >
                                  النتائج
                                </Link>
                                <button
                                  title="تحريك لأعلى"
                                  disabled={eIndex === 0}
                                  onClick={() => moveExam(exam.id, "up")}
                                >
                                  <ArrowUp size={15} />
                                </button>
                                <button
                                  title="تحريك لأسفل"
                                  disabled={eIndex === section.exams.length - 1}
                                  onClick={() => moveExam(exam.id, "down")}
                                >
                                  <ArrowDown size={15} />
                                </button>
                                <button
                                  className="btn text"
                                  onClick={() => openExamModal(section.id, exam)}
                                >
                                  تعديل
                                </button>
                                <button
                                  className="btn text danger"
                                  onClick={() =>
                                    setConfirmDelete({
                                      open: true,
                                      type: "exam",
                                      id: exam.id,
                                      name: exam.title,
                                    })
                                  }
                                >
                                  حذف
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* Section Modal */}
      {sectionModal.open && (
        <div className="modalOverlay">
          <form className="modalSheet" onSubmit={saveSection}>
            <header>
              <div><span className="modalEyebrow">الخطوة الأولى</span><h3>{sectionModal.data ? "تعديل القسم" : "إنشاء قسم جديد"}</h3></div>
              <button type="button" onClick={() => setSectionModal({ open: false })}>
                <X size={18} />
              </button>
            </header>
            <div className="modalBody">
              <label>
                عنوان القسم *
                <input
                  name="title"
                  defaultValue={sectionModal.data?.title ?? ""}
                  placeholder="مثال: الفصل الأول - مفاهيم أساسية"
                  required
                />
              </label>
              <label>
                وصف اختياري للقسم
                <textarea
                  name="description"
                  defaultValue={sectionModal.data?.description ?? ""}
                  placeholder="وصف مختصر لمحتوى هذا القسم..."
                  rows={3}
                />
              </label>
            </div>
            <footer>
              <button
                type="button"
                className="btn outline"
                onClick={() => setSectionModal({ open: false })}
              >
                إلغاء
              </button>
              <button className="btn primary" disabled={loading}>
                {loading ? "جارٍ الحفظ..." : "حفظ القسم"}
              </button>
            </footer>
          </form>
        </div>
      )}

      {/* Lesson Modal */}
      {lessonModal.open && (
        <div className="modalOverlay">
          <form ref={lessonFormRef} className="modalSheet wide" onSubmit={saveLesson} role="dialog" aria-modal="true" aria-labelledby="lesson-form-title">
            <header>
              <div><span className="modalEyebrow">محتوى القسم</span><h3 id="lesson-form-title">{lessonModal.data ? "تعديل الدرس" : "إضافة درس جديد"}</h3></div>
              <button type="button" onClick={() => setLessonModal({ open: false })}>
                <X size={18} />
              </button>
            </header>
            <div className="modalBody grid">
              <label className="full">
                عنوان الدرس *
                <input
                  name="title"
                  defaultValue={lessonModal.data?.title ?? ""}
                  placeholder="عنوان الدرس الشارح..."
                  required
                />
              </label>

              <label>
                المدة بالدقائق
                <input
                  name="duration"
                  type="number"
                  min="0"
                  defaultValue={lessonModal.data?.duration ?? 0}
                />
              </label>

              <div className="full lessonBunnyUploads">
  <div><b>ملفات الدرس</b><small>ارفع الفيديو مباشرةً، ويمكنك استكماله إذا انقطع الإنترنت.</small></div>
  <div className="lessonUploadGrid"><div className="bunnyUploadKind"><Video size={17}/><b>فيديو الدرس</b><MediaUploader resourceType="video" courseId={course.id} lessonId={lessonModal.data?.id} beforeUpload={ensureLessonForUpload} onUploadComplete={(asset) => applyLessonAsset("video", asset)} onUploadError={(message) => showMessage(message, "error")} /></div>{lessonModal.data?.id ? <><div className="bunnyUploadKind"><Paperclip size={17}/><b>ملف أو PDF</b><MediaUploader resourceType="attachment" courseId={course.id} lessonId={lessonModal.data.id} onUploadComplete={(asset) => applyLessonAsset("attachment", asset)} onUploadError={(message) => showMessage(message, "error")} /></div><div className="bunnyUploadKind"><ImageIcon size={17}/><b>صورة الدرس</b><MediaUploader resourceType="image" courseId={course.id} lessonId={lessonModal.data.id} aspectRatio={16/9} onUploadComplete={(asset) => applyLessonAsset("thumbnail", asset)} onUploadError={(message) => showMessage(message, "error")} /></div></> : null}</div>
</div>

                            <input type="hidden" name="videoUrl" value={lessonModal.data?.videoUrl ?? ""} readOnly />
              <input type="hidden" name="attachmentUrl" value={lessonModal.data?.attachmentUrl ?? ""} readOnly />
              <input type="hidden" name="thumbnailUrl" value={lessonModal.data?.thumbnailUrl ?? ""} readOnly />

              <label className="full">
                ملاحظات أو شرح إضافي للدرس
                <textarea
                  name="content"
                  defaultValue={lessonModal.data?.content ?? ""}
                  rows={4}
                  placeholder="اكتب هنا الشرح التفصيلي للدرس..."
                />
              </label>

              <div className="full checkboxGroup">
                <label className="checkboxLabel">
                  <input
                    type="checkbox"
                    name="isPreview"
                    defaultChecked={lessonModal.data?.isPreview ?? false}
                  />
                  <span>درس مجاني للمعاينة قبل الاشتراك</span>
                </label>
              </div>
            </div>
            <footer>
              <button
                type="button"
                className="btn outline"
                onClick={() => setLessonModal({ open: false })}
              >
                إلغاء
              </button>
              <button className="btn primary" disabled={loading}>
                {loading ? "جارٍ الحفظ..." : "حفظ الدرس"}
              </button>
            </footer>
          </form>
        </div>
      )}

      {/* Exam Modal */}
      {mounted && examModal.open ? createPortal(
        <div className="modalOverlay quizBuilderOverlay">
          <form className="modalSheet extraWide" onSubmit={saveExam} noValidate role="dialog" aria-modal="true" aria-labelledby="exam-form-title">
            <header>
              <div><span className="modalEyebrow">تقييم الطالب</span><h3 id="exam-form-title">{examModal.data ? "تعديل الكويز" : "إنشاء كويز جديد"}</h3></div>
              <button type="button" onClick={() => setExamModal({ open: false })}>
                <X size={18} />
              </button>
            </header>
            {notice ? <div className={`formNotice ${notice.type === "error" ? "formError" : ""}`} style={{ margin: "14px 24px 0" }}>{notice.text}</div> : null}
            <div className="modalBody grid">
              <div className="full examSetupIntro"><i><HelpCircle size={22}/></i><div><b>أنشئ الكويز من هنا مباشرة</b><p>اكتب السؤال، أضف الاختيارات، ثم اضغط الدائرة بجوار الإجابة الصحيحة قبل الحفظ.</p></div></div>
              <label className="full">
                عنوان الكويز *
                <input
                  name="title"
                  defaultValue={examModal.data?.title ?? ""}
                  placeholder="عنوان الامتحان أو الاختبار..."
                  required
                />
              </label>

              <label>
                مدة الامتحان بالدقائق *
                <input
                  name="durationMinutes"
                  type="number"
                  min="1"
                  max="300"
                  defaultValue={examModal.data?.durationMinutes ?? 30}
                  required
                />
              </label>

              <label>
                نسبة النجاح المطلوب %
                <input
                  name="passingScore"
                  type="number"
                  min="0"
                  max="100"
                  defaultValue={examModal.data?.passingScore ?? 50}
                  required
                />
              </label>

              <div className="singleAttemptRule">
                <ShieldCheck size={20} />
                <div><b>محاولة واحدة فقط لكل طالب</b><small>بعد تسليم الاختبار لا يمكن للطالب إعادته، لضمان عدالة التقييم.</small></div>
                <input type="hidden" name="maxAttempts" value="1" />
              </div>

              <div className="full checkboxGrid">
                <label className="checkboxLabel">
                  <input
                    type="checkbox"
                    name="showResultImmediately"
                    defaultChecked={examModal.data?.showResultImmediately ?? true}
                  />
                  <span>إظهار النتيجة والدرجة فور التسليم</span>
                </label>
                <label className="checkboxLabel">
                  <input
                    type="checkbox"
                    name="showAnswersAfterSubmit"
                    defaultChecked={examModal.data?.showAnswersAfterSubmit ?? false}
                  />
                  <span>إظهار الإجابات الصحيحة والشرح بعد التسليم</span>
                </label>
              </div>

              {examQuestions.some((question) => question.type === "ESSAY") ? <div className="essayExamRule"><Clock size={18}/><span><b>النتيجة النهائية بعد تصحيحك</b><small>سيتم تسليم إجابات الطالب وحجز النتيجة حتى تنتهي من تصحيح الأسئلة المقالية.</small></span></div> : null}

              {/* Questions Editor */}
              <div className="full questionsEditor">
                <div className="questionsHeader">
                  <div><span>بنك الأسئلة</span><h4>أسئلة الكويز ({examQuestions.length})</h4></div>
                  <button type="button" className="btn sm primary" onClick={addQuestion}>
                    <Plus size={15} /> إضافة سؤال
                  </button>
                </div>

                {examQuestions.map((q, qIdx) => (
                  <div key={qIdx} className="questionBox">
                    <div className="questionHead">
                      <b>سؤال {qIdx + 1}</b>
                      <button
                        type="button"
                        className="btn text danger"
                        onClick={() => removeQuestion(qIdx)}
                      >
                        حذف السؤال
                      </button>
                    </div>

                    <label>
                      نص السؤال
                      <input
                        value={q.text}
                        onChange={(e) => updateQuestion(qIdx, { text: e.target.value })}
                        placeholder="أدخل نص السؤال (أو اتركه إذا أضفت رابط صورة)..."
                      />
                    </label>
                    <details className="questionImageDisclosure" open={Boolean(q.imageUrl)}>
                      <summary><ImageIcon size={17}/><span><b>إضافة صورة للسؤال</b><small>اختياري</small></span><ChevronDown size={17}/></summary>
                      <div className="questionBunnyImage">
                        <p>ارفع صورة توضيحية فقط لو السؤال محتاجها.</p>
                        <MediaUploader resourceType="image" courseId={course.id} onUploadComplete={(asset) => updateQuestion(qIdx, { imageUrl: asset.publicUrl ?? "" })} />
                        {q.imageUrl ? <><div className="questionImagePreview"><Image src={q.imageUrl} alt="معاينة صورة السؤال" width={900} height={500} /></div><button type="button" className="removeQuestionImage" onClick={() => updateQuestion(qIdx, { imageUrl: "" })}>حذف صورة السؤال</button></> : null}
                      </div>
                    </details>

                    <div className="questionRow">
                      <label>
                        نوع السؤال
                        <select
                          value={q.type}
                          onChange={(e) => {
                            const newType = e.target.value as "MCQ" | "TRUE_FALSE" | "ESSAY";
                            const defaultOpts = newType === "ESSAY" ? [] : (newType === "TRUE_FALSE" ? ["صح", "خطأ"] : ["أ", "ب", "ج", "د"]);
                            updateQuestion(qIdx, {
                              type: newType,
                              options: defaultOpts,
                              correctAnswer: defaultOpts[0] ?? "",
                            });
                          }}
                        >
                          <option value="MCQ">اختيار من متعدد</option>
                          <option value="TRUE_FALSE">صح أو خطأ</option>
                          <option value="ESSAY">سؤال مقالي</option>
                        </select>
                      </label>

                      <label>
                        درجة السؤال
                        <input
                          type="number"
                          min="0.5"
                          step="0.5"
                          value={q.points}
                          onChange={(e) => updateQuestion(qIdx, { points: Number(e.target.value) })}
                        />
                      </label>
                    </div>

                    {/* Options list */}
                    {q.type === "MCQ" ? (
                      <div className="optionsEditor">
                        <small>الاختيارات والإجابة الصحيحة (اختر الدائرة بجانب الإجابة الصحيحة):</small>
                        {q.options.map((opt, optIdx) => (
                          <div key={optIdx} className="optionRow">
                            <input
                              type="radio"
                              name={`correct_${qIdx}`}
                              checked={q.correctAnswer === opt}
                              onChange={() => updateQuestion(qIdx, { correctAnswer: opt })}
                            />
                            <input
                              value={opt}
                              onChange={(e) => {
                                const newOpts = [...q.options];
                                const oldVal = newOpts[optIdx];
                                newOpts[optIdx] = e.target.value;
                                const isCorrect = q.correctAnswer === oldVal;
                                updateQuestion(qIdx, {
                                  options: newOpts,
                                  correctAnswer: isCorrect ? e.target.value : q.correctAnswer,
                                });
                              }}
                              placeholder={["أ", "ب", "ج", "د", "هـ", "و"][optIdx] || `خيار ${optIdx + 1}`}
                            />
                            {q.options.length > 2 ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const newOpts = q.options.filter((_, i) => i !== optIdx);
                                  updateQuestion(qIdx, {
                                    options: newOpts,
                                    correctAnswer: newOpts.includes(q.correctAnswer) ? q.correctAnswer : newOpts[0],
                                  });
                                }}
                              >
                                <X size={14} />
                              </button>
                            ) : null}
                          </div>
                        ))}
                        {q.options.length < 6 ? (
                          <button
                            type="button"
                            className="btn sm text"
                            onClick={() => {
                              const labels = ["أ", "ب", "ج", "د", "هـ", "و"];
                              const nextLabel = labels[q.options.length] || `خيار ${q.options.length + 1}`;
                              updateQuestion(qIdx, {
                                options: [...q.options, nextLabel],
                              });
                            }}
                          >
                            + إضافة خيار
                          </button>
                        ) : null}
                      </div>
                     ) : q.type === "TRUE_FALSE" ? (
                      <div className="optionsEditor">
                        <small>الإجابة الصحيحة:</small>
                        <div className="tfRadio">
                          <label>
                            <input
                              type="radio"
                              name={`tf_${qIdx}`}
                              checked={q.correctAnswer === "صح"}
                              onChange={() => updateQuestion(qIdx, { correctAnswer: "صح" })}
                            />
                            <span>صح</span>
                          </label>
                          <label>
                            <input
                              type="radio"
                              name={`tf_${qIdx}`}
                              checked={q.correctAnswer === "خطأ"}
                              onChange={() => updateQuestion(qIdx, { correctAnswer: "خطأ" })}
                            />
                            <span>خطأ</span>
                          </label>
                        </div>
                      </div>
                    ) : (
                      <div className="essayQuestionNotice" role="note">
                        <FileText size={18}/><span><b>إجابة كتابية طويلة</b><small>السؤال المقالي لا يُصحَّح تلقائيًا، وسيحتاج منك تصحيحًا يدويًا بعد تسليم الطالب.</small></span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <footer>
              <button
                type="button"
                className="btn outline"
                onClick={() => setExamModal({ open: false })}
              >
                إلغاء
              </button>
              <button className="btn primary" disabled={loading}>
                {loading ? "جارٍ الحفظ..." : "حفظ الامتحان والأسئلة"}
              </button>
            </footer>
          </form>
        </div>,
        document.body
      ) : null}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="modalOverlay">
          <div className="modalSheet confirmSheet">
            <h3>تأكيد الحذف</h3>
            <p>
              هل أنت تأكد من رغبتك في حذف {confirmDelete.type === "section" ? "القسم" : confirmDelete.type === "lesson" ? "الدرس" : "الامتحان"}{" "}
              <b>«{confirmDelete.name}»</b>؟ لا يمكن التراجع بعد الحذف.
            </p>
            <div className="confirmActions">
              <button
                className="btn outline"
                onClick={() => setConfirmDelete(null)}
                disabled={loading}
              >
                إلغاء
              </button>
              <button
                className="btn danger"
                onClick={handleConfirmDelete}
                disabled={loading}
              >
                {loading ? "جارٍ الحذف..." : "تأكيد الحذف"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
