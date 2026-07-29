import "server-only";
import { createNotification } from "@/lib/notifications/service";

export function notifyLessonPublished(input:{tenantId:string;courseId:string;courseTitle:string;lessonId:string;lessonTitle:string;version:number}){
  return createNotification({tenantId:input.tenantId,audience:{kind:"COURSE_STUDENTS",courseId:input.courseId},type:"LESSON_PUBLISHED",category:"COURSE_CONTENT",title:"محاضرة جديدة متاحة 🎬",message:`تم نشر محاضرة «${input.lessonTitle}» في كورس «${input.courseTitle}».`,link:`/course?courseId=${encodeURIComponent(input.courseId)}&lessonId=${encodeURIComponent(input.lessonId)}`,priority:"HIGH",source:"COURSE",idempotencyKey:`lesson-published:${input.lessonId}:${input.version}`});
}
export function notifyExamPublished(input:{tenantId:string;courseId:string;courseTitle:string;examId:string;examTitle:string;version:number}){
  return createNotification({tenantId:input.tenantId,audience:{kind:"COURSE_STUDENTS",courseId:input.courseId},type:"EXAM_PUBLISHED",category:"EXAMS",title:"امتحان جديد متاح 📝",message:`تم نشر امتحان «${input.examTitle}» في كورس «${input.courseTitle}».`,link:`/course?courseId=${encodeURIComponent(input.courseId)}`,priority:"HIGH",source:"EXAMS",idempotencyKey:`exam-published:${input.examId}:${input.version}`});
}
export function notifyExamResult(input:{tenantId:string;studentId:string;examId:string;examTitle:string;attemptId:string;version:number}){
  return createNotification({tenantId:input.tenantId,audience:{kind:"USER",userId:input.studentId},type:"EXAM_RESULT_RELEASED",category:"RESULTS",title:"نتيجة الامتحان ظهرت ✅",message:`نتيجتك في امتحان «${input.examTitle}» متاحة دلوقتي.`,link:`/course?examId=${encodeURIComponent(input.examId)}`,priority:"HIGH",source:"EXAMS",idempotencyKey:`exam-result-released:${input.attemptId}:${input.version}`});
}
export function notifyEnrollmentRequest(input:{tenantId:string;studentId:string;studentName:string}){
  return createNotification({tenantId:input.tenantId,audience:{kind:"ACADEMY_STAFF"},type:"ENROLLMENT_REQUESTED",category:"ENROLLMENTS",title:"طلب اشتراك جديد 👤",message:`وصل طلب اشتراك جديد من ${input.studentName}.`,link:"/teacher/students",priority:"HIGH",source:"ENROLLMENTS",idempotencyKey:`enrollment-request:${input.studentId}:1`});
}
export function notifyEnrollmentAccepted(input:{tenantId:string;studentId:string;courseId:string;courseName:string;enrollmentId:string}){
  return createNotification({tenantId:input.tenantId,audience:{kind:"USER",userId:input.studentId},type:"ENROLLMENT_ACCEPTED",category:"ENROLLMENTS",title:"تم قبول اشتراكك 🎉",message:`تم تفعيل وصولك إلى «${input.courseName}».`,link:`/course?courseId=${encodeURIComponent(input.courseId)}`,priority:"HIGH",source:"ENROLLMENTS",idempotencyKey:`enrollment-accepted:${input.enrollmentId}:1`});
}
export function notifyPaymentSubmitted(input:{tenantId:string;paymentId:string}){
  return createNotification({tenantId:input.tenantId,audience:{kind:"ACADEMY_STAFF"},type:"PAYMENT_PROOF_SUBMITTED",category:"PAYMENTS",title:"إثبات دفع جديد 💳",message:"تم رفع إثبات دفع جديد ويحتاج إلى المراجعة.",link:"/teacher/payments",priority:"HIGH",source:"PAYMENTS",idempotencyKey:`payment-proof-submitted:${input.paymentId}:1`});
}
export function notifyPaymentDecision(input:{tenantId:string;studentId:string;paymentId:string;version:number;approved:boolean;courseId:string}){
  return createNotification({tenantId:input.tenantId,audience:{kind:"USER",userId:input.studentId},type:input.approved?"PAYMENT_APPROVED":"PAYMENT_REJECTED",category:"PAYMENTS",title:input.approved?"تم تأكيد الدفع ✅":"تعذر تأكيد الدفع",message:input.approved?"تم قبول عملية الدفع وتحديث حالة اشتراكك.":"راجع بيانات الدفع وحاول إرسال الطلب مرة أخرى.",link:input.approved?`/course?courseId=${encodeURIComponent(input.courseId)}`:"/dashboard",priority:"HIGH",source:"PAYMENTS",idempotencyKey:input.approved?`payment-approved:${input.paymentId}:${input.version}`:`payment-rejected:${input.paymentId}:${input.version}`});
}

