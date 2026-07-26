
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, BookOpen, Search, Users } from "lucide-react";
import { CourseThumbnail } from "../../../course-thumbnail";

type CatalogCourse = {
  id: string;
  slug: string;
  title: string;
  subject: string;
  grade: "FIRST_SECONDARY" | "SECOND_SECONDARY" | "THIRD_SECONDARY";
  description: string;
  thumbnailUrl: string | null;
  price: number;
  sectionsCount: number;
  studentsCount: number;
};

const gradeOptions = [
  { value: "ALL", label: "كل الصفوف" },
  { value: "FIRST_SECONDARY", label: "الأول الثانوي" },
  { value: "SECOND_SECONDARY", label: "الثاني الثانوي" },
  { value: "THIRD_SECONDARY", label: "الثالث الثانوي" },
] as const;

const gradeLabels: Record<CatalogCourse["grade"], string> = {
  FIRST_SECONDARY: "الأول الثانوي",
  SECOND_SECONDARY: "الثاني الثانوي",
  THIRD_SECONDARY: "الثالث الثانوي",
};

export function CourseCatalogClient({
  tenantSlug,
  courses,
  isLoggedInStudent,
  enrolledCourseIds,
}: {
  tenantSlug: string;
  courses: CatalogCourse[];
  isLoggedInStudent: boolean;
  enrolledCourseIds: string[];
}) {
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState<(typeof gradeOptions)[number]["value"]>("ALL");
  const enrolledSet = useMemo(() => new Set(enrolledCourseIds), [enrolledCourseIds]);

  const filteredCourses = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return courses.filter((course) => {
      const matchesGrade = grade === "ALL" || course.grade === grade;
      const searchable = [course.title, course.subject, course.description, gradeLabels[course.grade]]
        .join(" ")
        .toLocaleLowerCase();
      return matchesGrade && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [courses, grade, query]);

  const clearFilters = () => {
    setQuery("");
    setGrade("ALL");
  };

  return (
    <div className="catalogExplorer">
      <div className="catalogToolbar" aria-label="فلترة الكورسات">
        <label className="catalogSearch">
          <Search size={19} aria-hidden="true" />
          <span className="srOnly">ابحث عن كورس</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ابحث باسم الكورس أو المادة..."
            type="search"
          />
          {query ? (
            <button type="button" onClick={() => setQuery("")} aria-label="مسح البحث">
              ×
            </button>
          ) : null}
        </label>

        <div className="catalogFilters" role="tablist" aria-label="اختيار الصف الدراسي">
          {gradeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={grade === option.value}
              className={grade === option.value ? "isActive" : ""}
              onClick={() => setGrade(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="catalogResultBar">
        <span>
          <b>{filteredCourses.length}</b> كورس متاح
        </span>
        {query || grade !== "ALL" ? (
          <button type="button" onClick={clearFilters}>
            إعادة ضبط الفلاتر
          </button>
        ) : (
          <span className="catalogHint">ابدأ بخطوة صغيرة، واستمر بثبات.</span>
        )}
      </div>

      {filteredCourses.length ? (
        <div className="catalogGrid">
          {filteredCourses.map((course, index) => {
            const isEnrolled = enrolledSet.has(course.id);
            return (
            <article className={"catalogCard catalogCardTone" + (index % 3)} key={course.id}>
              <Link className="catalogCardVisual" href={"/t/" + tenantSlug + "/courses/" + course.slug}>
                {course.thumbnailUrl ? (
                  <CourseThumbnail src={course.thumbnailUrl} alt={course.title} />
                ) : (
                  <div className="catalogAbstractArt">
                    <span>{course.subject}</span>
                    <strong>{course.subject.slice(0, 2)}</strong>
                    <i />
                    <em />
                  </div>
                )}
                <span className="catalogCardOverlay">
                  عرض التفاصيل <ArrowLeft size={16} />
                </span>
              </Link>
              <div className="catalogCardBody">
                <div className="catalogCardMeta">
                  <span>{gradeLabels[course.grade]}</span>
                  <small><Users size={14} /> {course.studentsCount.toLocaleString("en-US")} طالب</small>
                </div>
                <h3><Link href={"/t/" + tenantSlug + "/courses/" + course.slug}>{course.title}</Link></h3>
                <p>{course.description}</p>
                <div className="catalogCardFooter">
                  <div>
                    <small>سعر الاشتراك</small>
                    <b>{course.price === 0 ? "مجاني" : course.price.toLocaleString("en-US") + " ج.م"}</b>
                  </div>
                  <Link className="catalogCardAction" href={isEnrolled ? "/course?courseId=" + course.id : "/t/" + tenantSlug + "/courses/" + course.slug}>
                    {isEnrolled ? "متابعة" : isLoggedInStudent ? "استكشف الكورس" : "استكشف"} <ArrowLeft size={16} />
                  </Link>
                </div>
              </div>
            </article>
            );
          })}
        </div>
      ) : (
        <div className="catalogEmpty">
          <span><BookOpen size={28} /></span>
          <h3>لم نجد كورسات بهذه المواصفات</h3>
          <p>جرّب تغيير كلمة البحث أو اختر كل الصفوف لمشاهدة المحتوى المتاح.</p>
          <button type="button" onClick={clearFilters}>عرض كل الكورسات</button>
        </div>
      )}
    </div>
  );
}
