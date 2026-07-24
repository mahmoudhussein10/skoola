import { NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";
import { authorizeTenant } from "../../../../../../lib/api-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: examId } = await params;
  const auth = await authorizeTenant("courses.manage");
  if (!auth.ok) return auth.response;

  const tenantId = auth.context.membership.tenantId;
  const { searchParams } = new URL(request.url);

  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(5, Number.parseInt(searchParams.get("limit") ?? "20", 10)));
  const query = searchParams.get("query")?.trim() ?? "";
  const filterPassed = searchParams.get("passed"); // "true" | "false" | null

  const exam = await prisma.exam.findFirst({
    where: { id: examId, tenantId },
    include: { course: { select: { title: true } } },
  });

  if (!exam) {
    return NextResponse.json({ ok: false, message: "الامتحان غير موجود" }, { status: 404 });
  }

  const whereCondition = {
    tenantId,
    examId,
    status: { in: ["SUBMITTED" as const, "GRADED" as const] },
    ...(filterPassed === "true" ? { passed: true } : filterPassed === "false" ? { passed: false } : {}),
    ...(query
      ? {
          student: {
            OR: [
              { fullName: { contains: query, mode: "insensitive" as const } },
              { phone: { contains: query } },
            ],
          },
        }
      : {}),
  };

  const [totalAttempts, attempts] = await Promise.all([
    prisma.examAttempt.count({ where: whereCondition }),
    prisma.examAttempt.findMany({
      where: whereCondition,
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            phone: true,
          },
        },
      },
      orderBy: { submittedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  // Overall analytics for this exam
  const allGraded = await prisma.examAttempt.findMany({
    where: { tenantId, examId, status: { in: ["SUBMITTED", "GRADED"] } },
    select: { score: true, percentage: true, passed: true },
  });

  const attemptsCount = allGraded.length;
  const averagePercentage =
    attemptsCount > 0
      ? Math.round(allGraded.reduce((sum, a) => sum + Number(a.percentage ?? 0), 0) / attemptsCount)
      : 0;
  const maxPercentage = attemptsCount > 0 ? Math.max(...allGraded.map((a) => Number(a.percentage ?? 0))) : 0;
  const minPercentage = attemptsCount > 0 ? Math.min(...allGraded.map((a) => Number(a.percentage ?? 0))) : 0;
  const passedCount = allGraded.filter((a) => a.passed).length;
  const passRate = attemptsCount > 0 ? Math.round((passedCount / attemptsCount) * 100) : 0;

  return NextResponse.json({
    ok: true,
    exam: {
      id: exam.id,
      title: exam.title,
      courseTitle: exam.course.title,
      passingScore: Number(exam.passingScore),
    },
    analytics: {
      attemptsCount,
      averagePercentage,
      maxPercentage,
      minPercentage,
      passedCount,
      passRate,
    },
    pagination: {
      page,
      limit,
      total: totalAttempts,
      totalPages: Math.ceil(totalAttempts / limit),
    },
    attempts: attempts.map((a) => ({
      id: a.id,
      studentName: a.student.fullName,
      studentPhone: a.student.phone,
      score: Number(a.score ?? 0),
      maxScore: Number(a.maxScore ?? 0),
      percentage: Number(a.percentage ?? 0),
      passed: a.passed ?? false,
      submittedAt: a.submittedAt?.toISOString() ?? a.startedAt.toISOString(),
    })),
  });
}
