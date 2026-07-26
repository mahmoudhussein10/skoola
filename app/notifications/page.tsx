import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { AppTop, Side } from "../ui";
import { NotificationCenter, PushSettingsCard } from "./push-client";

export const metadata = { title: "الإشعارات | Skoola" };

export default async function StudentNotificationsPage() {
  const auth = await getAuthContext();
  if (!auth?.membership || auth.user.role !== "STUDENT") redirect("/login?role=student&next=/notifications");
  return <div className="appShell studentShell">
    <Side active="الإشعارات" />
    <main className="appMain">
      <AppTop title="الإشعارات" sub="كل جديد في رحلتك التعليمية" userName={auth.user.fullName} />
      <NotificationCenter />
      <PushSettingsCard />
    </main>
  </div>;
}
