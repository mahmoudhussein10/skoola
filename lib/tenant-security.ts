export function tenantWhere<T extends object>(tenantId: string, where?: T) {
  return { ...(where ?? ({} as T)), tenantId };
}

export function assertTenantAccess(expectedTenantId: string, actualTenantId: string) {
  if (!expectedTenantId || expectedTenantId !== actualTenantId) {
    throw new Error("TENANT_ACCESS_DENIED");
  }
}

export function tenantStoragePath(tenantId: string, ...segments: string[]) {
  const safe = [tenantId, ...segments].map((segment) => {
    const normalized = segment.trim().replace(/[^a-zA-Z0-9._-]/g, "-");
    if (!normalized || normalized === "." || normalized === "..") {
      throw new Error("INVALID_STORAGE_PATH");
    }
    return normalized;
  });
  return ["tenants", ...safe].join("/");
}
