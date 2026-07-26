"use client";
import { useMemo,useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2,Clock3,ReceiptText,Search,XCircle } from "lucide-react";

type Statement={id:string;tenantName:string;tenantSlug:string;number:string;month:string;students:number;price:number;amount:number;paid:number;status:string;dueDate:string};
type Submission={id:string;tenantName:string;statementNumber:string;amount:number;method:string;reference:string|null;status:string;reason:string|null;createdAt:string};
const money=(n:number)=>`${n.toLocaleString("en-US")} ج.م`;
const statusLabel:Record<string,string>={UNPAID:"غير مدفوعة",PARTIALLY_PAID:"مدفوعة جزئيًا",PAID:"مدفوعة",OVERDUE:"متأخرة",CANCELLED:"ملغاة"};
export function SuperAdminBillingClient({statements,submissions}:{statements:Statement[];submissions:Submission[]}){
 const router=useRouter();const[q,setQ]=useState("");const[busy,setBusy]=useState("");
 const filtered=useMemo(()=>statements.filter(s=>(s.tenantName+" "+s.number).toLowerCase().includes(q.toLowerCase())),[q,statements]);
 const pending=submissions.filter(s=>s.status==="PENDING");
 async function review(id:string,action:"APPROVE"|"REJECT"){const reason=action==="REJECT"?window.prompt("اكتب سبب الرفض للمدرس"):"";if(action==="REJECT"&&!reason)return;setBusy(id);const response=await fetch(`/api/super-admin/billing/submissions/${id}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action,rejectionReason:reason})});setBusy("");if(response.ok)router.refresh();else alert((await response.json().catch(()=>null))?.message??"تعذر تنفيذ القرار");}
 return <div className="superAdminBilling">
  <section className="billingHero"><div><span><ReceiptText size={17}/> حسابات Skoola</span><h2>الفواتير والتحويلات الشهرية</h2><p>كل فاتورة تُحسب من عدد الطلاب النشطين × سعر الطالب المحدد للأكاديمية.</p></div><div className="billingHeroState"><Clock3 size={22}/><span><small>تحويلات تنتظر المراجعة</small><b>{pending.length.toLocaleString("en-US")}</b></span></div></section>
  {pending.length?<section className="saasPanel"><div className="billingSectionHead"><div><span>تحتاج إجراء</span><h3>تحويلات قيد المراجعة</h3></div></div><div className="teacherInvoiceList">{pending.map(item=><article className="teacherInvoiceCard" key={item.id}><header><div><small>{item.tenantName}</small><b>{item.statementNumber}</b></div><span>{money(item.amount)}</span></header><p>الطريقة: {item.method} · رقم العملية: <b dir="ltr">{item.reference||"—"}</b></p><footer><button className="btn primary" disabled={busy===item.id} onClick={()=>review(item.id,"APPROVE")}><CheckCircle2 size={16}/>اعتماد</button><button className="btn secondary" disabled={busy===item.id} onClick={()=>review(item.id,"REJECT")}><XCircle size={16}/>رفض</button></footer></article>)}</div></section>:null}
  <section className="saasPanel"><div className="billingSectionHead"><div><span>السجل الكامل</span><h3>فواتير كل الأكاديميات</h3></div><label className="searchField"><Search size={17}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="ابحث باسم الأكاديمية أو الفاتورة"/></label></div><div className="teacherInvoiceList">{filtered.map(item=><article className={`teacherInvoiceCard state-${item.status.toLowerCase()}`} key={item.id}><header><div><small>{item.tenantName}</small><b>{item.number}</b></div><span>{statusLabel[item.status]??item.status}</span></header><div className="teacherInvoiceMath"><span>{item.students} طالب</span><b>×</b><span>{money(item.price)}</span><b>=</b><strong>{money(item.amount)}</strong></div><footer><span>المدفوع: <b>{money(item.paid)}</b></span><span>المتبقي: <b>{money(Math.max(0,item.amount-item.paid))}</b></span></footer></article>)}</div></section>
 </div>;
}
