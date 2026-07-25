import { requirePermission } from "../../../lib/auth";
import { DashboardShell } from "../../dashboard-shell";
import { BrandAssetUpload, ThemeEditor, type Theme } from "./theme-editor";

const defaults = { buttonColor: "#1565f5", successColor: "#15803d", warningColor: "#b45309", dangerColor: "#dc2626", navbarColor: "#ffffff", footerColor: "#081b3a", linkColor: "#1565f5", hoverColor: "#0f4ed8", sidebarColor: "#081b3a", headingFont: "Tajawal", bodyFont: "Tajawal", buttonFont: "Tajawal", cardStyle: "ELEVATED", buttonStyle: "GRADIENT", animationStyle: "SMOOTH", heroLayout: "SPLIT", heroImagePosition: "50% 50%", heroOverlay: 18, heroCtaLabel: "أنشئ حسابك مجانًا", heroSecondaryLabel: "استكشف الكورسات", homepageSections: ["HERO", "COURSES", "FEATURES", "STATS", "FAQ", "CONTACT"] } as const;

export default async function BrandingPage() {
  const context = await requirePermission("tenant.branding.manage");
  const theme = context.membership.tenant.theme!;
  const initial: Theme = {
    ...defaults, ...theme,
    fontFamily: theme.fontFamily as Theme["fontFamily"],
    headingFont: (theme.headingFont ?? defaults.headingFont) as Theme["headingFont"],
    bodyFont: (theme.bodyFont ?? defaults.bodyFont) as Theme["bodyFont"],
    buttonFont: (theme.buttonFont ?? defaults.buttonFont) as Theme["buttonFont"],
    cardStyle: (theme.cardStyle ?? defaults.cardStyle) as Theme["cardStyle"],
    buttonStyle: (theme.buttonStyle ?? defaults.buttonStyle) as Theme["buttonStyle"],
    animationStyle: (theme.animationStyle ?? defaults.animationStyle) as Theme["animationStyle"],
    heroLayout: (theme.heroLayout ?? defaults.heroLayout) as Theme["heroLayout"],
    homepageSections: Array.isArray(theme.homepageSections) ? theme.homepageSections as unknown as Theme["homepageSections"] : [...defaults.homepageSections] as Theme["homepageSections"],
    preset: theme.preset as Theme["preset"],
  }
  return <DashboardShell kind="teacher" title="الهوية البصرية" subtitle="صمّم واجهة أكاديميتك، واعرضها لطلابك بهوية مستقلة." userName={context.user.fullName} tenantSlug={context.membership.tenant.slug} supportMode={context.supportMode}><BrandAssetUpload currentLogo={context.membership.tenant.logoUrl} currentHero={theme.heroImageUrl} currentPortrait={theme.teacherPortraitUrl} /><ThemeEditor initial={initial} tenantName={context.membership.tenant.name} /></DashboardShell>;
}