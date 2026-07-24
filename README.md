# منصة تعليمية عربية متعددة المستأجرين

منصة SaaS تعليمية مبنية بـ Next.js 16 وTypeScript وPrisma وSupabase PostgreSQL. كل مدرس يمثل Tenant مستقلًا، وجميع بيانات الكورسات والطلاب والاشتراكات والمحتوى والإعدادات مقيدة بـ `tenantId` على الخادم.

## التشغيل على localhost

```bash
npm install
npx prisma validate
npx prisma migrate deploy
npx prisma generate
npm run db:validate-tenant
npm run dev
```

ثم افتح [http://localhost:3001](http://localhost:3001).

المشروع يعمل على المنفذ `3001`. لا تشغّل `prisma migrate reset` على هذه القاعدة.

## إعداد قاعدة Supabase

- للتطوير المحلي وعمليات Prisma migrations استخدم **Session Pooler** على المنفذ `5432` في `DATABASE_URL` و`DIRECT_URL`.
- في بيئة Serverless مثل Vercel استخدم **Transaction Pooler** على المنفذ `6543` في `DATABASE_URL`، واحتفظ بـ Session Pooler في `DIRECT_URL` للهجرات.
- أي رموز خاصة داخل كلمة مرور الاتصال يجب أن تكون URL-encoded.
- لا تُرفع ملفات `.env` إلى Git.

انسخ `.env.example` إلى `.env.local` وأدخل القيم. المتغيرات المطلوبة للتشغيل الأساسي:

```text
DATABASE_URL
DIRECT_URL
AUTH_SECRET
AUTH_URL
NEXT_PUBLIC_APP_URL
DEFAULT_TENANT_SLUG
```

رفع شعارات المدرسين يحتاج أيضًا:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET
```

يجب إنشاء bucket عام للشعارات باسم `tenant-assets` أو تغيير `SUPABASE_STORAGE_BUCKET`. مفتاح `service-role` يبقى على الخادم فقط.

## حساب Super Admin

أدخل قيم `ADMIN_NAME`, `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PHONE`, و`ADMIN_PASSWORD` ثم نفّذ:

```bash
npm run db:seed
```

أمر seed لا يحتوي بيانات دخول افتراضية ولا يعمل قبل إدخال القيم، منعًا لإنشاء حساب معروف أو ضعيف.

## المسارات الرئيسية

- `/teacher-register`: تسجيل مدرس وإنشاء Tenant مستقل.
- `/t/[tenantSlug]`: الصفحة العامة المخصصة للمدرس.
- `/teacher`: لوحة المدرس.
- `/teacher/courses`, `/teacher/students`, `/teacher/staff`: إدارة بيانات المستأجر.
- `/teacher/branding`, `/teacher/settings`: الهوية وإعدادات الصفحة العامة.
- `/teacher/activation-codes`: إنشاء أكواد تفعيل آمنة تظهر مرة واحدة.
- `/super-admin`: لوحة الإدارة العامة والتحليلات الحقيقية.
- `/super-admin/teachers`: إدارة المدرسين وحالات المنصات.
- `/super-admin/announcements`, `/super-admin/settings`, `/super-admin/audit-logs`: الإعلانات والإعدادات والتدقيق.

## فحوص الجودة

```bash
npm run typecheck
npm run lint
npm test
npm run db:validate-tenant
npm run build
```

راجع `IMPLEMENTATION_REPORT.md` للتقرير الكامل ونتائج الهجرة والاختبارات.