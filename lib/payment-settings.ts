import { z } from "zod";

const egyptianPhone = /^01[0125]\d{8}$/;

export const paymentSettingsSchema = z.object({
  vodafoneCashEnabled: z.boolean(),
  vodafoneCashNumber: z.string().trim().max(20),
  instaPayEnabled: z.boolean(),
  instaPayAddress: z.string().trim().max(120),
  bankTransferEnabled: z.boolean().optional().default(false),
  bankName: z.string().trim().max(120).optional().default(""),
  bankAccountNumber: z.string().trim().max(100).optional().default(""),
  bankIban: z.string().trim().max(100).optional().default(""),
  accountHolderName: z.string().trim().max(120).optional().default(""),
  paymentInstructions: z.string().trim().max(1200).optional().default(""),
}).superRefine((data, context) => {
  const vodafone = data.vodafoneCashNumber.replace(/[\s-]/g, "");
  if (data.vodafoneCashEnabled && !egyptianPhone.test(vodafone)) {
    context.addIssue({ code: "custom", path: ["vodafoneCashNumber"], message: "أدخل رقم Vodafone Cash مصريًا صحيحًا" });
  }
  if (data.instaPayEnabled && data.instaPayAddress.length < 3) {
    context.addIssue({ code: "custom", path: ["instaPayAddress"], message: "أدخل رقم الهاتف أو عنوان InstaPay" });
  }
  if (data.bankTransferEnabled && (!data.bankName || !data.bankAccountNumber)) {
    context.addIssue({ code: "custom", path: ["bankName"], message: "أدخل اسم البنك ورقم الحساب البنكي" });
  }
  if ((data.vodafoneCashEnabled || data.instaPayEnabled || data.bankTransferEnabled) && data.accountHolderName.length < 3) {
    context.addIssue({ code: "custom", path: ["accountHolderName"], message: "أدخل اسم صاحب الحساب" });
  }
});

export type ActivePaymentMethod = {
  type: "vodafone" | "instapay" | "bank";
  title: string;
  value: string;
  bankName?: string;
  iban?: string | null;
  holder?: string | null;
};

export function visiblePaymentMethods(settings: {
  vodafoneCashEnabled: boolean;
  vodafoneCashNumber: string | null;
  instaPayEnabled: boolean;
  instaPayAddress: string | null;
  bankTransferEnabled?: boolean;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankIban?: string | null;
  accountHolderName?: string | null;
} | null): ActivePaymentMethod[] {
  if (!settings) return [];
  const list: (ActivePaymentMethod | null)[] = [
    settings.vodafoneCashEnabled && settings.vodafoneCashNumber ? { type: "vodafone", title: "Vodafone Cash", value: settings.vodafoneCashNumber, holder: settings.accountHolderName } : null,
    settings.instaPayEnabled && settings.instaPayAddress ? { type: "instapay", title: "InstaPay", value: settings.instaPayAddress, holder: settings.accountHolderName } : null,
    settings.bankTransferEnabled && settings.bankName && settings.bankAccountNumber ? { type: "bank", title: "تحويل بنكي", bankName: settings.bankName, value: settings.bankAccountNumber, iban: settings.bankIban, holder: settings.accountHolderName } : null,
  ];
  return list.filter((m): m is ActivePaymentMethod => m !== null);
}