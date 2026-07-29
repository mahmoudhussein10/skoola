import type { ReactNode } from "react";
import { TeacherSupportButton } from "./teacher-support-button";

export default function TeacherLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <TeacherSupportButton />
    </>
  );
}