import { notFound } from "next/navigation";
import { prisma } from "./prisma";
import { syncTenantSubscriptionState } from "./subscriptions";

export { assertTenantAccess, tenantStoragePath, tenantWhere } from "./tenant-security";

export async function getPublicTenant(slug: string) {
  if (!slug) return null;
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    include: { theme: true, settings: true },
  });
  if (!tenant) return null;
  const synced = await syncTenantSubscriptionState(tenant.id);
  return synced ? { ...tenant, status: synced.tenantStatus } : tenant;
}

export async function requirePublicTenant(slug: string) {
  const tenant = await getPublicTenant(slug);
  if (!tenant || tenant.status === "SUSPENDED" || tenant.status === "DISABLED" || tenant.status === "ARCHIVED") {
    notFound();
  }
  return tenant;
}
