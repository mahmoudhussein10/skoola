"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  ChevronLeft,
  CircleAlert,
  LoaderCircle,
  Send,
  Settings2,
  Smartphone,
  X,
} from "lucide-react";
import { pushCapability, registerForPush, subscribeForegroundMessages } from "@/lib/firebase/client";

type RoleKind = "student" | "teacher";
type DeviceState = {
  registered: boolean;
  enabled: boolean;
  permissionState: "DEFAULT" | "GRANTED" | "DENIED" | "UNSUPPORTED";
  promptCount: number;
  cooldownUntil: string | null;
  needsRetry: boolean;
};
type InboxItem = {
  id: string;
  isRead: boolean;
  isSeen: boolean;
  createdAt: string;
  notification: {
    id: string;
    type: string;
    category: string;
    title: string;
    message: string;
    link: string;
    priority: string;
    createdAt: string;
  };
};

const INSTALLATION_KEY = "skoola_push_installation_id";
const excludedPromptPaths = /(?:\/login|\/register|forgot-password|staff-invite|\/course(?:\/|\?)|\/teacher\/payments|\/teacher\/billing|\/exams?)/i;

function getInstallationId() {
  let value = window.localStorage.getItem(INSTALLATION_KEY);
  if (!value || !/^[0-9a-f-]{36}$/i.test(value)) {
    value = crypto.randomUUID();
    window.localStorage.setItem(INSTALLATION_KEY, value);
  }
  return value;
}

async function apiJson(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await response.json().catch(() => ({ ok: false, message: "تعذر الاتصال بالخادم" }));
  if (!response.ok || !data.ok) throw new Error(data.message || "تعذر تنفيذ الطلب");
  return data;
}

