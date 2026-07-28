import { getAuthenticatedTeacherOnboardingProgress } from "../../lib/teacher-onboarding-progress";
import { OnboardingJourneyUnavailable, TeacherOnboardingJourney } from "./onboarding-journey";

export async function TeacherOnboardingJourneySection({tenantSlug}:{tenantSlug:string}) {
  const progress=await getAuthenticatedTeacherOnboardingProgress();
  if(!progress) return <OnboardingJourneyUnavailable/>;
  return <TeacherOnboardingJourney progress={progress} tenantSlug={tenantSlug}/>;
}