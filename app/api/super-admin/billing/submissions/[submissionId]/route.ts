import { NextResponse } from "next/server";
import { z } from "zod";
import { requestFingerprint } from "@/lib/auth";
import { authorizeSuperAdmin, isSameOrigin } from "@/lib/api-auth";
import { createNotification } from "@/lib/notifications/service";
import { prisma } from "@/lib/prisma";

const schema=z.object({action:z.enum(["APPROVE","REJECT"]),rejectionReason:z.string().trim().max(500).optional().nullable()});
export async function POST(request:Request,{params}:{params:Promise<{submissionId:string}>}){
  const auth=await authorizeSuperAdmin();if(!auth.ok)return auth.response;
  if(!isSameOrigin(request))return NextResponse.json({ok:false,message:"طلب غير صالح"},{status:403});
  const parsed=schema.safeParse(await request.json().catch(()=>null));if(!parsed.success||parsed.data.action==="REJECT"&&!parsed.data.rejectionReason)return NextResponse.json({ok:false,message:"تحقق من قرار المراجعة"},{status:400});
  const {submissionId}=await params;const {ipHash}=await requestFingerprint();
  const result=await prisma.$transaction(async(tx)=>{
    const submission=await tx.teacherBillingPaymentSubmission.findUnique({where:{id:submissionId},include:{statement:true}});
    if(!submission||submission.status!=="PENDING")return null;
    if(parsed.data.action==="REJECT"){
      await tx.teacherBillingPaymentSubmission.update({where:{id:submission.id},data:{status:"REJECTED",rejectionReason:parsed.data.rejectionReason,reviewedAt:new Date()}});
      await tx.auditLog.create({data:{tenantId:submission.tenantId,actorId:auth.context.user.id,action:"TEACHER_BILLING_PAYMENT_REJECTED",entityType:"TeacherBillingPaymentSubmission",entityId:submission.id,ipHash}});
      return {tenantId:submission.tenantId,approved:false,statementId:submission.statementId};
    }
    const paidAmount=Math.min(Number(submission.statement.finalAmount),Number(submission.statement.paidAmount)+Number(submission.amount));
    await tx.teacherPaymentRecord.create({data:{tenantId:submission.tenantId,statementId:submission.statementId,amount:submission.amount,paymentMethod:submission.paymentMethod,referenceNumber:submission.referenceNumber,notes:submission.notes}});
    await tx.teacherBillingPaymentSubmission.update({where:{id:submission.id},data:{status:"APPROVED",reviewedAt:new Date(),rejectionReason:null}});
    await tx.billingStatement.update({where:{id:submission.statementId},data:{paidAmount,status:paidAmount>=Number(submission.statement.finalAmount)?"PAID":"PARTIALLY_PAID"}});
    await tx.auditLog.create({data:{tenantId:submission.tenantId,actorId:auth.context.user.id,action:"TEACHER_BILLING_PAYMENT_APPROVED",entityType:"TeacherBillingPaymentSubmission",entityId:submission.id,ipHash}});
    return {tenantId:submission.tenantId,approved:true,statementId:submission.statementId};
  });
  if(!result)return NextResponse.json({ok:false,message:"التحويل غير موجود أو تمت مراجعته"},{status:409});
  await createNotification({tenantId:result.tenantId,audience:{kind:"ACADEMY_STAFF"},type:result.approved?"PLATFORM_BILLING_APPROVED":"PLATFORM_BILLING_REJECTED",category:"PAYMENTS",title:result.approved?"تم اعتماد تحويل فاتورة Skoola":"تعذر اعتماد تحويل فاتورة Skoola",message:result.approved?"تم تحديث الفاتورة وتسجيل المبلغ المدفوع.":"راجع بيانات التحويل وأرسلها من جديد.",link:"/teacher/billing",priority:"HIGH",source:"PLATFORM_BILLING",idempotencyKey:`platform-billing-review:${submissionId}`}).catch(()=>undefined);
  return NextResponse.json({ok:true});
}
