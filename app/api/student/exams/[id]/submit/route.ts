import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../../../lib/prisma";
import { getAuthContext } from "../../../../../../lib/auth";
import { isSameOrigin } from "../../../../../../lib/api-auth";

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
  const auth = await getAuthContext();
  if (!auth || !auth.membership) {
    return NextResponse.json({ ok: false, message: "يرجى تسجيل الدخول أولاً لتأدية الامتحان" }, { status: 401 });
  }
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

  // Check attempts count
  const existingAttemptsCount = await prisma.examAttempt.count({
    where: { tenantId, examId, studentId, status: { in: ["SUBMITTED", "GRADED"] } },
  });

  if (existingAttemptsCount >= exam.maxAttempts) {
    return NextResponse.json({ ok: false, message: `استنفدت الحد الأقصى للمحاولات المسموحة (${exam.maxAttempts})` }, { status: 403 });
  }

  const studentAnswers = parsed.data.answers;

  // Server-side auto-grading
  let earnedScore = 0;
  let totalMaxScore = 0;
  let correctCount = 0;
  let wrongCount = 0;

  const questionResults = exam.questions.map((q) => {
    const qPoints = Number(q.points);
    totalMaxScore += qPoints;
    const studentAns = (studentAnswers[q.id] ?? "").trim();
    const correctAns = (typeof q.correctAnswer === "string" ? q.correctAnswer : JSON.stringify(q.correctAnswer)).trim();

    const isCorrect = studentAns !== "" && studentAns === correctAns;
    if (isCorrect) {
      earnedScore += qPoints;
      correctCount++;
    } else {
      wrongCount++;
    }

    return {
      id: q.id,
      text: q.text,
      type: q.type,
      points: qPoints,
      studentAnswer: studentAns,
      isCorrect,
      correctAnswer: exam.showAnswersAfterSubmit ? correctAns : undefined,
      explanation: exam.showAnswersAfterSubmit ? q.explanation : undefined,
    };
  });

  const percentage = totalMaxScore > 0 ? Math.round((earnedScore / totalMaxScore) * 10000) / 100 : 0;
  const passed = percentage >= Number(exam.passingScore);

  const startTime = parsed.data.startedAt ? new Date(parsed.data.startedAt) : now;

  // Save ExamAttempt in transaction
  const attempt = await prisma.$transaction(async (tx) => {
    const record = await tx.examAttempt.create({
      data: {
        tenantId,
        examId,
        studentId,
        score: earnedScore,
        maxScore: totalMaxScore,
        percentage,
        passed,
        startedAt: startTime,
        submittedAt: now,
        status: "GRADED",
        answers: studentAnswers,
      },
    });

    await tx.activityLog.create({
      data: {
        tenantId,
        actorId: studentId,
        action: "حل امتحان",
        entityType: "Exam",
        entityId: examId,
        metadata: { score: earnedScore, percentage, passed },
      },
    });

    return record;
  });

  const responseData: Record<string, unknown> = {
    ok: true,
    attemptId: attempt.id,
    showResultImmediately: exam.showResultImmediately,
  };

  if (exam.showResultImmediately) {
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
      attemptsRemaining: exam.maxAttempts - (existingAttemptsCount + 1),
    };

    if (exam.showAnswersAfterSubmit) {
      responseData.questions = questionResults;
    }
  }

  return NextResponse.json(responseData);
}
