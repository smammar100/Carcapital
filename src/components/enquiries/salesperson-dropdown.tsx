"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { teamService } from "@/lib/services/team-service";
import type { User } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface SalespersonDropdownProps {
  value: string;
  onChange: (userId: string) => void;
  invalid?: boolean;
}

/**
 * Lists the company's sales-eligible users. Includes anyone with role
 * `sales` or `admin`, plus super-users. Defaults aren't applied here —
 * the parent form seeds `defaultValues` from `useAuth().user.id`.
 */
export function SalespersonDropdown({
  value,
  onChange,
  invalid,
}: SalespersonDropdownProps) {
  const { company } = useAuth();
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    if (!company?.id) return;
    void teamService.getAll(company.id).then((all) => {
      setUsers(
        all.filter(
          (u) =>
            u.active &&
            (u.isSuperUser ||
              u.role === "sales" ||
              u.role === "admin" ||
              u.roles?.some(
                (r) =>
                  r === "sales_specialist" ||
                  r === "sales_manager" ||
                  r === "administrator" ||
                  r === "owner",
              )),
        ),
      );
    });
  }, [company?.id]);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-invalid={invalid}
        className={cn(invalid && "border-destructive")}
      >
        <SelectValue placeholder="Pick salesperson" />
      </SelectTrigger>
      <SelectContent>
        {users.map((u) => (
          <SelectItem key={u.id} value={u.id}>
            {u.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
