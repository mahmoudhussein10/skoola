import { requirePermission } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { DashboardShell } from "../../dashboard-shell";
import { MediaLibraryClient } from "./media-library-client";

export default async function TeacherMediaPage() {
  const context = await requirePermission("media.manage");
  const tenantId = context.membership.tenantId;
  const [assets, courses] = await Promise.all([
    prisma.mediaAsset.findMany({ where: { tenantId, deletedAt: null }, include: { course: { select: { id: true, title: true } }, lesson: { select: { id: true, title: true } } }, orderBy: { createdAt: "desc" }, take: 250 }),
    prisma.course.findMany({ where: { tenantId }, select: { id: true, title: true }, orderBy: { createdAt: "desc" } }),
  ]);
  const serialized = assets.map((asset) => ({ ...asset, fileSizeBytes: asset.fileSizeBytes.toString(), createdAt: asset.createdAt.toISOString(), updatedAt: asset.updatedAt.toISOString(), deletedAt: asset.deletedAt?.toISOString() ?? null }));
  return <DashboardShell kind="teacher" title="مكتبة الوسائط" subtitle="فيديوهات وصور ومستندات أكاديميتك في مكان واحد" userName={context.user.fullName} tenantSlug={context.membership.tenant.slug} supportMode={context.supportMode}><MediaLibraryClient initialAssets={serialized} courses={courses} /></DashboardShell>;
}