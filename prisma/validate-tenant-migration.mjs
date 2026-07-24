import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function mismatchCount(query) {
  const rows = await prisma.$queryRawUnsafe(query);
  return Number(rows[0]?.count ?? 0);
}

async function main() {
  const tenants = await prisma.tenant.count();
  if (!tenants) throw new Error("No tenant exists after migration.");

  const checks = {
    sectionCourse: await mismatchCount('SELECT COUNT(*)::int AS count FROM "Section" s JOIN "Course" c ON c.id=s."courseId" WHERE s."tenantId"<>c."tenantId"'),
    lessonSection: await mismatchCount('SELECT COUNT(*)::int AS count FROM "Lesson" l JOIN "Section" s ON s.id=l."sectionId" WHERE l."tenantId"<>s."tenantId"'),
    enrollmentCourse: await mismatchCount('SELECT COUNT(*)::int AS count FROM "Enrollment" e JOIN "Course" c ON c.id=e."courseId" WHERE e."tenantId"<>c."tenantId"'),
    examCourse: await mismatchCount('SELECT COUNT(*)::int AS count FROM "Exam" e JOIN "Course" c ON c.id=e."courseId" WHERE e."tenantId"<>c."tenantId"'),
    paymentCourse: await mismatchCount('SELECT COUNT(*)::int AS count FROM "Payment" p JOIN "Course" c ON c.id=p."courseId" WHERE p."tenantId"<>c."tenantId"'),
    studentMembership: await mismatchCount('SELECT COUNT(*)::int AS count FROM "StudentProfile" p LEFT JOIN "TenantMember" m ON m."tenantId"=p."tenantId" AND m."userId"=p."userId" WHERE m.id IS NULL'),
  };
  const failures = Object.entries(checks).filter(([, count]) => count !== 0);
  if (failures.length) throw new Error("Tenant migration validation failed: " + JSON.stringify(failures));
  console.log("Tenant migration valid:", { tenants, checks });
}

main().finally(() => prisma.$disconnect());
