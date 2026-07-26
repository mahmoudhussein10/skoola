import { NotificationCategory } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requestFingerprint } from "@/lib/auth";
import { authorizeTenant, isSameOrigin } from "@/lib/api-auth";
import { createNotification, type NotificationAudience } from "@/lib/notifications/service";
import { normalizeInternalNotificationUrl } from "@/lib/notifications/security";
import { prisma } from "@/lib/prisma";

const schema=z.object({title:z.string().trim().min(3).max(120),body:z.string().trim().min(3).max(600),category:z.nativeEnum(NotificationCategory),audience:z.enum(["ALL_STUDENTS","COURSE_STUDENTS","STAFF"]),courseId:z.string().min(1).optional().nullable(),internalUrl:z.string().trim().max(500).optional().nullable(),requestId:z.string().uuid()});
export async function POST(request:Request){
 const auth=await authorizeTenant("notifications.manage");if(!auth.ok)return auth.response;
 if(!isSameOrigin(request))return NextResponse.json({ok:false,message:"طلب غير صالح"},{status:403});
 const parsed=schema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({ok:false,message:"تحقق من عنوان الإعلان ونصه والجمهور"},{status:400});
 const tenantId=auth.context.membership.tenantId;
 const recent=await prisma.auditLog.count({where:{tenantId,action:"ACADEMY_ANNOUNCEMENT_SENT",createdAt:{gte:new Date(Date.now()-3600000)}}});
 if(recent>=10)return NextResponse.json({ok:false,message:"وصلت للحد المؤقت للإعلانات. حاول بعد ساعة."},{status:429});
 if(parsed.data.audience==="COURSE_STUDENTS"){
  if(!parsed.data.courseId)return NextResponse.json({ok:false,message:"اختر الكورس"},{status:400});
  const course=await prisma.course.findFirst({where:{id:parsed.data.courseId,tenantId},select:{id:true}});
  if(!course)return NextResponse.json({ok:false,message:"الكورس غير موجود"},{status:404});
 }
 const audience:NotificationAudience=parsed.data.audience==="STAFF"?{kind:"ACADEMY_STAFF"}:parsed.data.audience==="COURSE_STUDENTS"?{kind:"COURSE_STUDENTS",courseId:parsed.data.courseId!}:{kind:"ACADEMY_STUDENTS"};
 const link=normalizeInternalNotificationUrl(parsed.data.internalUrl,parsed.data.audience==="STAFF"?"/teacher":"/dashboard");
 const result=await createNotification({tenantId,audience,type:"ACADEMY_ANNOUNCEMENT",category:parsed.data.category,title:parsed.data.title,message:parsed.data.body,link,priority:"HIGH",source:"ACADEMY",createdById:auth.context.user.id,metadata:{audience:parsed.data.audience,courseId:parsed.data.courseId??null},idempotencyKey:`academy-announcement:${parsed.data.requestId}`});
 const {ipHash}=await requestFingerprint();
 await prisma.auditLog.create({data:{tenantId,actorId:auth.context.user.id,action:"ACADEMY_ANNOUNCEMENT_SENT",entityType:"Notification",entityId:result.notificationId,metadata:{audience:parsed.data.audience,courseId:parsed.data.courseId??null,recipientCount:result.recipientCount},ipHash}});
 return NextResponse.json({ok:true,recipientCount:result.recipientCount});
}
