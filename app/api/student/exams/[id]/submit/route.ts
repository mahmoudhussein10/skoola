import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../../../lib/prisma";
import { authorizeStudentSubscription } from "../../../../../../lib/api-auth";
import { isSameOrigin } from "../../../../../../lib/api-auth";
import { notifyExamResult } from "../../../../../../lib/notifications/events";

const submitSchema = z.object({
  attemptId: z.string().cuid().optional(),
  answers: z.record(z.string(), z.string()), // questionId -> student selected answer text
  startedAt: z.string().datetime().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: examId } = await params;
  const authorization = await authorizeStudentSubscription();
  if (!authorization.ok) return authorization.response;
  const auth = authorization.context;
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });

  const tenantId = auth.membership.tenantId;
  const studentId = auth.user.id;

  const parsed = submitSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "بيانات الإجابة غير صالحة" }, { status: 400 });
  }

  const exam = await prisma.exam.findFirst({
    where: { id: examId, tenantId, status: "PUBLISHED" },
    include: {
      questions: {
        orderBy: { order: "asc" },
      },
      course: { select: { id: true } },
    },
  });

  if (!exam) {
    return NextResponse.json({ ok: false, message: "الامتحان غير موجود أو غير منشور" }, { status: 404 });
  }

  // Verify dates if configured
  const now = new Date();
  if (exam.startDate && now < exam.startDate) {
    return NextResponse.json({ ok: false, message: "لم يبدأ موعد الامتحان بعد" }, { status: 403 });
  }
  if (exam.endDate && now > exam.endDate) {
    return NextResponse.json({ ok: false, message: "انتهى موعد تقديم هذا الامتحان" }, { status: 403 });
  }

  // Verify enrollment for students
  if (auth.user.role === "STUDENT") {
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        tenantId,
        studentId,
        courseId: exam.courseId,
        status: { in: ["ACTIVE", "COMPLETED"] },
      },
    });
    if (!enrollment) {
      return NextResponse.json({ ok: false, message: "يلزم اشتراك نشط في الكورس لأداء الامتحان" }, { status: 403 });
    }
  }

  // Every student gets exactly one submitted attempt, regardless of legacy exam settings.
  const existingAttempt = await prisma.examAttempt.findFirst({
    where: { tenantId, examId, studentId, status: { in: ["SUBMITTED", "GRADED"] } },
    select: { id: true },
  });
  if (existingAttempt) {
    return NextResponse.json({ ok: false, message: "لقد استخدمت محاولتك الوحيدة لهذا الاختبار، ولا يمكن إعادته مرة أخرى." }, { status: 403 });
  }

  const studentAnswers = parsed.data.answers;

  // Server-side auto-grading
  let earnedScore = 0;
  let totalMaxScore = 0;
  let correctCount = 0;
  let wrongCount = 0;

  const hasEssayQuestions = exam.questions.some((question) => question.type === "ESSAY");
  const questionResults = exam.questions.map((q) => {
    const qPoints = Number(q.points);
    totalMaxScore += qPoints;
    const studentAns = (studentAnswers[q.id] ?? "").trim();
    const isEssay = q.type === "ESSAY";
    const correctAns = isEssay ? "" : (typeof q.correctAnswer === "string" ? q.correctAnswer : JSON.stringify(q.correctAnswer)).trim();
    const isCorrect = !isEssay && studentAns !== "" && studentAns === correctAns;

    if (!isEssay) {
      if (isCorrect) {
        earnedScore += qPoints;
        correctCount++;
      } else {
        wrongCount++;
      }
    }

    return {
      id: q.id,
      text: q.text,
      type: q.type,
      points: qPoints,
      studentAnswer: studentAns,
      isCorrect: isEssay ? undefined : isCorrect,
      requiresManualGrading: isEssay,
      correctAnswer: !isEssay && exam.showAnswersAfterSubmit ? correctAns : undefined,
      explanation: !isEssay && exam.showAnswersAfterSubmit ? q.explanation : undefined,
    };
  });
  const percentage = totalMaxScore > 0 ? Math.round((earnedScore / totalMaxScore) * 10000) / 100 : 0;
  const passed = percentage >= Number(exam.passingScore);

  const startTime = parsed.data.startedAt ? new Date(parsed.data.startedAt) : now;

  // Serializable isolation closes the double-submit race without changing the database model.
  let attempt: { id: string; resultVersion: number };
  try {
    attempt = await prisma.$transaction(async (tx) => {
      const alreadySubmitted = await tx.examAttempt.findFirst({
        where: { tenantId, examId, studentId, status: { in: ["SUBMITTED", "GRADED"] } },
        select: { id: true, resultVersion: true },
      });
      if (alreadySubmitted) throw new Error("EXAM_ATTEMPT_ALREADY_USED");

      const record = await tx.examAttempt.create({
        data: {
          tenantId,
          examId,
          studentId,
          score: earnedScore,
          maxScore: totalMaxScore,
          percentage,
          passed: hasEssayQuestions ? null : passed,
          startedAt: startTime,
          submittedAt: now,
          status: hasEssayQuestions ? "SUBMITTED" : "GRADED",
          answers: studentAnswers,
        },
        select: { id: true, resultVersion: true },
      });

      await tx.activityLog.create({
        data: {
          tenantId,
          actorId: studentId,
          action: "حل امتحان",
          entityType: "Exam",
          entityId: examId,
          metadata: { score: earnedScore, percentage, passed: hasEssayQuestions ? null : passed, manualReviewRequired: hasEssayQuestions },
        },
      });
      return record;
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if ((error instanceof Error && error.message === "EXAM_ATTEMPT_ALREADY_USED") || code === "P2034") {
      return NextResponse.json({ ok: false, message: "لقد استخدمت محاولتك الوحيدة لهذا الاختبار، ولا يمكن إعادته مرة أخرى." }, { status: 403 });
    }
    throw error;
  }

  const responseData: Record<string, unknown> = {
    ok: true,
    attemptId: attempt.id,
    showResultImmediately: exam.showResultImmediately && !hasEssayQuestions,
    manualReviewRequired: hasEssayQuestions,
  };

  if (exam.showResultImmediately && !hasEssayQuestions) {
    await notifyExamResult({ tenantId, studentId, examId, examTitle: exam.title, attemptId: attempt.id, version: attempt.resultVersion }).catch(() => undefined);
    responseData.result = {
      score: earnedScore,
      maxScore: totalMaxScore,
      percentage,
      passed,
      passingScore: Number(exam.passingScore),
      correctCount,
      wrongCount,
      totalQuestions: exam.questions.length,
      submittedAt: now.toISOString(),
      attemptsRemaining: 0,
    };

    if (exam.showAnswersAfterSubmit) {
      responseData.questions = questionResults;
    }
  }

  return NextResponse.json(responseData);
}
