import "server-only";
import { prisma } from "./prisma";
import { buildOnboardingProgress, buildOnboardingTenantQuery, type OnboardingProgress } from "./onboarding-progress";

const hasText=(value:string|null|undefined)=>Boolean(value?.trim());

async function getTenantOnboardingProgress(tenantId:string):Promise<OnboardingProgress|null> {
  try {
    const tenant=await prisma.tenant.findUnique(buildOnboardingTenantQuery(tenantId));
    if(!tenant) return null;
    return buildOnboardingProgress({
      hasAcademyLogo:hasText(tenant.logoUrl),
      hasTeacherPhoto:hasText(tenant.theme?.teacherPortraitUrl)||(tenant.owner?.deletedAt===null&&hasText(tenant.owner.avatarUrl)),
      hasAcademyDescription:hasText(tenant.settings?.description)||hasText(tenant.description),
      hasCourse:tenant._count.courses>0,
      hasLesson:tenant._count.lessons>0,
      hasExam:tenant._count.exams>0,
      isAcademyPublished:tenant.settings?.publicPageLive===true&&(tenant.status==="TRIAL"||tenant.status==="ACTIVE"),
      hasStudent:tenant._count.members>0,
      hasLessonView:tenant._count.videoProgress>0,
      hasExamAttempt:tenant._count.examAttempts>0,
    });
  } catch(error) {
    console.error("Failed to load teacher onboarding progress",{tenantId,error:error instanceof Error?error.message:"UNKNOWN_ERROR"});
    return null;
  }
}

export async function getAuthenticatedTeacherOnboardingProgress():Promise<OnboardingProgress|null> {
  const {requireTenantMember}=await import("./auth");
  const {tenantStaffRoles}=await import("./permissions");
  const context=await requireTenantMember(tenantStaffRoles);
  return getTenantOnboardingProgress(context.membership.tenantId);
}