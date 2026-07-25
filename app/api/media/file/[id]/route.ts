import { NextResponse } from "next/server";
import { authorizeTenant, isSameOrigin } from "../../../../../lib/api-auth";
import { prisma } from "../../../../../lib/prisma";
import { configurationMessage } from "../../../../../lib/bunny/config";
import { deleteStorageFile } from "../../../../../lib/bunny/storage";
import { getMediaUsage } from "../../../../../lib/media/permissions";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeTenant("media.manage");
  if (!auth.ok) return auth.response;
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  const { id } = await params;
  const tenantId = auth.context.membership.tenantId;
  const asset = await prisma.mediaAsset.findFirst({ where: { id, tenantId, provider: "BUNNY_STORAGE", deletedAt: null } });
  if (!asset?.bunnyStoragePath) return NextResponse.json({ ok: false, message: "الملف غير موجود" }, { status: 404 });
  const usage = await getMediaUsage(tenantId, asset);
  if (usage.length) return NextResponse.json({ ok: false, message: "الملف مستخدم حاليًا. استبدله أو أزل ارتباطه أولًا.", usage }, { status: 409 });
  try {
    await deleteStorageFile(asset.bunnyStoragePath);
    await prisma.mediaAsset.update({ where: { id: asset.id }, data: { deletedAt: new Date(), uploadStatus: "CANCELLED" } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, message: configurationMessage(error) }, { status: 502 });
  }
}