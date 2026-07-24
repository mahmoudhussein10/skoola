import { prisma } from "../../../lib/prisma";
import { requireSuperAdmin } from "../../../lib/auth";
import { DashboardShell } from "../../dashboard-shell";
import { PlatformSettingsForm } from "./settings-form";

export default async function SuperAdminSettingsPage() {
  const user = await requireSuperAdmin();
  const settings = await prisma.platformSettings.upsert({ where: { id: "default" }, update: {}, create: {} });
  return <DashboardShell kind="super" title="إعدادات النظام" subtitle="سياسات عامة آمنة لكل المنصات" userName={user.fullName}>
    <PlatformSettingsForm initial={{
      platformName: settings.platformName,
      supportEmail: settings.supportEmail ?? "",
      supportPhone: settings.supportPhone ?? "",
      registrationEnabled: settings.registrationEnabled,
      teacherRegistrationEnabled: settings.teacherRegistrationEnabled,
      maintenanceMode: settings.maintenanceMode,
      requireAdminApproval: settings.requireAdminApproval,
      maxDevicesPerStudent: settings.maxDevicesPerStudent,
      defaultTenantStatus: settings.defaultTenantStatus as "TRIAL" | "ACTIVE" | "SUSPENDED" | "DISABLED",
      maxUploadSizeMb: settings.maxUploadSizeMb,
      allowedUploadTypes: Array.isArray(settings.allowedUploadTypes) ? settings.allowedUploadTypes.filter((value): value is string => typeof value === "string") : [],
    }} />
  </DashboardShell>;
}