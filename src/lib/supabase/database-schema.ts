import type { Database as GeneratedDatabase } from "./database.types";

// PostgreSQL introspection does not describe nullable function arguments.
// The versioned save RPC deliberately accepts null for a new record.
type Functions = GeneratedDatabase["public"]["Functions"];
export type Database = Omit<GeneratedDatabase, "public"> & {
  public: Omit<GeneratedDatabase["public"], "Functions"> & {
    Functions: Omit<Functions, "staff_save_record"> & {
      staff_save_record: Omit<Functions["staff_save_record"], "Args"> & {
        Args: Omit<Functions["staff_save_record"]["Args"], "p_id" | "p_revision"> & { p_id: string | null; p_revision: number | null };
      };
    };
  };
};