export function notifySubscriptionApproved(input:{tenantId:string;requestId:string;planName:string;periodEnd:Date}){
  return createNotification({tenantId:input.tenantId,audience:{kind:"ACADEMY_STAFF"},type:"SUBSCRIPTION_APPROVED",category:"ADMINISTRATIVE",title:"تم تفعيل اشتراك الأكاديمية",message:`تم اعتماد اشتراك ${input.planName}. الاشتراك متاح حتى ${input.periodEnd.toLocaleDateString("ar-EG")}.`,link:"/teacher/subscription",priority:"HIGH",source:"SUBSCRIPTIONS",idempotencyKey:`subscription-approved:${input.requestId}`});
}
export function notifySubscriptionReceiptReview(input:{tenantId:string;requestId:string;reason:string}){
  return createNotification({tenantId:input.tenantId,audience:{kind:"ACADEMY_STAFF"},type:"SUBSCRIPTION_RECEIPT_REVIEW",category:"ADMINISTRATIVE",title:"مطلوب إيصال أوضح",message:input.reason,link:"/teacher/subscription",priority:"HIGH",source:"SUBSCRIPTIONS",idempotencyKey:`subscription-receipt-review:${input.requestId}`});
}
export function notifySubscriptionLifecycle(input:{tenantId:string;subscriptionId:string;kind:"WARNING"|"GRACE"|"EXPIRED"|"TRIAL_EXPIRED";days?:number;graceDays?:number;cycleKey:string}){
  const content=input.kind==="WARNING"?{type:"SUBSCRIPTION_EXPIRY_WARNING",title:`متبقي ${input.days} يوم على انتهاء الاشتراك`,message:"جدّد الآن لتستمر الأكاديمية بدون انقطاع."}:input.kind==="GRACE"?{type:"SUBSCRIPTION_GRACE_STARTED",title:"بدأت فترة السماح",message:`لديك ${input.graceDays ?? 7} أيام لتجديد الاشتراك قبل إيقاف وصول الطلاب.`}:input.kind==="TRIAL_EXPIRED"?{type:"SUBSCRIPTION_TRIAL_EXPIRED",title:"انتهت التجربة المجانية",message:"اختر خطة وارفع إيصال التحويل لإعادة فتح الأكاديمية."}:{type:"SUBSCRIPTION_EXPIRED",title:"تم إيقاف الأكاديمية مؤقتًا",message:"انتهت فترة السماح. كل بياناتك محفوظة ويمكنك التجديد الآن."};
  return createNotification({tenantId:input.tenantId,audience:{kind:"ACADEMY_STAFF"},type:content.type,category:"ADMINISTRATIVE",title:content.title,message:content.message,link:"/teacher/subscription",priority:"HIGH",source:"SUBSCRIPTIONS",idempotencyKey:`subscription-lifecycle:${input.subscriptionId}:${input.kind}:${input.days ?? 0}:${input.cycleKey}`});
}
