"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  HelpCircle,
  FileText,
  Save,
  X,
  Search,
  Users,
  XCircle,
} from "lucide-react";

type ExamSummary = {
  id: string;
  title: string;
  courseTitle: string;
  durationMinutes: number;
  passingScore: number;
  questionsCount: number;
  attemptsCount: number;
  status: string;
};

type StudentAttempt = {
  id: string;
  studentName: string;
  studentPhone: string;
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean | null;
  status: "SUBMITTED" | "GRADED";
  needsManualGrading: boolean;
  essayQuestions: Array<{ id: string; text: string; points: number; answer: string; awardedPoints: number }>;
  submittedAt: string;
};

type Analytics = {
  attemptsCount: number;
  averagePercentage: number;
  maxPercentage: number;
  minPercentage: number;
  passedCount: number;
  passRate: number;
  pendingManualCount: number;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export function TeacherExamsClient({
  examsList,
  selectedExamId,
}: {
  examsList: ExamSummary[];
  selectedExamId?: string;
}) {
  const [activeExamId, setActiveExamId] = useState<string>(
    selectedExamId || examsList[0]?.id || ""
  );

  const [query, setQuery] = useState("");
  const [filterPassed, setFilterPassed] = useState<string>("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [gradingAttempt, setGradingAttempt] = useState<StudentAttempt | null>(null);
  const [manualScores, setManualScores] = useState<Record<string, number>>({});
  const [gradingSaving, setGradingSaving] = useState(false);
  const [gradingMessage, setGradingMessage] = useState("");

  const [data, setData] = useState<{
    exam?: { id: string; title: string; courseTitle: string; passingScore: number };
    analytics?: Analytics;
    pagination?: Pagination;
    attempts?: StudentAttempt[];
  } | null>(null);

  useEffect(() => {
    if (!activeExamId) return;

    async function fetchResults() {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "15");
      if (query) params.set("query", query);
      if (filterPassed) params.set("passed", filterPassed);

      const res = await fetch(`/api/teacher/exams/${activeExamId}/results?${params.toString()}`);
      setLoading(false);

      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    }

    fetchResults();
  }, [activeExamId, page, query, filterPassed, refreshKey]);

  function openManualGrading(attempt: StudentAttempt) {
    setGradingAttempt(attempt);
    setManualScores(Object.fromEntries(attempt.essayQuestions.map((question) => [question.id, question.awardedPoints])));
    setGradingMessage("");
  }

  async function saveManualGrading(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!gradingAttempt || !activeExamId) return;
    setGradingSaving(true);
    setGradingMessage("");
    const response = await fetch(`/api/teacher/exams/${activeExamId}/results`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ attemptId: gradingAttempt.id, scores: manualScores }),
    });
    const result = await response.json().catch(() => null);
    setGradingSaving(false);
    if (!response.ok) {
      setGradingMessage(result?.message ?? "تعذر حفظ التصحيح، حاول مرة أخرى.");
      return;
    }
    setGradingAttempt(null);
    setRefreshKey((value) => value + 1);
  }
  const activeExamMeta = examsList.find((e) => e.id === activeExamId);

  return (
    <div className="teacherExamsWorkspace">
      {/* Top Filter Bar */}
      <div className="examsToolbar">
        <label className="selectLabel">
          <b>اختر الامتحان للمعاينة:</b>
          <select
            value={activeExamId}
            onChange={(e) => {
              setActiveExamId(e.target.value);
              setPage(1);
            }}
          >
            {examsList.map((e) => (
              <option value={e.id} key={e.id}>
                {e.title} ({e.courseTitle}) - {e.attemptsCount} محاولات
              </option>
            ))}
          </select>
        </label>
      </div>

      {activeExamMeta ? (
        <>
          {/* Analytics KPI Cards */}
          <div className="analyticsGrid">
            <article className="kpiCard">
              <span className="icon blue">
                <Users size={20} />
              </span>
              <div>
                <small>إجمالي محاولات الطلاب</small>
                <b>{(data?.analytics?.attemptsCount ?? activeExamMeta.attemptsCount).toLocaleString("en-US")}</b>
              </div>
            </article>

            <article className="kpiCard">
              <span className="icon green">
                <CheckCircle2 size={20} />
              </span>
              <div>
                <small>نسبة النجاح العامة</small>
                <b>{data?.analytics?.passRate ?? 0}%</b>
              </div>
            </article>

            <article className="kpiCard">
              <span className="icon violet">
                <HelpCircle size={20} />
              </span>
              <div>
                <small>متوسط الدرجات</small>
                <b>{data?.analytics?.averagePercentage ?? 0}%</b>
              </div>
            </article>

            <article className="kpiCard">
              <span className="icon orange">
                <Clock size={20} />
              </span>
              <div>
                <small>أعلى / أقل نسبة</small>
                <b>
                  {data?.analytics?.maxPercentage ?? 0}% / {data?.analytics?.minPercentage ?? 0}%
                </b>
              </div>
            </article>
          </div>

          {/* Search & Filter Controls */}
          <div className="resultsHeader">
            <h3>قائمة محاولات الطلاب</h3>

            <div className="filtersRow">
              <div className="searchBox dashboardSearchControl">
                <Search size={16} />
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="ابحث باسم الطالب أو رقم الهاتف..."
                />
              </div>

              <select
                value={filterPassed}
                onChange={(e) => {
                  setFilterPassed(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">جميع الحالات</option>
                <option value="true">الناجحون فقط</option>
                <option value="false">الراسبون فقط</option>
              </select>
            </div>
          </div>

          {/* Results Table */}
          <div className="tableContainer">
            {loading ? (
              <div className="loadingState">جارٍ تحميل النتائج...</div>
            ) : data?.attempts && data.attempts.length > 0 ? (
              <table className="resultsTable">
                <thead>
                  <tr>
                    <th>اسم الطالب</th>
                    <th>رقم الهاتف</th>
                    <th>الدرجة المحققة</th>
                    <th>النسبة المئوية</th>
                    <th>حالة النجاح</th>
                    <th>تاريخ المحاولة</th>
                    <th>الإجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {data.attempts.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <b>{item.studentName}</b>
                      </td>
                      <td dir="ltr">{item.studentPhone}</td>
                      <td>
                        {item.score} / {item.maxScore}
                      </td>
                      <td>
                        <b>{item.percentage}%</b>
                      </td>
                      <td>
                        <span className={`passTag ${item.status === "SUBMITTED" ? "pending" : item.passed ? "pass" : "fail"}`}>
                          {item.status === "SUBMITTED" ? <><Clock size={14}/> بانتظار التصحيح</> : item.passed ? <><CheckCircle2 size={14}/> ناجح</> : <><XCircle size={14}/> راسب</>}
                        </span>
                      </td>
                      <td>{new Date(item.submittedAt).toLocaleDateString("ar-EG")}</td>
                      <td>{item.needsManualGrading ? <button type="button" className="btn sm primary" onClick={() => openManualGrading(item)}>تصحيح المقالي</button> : <span className="gradingComplete">تم التصحيح</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="emptyState">
                <HelpCircle size={32} />
                <h4>لا توجد نتائج محاولات لهذا الامتحان حتى الآن</h4>
                <p>تظهر النتائج فور قيام الطلاب بحل الامتحان وتكون مرتبطة بحساباتهم الحقيقية.</p>
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          {data?.pagination && data.pagination.totalPages > 1 ? (
            <div className="paginationRow">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronRight size={16} /> السابق
              </button>
              <span>
                صفحة {data.pagination.page} من {data.pagination.totalPages}
              </span>
              <button
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                التالي <ChevronLeft size={16} />
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="emptyState">
          <HelpCircle size={32} />
          <h4>لا توجد امتحانات مقامة في منصتك</h4>
          <p>يمكنك إنشاء امتحان جديد من صفحة إدارة محتوى الكورس.</p>
        </div>
      )}
      {gradingAttempt && typeof document !== "undefined" ? createPortal(
        <div className="manualGradingOverlay" onClick={() => setGradingAttempt(null)}>
          <form className="manualGradingSheet" onSubmit={saveManualGrading} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="manual-grading-title">
            <header><div><span>تصحيح يدوي</span><h3 id="manual-grading-title">إجابات {gradingAttempt.studentName}</h3></div><button type="button" onClick={() => setGradingAttempt(null)} aria-label="إغلاق"><X size={19}/></button></header>
            <div className="manualGradingBody">
              <div className="manualGradingIntro"><FileText size={20}/><p>راجع كل إجابة وحدد درجتها من الحد الأقصى. الأسئلة الموضوعية محسوبة تلقائيًا.</p></div>
              {gradingAttempt.essayQuestions.map((question, index) => (
                <article key={question.id} className="manualEssayCard">
                  <div><span>سؤال {index + 1}</span><b>{question.text}</b></div>
                  <blockquote>{question.answer || "لم يكتب الطالب إجابة."}</blockquote>
                  <label>درجة السؤال من {question.points}<input type="number" min="0" max={question.points} step="0.5" value={manualScores[question.id] ?? 0} onChange={(event) => setManualScores((scores) => ({ ...scores, [question.id]: Number(event.target.value) }))}/></label>
                </article>
              ))}
              {gradingMessage ? <p className="formError">{gradingMessage}</p> : null}
            </div>
            <footer><button type="button" className="btn outline" onClick={() => setGradingAttempt(null)}>إلغاء</button><button className="btn primary" disabled={gradingSaving}><Save size={16}/>{gradingSaving ? "جارٍ الحفظ..." : "حفظ النتيجة النهائية"}</button></footer>
          </form>
        </div>, document.body
      ) : null}
    </div>
  );
}
