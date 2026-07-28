import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../../../lib/prisma";
import { authorizeTenant, isSameOrigin } from "../../../../../../lib/api-auth";
import { notifyExamResult } from "../../../../../../lib/notifications/events";
function answerRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

const manualGradeSchema = z.object({
  attemptId: z.string().cuid(),
  scores: z.record(z.string(), z.coerce.number().min(0)),
});

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
    include: { course: { select: { title: true } }, questions: { orderBy: { order: "asc" } } },
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
    select: { score: true, percentage: true, passed: true, status: true },
  });

  const attemptsCount = allGraded.length;
  const gradedAttempts = allGraded.filter((attempt) => attempt.status === "GRADED");
  const pendingManualCount = allGraded.filter((attempt) => attempt.status === "SUBMITTED").length;
  const averagePercentage =
    attemptsCount > 0
      ? Math.round(gradedAttempts.reduce((sum, a) => sum + Number(a.percentage ?? 0), 0) / Math.max(1, gradedAttempts.length))
      : 0;
  const maxPercentage = gradedAttempts.length > 0 ? Math.max(...gradedAttempts.map((a) => Number(a.percentage ?? 0))) : 0;
  const minPercentage = gradedAttempts.length > 0 ? Math.min(...gradedAttempts.map((a) => Number(a.percentage ?? 0))) : 0;
  const passedCount = gradedAttempts.filter((a) => a.passed).length;
  const passRate = gradedAttempts.length > 0 ? Math.round((passedCount / gradedAttempts.length) * 100) : 0;

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
      pendingManualCount,
    },
    pagination: {
      page,
      limit,
      total: totalAttempts,
      totalPages: Math.ceil(totalAttempts / limit),
    },
    attempts: attempts.map((attempt) => {
      const answers = answerRecord(attempt.answers);
      const storedScores = answerRecord(answers.__manualScores);
      const essayQuestions = exam.questions.filter((question) => question.type === "ESSAY").map((question) => ({
        id: question.id,
        text: question.text,
        points: Number(question.points),
        answer: typeof answers[question.id] === "string" ? answers[question.id] : "",
        awardedPoints: typeof storedScores[question.id] === "number" ? storedScores[question.id] : 0,
      }));
      return {
        id: attempt.id,
        studentName: attempt.student.fullName,
        studentPhone: attempt.student.phone,
        score: Number(attempt.score ?? 0),
        maxScore: Number(attempt.maxScore ?? 0),
        percentage: Number(attempt.percentage ?? 0),
        passed: attempt.passed,
        status: attempt.status,
        needsManualGrading: attempt.status === "SUBMITTED" && essayQuestions.length > 0,
        essayQuestions,
        submittedAt: attempt.submittedAt?.toISOString() ?? attempt.startedAt.toISOString(),
      };
    }),
  });
}
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: examId } = await params;
  const auth = await authorizeTenant("courses.manage");
  if (!auth.ok) return auth.response;
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });

  const parsed = manualGradeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "راجع درجات الأسئلة المقالية" }, { status: 400 });

  const tenantId = auth.context.membership.tenantId;
  const attempt = await prisma.examAttempt.findFirst({
    where: { id: parsed.data.attemptId, examId, tenantId, status: "SUBMITTED" },
    include: { exam: { include: { questions: { orderBy: { order: "asc" } } } } },
  });
  if (!attempt) return NextResponse.json({ ok: false, message: "المحاولة غير موجودة أو تم تصحيحها بالفعل" }, { status: 404 });

  const answers = answerRecord(attempt.answers);
  let earnedScore = 0;
  let maxScore = 0;
  const manualScores: Record<string, number> = {};

  for (const question of attempt.exam.questions) {
    const points = Number(question.points);
    maxScore += points;
    if (question.type === "ESSAY") {
      const awarded = Math.min(points, Math.max(0, Number(parsed.data.scores[question.id] ?? 0)));
      manualScores[question.id] = awarded;
      earnedScore += awarded;
    } else {
      const rawStudentAnswer = answers[question.id];
      const studentAnswer = typeof rawStudentAnswer === "string" ? rawStudentAnswer.trim() : "";
      const correctAnswer = (typeof question.correctAnswer === "string" ? question.correctAnswer : JSON.stringify(question.correctAnswer)).trim();
      if (studentAnswer && studentAnswer === correctAnswer) earnedScore += points;
    }
  }

  const percentage = maxScore > 0 ? Math.round((earnedScore / maxScore) * 10000) / 100 : 0;
  const passed = percentage >= Number(attempt.exam.passingScore);
  const updated = await prisma.examAttempt.update({
    where: { id: attempt.id },
    data: {
      score: earnedScore,
      maxScore,
      percentage,
      passed,
      status: "GRADED",
      resultVersion: { increment: 1 },
      answers: { ...answers, __manualScores: manualScores },
    },
    select: { id: true, resultVersion: true },
  });

  await notifyExamResult({ tenantId, studentId: attempt.studentId, examId, examTitle: attempt.exam.title, attemptId: updated.id, version: updated.resultVersion }).catch(() => undefined);
  return NextResponse.json({ ok: true, result: { score: earnedScore, maxScore, percentage, passed } });
}
