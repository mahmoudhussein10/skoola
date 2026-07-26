"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Banknote, CalendarDays, CheckCircle2, Clock3, Copy, CreditCard, ReceiptText, Send, Smartphone, Users } from "lucide-react";

type Submission = { id:string; amount:number; paymentMethod:string; referenceNumber:string|null; status:string; rejectionReason:string|null; createdAt:string };
type Statement = { id:string; statementNumber:string; periodStart:string; periodEnd:string; billableStudents:number; pricePerStudent:number; finalAmount:number; paidAmount:number; status:string; dueDate:string; submissions:Submission[] };
type Platform = { pricePerStudent:number; vodafoneEnabled:boolean; vodafoneNumber:string|null; instaPayEnabled:boolean; instaPayAddress:string|null; accountName:string|null; instructions:string|null };

const statusLabels:Record<string,string>={UNPAID:"غير مدفوعة",PARTIALLY_PAID:"مدفوعة جزئيًا",PAID:"مدفوعة",OVERDUE:"متأخرة",CANCELLED:"ملغاة"};
const submissionLabels:Record<string,string>={PENDING:"قيد المراجعة",APPROVED:"مقبول",REJECTED:"مرفوض"};
const money=(value:number)=>`${value.toLocaleString("en-US")} ج.م`;
const monthLabel=(value:string)=>new Intl.DateTimeFormat("ar-EG",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(value));

