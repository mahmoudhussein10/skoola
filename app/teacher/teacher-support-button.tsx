"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { MessageCircle } from "lucide-react";
import styles from "./teacher-support.module.css";

const SUPPORT_WHATSAPP_NUMBER = "20155457735";
const SUPPORT_MESSAGE = encodeURIComponent("مرحبًا، أحتاج مساعدة في استخدام منصة Skoola.");
const subscribe = () => () => undefined;

export function TeacherSupportButton() {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  if (!mounted) return null;

  return createPortal(
    <a
      className={styles.supportButton}
      href={`https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${SUPPORT_MESSAGE}`}
      target="_blank"
      rel="noreferrer"
      aria-label="تواصل مع دعم Skoola عبر واتساب"
    >
      <span className={styles.iconWrap} aria-hidden="true"><MessageCircle size={22} /></span>
      <span className={styles.copy}>
        <strong>تواصل مع الدعم</strong>
        <small>عبر واتساب</small>
      </span>
    </a>,
    document.body,
  );
}
