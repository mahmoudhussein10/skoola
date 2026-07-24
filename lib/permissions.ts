import type { UserRole } from "@prisma/client";

export const permissions = [
  "tenant.view",
  "tenant.settings.manage",
  "tenant.branding.manage",
  "courses.view",
  "courses.manage",
  "students.view",
  "students.manage",
  "staff.view",
  "staff.manage",
  "analytics.view",
  "notifications.manage",
  "assignments.manage",
  "exams.manage",
  "activationCodes.manage",
  "audit.view",
] as const;

export type Permission = (typeof permissions)[number];

const rolePermissions: Partial<Record<UserRole, readonly Permission[]>> = {
  TEACHER_OWNER: permissions,
  TEACHER_ADMIN: permissions.filter((permission) => permission !== "tenant.settings.manage"),
  TEACHER_EDITOR: ["tenant.view", "courses.view", "courses.manage", "assignments.manage", "exams.manage"],
  SUPPORT_STAFF: ["tenant.view", "courses.view", "students.view"],
  STUDENT: ["tenant.view", "courses.view"],
};

export const tenantStaffRoles: UserRole[] = [
  "TEACHER_OWNER",
  "TEACHER_ADMIN",
  "TEACHER_EDITOR",
  "SUPPORT_STAFF",
];

export function hasPermission(
  role: UserRole,
  permission: Permission,
  customPermissions?: unknown,
) {
  if (role === "SUPER_ADMIN" || role === "ADMIN") return true;
  const defaults = rolePermissions[role] ?? [];
  if (defaults.includes(permission)) return true;
  return Array.isArray(customPermissions) && customPermissions.includes(permission);
}
