"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { ArrowLeft, BookOpenCheck, Check, CheckCircle2, ChevronDown, Circle, ClipboardCheck, ExternalLink, Globe2, GraduationCap, ImageIcon, Palette, Rocket, Share2, Sparkles, UserRound, Users } from "lucide-react";
import { onboardingStepHref, type OnboardingProgress, type OnboardingStep, type OnboardingStepCategory, type OnboardingStepId } from "../../lib/onboarding-progress";
import { PUBLIC_SITE_ORIGIN } from "@/lib/public-site-url";
import styles from "./onboarding-journey.module.css";

type Icon = ComponentType<{ size?: number; strokeWidth?: number; "aria-hidden"?: boolean }>;
const stepIcons: Record<OnboardingStepId, Icon> = {
  academy_logo: ImageIcon, teacher_photo: UserRound, academy_description: ClipboardCheck,
  first_course: BookOpenCheck, first_lesson: GraduationCap, first_exam: CheckCircle2,
  academy_published: Globe2, first_student: Users, first_lesson_view: BookOpenCheck, first_exam_attempt: ClipboardCheck,
};
const groups: Array<{category:OnboardingStepCategory;label:string;icon:Icon}> = [
  {category:"identity",label:"هوية الأكاديمية",icon:Palette},
  {category:"content",label:"المحتوى التعليمي",icon:BookOpenCheck},
  {category:"publishing",label:"النشر",icon:Globe2},
  {category:"student_activity",label:"تفاعل الطلاب",icon:Users},
];

export function TeacherOnboardingJourney({progress,tenantSlug}:{progress:OnboardingProgress;tenantSlug:string}) {
  const [expanded,setExpanded]=useState(false);
  const [successVisible,setSuccessVisible]=useState(false);
  const [shareLabel,setShareLabel]=useState("شارك رابط الأكاديمية");
  const remaining=progress.totalSteps-progress.completedSteps;
  const grouped=useMemo(()=>groups.map(group=>({...group,steps:progress.steps.filter(step=>step.category===group.category)})),[progress.steps]);

  useEffect(()=>{
    const key=`skoola:onboarding:${tenantSlug}:progress`;
    const previous=window.localStorage.getItem(key);
    const previousValue=previous===null?null:Number(previous);
    if(previousValue!==null&&Number.isFinite(previousValue)&&progress.progressPercentage>previousValue) {
      let hideTimer: number | undefined;
      const revealTimer=window.setTimeout(()=>{
        setSuccessVisible(true);
        hideTimer=window.setTimeout(()=>setSuccessVisible(false),4200);
      },0);
      window.localStorage.setItem(key,String(progress.progressPercentage));
      return ()=>{ window.clearTimeout(revealTimer); if(hideTimer) window.clearTimeout(hideTimer); };
    }
    window.localStorage.setItem(key,String(progress.progressPercentage));
  },[progress.progressPercentage,tenantSlug]);

  async function shareAcademy() {
    const url=`${PUBLIC_SITE_ORIGIN}/t/${tenantSlug}`;
    try {
      if(navigator.share) await navigator.share({title:"أكاديميتي على Skoola",url});
      else await navigator.clipboard.writeText(url);
      setShareLabel("تم نسخ الرابط");
      window.setTimeout(()=>setShareLabel("شارك رابط الأكاديمية"),2200);
    } catch {
      setShareLabel("تعذّر النسخ");
      window.setTimeout(()=>setShareLabel("شارك رابط الأكاديمية"),2200);
    }
  }

  return <section className={`${styles.card} ${progress.isCompleted?styles.completed:""}`} aria-labelledby="teacher-onboarding-title">
    {successVisible?<div className={styles.successNotice} role="status"><CheckCircle2 size={18}/><span><b>ممتاز! اكتملت خطوة جديدة.</b><small>أنت أقرب لإطلاق أكاديميتك واستقبال الطلاب.</small></span></div>:null}
    <div className={styles.header}>
      <div className={styles.heading}>
        <span><Rocket size={16}/> رحلة إطلاق أكاديميتك</span>
        <h2 id="teacher-onboarding-title">{progress.isCompleted?"أكاديميتك جاهزة للانطلاق":progress.progressPercentage<=10?"أهلًا بك في Skoola":"رحلة إطلاق أكاديميتك"}</h2>
        <p>{progress.isCompleted?"أكملت خطوات الإعداد الأساسية، ويمكنك الآن التركيز على جذب الطلاب وتنمية أكاديميتك.":progress.progressPercentage<=10?"سنساعدك خطوة بخطوة حتى تصبح أكاديميتك جاهزة لاستقبال أول طالب.":"أكمل الخطوات التالية وجهّز أكاديميتك لاستقبال الطلاب."}</p>
      </div>
      <div className={styles.progressSummary}>
        <div className={styles.progressValue}><strong>{progress.progressPercentage}%</strong><span>مكتمل</span></div>
        <div className={styles.progressCopy}><b>أنجزت {progress.completedSteps.toLocaleString("en-US")} من {progress.totalSteps.toLocaleString("en-US")} خطوات</b><small>{progress.isCompleted?"اكتملت رحلة الإعداد الأساسية":`تبقّى لك ${remaining.toLocaleString("en-US")} خطوات لإطلاق أكاديميتك`}</small></div>
      </div>
    </div>
    <div className={styles.progressTrack} role="progressbar" aria-label="نسبة اكتمال رحلة إطلاق الأكاديمية" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.progressPercentage}>
      <span style={{width:`${progress.progressPercentage}%`}}/>
    </div>

    {progress.isCompleted?
      <div className={styles.completedActions}>
        <button type="button" onClick={shareAcademy}><Share2 size={18}/>{shareLabel}</button>
        <Link href={`/t/${tenantSlug}`} target="_blank">شاهد الأكاديمية <ExternalLink size={17}/></Link>
      </div>
      :progress.nextRecommendedStep?<NextAction step={progress.nextRecommendedStep}/>:null}

    <button className={styles.toggle} type="button" onClick={()=>setExpanded(value=>!value)} aria-expanded={expanded} aria-controls="teacher-onboarding-steps">
      <span>{expanded?"إخفاء الخطوات":"عرض كل الخطوات"}</span>
      <small>{progress.completedSteps}/{progress.totalSteps}</small>
      <ChevronDown className={expanded?styles.rotated:""} size={18}/>
    </button>

    {expanded?<div className={styles.groups} id="teacher-onboarding-steps">
      {grouped.map(group=>{const GroupIcon=group.icon;return <section className={styles.group} key={group.category} aria-labelledby={`onboarding-${group.category}`}>
        <header><GroupIcon size={18}/><h3 id={`onboarding-${group.category}`}>{group.label}</h3><span>{group.steps.filter(step=>step.completed).length}/{group.steps.length}</span></header>
        <div>{group.steps.map(step=><StepItem key={step.id} step={step}/>)}</div>
      </section>})}
    </div>:null}
  </section>;
}

