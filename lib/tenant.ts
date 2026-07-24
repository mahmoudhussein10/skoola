import { notFound } from "next/navigation";
import { prisma } from "./prisma";

export { assertTenantAccess, tenantStoragePath, tenantWhere } from "./tenant-security";

export async function getPublicTenant(slug: string) {
  if (!slug) return null;
  return prisma.tenant.findUnique({
    where: { slug },
    include: { theme: true, settings: true },
  });
}

export async function requirePublicTenant(slug: string) {
  const tenant = await getPublicTenant(slug);
  if (!tenant || tenant.status === "SUSPENDED" || tenant.status === "DISABLED" || tenant.status === "ARCHIVED") {
    notFound();
  }
  return tenant;
}
