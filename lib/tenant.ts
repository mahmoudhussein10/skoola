import { notFound } from "next/navigation";
import { prisma } from "./prisma";
import { subscriptionNeedsLifecycleSync, syncTenantSubscriptionState } from "./subscriptions";

export { assertTenantAccess, tenantStoragePath, tenantWhere } from "./tenant-security";

export async function getPublicTenant(slug: string) {
  if (!slug) return null;
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    include: {
      theme: true,
      settings: true,
      subscriptions: { select: { status: true, trialEndsAt: true, currentPeriodEnd: true, gracePeriodEndsAt: true, pendingPlanId: true, pendingDowngradeAt: true } },
    },
  });
  if (!tenant) return null;
  const subscription = tenant.subscriptions[0];
  const synced = subscription && subscriptionNeedsLifecycleSync(subscription) ? await syncTenantSubscriptionState(tenant.id) : null;
  return synced ? { ...tenant, status: synced.tenantStatus } : tenant;
}

export async function requirePublicTenant(slug: string) {
  const tenant = await getPublicTenant(slug);
  if (!tenant || tenant.status === "SUSPENDED" || tenant.status === "DISABLED" || tenant.status === "ARCHIVED") {
    notFound();
  }
  return tenant;
}
