"use client";
import { createContext, useContext } from "react";
import type { StaffAccount } from "@/lib/supabase/types";
export const StaffContext = createContext<StaffAccount | null>(null);
export const useStaff = () => useContext(StaffContext);
