"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  FileText,
  HelpCircle,
  Lock,
  Menu,
  PlayCircle,
  X,
} from "lucide-react";
import { Brand } from "../ui";

type Question = {
  id: string;
  text: string;
  imageUrl?: string | null;
  type: "MCQ" | "TRUE_FALSE";
  options: string[];
  points: number;
};

type Exam = {
  id: string;
  title: string;
  description?: string | null;
  durationMinutes: number;
  passingScore: number;
  maxAttempts: number;
  showResultImmediately: boolean;
  showAnswersAfterSubmit: boolean;
  questionsCount: number;
  questions: Question[];
  myAttemptsCount: number;
  lastAttempt?: {
    score: number;
    maxScore: number;
    percentage: number;
    passed: boolean;
    submittedAt: string;
  } | null;
};

type Lesson = {
  id: string;
  sectionId: string;
  sectionTitle: string;
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
  completed: boolean;
};

type Section = {
  id: string;
  title: string;
  lessons: Lesson[];
  exams: Exam[];
};

type ViewerProps = {
  user: {
    id: string;
    fullName: string;
    phone: string;
  };
  course: {
    id: string;
    title: string;
    subject: string;
    sections: Section[];
  };
  initialLessonId?: string;
  initialProgress: number;
};

export function StudentCourseViewer({
  user,
  course,
  initialLessonId,
  initialProgress,
}: ViewerProps) {
  const allLessons = useMemo(
    () => course.sections.flatMap((s) => s.lessons),
    [course.sections]
  );

  const [activeLessonId, setActiveLessonId] = useState<string>(() => {
    if (initialLessonId && allLessons.some((l) => l.id === initialLessonId)) {
      return initialLessonId;
    }
    const firstUncompleted = allLessons.find((l) => !l.completed);
    return firstUncompleted?.id ?? allLessons[0]?.id ?? "";
  });

  const [activeExam, setActiveExam] = useState<Exam | null>(null);
  const [completedLessons, setCompletedLessons] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    allLessons.forEach((l) => {
      if (l.completed) map[l.id] = true;
    });
    return map;
  });

  const [progressPercentage, setProgressPercentage] = useState(initialProgress);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [marking, setMarking] = useState(false);

  // Exam Attempt state
  const [examStarted, setExamStarted] = useState(false);
  const [examAnswers, setExamAnswers] = useState<Record<string, string>>({});
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [examResult, setExamResult] = useState<any | null>(null);
  const [submittingExam, setSubmittingExam] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  const currentLesson = useMemo(
    () => allLessons.find((l) => l.id === activeLessonId),
    [allLessons, activeLessonId]
  );

  const currentIndex = useMemo(
    () => allLessons.findIndex((l) => l.id === activeLessonId),
    [allLessons, activeLessonId]
  );

  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex >= 0 && currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  // Countdown timer for active exam
  useEffect(() => {
    if (!examStarted || timeRemaining === null) return;

    if (timeRemaining <= 0) {
      handleFinalExamSubmit();
      return;
    }

    const timer = setInterval(() => {
      setTimeRemaining((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [examStarted, timeRemaining]);

  // Mark lesson complete
  async function toggleLessonComplete(lessonId: string) {
    const nextState = !completedLessons[lessonId];
    setMarking(true);

    const res = await fetch(`/api/student/lessons/${lessonId}/progress`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ completed: nextState }),
    });

    setMarking(false);

    if (res.ok) {
      const data = await res.json();
      setCompletedLessons((prev) => ({ ...prev, [lessonId]: nextState }));
      if (typeof data.progressPercentage === "number") {
        setProgressPercentage(data.progressPercentage);
      }
    }
  }

  function selectLesson(lessonId: string) {
    setActiveExam(null);
    setExamStarted(false);
    setExamResult(null);
    setActiveLessonId(lessonId);
    setMobileMenuOpen(false);
  }

  function startExam(exam: Exam) {
    setActiveExam(exam);
    setExamResult(null);
    setExamAnswers({});
    setExamStarted(true);
    setTimeRemaining(exam.durationMinutes * 60);
    setMobileMenuOpen(false);
  }

  const [examSubmitError, setExamSubmitError] = useState<string | null>(null);

  async function handleFinalExamSubmit() {
    if (!activeExam) return;
    setSubmittingExam(true);
    setExamSubmitError(null);

    try {
      const res = await fetch(`/api/student/exams/${activeExam.id}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers: examAnswers }),
      });

      setSubmittingExam(false);

      if (res.ok) {
        setConfirmSubmit(false);
        const data = await res.json();
        setExamResult(data);
        setExamStarted(false);
        setTimeRemaining(null);
      } else {
        const err = await res.json().catch(() => null);
        setExamSubmitError(err?.message ?? "حدث خطأ أثناء تسليم الامتحان");
      }
    } catch {
      setSubmittingExam(false);
      setExamSubmitError("حدث خطأ في الاتصال بالخادم أثناء تسليم الامتحان");
    }
  }

  // Parse embed or video URL
  function renderVideoPlayer(lesson: Lesson) {
    const url = lesson.videoUrl ?? "";
    const videoId = lesson.videoId ?? "";

    if (url.includes("iframe.mediadelivery.net")) {
      return (
        <iframe
          title={lesson.title}
          src={url}
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      );
    }
    if (videoId) {
      return (
        <iframe
          title={lesson.title}
          src={`https://iframe.videodelivery.net/${videoId}`}
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      );
    }

    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      const ytId = url.includes("v=") ? url.split("v=")[1]?.split("&")[0] : url.split("/").pop();
      return (
        <iframe
          title={lesson.title}
          src={`https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      );
    }

    if (url.includes("vimeo.com")) {
      const vimeoId = url.split("/").pop();
      return (
        <iframe
          title={lesson.title}
          src={`https://player.vimeo.com/video/${vimeoId}`}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      );
    }

    if (url.startsWith("http://") || url.startsWith("https://")) {
      return (
        <video
          src={url}
          controls
          controlsList="nodownload"
          poster={lesson.thumbnailUrl ?? undefined}
        >
          متصفحك لا يدعم مشغل الفيديو المباشر.
        </video>
      );
    }

    return (
      <div className="videoUnavailable">
        <PlayCircle size={40} />
        <h3>الفيديو قيد الإعداد</h3>
        <p>سيقوم المدرس برفع الفيديو قريباً.</p>
      </div>
    );
  }

  return (
    <main className="studentViewerPage">
      {/* Top Navbar */}
      <header className="viewerHeader">
        <div className="wrap viewerHeaderWrap">
          <div className="brandArea">
            <Brand compact inverse />
            <span className="subjectPillHeader">{course.subject}</span>
            <span className="courseTitleHeader">{course.title}</span>
          </div>

          <div className="navActions">
            <button
              className="mobileToggleBtn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Menu size={20} /> فهرس الكورس
            </button>

            <Link className="exitBtn" href="/dashboard">
              العودة للوحة التحكم <ArrowLeft size={16} />
            </Link>
          </div>
        </div>
      </header>

      <div className="wrap viewerLayout">
        {/* Main Content Area */}
        <section className="viewerMain">
          {activeExam ? (
            /* Exam Attempt / Result View */
            <div className="examViewContainer">
              {!examStarted && !examResult ? (
                <div className="examIntroCard">
                  <span className="badge purple">امتحان أونلاين</span>
                  <h2>{activeExam.title}</h2>
                  {activeExam.description ? <p>{activeExam.description}</p> : null}

                  <div className="examStatsGrid">
                    <div>
                      <Clock size={20} />
                      <b>{activeExam.durationMinutes} دقيقة</b>
                      <small>المدة الزمنية</small>
                    </div>
                    <div>
                      <HelpCircle size={20} />
                      <b>{activeExam.questionsCount} أسئلة</b>
                      <small>عدد الأسئلة</small>
                    </div>
                    <div>
                      <CheckCircle2 size={20} />
                      <b>{activeExam.passingScore}%</b>
                      <small>درجة النجاح</small>
                    </div>
                  </div>

                  {activeExam.myAttemptsCount >= activeExam.maxAttempts ? (
                    <div className="attemptLimitNotice">
                      استنفدت الحد الأقصى للمحاولات المسموحة ({activeExam.maxAttempts}).
                    </div>
                  ) : (
                    <button className="btn primary lg" onClick={() => startExam(activeExam)}>
                      ابدأ حل الامتحان الآن ←
                    </button>
                  )}
                </div>
              ) : examStarted ? (
                <div className="examActiveSheet">
                  <header className="examActiveHeader">
                    <div>
                      <h2>{activeExam.title}</h2>
                      <small>أجب عن كافة الأسئلة ثم اضغط تسليم</small>
                    </div>

                    {timeRemaining !== null && (
                      <div className="examTimer">
                        <Clock size={18} />
                        <b>
                          {Math.floor(timeRemaining / 60)}:
                          {String(timeRemaining % 60).padStart(2, "0")}
                        </b>
                      </div>
                    )}
                  </header>

                  <div className="questionsList">
                    {activeExam.questions.map((q, idx) => (
                      <div key={q.id} className="questionItem">
                        <div className="qTitle">
                          <span>{idx + 1}</span>
                          <h3>{q.text}</h3>
                        </div>

                        {q.imageUrl ? (
                          <div className="studentQuestionImage">
                            <img src={q.imageUrl} alt={`صورة سؤال ${idx + 1}`} />
                          </div>
                        ) : null}

                        <div className="qOptions">
                          {q.options.map((opt, oIdx) => (
                            <label
                              key={oIdx}
                              className={`optionLabel ${
                                examAnswers[q.id] === opt ? "selected" : ""
                              }`}
                            >
                              <input
                                type="radio"
                                name={`q_${q.id}`}
                                checked={examAnswers[q.id] === opt}
                                onChange={() =>
                                  setExamAnswers((prev) => ({ ...prev, [q.id]: opt }))
                                }
                              />
                              <span>{opt}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <footer className="examFooter">
                    <button
                      className="btn primary lg"
                      onClick={() => setConfirmSubmit(true)}
                    >
                      تسليم الامتحان والنتيجة
                    </button>
                  </footer>
                </div>
              ) : examResult ? (
                <div className="examResultCard">
                  {examResult.result ? (
                    <>
                      <div
                        className={`resultHeader ${
                          examResult.result.passed ? "pass" : "fail"
                        }`}
                      >
                        <span className="resultIcon">
                          {examResult.result.passed ? "🏆" : "⚠️"}
                        </span>
                        <h2>
                          {examResult.result.passed
                            ? "مبروك! لقد نجحت في الامتحان"
                            : "للأسف لم تتجاوز نسبة النجاح"}
                        </h2>
                        <strong className="scorePercent">
                          {examResult.result.percentage}%
                        </strong>
                        <p>
                          درجتك: {examResult.result.score} من {examResult.result.maxScore} (نسبة النجاح: {examResult.result.passingScore}%)
                        </p>
                      </div>

                      {examResult.questions ? (
                        <div className="questionsReview">
                          <h3>مراجعة الإجابات والشرح:</h3>
                          {examResult.questions.map((q: any, i: number) => (
                            <div
                              key={q.id}
                              className={`reviewItem ${q.isCorrect ? "correct" : "wrong"}`}
                            >
                              <p>
                                <b>س{i + 1}:</b> {q.text}
                              </p>
                              <small>إجابتك: {q.studentAnswer || "لم تجب"}</small>
                              {q.correctAnswer && (
                                <small className="correctTxt">
                                  الإجابة الصحيحة: {q.correctAnswer}
                                </small>
                              )}
                              {q.explanation && <p className="expl">{q.explanation}</p>}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      <button
                        className="btn secondary"
                        onClick={() => setActiveExam(null)}
                      >
                        العودة للدروس ←
                      </button>
                    </>
                  ) : (
                    <div className="resultHeader">
                      <h2>تم تسليم الامتحان بنجاح</h2>
                      <p>سيراجع المدرس نتيجتك قريباً.</p>
                      <button className="btn secondary" onClick={() => setActiveExam(null)}>
                        العودة للدروس ←
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : currentLesson ? (
            /* Lesson View Screen */
            <div className="lessonViewContainer">
              {/* Media Container */}
              <div className="mediaContainer">
                {currentLesson.type === "TEXT" ? (
                  <div className="textLessonBox">
                    <FileText size={48} />
                    <h2>{currentLesson.title}</h2>
                    <div className="textContent">
                      {currentLesson.content || currentLesson.description || "لا يوجد نص مضاف لهذا الدرس."}
                    </div>
                  </div>
                ) : (
                  <div className="videoPlayerWrapper">
                    {renderVideoPlayer(currentLesson)}
                    {/* Security Moving Watermark */}
                    <div className="securityWatermark">
                      <span>
                        {user.fullName} · {user.phone} · ID:{user.id.slice(-6)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Lesson Details & Actions */}
              <div className="lessonHeaderBar">
                <div>
                  <span className="sectionTag">{currentLesson.sectionTitle}</span>
                  <h1>{currentLesson.title}</h1>
                </div>

                <button
                  className={`completeBtn ${
                    completedLessons[currentLesson.id] ? "completed" : ""
                  }`}
                  disabled={marking}
                  onClick={() => toggleLessonComplete(currentLesson.id)}
                >
                  <CheckCircle2 size={18} />
                  {completedLessons[currentLesson.id] ? "درس مكتمل ✓" : "تحديد كـ مكتمل"}
                </button>
              </div>

              {currentLesson.description && (
                <div className="lessonDescription">
                  <h3>تفاصيل الدرس:</h3>
                  <p>{currentLesson.description}</p>
                </div>
              )}

              {currentLesson.attachmentUrl && (
                <div className="attachmentBox">
                  <div>
                    <Download size={20} />
                    <span>الملحقات والمرفقات الخاصة بالدرس</span>
                  </div>
                  <a
                    href={currentLesson.attachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn sm outline"
                  >
                    تحميل المرفق
                  </a>
                </div>
              )}

              {/* Lesson Navigation Footer */}
              <footer className="lessonNavFooter">
                {prevLesson ? (
                  <button className="navBtn" onClick={() => selectLesson(prevLesson.id)}>
                    <ArrowRight size={16} /> الدرس السابق: {prevLesson.title}
                  </button>
                ) : <span />}

                {nextLesson ? (
                  <button className="navBtn primary" onClick={() => selectLesson(nextLesson.id)}>
                    الدرس التالي: {nextLesson.title} <ArrowLeft size={16} />
                  </button>
                ) : <span />}
              </footer>
            </div>
          ) : (
            <div className="emptyStateCard">
              <PlayCircle size={40} />
              <h3>لا يوجد درس محدد</h3>
              <p>اختر درساً من قائمة المحتوى للبدء في المشاهدة.</p>
            </div>
          )}
        </section>

        {/* Sidebar Outline */}
        <aside className={`viewerSidebar ${mobileMenuOpen ? "mobileOpen" : ""}`}>
          <div className="sidebarCard">
            <header className="sidebarHeader">
              <div>
                <h3>محتوى الكورس</h3>
                <small>{progressPercentage}% مكتمل</small>
              </div>
              <div className="progressBar">
                <em style={{ width: `${progressPercentage}%` }} />
              </div>
            </header>

            <div className="sidebarContent">
              {course.sections.map((section, idx) => (
                <div key={section.id} className="sidebarSection">
                  <div className="sidebarSectionTitle">
                    <b>{idx + 1}</b>
                    <span>{section.title}</span>
                  </div>

                  <div className="sidebarItems">
                    {section.lessons.map((lesson) => {
                      const isSelected = !activeExam && lesson.id === activeLessonId;
                      const isDone = completedLessons[lesson.id];

                      return (
                        <button
                          key={lesson.id}
                          className={`sidebarItem ${isSelected ? "active" : ""} ${
                            isDone ? "done" : ""
                          }`}
                          onClick={() => selectLesson(lesson.id)}
                        >
                          <span className="icon">
                            {isDone ? <CheckCircle2 size={16} /> : <PlayCircle size={16} />}
                          </span>
                          <span className="itemTitle">{lesson.title}</span>
                          {lesson.duration > 0 ? (
                            <small className="itemDuration">{lesson.duration} د</small>
                          ) : null}
                        </button>
                      );
                    })}

                    {section.exams.map((exam) => {
                      const isExamActive = activeExam?.id === exam.id;

                      return (
                        <button
                          key={exam.id}
                          className={`sidebarItem examItem ${isExamActive ? "active" : ""}`}
                          onClick={() => startExam(exam)}
                        >
                          <span className="icon purple">
                            <HelpCircle size={16} />
                          </span>
                          <span className="itemTitle">امتحان: {exam.title}</span>
                          <small className="itemDuration">{exam.durationMinutes} د</small>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* Confirm Exam Submit Modal */}
      {confirmSubmit && typeof window !== "undefined"
        ? createPortal(
            <div className="modalOverlay checkoutPortalOverlay" onClick={() => setConfirmSubmit(false)}>
              <div
                className="modalSheet checkoutSheet"
                style={{ maxWidth: "480px", background: "#ffffff", padding: "0" }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  className="modalHeader"
                  style={{
                    background: "#f8fafc",
                    padding: "18px 24px",
                    borderBottom: "1px solid #e2e8f0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "900", color: "#0f172a" }}>
                    تأكيد تسليم الامتحان
                  </h3>
                  <button
                    type="button"
                    className="iconBtn"
                    onClick={() => setConfirmSubmit(false)}
                    style={{ background: "transparent", border: "none", cursor: "pointer" }}
                  >
                    <X size={20} color="#64748b" />
                  </button>
                </div>

                <div className="modalBody" style={{ padding: "24px" }}>
                  <p style={{ margin: "0 0 18px", fontSize: "15px", fontWeight: "700", color: "#334155", lineHeight: "1.6" }}>
                    هل أنت تأكد من رغبتك في إنهاء وتسليم أجوبتك الآن؟ لا يمكنك تعديل الإجابات بعد التسليم.
                  </p>

                  {examSubmitError && (
                    <div
                      style={{
                        padding: "12px 16px",
                        background: "#fef2f2",
                        border: "1px solid #fecaca",
                        borderRadius: "12px",
                        color: "#b91c1c",
                        fontSize: "14px",
                        fontWeight: "700",
                        marginBottom: "18px",
                      }}
                    >
                      {examSubmitError}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      className="btn outline"
                      onClick={() => setConfirmSubmit(false)}
                      disabled={submittingExam}
                      style={{
                        padding: "10px 20px",
                        borderRadius: "12px",
                        fontSize: "14px",
                        fontWeight: "800",
                        color: "#334155",
                        borderColor: "#cbd5e1",
                        background: "#ffffff",
                        cursor: "pointer",
                      }}
                    >
                      متابعة الحل
                    </button>
                    <button
                      type="button"
                      className="btn primary"
                      onClick={handleFinalExamSubmit}
                      disabled={submittingExam}
                      style={{
                        padding: "10px 24px",
                        borderRadius: "12px",
                        fontSize: "14px",
                        fontWeight: "900",
                        background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                        color: "#ffffff",
                        border: "none",
                        boxShadow: "0 4px 16px rgba(37,99,235,0.3)",
                        cursor: "pointer",
                      }}
                    >
                      {submittingExam ? "جارٍ التسليم..." : "تأكيد التسليم ←"}
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </main>
  );
}
