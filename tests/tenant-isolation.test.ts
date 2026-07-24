import test from "node:test";
import assert from "node:assert/strict";
import { assertTenantAccess, tenantStoragePath, tenantWhere } from "../lib/tenant-security.ts";
import { hasPermission } from "../lib/permissions.ts";
import { themeSchema } from "../lib/validation.ts";
import { paymentSettingsSchema, visiblePaymentMethods } from "../lib/payment-settings.ts";

test("tenant scope always overrides a tenantId supplied by the browser", () => {
  const scoped = tenantWhere("tenant-a", { tenantId: "tenant-b", status: "PUBLISHED" });
  assert.equal(scoped.tenantId, "tenant-a");
  assert.equal(scoped.status, "PUBLISHED");
});

test("cross-tenant ownership checks fail closed", () => {
  assert.doesNotThrow(() => assertTenantAccess("tenant-a", "tenant-a"));
  assert.throws(() => assertTenantAccess("tenant-a", "tenant-b"), /TENANT_ACCESS_DENIED/);
  assert.throws(() => assertTenantAccess("", "tenant-b"), /TENANT_ACCESS_DENIED/);
});

test("teacher permissions do not grant privilege escalation", () => {
  assert.equal(hasPermission("TEACHER_OWNER", "staff.manage"), true);
  assert.equal(hasPermission("TEACHER_EDITOR", "courses.manage"), true);
  assert.equal(hasPermission("TEACHER_EDITOR", "tenant.settings.manage"), false);
  assert.equal(hasPermission("STUDENT", "students.view"), false);
  assert.equal(hasPermission("SUPER_ADMIN", "audit.view"), true);
});

test("storage paths are tenant scoped and reject traversal", () => {
  assert.equal(tenantStoragePath("tenant-a", "courses", "course-1", "lesson.pdf"), "tenants/tenant-a/courses/course-1/lesson.pdf");
  assert.throws(() => tenantStoragePath("tenant-a", "..", "secret"), /INVALID_STORAGE_PATH/);
});

test("support mode remains read-only even when analytics access is granted", () => {
  assert.equal(hasPermission("SUPPORT_STAFF", "analytics.view", ["analytics.view"]), true);
  assert.equal(hasPermission("SUPPORT_STAFF", "courses.manage", ["analytics.view"]), false);
  assert.equal(hasPermission("SUPPORT_STAFF", "tenant.branding.manage", ["analytics.view"]), false);
  assert.equal(hasPermission("SUPPORT_STAFF", "staff.manage", ["analytics.view"]), false);
});

test("storage segments cannot escape into another tenant prefix", () => {
  const path = tenantStoragePath("tenant-a", "tenants/tenant-b", "private.pdf");
  assert.equal(path, "tenants/tenant-a/tenants-tenant-b/private.pdf");
  assert.equal(path.startsWith("tenants/tenant-a/"), true);
});

test("theme tokens accept controlled accessible values and reject arbitrary CSS", () => {
  const valid = { primaryColor: "#2457d6", secondaryColor: "#10204a", accentColor: "#4f7cff", backgroundColor: "#f6f8fc", surfaceColor: "#ffffff", textColor: "#17213a", mutedColor: "#65708a", borderRadius: 16, buttonRadius: 14, fontFamily: "Tajawal", preset: "CLASSIC_BLUE" };
  assert.equal(themeSchema.safeParse(valid).success, true);
  assert.equal(themeSchema.safeParse({ ...valid, primaryColor: "red; background:url(javascript:alert(1))" }).success, false);
  assert.equal(themeSchema.safeParse({ ...valid, borderRadius: 200 }).success, false);
});
test("enabled payment methods require real receiving data", () => {
  const base = { vodafoneCashEnabled: false, vodafoneCashNumber: "", instaPayEnabled: false, instaPayAddress: "", accountHolderName: "", paymentInstructions: "" };
  assert.equal(paymentSettingsSchema.safeParse(base).success, true);
  assert.equal(paymentSettingsSchema.safeParse({ ...base, vodafoneCashEnabled: true }).success, false);
  assert.equal(paymentSettingsSchema.safeParse({ ...base, vodafoneCashEnabled: true, vodafoneCashNumber: "01012345678", accountHolderName: "صاحب الحساب" }).success, true);
  assert.equal(paymentSettingsSchema.safeParse({ ...base, instaPayEnabled: true, instaPayAddress: "", accountHolderName: "صاحب الحساب" }).success, false);
});

test("students only receive payment methods enabled by their tenant", () => {
  const methods = visiblePaymentMethods({ vodafoneCashEnabled: false, vodafoneCashNumber: "01012345678", instaPayEnabled: true, instaPayAddress: "teacher@instapay" });
  assert.deepEqual(methods, [{ type: "instapay", title: "InstaPay", value: "teacher@instapay", holder: undefined }]);
  assert.deepEqual(visiblePaymentMethods(null), []);
});