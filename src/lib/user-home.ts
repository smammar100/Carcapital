import type { User } from "./types";
import type { RoleValue } from "./roles";

/**
 * Role-appropriate landing page after login. A user only ever lands on a
 * route their capabilities unlock (verified against the sidebar/RouteGuard
 * gates). Multi-role users get the highest-priority match. Super-users and
 * the admin roles land on the full dashboard.
 */
const HOME_BY_ROLE: Array<{ role: RoleValue; home: string }> = [
  { role: "iam_admin", home: "/admin/users-and-permissions" },
  { role: "driver", home: "/inventory/add-vehicle" },
  { role: "inspector", home: "/maintenance/inspection" },
  { role: "workshop_lead", home: "/maintenance" },
  { role: "inventory_manager", home: "/vehicles" },
  { role: "sales_specialist", home: "/sales/leads" },
  { role: "sales_manager", home: "/sales/leads" },
  { role: "finance_admin", home: "/admin/invoicing" },
  { role: "aftercare_specialist", home: "/warranties" },
  { role: "view_only", home: "/admin/master-sheet" },
];

export function getHomeForUser(user: Pick<User, "roles" | "isSuperUser">): string {
  if (user.isSuperUser) return "/dashboard";
  if (user.roles.includes("owner") || user.roles.includes("administrator")) {
    return "/dashboard";
  }
  for (const { role, home } of HOME_BY_ROLE) {
    if (user.roles.includes(role)) return home;
  }
  return "/dashboard";
}
