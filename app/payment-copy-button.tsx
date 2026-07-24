"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyPaymentValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }
  return <button type="button" className="copyPaymentButton" onClick={copy} aria-label={"نسخ " + value}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "تم النسخ" : "نسخ"}</button>;
}