function usePushDevice() {
  const [installationId] = useState(() => typeof window === "undefined" ? "" : getInstallationId());
  const [supported, setSupported] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [device, setDevice] = useState<DeviceState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async (id?: string) => {
    const current = id || installationId;
    if (!current) return;
    const capability = await pushCapability();
    setSupported(capability.supported);
    setPermission(capability.supported ? capability.permission : "unsupported");
    if (!capability.supported) {
      setDevice({ registered: false, enabled: false, permissionState: "UNSUPPORTED", promptCount: 0, cooldownUntil: null, needsRetry: false });
      return;
    }
    const data = await apiJson(`/api/notifications/device?installationId=${encodeURIComponent(current)}`);
    setDevice(data.currentDevice);
  }, [installationId]);

  useEffect(() => {
    if (!installationId) return;
    const timer = window.setTimeout(() => {
      void refresh(installationId).catch(() => setMessage("تعذر قراءة حالة الإشعارات"));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [installationId, refresh]);

  const enable = useCallback(async () => {
    if (!installationId || busy) return false;
    setBusy(true);
    setMessage("");
    try {
      const capability = await pushCapability();
      if (!capability.supported) throw new Error("الإشعارات غير مدعومة على هذا المتصفح");
      const nextPermission = await Notification.requestPermission();
      await apiJson("/api/notifications/device", {
        method: "PATCH",
        body: JSON.stringify({ installationId, action: "PERMISSION", permission: nextPermission }),
      });
      setPermission(nextPermission);
      if (nextPermission !== "granted") {
        setMessage("الإذن محظور. فعّله من إعدادات الموقع في المتصفح ثم حاول مجددًا.");
        await refresh();
        return false;
      }
      const token = await registerForPush();
      await apiJson("/api/notifications/device", {
        method: "POST",
        body: JSON.stringify({ installationId, token, permission: nextPermission }),
      });
      setMessage("تم تفعيل الإشعارات على هذا الجهاز بنجاح");
      await refresh();
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تفعيل الإشعارات الآن");
      await refresh().catch(() => undefined);
      return false;
    } finally {
      setBusy(false);
    }
  }, [busy, installationId, refresh]);

  const disable = useCallback(async () => {
    if (!installationId || busy) return;
    setBusy(true);
    try {
      await apiJson("/api/notifications/device", {
        method: "PATCH",
        body: JSON.stringify({ installationId, action: "DISABLE" }),
      });
      setMessage("تم إيقاف الإشعارات على هذا الجهاز فقط");
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [busy, installationId, refresh]);

  const sendTest = useCallback(async () => {
    if (!installationId || busy) return;
    setBusy(true);
    try {
      const result = await apiJson("/api/notifications/test", {
        method: "POST",
        body: JSON.stringify({ installationId }),
      });
      setMessage(result.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر إرسال الاختبار");
    } finally {
      setBusy(false);
    }
  }, [busy, installationId]);

  return { installationId, supported, permission, device, busy, message, refresh, enable, disable, sendTest };
}

export function PushBootstrap({ role }: { role: RoleKind }) {
  const pathname = usePathname();
  const push = usePushDevice();
  const [showPrompt, setShowPrompt] = useState(false);
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);
  const promptChecked = useRef(false);

  useEffect(() => {
    let unsubscribe: () => void = () => undefined;
    void subscribeForegroundMessages((payload) => {
      setToast({
        title: payload.notification?.title || payload.data?.title || "Skoola",
        body: payload.notification?.body || payload.data?.body || "لديك إشعار جديد",
      });
      window.setTimeout(() => setToast(null), 6000);
    }).then((off) => { unsubscribe = off; });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (promptChecked.current || !push.installationId || push.supported !== true || !push.device) return;
    promptChecked.current = true;
    const timer = window.setTimeout(async () => {
      const cooldown = push.device?.cooldownUntil ? new Date(push.device.cooldownUntil).getTime() : 0;
      const blockingDialog = document.querySelector('dialog[open], [role="dialog"][aria-modal="true"], [data-blocking-dialog="true"]');
      const eligible = push.permission === "default"
        && !push.device?.registered
        && (push.device?.promptCount ?? 0) < 3
        && cooldown <= Date.now()
        && !excludedPromptPaths.test(pathname)
        && !blockingDialog;
      if (!eligible) return;
      await apiJson("/api/notifications/device", {
        method: "PATCH",
        body: JSON.stringify({ installationId: push.installationId, action: "PROMPT_SHOWN", permission: "default" }),
      }).catch(() => undefined);
      setShowPrompt(true);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [pathname, push.device, push.installationId, push.permission, push.supported]);

  async function later() {
    setShowPrompt(false);
    await apiJson("/api/notifications/device", {
      method: "PATCH",
      body: JSON.stringify({ installationId: push.installationId, action: "DISMISS", permission: "default" }),
    }).catch(() => undefined);
  }

  async function enableFromPrompt() {
    const enabled = await push.enable();
    if (enabled) setShowPrompt(false);
  }

  const copy = role === "student"
    ? {
        title: "خليك متابع دروسك أول بأول",
        body: "فعّل الإشعارات علشان تعرف فورًا عند نزول محاضرة، امتحان أو نتيجة جديدة.",
      }
    : {
        title: "تابع أكاديميتك بدون ما يفوتك شيء",
        body: "فعّل الإشعارات لاستقبال طلبات الاشتراك، المدفوعات والتنبيهات المهمة.",
      };

  return <>
    {showPrompt ? <div className="pushPromptBackdrop" role="presentation">
      <section className="pushPrompt" role="dialog" aria-modal="true" aria-labelledby="push-prompt-title" dir="rtl">
        <i aria-hidden="true"><Bell size={25}/></i>
        <span>تنبيهات Skoola</span>
        <h2 id="push-prompt-title">{copy.title}</h2>
        <p>{copy.body}</p>
        <div>
          <button className="btn primary" onClick={enableFromPrompt} disabled={push.busy}>
            {push.busy ? <LoaderCircle className="spin" size={18}/> : <Bell size={18}/>}
            فعّل الإشعارات
          </button>
          <button className="pushLaterButton" onClick={later} disabled={push.busy}>لاحقًا</button>
        </div>
        {push.message ? <small role="status">{push.message}</small> : null}
      </section>
    </div> : null}
    {toast ? <aside className="foregroundNotificationToast" role="status" dir="rtl">
      <i><Bell size={18}/></i><span><b>{toast.title}</b><small>{toast.body}</small></span>
      <button aria-label="إغلاق التنبيه" onClick={() => setToast(null)}><X size={16}/></button>
    </aside> : null}
  </>;
}

export function PushSettingsCard() {
  const push = usePushDevice();
  const isIos = typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone)));
  const state = push.supported === false
    ? "unsupported"
    : push.permission === "denied"
      ? "blocked"
      : push.device?.registered
        ? "enabled"
        : push.device?.needsRetry
          ? "retry"
          : "needs-registration";

  const labels = {
    enabled: ["الإشعارات مفعّلة", "هذا الجهاز جاهز لاستقبال التنبيهات.", Check],
    blocked: ["الإذن محظور من المتصفح", "افتح إعدادات الموقع واسمح بالإشعارات ثم حدّث الصفحة.", BellOff],
    unsupported: ["الإشعارات غير مدعومة", "جرّب إصدارًا حديثًا من Chrome أو Edge أو Safari.", CircleAlert],
    retry: ["تحتاج إعادة تسجيل", "انتهى تسجيل هذا الجهاز ويمكنك تفعيله من جديد بأمان.", CircleAlert],
    "needs-registration": ["الإشعارات غير مفعّلة", "فعّلها لتصلك المحاضرات والامتحانات والتنبيهات المهمة.", Bell],
  } as const;
  const [title, description, Icon] = labels[state];

  return <section className={`pushSettingsCard state-${state}`} dir="rtl">
    <header><i><Icon size={22}/></i><div><span>إعدادات هذا الجهاز</span><h3>{title}</h3><p>{description}</p></div></header>
    {isIos && !standalone ? <div className="iosPushGuide"><Smartphone size={18}/><span><b>على iPhone وiPad</b> أضف Skoola إلى الشاشة الرئيسية من زر المشاركة، ثم افتحها من الأيقونة لتفعيل الإشعارات.</span></div> : null}
    <div className="pushSettingsActions">
      {state !== "enabled" && state !== "unsupported" && state !== "blocked" ? <button className="btn primary" onClick={push.enable} disabled={push.busy}><Bell size={17}/>تفعيل الإشعارات</button> : null}
      {state === "blocked" ? <button className="btn secondary" onClick={() => push.refresh()} disabled={push.busy}><Settings2 size={17}/>تحقق مجددًا</button> : null}
      {state === "enabled" ? <>
        <button className="btn secondary" onClick={push.sendTest} disabled={push.busy}><Send size={17}/>إرسال إشعار تجريبي</button>
        <button className="pushDisableButton" onClick={push.disable} disabled={push.busy}><BellOff size={17}/>إيقاف على هذا الجهاز</button>
      </> : null}
    </div>
    {push.message ? <p className="pushDeviceMessage" role="status">{push.message}</p> : null}
  </section>;
}

function relativeTime(value: string) {
  const diff = new Date(value).getTime() - Date.now();
  const abs = Math.abs(diff);
  const formatter = new Intl.RelativeTimeFormat("ar", { numeric: "auto" });
  if (abs < 60_000) return formatter.format(Math.round(diff / 1000), "second");
  if (abs < 3_600_000) return formatter.format(Math.round(diff / 60_000), "minute");
  if (abs < 86_400_000) return formatter.format(Math.round(diff / 3_600_000), "hour");
  return formatter.format(Math.round(diff / 86_400_000), "day");
}

export function NotificationBell({ role }: { role: RoleKind }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const href = role === "student" ? "/notifications" : "/teacher/notifications";

  const load = useCallback(async () => {
    try {
      const data = await apiJson("/api/notifications?limit=5");
      setItems(data.items);
      setUnread(data.unreadCount);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(load, 45_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  async function markAll() {
    await apiJson("/api/notifications", { method: "POST", body: JSON.stringify({ action: "MARK_ALL_READ" }) });
    setItems((current) => current.map((item) => ({ ...item, isRead: true })));
    setUnread(0);
  }

  async function openItem(item: InboxItem) {
    if (!item.isRead) {
      await apiJson(`/api/notifications/${item.id}`, { method: "PATCH", body: JSON.stringify({ action: "READ" }) }).catch(() => undefined);
    }
    setOpen(false);
    router.push(item.notification.link);
  }

  return <div className="notificationBellWrap" ref={panelRef}>
    <button className="notificationBellButton" aria-label={`الإشعارات، ${unread} غير مقروء`} aria-expanded={open} onClick={() => setOpen(!open)}>
      <Bell size={19}/>{unread ? <b>{unread > 99 ? "99+" : unread.toLocaleString("en-US")}</b> : null}
    </button>
    {open ? <section className="notificationBellPanel" dir="rtl">
      <header><div><span>مركز الإشعارات</span><h3>آخر التنبيهات</h3></div>{unread ? <button onClick={markAll}><CheckCheck size={15}/>تحديد الكل كمقروء</button> : null}</header>
      {error ? <div className="notificationPanelState"><CircleAlert size={20}/><span>تعذر تحميل الإشعارات</span><button onClick={load}>إعادة المحاولة</button></div>
      : items.length ? <div className="notificationBellItems">{items.map((item) => <button key={item.id} className={item.isRead ? "" : "unread"} onClick={() => openItem(item)}>
          <i><Bell size={15}/></i><span><b>{item.notification.title}</b><small>{item.notification.message}</small><time>{relativeTime(item.createdAt)}</time></span>
        </button>)}</div>
      : <div className="notificationPanelState"><Bell size={20}/><span>لا توجد إشعارات حتى الآن</span></div>}
      <Link href={href} onClick={() => setOpen(false)}>عرض كل الإشعارات <ChevronLeft size={16}/></Link>
    </section> : null}
  </div>;
}

export function NotificationCenter() {
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [items, setItems] = useState<InboxItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  const load = useCallback(async (next?: string | null, append = false) => {
    setLoading(true);
    setError("");
    try {
      const data = await apiJson(`/api/notifications?filter=${filter}&limit=20${next ? `&cursor=${encodeURIComponent(next)}` : ""}`);
      setItems((current) => append ? [...current, ...data.items] : data.items);
      setUnread(data.unreadCount);
      setCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل الإشعارات");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(null, false), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function action(item: InboxItem, action: "READ" | "UNREAD" | "ARCHIVE") {
    await apiJson(`/api/notifications/${item.id}`, { method: "PATCH", body: JSON.stringify({ action }) });
    if (action === "ARCHIVE") setItems((current) => current.filter((row) => row.id !== item.id));
    else setItems((current) => current.map((row) => row.id === item.id ? { ...row, isRead: action === "READ" } : row));
    setUnread((value) => Math.max(0, value + (action === "READ" && !item.isRead ? -1 : action === "UNREAD" && item.isRead ? 1 : 0)));
  }

  async function markAll() {
    await apiJson("/api/notifications", { method: "POST", body: JSON.stringify({ action: "MARK_ALL_READ" }) });
    setItems((current) => current.map((item) => ({ ...item, isRead: true })));
    setUnread(0);
  }

  return <section className="notificationCenter" dir="rtl">
    <header className="notificationCenterHero">
      <div><span><Bell size={16}/>مركز الإشعارات</span><h2>كل جديد يخص حسابك في مكان واحد</h2><p>المحاضرات والامتحانات والنتائج والمدفوعات والتنبيهات الإدارية.</p></div>
      <div><b>{unread > 99 ? "99+" : unread.toLocaleString("en-US")}</b><small>غير مقروء</small></div>
    </header>
    <div className="notificationCenterTools">
      <div role="tablist" aria-label="فلترة الإشعارات">
        <button role="tab" aria-selected={filter === "all"} className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>الكل</button>
        <button role="tab" aria-selected={filter === "unread"} className={filter === "unread" ? "active" : ""} onClick={() => setFilter("unread")}>غير المقروء</button>
      </div>
      {unread ? <button onClick={markAll}><CheckCheck size={16}/>تحديد الكل كمقروء</button> : null}
    </div>
    {loading && !items.length ? <div className="notificationCenterState"><LoaderCircle className="spin" size={24}/><b>جارٍ تحميل الإشعارات…</b></div>
    : error ? <div className="notificationCenterState error"><CircleAlert size={24}/><b>{error}</b><button onClick={() => load(null, false)}>إعادة المحاولة</button></div>
    : items.length ? <div className="notificationCenterList">{items.map((item) => <article key={item.id} className={item.isRead ? "" : "unread"}>
        <button className="notificationOpenButton" onClick={() => { void action(item, "READ"); router.push(item.notification.link); }}>
          <i><Bell size={18}/></i><span><b>{item.notification.title}</b><p>{item.notification.message}</p><time>{relativeTime(item.createdAt)}</time></span><ChevronLeft size={18}/>
        </button>
        <div><button onClick={() => action(item, item.isRead ? "UNREAD" : "READ")}>{item.isRead ? "تحديد كغير مقروء" : "تحديد كمقروء"}</button><button onClick={() => action(item, "ARCHIVE")}>أرشفة</button></div>
      </article>)}</div>
    : <div className="notificationCenterState"><Bell size={25}/><b>{filter === "unread" ? "قرأت كل إشعاراتك" : "لا توجد إشعارات حتى الآن"}</b><span>ستظهر التنبيهات الحقيقية هنا فور وصولها.</span></div>}
    {cursor ? <button className="notificationLoadMore" onClick={() => load(cursor, true)} disabled={loading}>{loading ? "جارٍ التحميل…" : "تحميل المزيد"}</button> : null}
  </section>;
}