function NextAction({step}:{step:OnboardingStep}) {
  const StepIcon=stepIcons[step.id];
  return <div className={styles.nextAction}>
    <i><StepIcon size={22}/></i>
    <div><span>خطوتك التالية</span><h3>{step.label}</h3><p>{step.description}</p></div>
    <Link href={onboardingStepHref(step)}>ابدأ الآن <ArrowLeft size={17}/></Link>
  </div>;
}

function StepItem({step}:{step:OnboardingStep}) {
  const StepIcon=stepIcons[step.id];
  const body=<><i className={styles.stepIcon}><StepIcon size={18}/></i><span><b>{step.label}</b><small>{step.description}</small></span><em aria-label={step.completed?"مكتملة":"غير مكتملة"}>{step.completed?<Check size={17}/>:<Circle size={15}/>}</em>{step.completed?null:<ArrowLeft className={styles.stepArrow} size={16}/>}</>;
  return step.completed?<div className={`${styles.step} ${styles.done}`}>{body}</div>:<Link className={styles.step} href={onboardingStepHref(step)} aria-label={`${step.label} — انتقل لإكمال الخطوة`}>{body}</Link>;
}

export function OnboardingJourneySkeleton() {
  return <section className={`${styles.card} ${styles.skeleton}`} aria-label="جارٍ تحميل رحلة إطلاق الأكاديمية"><span/><b/><p/><div/><article/></section>;
}

export function OnboardingJourneyUnavailable() {
  return <section className={styles.unavailable} role="status"><Sparkles size={18}/><span><b>تعذّر تحميل رحلة الإعداد الآن.</b><small>يمكنك استخدام لوحة التحكم بشكل طبيعي والمحاولة لاحقًا.</small></span><Link href="/teacher">إعادة المحاولة</Link></section>;
}