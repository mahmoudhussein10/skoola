import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  isInvalidFirebaseTokenCode,
  isPushEligibleRole,
  normalizeInternalNotificationUrl,
  safeFirebaseErrorCode,
} from "../lib/notifications/security.ts";

test("notification links accept only internal Skoola routes", () => {
  assert.equal(normalizeInternalNotificationUrl("/teacher/payments"), "/teacher/payments");
  assert.equal(normalizeInternalNotificationUrl("/course?courseId=abc"), "/course?courseId=abc");
  assert.equal(normalizeInternalNotificationUrl("https://evil.example/phish"), "/dashboard");
  assert.equal(normalizeInternalNotificationUrl("//evil.example/phish"), "/dashboard");
  assert.equal(normalizeInternalNotificationUrl("javascript:alert(1)"), "/dashboard");
});

test("push is limited to eligible authenticated product roles", () => {
  assert.equal(isPushEligibleRole("STUDENT"), true);
  assert.equal(isPushEligibleRole("TEACHER_OWNER"), true);
  assert.equal(isPushEligibleRole("SUPER_ADMIN"), false);
});

test("Firebase errors are reduced to safe internal codes", () => {
  assert.equal(safeFirebaseErrorCode({ code: "messaging/registration-token-not-registered" }), "TOKEN_UNREGISTERED");
  assert.equal(safeFirebaseErrorCode({ code: "messaging/invalid-registration-token" }), "TOKEN_INVALID");
  assert.equal(isInvalidFirebaseTokenCode("TOKEN_INVALID"), true);
  assert.equal(safeFirebaseErrorCode(new Error("secret provider detail")), "PROVIDER_FAILURE");
});

test("business event keys are deterministic and versioned", async () => {
  const source = await readFile(new URL("../lib/notifications/events.ts", import.meta.url), "utf8");
  for (const key of ["lesson-published:", "exam-published:", "exam-result-released:", "enrollment-request:", "payment-proof-submitted:", "payment-approved:", "payment-rejected:"]) {
    assert.equal(source.includes(key), true, key);
  }
});

test("notification APIs never serialize device tokens", async () => {
  const files = [
    "../app/api/notifications/route.ts",
    "../app/api/notifications/[recipientId]/route.ts",
    "../app/api/notifications/device/route.ts",
    "../app/api/notifications/preferences/route.ts",
  ];
  for (const file of files) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.equal(/NextResponse\.json\([^\n]*token\s*:/i.test(source), false, file);
  }
});

test("service persists recipients before sending multicast push", async () => {
  const source = await readFile(new URL("../lib/notifications/service.ts", import.meta.url), "utf8");
  const recipientWrite = source.indexOf("notificationRecipient.createMany");
  const pushSend = source.indexOf("sendEachForMulticast");
  assert.ok(recipientWrite >= 0 && pushSend > recipientWrite);
  assert.equal(source.includes("take: 2000"), true);
  assert.equal(source.includes("skipDuplicates: true"), true);
});
