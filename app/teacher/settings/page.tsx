import { requirePermission } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { DashboardShell } from "../../dashboard-shell";
import { PaymentSettingsForm } from "./payment-settings-form";
import { TenantSettingsForm } from "./settings-form";

export default async function TenantSettingsPage() {
  const context = await requirePermission("tenant.settings.manage");
  const tenant = context.membership.tenant;
  const settings = tenant.settings;
  const payment = await prisma.teacherBillingSettings.findUnique({
    where: { tenantId: context.membership.tenantId },
    select: {
      vodafoneCashEnabled: true,
      vodafoneCashNumber: true,
      instaPayEnabled: true,
      instaPayAddress: true,
      bankTransferEnabled: true,
      bankName: true,
      bankAccountNumber: true,
      bankIban: true,
      accountHolderName: true,
      paymentInstructions: true,
    },
  });
  const links = settings?.socialLinks && typeof settings.socialLinks === "object" && !Array.isArray(settings.socialLinks) ? settings.socialLinks as Record<string, unknown> : {};

  return <DashboardShell kind="teacher" title="إعدادات المنصة" subtitle="بيانات الصفحة العامة والتواصل والدفع" userName={context.user.fullName} tenantSlug={tenant.slug} supportMode={context.supportMode}>
    <div className="settingsPageStack">
      <TenantSettingsForm initial={{
        platformName: settings?.platformName ?? tenant.name,
        heroTitle: settings?.heroTitle ?? "",
        description: settings?.description ?? tenant.description ?? "",
        supportPhone: settings?.supportPhone ?? tenant.contactPhone ?? "",
        supportEmail: settings?.supportEmail ?? tenant.contactEmail ?? "",
        facebook: typeof links.facebook === "string" ? links.facebook : "",
        youtube: typeof links.youtube === "string" ? links.youtube : "",
        whatsapp: typeof links.whatsapp === "string" ? links.whatsapp : "",
        publicPageLive: settings?.publicPageLive ?? true,
      }} />
      <PaymentSettingsForm initial={{
        vodafoneCashEnabled: payment?.vodafoneCashEnabled ?? false,
        vodafoneCashNumber: payment?.vodafoneCashNumber ?? "",
        instaPayEnabled: payment?.instaPayEnabled ?? false,
        instaPayAddress: payment?.instaPayAddress ?? "",
        bankTransferEnabled: payment?.bankTransferEnabled ?? false,
        bankName: payment?.bankName ?? "",
        bankAccountNumber: payment?.bankAccountNumber ?? "",
        bankIban: payment?.bankIban ?? "",
        accountHolderName: payment?.accountHolderName ?? "",
        paymentInstructions: payment?.paymentInstructions ?? "",
      }} />
    </div>
  </DashboardShell>;
}