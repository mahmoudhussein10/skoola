import { z } from "zod";
import { isBunnyStorageUrl } from "./media/trusted-url.ts";

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
    grade: z.enum(["FIRST_PREPARATORY", "SECOND_PREPARATORY", "THIRD_PREPARATORY", "FIRST_SECONDARY", "SECOND_SECONDARY", "THIRD_SECONDARY"]),
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

const themeFonts = ["Tajawal", "Cairo", "Alexandria", "Noto Kufi Arabic", "IBM Plex Sans Arabic", "Inter", "Poppins", "Roboto", "Montserrat"] as const;
const themePresets = ["CLASSIC_BLUE", "PREMIUM_BLACK", "EDUCATIONAL_GREEN", "MODERN_PURPLE", "ELEGANT_BURGUNDY", "CLEAN_ORANGE", "MINIMAL", "GLASS", "DARK_PRO", "KIDS", "LUXURY", "FUTURE_TECH", "SKOOLA"] as const;
export const themeSchema = z.object({
  primaryColor:z.string().regex(hexColor),secondaryColor:z.string().regex(hexColor),accentColor:z.string().regex(hexColor),backgroundColor:z.string().regex(hexColor),surfaceColor:z.string().regex(hexColor),textColor:z.string().regex(hexColor),mutedColor:z.string().regex(hexColor),buttonColor:z.string().regex(hexColor).optional().default("#1565f5"),successColor:z.string().regex(hexColor).optional().default("#15803d"),warningColor:z.string().regex(hexColor).optional().default("#b45309"),dangerColor:z.string().regex(hexColor).optional().default("#dc2626"),navbarColor:z.string().regex(hexColor).optional().default("#ffffff"),footerColor:z.string().regex(hexColor).optional().default("#081b3a"),linkColor:z.string().regex(hexColor).optional().default("#1565f5"),hoverColor:z.string().regex(hexColor).optional().default("#0f4ed8"),sidebarColor:z.string().regex(hexColor).optional().default("#081b3a"),
  borderRadius:z.number().int().min(0).max(32),buttonRadius:z.number().int().min(0).max(32),fontFamily:z.enum(themeFonts),headingFont:z.enum(themeFonts).optional().default("Tajawal"),bodyFont:z.enum(themeFonts).optional().default("Tajawal"),buttonFont:z.enum(themeFonts).optional().default("Tajawal"),cardStyle:z.enum(["FLAT","ELEVATED","GLASS","OUTLINE","SOFT"]).optional().default("ELEVATED"),buttonStyle:z.enum(["FILLED","OUTLINE","GRADIENT","SHADOW","PILL"]).optional().default("GRADIENT"),animationStyle:z.enum(["NONE","MINIMAL","SMOOTH","MODERN","PREMIUM"]).optional().default("SMOOTH"),heroLayout:z.enum(["CENTERED","SPLIT","IMAGE_LEFT","BACKGROUND","FULL"]).optional().default("SPLIT"),heroImageUrl:z.string().url().max(2048).refine(isBunnyStorageUrl,"ارفع صورة الواجهة من جهازك").nullable().optional(),teacherPortraitUrl:z.string().url().max(2048).refine(isBunnyStorageUrl,"ارفع صورة المدرس من جهازك").nullable().optional(),heroImagePosition:z.string().regex(/^\d{1,3}%\s\d{1,3}%$/).default("50% 50%"),heroOverlay:z.number().int().min(0).max(75).optional().default(18),heroTitle:z.string().trim().max(140).nullable().optional(),heroSubtitle:z.string().trim().max(360).nullable().optional(),heroCtaLabel:z.string().trim().min(2).max(50).optional().default("أنشئ حسابك مجانًا"),heroSecondaryLabel:z.string().trim().min(2).max(50).optional().default("استكشف الكورسات"),homepageSections:z.array(z.enum(["HERO","COURSES","FEATURES","STATS","FAQ","CONTACT"])).min(2).max(6).optional().default(["HERO","COURSES","FEATURES","STATS","FAQ","CONTACT"]),preset:z.enum(themePresets),
}).superRefine((theme,context)=>{
  if(contrastRatio(theme.textColor,theme.backgroundColor)<4.5)context.addIssue({code:"custom",path:["textColor"],message:"تباين النص مع الخلفية منخفض؛ اختر ألوانًا أوضح."});
  if(contrastRatio(theme.primaryColor,theme.backgroundColor)<1.35)context.addIssue({code:"custom",path:["primaryColor"],message:"اللون الأساسي قريب جدًا من الخلفية."});
});