export function TeacherBillingClient({platform,statements,canSubmit}:{platform:Platform;statements:Statement[];canSubmit:boolean}){
  const router=useRouter();
  const payable=useMemo(()=>statements.find((item)=>["UNPAID","PARTIALLY_PAID","OVERDUE"].includes(item.status)),[statements]);
  const outstanding=payable?Math.max(0,payable.finalAmount-payable.paidAmount):0;
  const pending=payable?.submissions.find((item)=>item.status==="PENDING");
  const methods=[
    ...(platform.vodafoneEnabled&&platform.vodafoneNumber?[{id:"VODAFONE_CASH",label:"فودافون كاش",value:platform.vodafoneNumber,Icon:Smartphone}]:[]),
    ...(platform.instaPayEnabled&&platform.instaPayAddress?[{id:"INSTAPAY",label:"InstaPay",value:platform.instaPayAddress,Icon:CreditCard}]:[]),
  ];
  const[method,setMethod]=useState(methods[0]?.id??"");
  const[amount,setAmount]=useState(outstanding);
  const[reference,setReference]=useState("");
  const[notes,setNotes]=useState("");
  const[saving,setSaving]=useState(false);
  const[message,setMessage]=useState("");
  async function copy(value:string){await navigator.clipboard.writeText(value);setMessage("تم نسخ بيانات الدفع");}
  async function submit(event:React.FormEvent){
    event.preventDefault();if(!payable)return;setSaving(true);setMessage("");
    const response=await fetch("/api/teacher/platform-billing",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({statementId:payable.id,amount:Number(amount),paymentMethod:method,referenceNumber:reference,notes})});
    const data=await response.json().catch(()=>null);setSaving(false);setMessage(response.ok?"تم إرسال التحويل للمراجعة، وسنحدث الفاتورة بعد الاعتماد.":data?.message??"تعذر إرسال بيانات التحويل");if(response.ok){setReference("");setNotes("");router.refresh();}
  }
  return <div className="teacherPlatformBilling">
    <section className="billingHero">
      <div><span><ReceiptText size={17}/> حساب اشتراك Skoola</span><h2>{payable?`فاتورة ${monthLabel(payable.periodStart)}`:"حسابك مسدد بالكامل"}</h2><p>الفاتورة تُحسب تلقائيًا: عدد الطلاب النشطين × سعر الطالب المحدد لحسابك.</p></div>
      <div className={`billingHeroState state-${payable?.status.toLowerCase()??"paid"}`}><Clock3 size={22}/><span><small>الحالة الحالية</small><b>{payable?statusLabels[payable.status]:"لا توجد مستحقات"}</b></span></div>
    </section>
    <section className="billingMetricGrid">
      <article><i><Users size={21}/></i><span>الطلاب المحتسبون</span><b>{payable?.billableStudents??0}</b><small>طالب نشط</small></article>
      <article><i><Banknote size={21}/></i><span>سعر الطالب</span><b>{money(payable?.pricePerStudent??platform.pricePerStudent)}</b><small>شهريًا لكل طالب</small></article>
      <article><i><ReceiptText size={21}/></i><span>إجمالي الفاتورة</span><b>{money(payable?.finalAmount??0)}</b><small>{payable?`${payable.billableStudents} × ${payable.pricePerStudent}`:"لا توجد فاتورة"}</small></article>
      <article className="amountDue"><i><CalendarDays size={21}/></i><span>المتبقي</span><b>{money(outstanding)}</b><small>{payable?`الاستحقاق ${new Date(payable.dueDate).toLocaleDateString("ar-EG")}`:"الحساب منتظم"}</small></article>
    </section>
    <div className="billingWorkGrid">
      <section className="billingPaymentPanel saasPanel">
        <div className="billingSectionHead"><div><span>الدفع إلى إدارة Skoola</span><h3>طرق الدفع المعتمدة</h3></div><CreditCard size={24}/></div>
        {methods.length?<div className="platformPaymentMethods">{methods.map(({id,label,value,Icon})=><button type="button" key={id} className={method===id?"active":""} onClick={()=>setMethod(id)}><i><Icon size={20}/></i><span><b>{label}</b><small dir="ltr">{value}</small></span><Copy size={17} onClick={(event)=>{event.stopPropagation();void copy(value)}}/></button>)}</div>:<div className="billingNotice warning"><AlertCircle size={20}/><span>لم تحدد إدارة Skoola طريقة دفع بعد. تواصل مع الإدارة قبل التحويل.</span></div>}
        {platform.accountName?<p className="billingAccountName">اسم المستفيد: <b>{platform.accountName}</b></p>:null}
        {platform.instructions?<p className="billingInstructions">{platform.instructions}</p>:null}
        {pending?<div className="billingNotice pending"><Clock3 size={21}/><span><b>تحويل بقيمة {money(pending.amount)} قيد المراجعة</b><small>رقم العملية: {pending.referenceNumber}</small></span></div>:null}
        {!canSubmit?<div className="billingNotice warning"><AlertCircle size={20}/><span>مالك الأكاديمية فقط يمكنه إرسال بيانات التحويل.</span></div>:null}
        {payable&&methods.length&&!pending&&canSubmit?<form className="billingSubmitForm" onSubmit={submit}><div className="billingFormGrid"><label>المبلغ المحول<input type="number" min="1" max={outstanding} value={amount} onChange={(event)=>setAmount(Number(event.target.value))} required/></label><label>رقم عملية التحويل<input dir="ltr" value={reference} onChange={(event)=>setReference(event.target.value)} minLength={4} maxLength={100} placeholder="Transaction ID" required/></label></div><label>ملاحظة اختيارية<textarea value={notes} onChange={(event)=>setNotes(event.target.value)} maxLength={500} rows={3} placeholder="أي تفاصيل تساعد الإدارة في مراجعة التحويل"/></label><button className="btn primary" disabled={saving||!method}><Send size={17}/>{saving?"جارٍ الإرسال…":"إرسال التحويل للمراجعة"}</button></form>:null}
        {message?<p className="billingFormMessage" role="status">{message}</p>:null}
      </section>
      <section className="billingHistoryPanel saasPanel"><div className="billingSectionHead"><div><span>سجل الحساب</span><h3>الفواتير الشهرية</h3></div><ReceiptText size={24}/></div><div className="teacherInvoiceList">{statements.map((item)=>{const latest=item.submissions[0];return <article key={item.id} className={`teacherInvoiceCard state-${item.status.toLowerCase()}`}><header><div><small>{monthLabel(item.periodStart)}</small><b>{item.statementNumber}</b></div><span>{statusLabels[item.status]}</span></header><div className="teacherInvoiceMath"><span>{item.billableStudents} طالب</span><b>×</b><span>{money(item.pricePerStudent)}</span><b>=</b><strong>{money(item.finalAmount)}</strong></div><footer><span>المدفوع: <b>{money(item.paidAmount)}</b></span><span>الاستحقاق: {new Date(item.dueDate).toLocaleDateString("ar-EG")}</span></footer>{latest?<div className={`submissionState ${latest.status.toLowerCase()}`}><CheckCircle2 size={16}/><span>{submissionLabels[latest.status]} · {money(latest.amount)}{latest.rejectionReason?` — ${latest.rejectionReason}`:""}</span></div>:null}</article>})}</div></section>
    </div>
  </div>;
}