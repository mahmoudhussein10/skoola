import type { Prisma } from "@prisma/client";

export type OnboardingStepId = "academy_logo"|"teacher_photo"|"academy_description"|"first_course"|"first_lesson"|"first_exam"|"academy_published"|"first_student"|"first_lesson_view"|"first_exam_attempt";
export type OnboardingStepCategory = "identity"|"content"|"publishing"|"student_activity";
export type OnboardingStep = { id:OnboardingStepId; label:string; description:string; completed:boolean; order:number; href:string; category:OnboardingStepCategory };
export type OnboardingProgress = { totalSteps:number; completedSteps:number; progressPercentage:number; isCompleted:boolean; currentStep:OnboardingStep|null; nextRecommendedStep:OnboardingStep|null; steps:OnboardingStep[] };
export const ONBOARDING_RETURN_PATH = "/teacher#teacher-onboarding-title";
export type OnboardingFacts = { hasAcademyLogo:boolean; hasTeacherPhoto:boolean; hasAcademyDescription:boolean; hasCourse:boolean; hasLesson:boolean; hasExam:boolean; isAcademyPublished:boolean; hasStudent:boolean; hasLessonView:boolean; hasExamAttempt:boolean };

const definitions: ReadonlyArray<Omit<OnboardingStep,"completed">&{fact:keyof OnboardingFacts}> = [
  {id:"academy_logo",label:"أضف شعار الأكاديمية",description:"ارفع شعارًا واضحًا يظهر في واجهة أكاديميتك.",order:1,href:"/teacher/branding",category:"identity",fact:"hasAcademyLogo"},
  {id:"teacher_photo",label:"أضف صورتك الشخصية",description:"أضف صورتك التي ستظهر للطلاب في الصفحة العامة.",order:2,href:"/teacher/branding",category:"identity",fact:"hasTeacherPhoto"},
  {id:"academy_description",label:"اكتب وصف الأكاديمية",description:"عرّف الطلاب بما تقدمه أكاديميتك باختصار.",order:3,href:"/teacher/settings",category:"identity",fact:"hasAcademyDescription"},
  {id:"first_course",label:"أنشئ أول كورس",description:"أضف أول كورس حقيقي إلى أكاديميتك.",order:4,href:"/teacher/courses",category:"content",fact:"hasCourse"},
  {id:"first_lesson",label:"أضف أول درس",description:"أضف درسًا إلى أحد كورسات الأكاديمية.",order:5,href:"/teacher/courses",category:"content",fact:"hasLesson"},
  {id:"first_exam",label:"أنشئ أول امتحان",description:"أنشئ امتحانًا لقياس فهم الطلاب.",order:6,href:"/teacher/courses",category:"content",fact:"hasExam"},
  {id:"academy_published",label:"انشر أكاديميتك",description:"اجعل الصفحة العامة متاحة للطلاب.",order:7,href:"/teacher/settings",category:"publishing",fact:"isAcademyPublished"},
  {id:"first_student",label:"استقبل أول طالب",description:"تكتمل عند انضمام أول طالب فعلي إلى الأكاديمية.",order:8,href:"/teacher/students",category:"student_activity",fact:"hasStudent"},
  {id:"first_lesson_view",label:"أول طالب يشاهد درسًا",description:"تكتمل عند تسجيل أول مشاهدة درس لطالب فعلي.",order:9,href:"/teacher/reports",category:"student_activity",fact:"hasLessonView"},
  {id:"first_exam_attempt",label:"أول طالب يحل امتحانًا",description:"تكتمل عند بدء أول محاولة امتحان لطالب فعلي.",order:10,href:"/teacher/exams",category:"student_activity",fact:"hasExamAttempt"},
];
export function buildOnboardingProgress(facts:OnboardingFacts):OnboardingProgress {
  const steps=definitions.map(({fact,...step})=>({...step,completed:facts[fact]}));
  const completedSteps=steps.filter(step=>step.completed).length;
  const nextRecommendedStep=steps.find(step=>!step.completed)??null;
  return {totalSteps:steps.length,completedSteps,progressPercentage:completedSteps*10,isCompleted:completedSteps===steps.length,currentStep:nextRecommendedStep,nextRecommendedStep,steps};
}

export function buildOnboardingTenantQuery(tenantId:string) {
  return {where:{id:tenantId},select:{status:true,logoUrl:true,description:true,owner:{select:{avatarUrl:true,deletedAt:true}},theme:{select:{teacherPortraitUrl:true}},settings:{select:{description:true,publicPageLive:true}},_count:{select:{
    courses:true,lessons:true,exams:true,
    members:{where:{role:"STUDENT",status:"ACTIVE",user:{deletedAt:null}}},
    videoProgress:{where:{student:{deletedAt:null,memberships:{some:{tenantId,role:"STUDENT",status:"ACTIVE"}}}}},
    examAttempts:{where:{student:{deletedAt:null,memberships:{some:{tenantId,role:"STUDENT",status:"ACTIVE"}}}}},
  }}}} satisfies Prisma.TenantFindUniqueArgs;
}
export function parseOnboardingStep(value:string|undefined):OnboardingStepId|undefined {
  return definitions.some(step=>step.id===value)?value as OnboardingStepId:undefined;
}
export function onboardingStepHref(step:Pick<OnboardingStep,"id"|"href">):string {
  const separator=step.href.includes("?")?"&":"?";
  return `${step.href}${separator}onboarding=${step.id}`;
}
