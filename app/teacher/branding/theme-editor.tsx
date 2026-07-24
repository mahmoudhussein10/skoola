"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Theme = {
  primaryColor: string; secondaryColor: string; accentColor: string; backgroundColor: string; surfaceColor: string; textColor: string; mutedColor: string; borderRadius: number; buttonRadius: number; fontFamily: "Tajawal" | "Cairo" | "Alexandria" | "Noto Kufi Arabic"; preset: "CLASSIC_BLUE" | "PREMIUM_BLACK" | "EDUCATIONAL_GREEN" | "MODERN_PURPLE" | "ELEGANT_BURGUNDY" | "CLEAN_ORANGE" | "SKOOLA";
};
const presets: Record<string, Partial<Theme>> = {
  SKOOLA: { primaryColor: "#1565f5", secondaryColor: "#081b3a", accentColor: "#7b2ff7", backgroundColor: "#f8fafc", surfaceColor: "#ffffff", textColor: "#0f172a", mutedColor: "#64748b" },
  CLEAN_ORANGE: { primaryColor: "#ff6b00", secondaryColor: "#171411", accentColor: "#ff922d", backgroundColor: "#fbfaf8", surfaceColor: "#ffffff", textColor: "#171411", mutedColor: "#6d6761" },
  CLASSIC_BLUE: { primaryColor: "#2457d6", secondaryColor: "#10204a", accentColor: "#4f7cff", backgroundColor: "#f6f8fc", surfaceColor: "#ffffff", textColor: "#17213a", mutedColor: "#65708a" },
  PREMIUM_BLACK: { primaryColor: "#d4a94e", secondaryColor: "#101010", accentColor: "#e7c675", backgroundColor: "#f6f3ed", surfaceColor: "#ffffff", textColor: "#171411", mutedColor: "#706a62" },
  EDUCATIONAL_GREEN: { primaryColor: "#17865d", secondaryColor: "#123b31", accentColor: "#34b583", backgroundColor: "#f4faf7", surfaceColor: "#ffffff", textColor: "#15342c", mutedColor: "#5f766f" },
  MODERN_PURPLE: { primaryColor: "#6d45d8", secondaryColor: "#24184a", accentColor: "#9c7bef", backgroundColor: "#f8f6fc", surfaceColor: "#ffffff", textColor: "#251d3b", mutedColor: "#746b87" },
  ELEGANT_BURGUNDY: { primaryColor: "#8c2746", secondaryColor: "#411326", accentColor: "#c04a70", backgroundColor: "#fbf6f8", surfaceColor: "#ffffff", textColor: "#351b25", mutedColor: "#7c6870" },
};

export function ThemeEditor({ initial, tenantName }: { initial: Theme; tenantName: string }) {
  const router = useRouter();
  const [theme, setTheme] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const changed = useMemo(() => JSON.stringify(theme) !== JSON.stringify(initial), [theme, initial]);
  function applyPreset(name: keyof typeof presets) { setTheme((current) => ({ ...current, ...presets[name], preset: name as Theme["preset"] })); }
  async function save() {
    setSaving(true); setMessage("");
    const response = await fetch("/api/teacher/branding", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(theme) });
    setSaving(false);
    setMessage(response.ok ? "تم حفظ الهوية البصرية" : "تعذر حفظ التغييرات");
    if (response.ok) router.refresh();
  }
  const colorFields: Array<[keyof Theme, string]> = [["primaryColor", "اللون الأساسي"], ["secondaryColor", "اللون الثانوي"], ["accentColor", "لون التمييز"], ["backgroundColor", "الخلفية"], ["surfaceColor", "البطاقات"], ["textColor", "النص"], ["mutedColor", "النص الهادئ"]];
  return <div className="themeEditor"><section className="saasPanel themeControls"><div className="presetGrid">{Object.keys(presets).map((name) => <button key={name} onClick={() => applyPreset(name)}>{name.replaceAll("_", " ")}</button>)}</div><div className="colorGrid">{colorFields.map(([key, label]) => <label key={key}>{label}<span><input type="color" value={String(theme[key])} onChange={(event) => setTheme({ ...theme, [key]: event.target.value })} /><input dir="ltr" value={String(theme[key])} onChange={(event) => setTheme({ ...theme, [key]: event.target.value })} /></span></label>)}</div><div className="fieldGrid"><label>الخط<select value={theme.fontFamily} onChange={(event) => setTheme({ ...theme, fontFamily: event.target.value as Theme["fontFamily"] })}><option>Tajawal</option><option>Cairo</option><option>Alexandria</option><option>Noto Kufi Arabic</option></select></label><label>استدارة البطاقات<input type="range" min="8" max="28" value={theme.borderRadius} onChange={(event) => setTheme({ ...theme, borderRadius: Number(event.target.value) })} /></label></div><div className="editorActions"><button className="btn primary" disabled={!changed || saving} onClick={save}>{saving ? "جارٍ الحفظ…" : "حفظ التغييرات"}</button><button onClick={() => setTheme(initial)}>إلغاء التغييرات</button></div>{message ? <p className="formNotice">{message}</p> : null}</section><section className="themePreview" style={{ background: theme.backgroundColor, color: theme.textColor, fontFamily: theme.fontFamily, borderRadius: theme.borderRadius }}><nav><b style={{ color: theme.primaryColor }}>{tenantName}</b><span>الكورسات · تسجيل الدخول</span></nav><div><small style={{ color: theme.primaryColor }}>منصة تعليمية مستقلة</small><h2>تعلم بطريقة أوضح وحقق أفضل نتيجة.</h2><p style={{ color: theme.mutedColor }}>معاينة مباشرة للصفحة التي يراها طلابك.</p><button style={{ background: theme.primaryColor, color: "#fff", borderRadius: theme.buttonRadius }}>ابدأ الآن</button></div><article style={{ background: theme.surfaceColor, borderRadius: theme.borderRadius }}><span style={{ color: theme.primaryColor }}>بطاقة الكورس</span><h3>عنوان الكورس يظهر هنا</h3><p style={{ color: theme.mutedColor }}>وصف مختصر للمحتوى التعليمي.</p></article></section></div>;
}

export function BrandAssetUpload({ currentLogo }: { currentLogo?: string | null }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    setSaving(true);
    setMessage("");
    const body = new FormData();
    body.set("file", file);
    const response = await fetch("/api/teacher/branding/upload", { method: "POST", body });
    const data = await response.json().catch(() => null);
    setSaving(false);
    setMessage(response.ok ? "تم تحديث شعار المنصة" : data?.message ?? "تعذر رفع الشعار");
    if (response.ok) router.refresh();
  }
  return <section className="saasPanel brandAssetUpload"><div><h3>شعار المنصة</h3><p>JPEG أو PNG أو WebP بحد أقصى 5MB. يُحفظ داخل مجلد منصتك المعزول.</p>{currentLogo ? <a href={currentLogo} target="_blank" rel="noreferrer">عرض الشعار الحالي ↗</a> : null}</div><form onSubmit={upload}><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required /><button className="btn primary" disabled={!file || saving}>{saving ? "جارٍ الرفع…" : "رفع الشعار"}</button></form>{message ? <p className="formNotice">{message}</p> : null}</section>;
}