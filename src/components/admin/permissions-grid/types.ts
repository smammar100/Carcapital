import type { Capability } from "@/lib/capabilities";
import type { UUID } from "@/lib/types";

/** Per-user effective capability set, keyed by user id. */
export type PermissionsMap = Map<UUID, Set<Capability>>;

/** A single cell whose local value diverges from the server ground truth. */
export interface PendingChange {
  userId: UUID;
  capability: Capability;
  /** Target value in localState — true = granting, false = revoking. */
  next: boolean;
}
