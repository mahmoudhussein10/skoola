import { requirePermission } from "../../../lib/auth";
import { DashboardShell } from "../../dashboard-shell";
import { BrandAssetUpload, ThemeEditor } from "./theme-editor";

export default async function BrandingPage() {
  const context = await requirePermission("tenant.branding.manage");
  const theme = context.membership.tenant.theme!;
  const initial = {
    primaryColor: theme.primaryColor, secondaryColor: theme.secondaryColor, accentColor: theme.accentColor, backgroundColor: theme.backgroundColor, surfaceColor: theme.surfaceColor, textColor: theme.textColor, mutedColor: theme.mutedColor, borderRadius: theme.borderRadius, buttonRadius: theme.buttonRadius, fontFamily: theme.fontFamily as "Tajawal" | "Cairo" | "Alexandria" | "Noto Kufi Arabic", preset: theme.preset as "CLASSIC_BLUE" | "PREMIUM_BLACK" | "EDUCATIONAL_GREEN" | "MODERN_PURPLE" | "ELEGANT_BURGUNDY" | "CLEAN_ORANGE" | "SKOOLA",
  };
  return <DashboardShell kind="teacher" title="الهوية البصرية" subtitle="ألوان آمنة ومحددة بدون CSS عشوائي" userName={context.user.fullName} tenantSlug={context.membership.tenant.slug} supportMode={context.supportMode}><BrandAssetUpload currentLogo={context.membership.tenant.logoUrl} /><ThemeEditor initial={initial} tenantName={context.membership.tenant.name} /></DashboardShell>;
}
