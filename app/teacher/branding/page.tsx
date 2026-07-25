import { requirePermission } from "../../../lib/auth";
import { DashboardShell } from "../../dashboard-shell";
import { BrandAssetUpload } from "./theme-editor";

export default async function BrandingPage() {
  const context = await requirePermission("tenant.branding.manage");
  const theme = context.membership.tenant.theme!;
  return <DashboardShell kind="teacher" title="صور الأكاديمية" subtitle="حدّث الشعار وصورة الواجهة وصورة المدرس التي تظهر لطلابك." userName={context.user.fullName} tenantSlug={context.membership.tenant.slug} supportMode={context.supportMode}><BrandAssetUpload currentLogo={context.membership.tenant.logoUrl} currentHero={theme.heroImageUrl} currentPortrait={theme.teacherPortraitUrl} /></DashboardShell>;
}