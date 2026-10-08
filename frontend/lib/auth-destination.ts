import type { User } from "@/components/auth/auth-provider";

export function accountDestination(user: User): string {
  if (user.password_change_required) return "/change-password";
  return user.role === "owner" ? "/owner" : user.role === "admin" ? "/admin" : "/dashboard";
}

export function can(user: User | null, permission: string): boolean {
  return Boolean(user && !user.password_change_required && (user.role === "owner" || (user.role === "admin" && user.permissions?.includes(permission))));
}
