import { redirect } from "next/navigation";

export const metadata = { title: "دخول المدرس" };

export default function TeacherRegisterPage() {
  redirect("/login?role=teacher&managed=1");
}