import { NextResponse } from "next/server";
import { z } from "zod";
import { requestFingerprint } from "@/lib/auth";
import { authorizeTenant, isSameOrigin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const schema=z.object({statementId:z.string().min(1),amount:z.number().positive().max(1_000_000),paymentMethod:z.enum(["VODAFONE_CASH","INSTAPAY"]),referenceNumber:z.string().trim().min(4).max(100),notes:z.string().trim().max(500).optional().nullable()});
export async function POST(request:Request){
  const auth=await authorizeTenant("tenant.settings.manage"); if(!auth.ok)return auth.response;
  if(!isSameOrigin(request))return NextResponse.json({ok:false,message:"طلب غير صالح"},{status:403});
  const parsed=schema.safeParse(await request.json().catch(()=>null)); if(!parsed.success)return NextResponse.json({ok:false,message:"تحقق من بيانات التحويل"},{status:400});
  const tenantId=auth.context.membership.tenantId;
  const platform=await prisma.platformSettings.upsert({where:{id:"default"},update:{},create:{}});
  const available=parsed.data.paymentMethod==="VODAFONE_CASH"?platform.billingVodafoneCashEnabled&&!!platform.billingVodafoneCashNumber:platform.billingInstaPayEnabled&&!!platform.billingInstaPayAddress;
  if(!available)return NextResponse.json({ok:false,message:"طريقة الدفع المختارة غير متاحة حاليًا"},{status:400});
  const statement=await prisma.billingStatement.findFirst({where:{id:parsed.data.statementId,tenantId,status:{in:["UNPAID","PARTIALLY_PAID","OVERDUE"]}}});
  if(!statement)return NextResponse.json({ok:false,message:"الفاتورة غير متاحة للدفع"},{status:404});
  const remaining=Math.max(0,Number(statement.finalAmount)-Number(statement.paidAmount));
  if(parsed.data.amount>remaining||remaining===0)return NextResponse.json({ok:false,message:"المبلغ أكبر من الرصيد المستحق"},{status:400});
  const pending=await prisma.teacherBillingPaymentSubmission.findFirst({where:{statementId:statement.id,status:"PENDING"}});
  if(pending)return NextResponse.json({ok:false,message:"يوجد تحويل قيد المراجعة لهذه الفاتورة بالفعل"},{status:409});
  const {ipHash}=await requestFingerprint();
  const submission=await prisma.$transaction(async(tx)=>{
    const item=await tx.teacherBillingPaymentSubmission.create({data:{tenantId,statementId:statement.id,amount:parsed.data.amount,paymentMethod:parsed.data.paymentMethod,referenceNumber:parsed.data.referenceNumber,notes:parsed.data.notes||null}});
    await tx.auditLog.create({data:{tenantId,actorId:auth.context.user.id,action:"TEACHER_BILLING_PAYMENT_SUBMITTED",entityType:"TeacherBillingPaymentSubmission",entityId:item.id,metadata:{statementId:statement.id,amount:parsed.data.amount,paymentMethod:parsed.data.paymentMethod},ipHash}});
    return item;
  });
  return NextResponse.json({ok:true,submission,message:"تم إرسال بيانات التحويل للمراجعة"});
}
