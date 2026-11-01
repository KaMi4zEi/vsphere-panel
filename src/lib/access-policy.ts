const passwordChangePaths = new Set([
  "/change-password",
  "/api/profile/change-password",
]);

export function canAccessDuringPasswordChange(pathname: string) {
  return passwordChangePaths.has(pathname);
}
