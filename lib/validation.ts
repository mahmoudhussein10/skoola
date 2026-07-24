import { z } from "zod";

const egyptianPhone = /^01[0125][0-9]{8}$/;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const hexColor = /^#[0-9a-fA-F]{6}$/;

export const loginSchema = z.object({
  identifier: z.string().trim().min(3).max(120),
  password: z.string().min(8).max(128),
  remember: z.boolean().optional().default(false),
  tenantSlug: z.string().trim().toLowerCase().regex(slugPattern).optional(),
});

export const signupSchema = z
  .object({
    fullName: z.string().trim().min(3, "الاسم يجب أن يكون 3 أحرف على الأقل").max(100),
    username: z.string().trim().toLowerCase().regex(/^[a-zA-Z0-9_]{3,30}$/, "اسم المستخدم يقبل الحروف الإنجليزية والأرقام و _ فقط"),
    email: z.union([z.string().trim().email("البريد الإلكتروني غير صحيح"), z.literal("")]).optional(),
    phone: z.string().trim().regex(egyptianPhone, "أدخل رقم هاتف مصري صحيح"),
    parentPhone: z.string().trim().regex(egyptianPhone, "أدخل رقم ولي أمر مصري صحيح"),
    grade: z.enum(["FIRST_SECONDARY", "SECOND_SECONDARY", "THIRD_SECONDARY"]),
    governorate: z.string().trim().min(2).max(60),
    tenantSlug: z.string().trim().toLowerCase().regex(slugPattern).optional(),
    password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل").max(128),
    confirmPassword: z.string(),
    acceptedTerms: z.literal(true),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "كلمتا المرور غير متطابقتين",
  });

export const teacherSignupSchema = z
  .object({
    fullName: z.string().trim().min(3).max(100),
    username: z.string().trim().toLowerCase().regex(/^[a-zA-Z0-9_]{3,30}$/),
    email: z.string().trim().toLowerCase().email(),
    phone: z.string().trim().regex(egyptianPhone),
    password: z.string().min(10).max(128),
    confirmPassword: z.string(),
    platformName: z.string().trim().min(3).max(100),
    slug: z.string().trim().toLowerCase().min(3).max(50).regex(slugPattern),
    subject: z.string().trim().min(2).max(80),
    acceptedTerms: z.literal(true),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "كلمتا المرور غير متطابقتين",
  });

function relativeLuminance(hex: string) {
  const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255).map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrastRatio(first: string, second: string) {
  const [light, dark] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

export const themeSchema = z.object({
  primaryColor: z.string().regex(hexColor),
  secondaryColor: z.string().regex(hexColor),
  accentColor: z.string().regex(hexColor),
  backgroundColor: z.string().regex(hexColor),
  surfaceColor: z.string().regex(hexColor),
  textColor: z.string().regex(hexColor),
  mutedColor: z.string().regex(hexColor),
  borderRadius: z.number().int().min(8).max(28),
  buttonRadius: z.number().int().min(6).max(24),
  fontFamily: z.enum(["Tajawal", "Cairo", "Alexandria", "Noto Kufi Arabic"]),
  preset: z.enum(["CLASSIC_BLUE", "PREMIUM_BLACK", "EDUCATIONAL_GREEN", "MODERN_PURPLE", "ELEGANT_BURGUNDY", "CLEAN_ORANGE", "SKOOLA"]),
}).superRefine((theme, context) => {
  if (contrastRatio(theme.textColor, theme.backgroundColor) < 4.5) context.addIssue({ code: "custom", path: ["textColor"], message: "تباين النص مع الخلفية منخفض؛ اختر ألوانًا أوضح." });
  if (contrastRatio(theme.primaryColor, theme.backgroundColor) < 1.35) context.addIssue({ code: "custom", path: ["primaryColor"], message: "اللون الأساسي قريب جدًا من الخلفية." });
});