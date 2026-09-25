import type { PublicBurialRecord } from "@/lib/supabase/types";

type PublicNavigationRecord = Pick<
  PublicBurialRecord,
  "coordinateStatus" | "location" | "locationVerified"
>;

export function canNavigateToPublicRecord(record: PublicNavigationRecord) {
  return Boolean(
    record.location &&
      record.locationVerified &&
      record.coordinateStatus === "verified",
  );
}
