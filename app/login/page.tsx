import { redirect } from "next/navigation";
import { AuthVisual } from "../auth-visual";
import { Brand } from "../ui";
import { LoginForm } from "../auth-form";
import { getAuthContext, homeForRole } from "../../lib/auth";

export const metadata = { title: "تسجيل الدخول" };

export default async function LoginPage() {
  const auth = await getAuthContext();
  if (auth) {
    redirect(homeForRole(auth.user.role));
  }
  return <main className="authPage skoolaAuthPage"><AuthVisual/><section className="authCard"><div className="authMobileBrand"><Brand/></div><div className="authCardInner"><span className="skoolaPill">مرحبًا بعودتك</span><h1>سجّل دخولك إلى Skoola</h1><p>واصل التدريس أو التعلّم من حيث توقفت.</p><LoginForm/></div></section></main>;
}