import "server-only";
import { cookies } from "next/headers";
import type { Locale } from "./format";

export type Theme = "dark" | "light";
export type DataModePref = "all" | "real";

export interface Prefs { locale: Locale; theme: Theme; dataMode: DataModePref }

/** Preferências de interface lidas de cookies (funcionam também sem login). */
export async function getPrefs(): Promise<Prefs> {
  const c = await cookies();
  return {
    locale: c.get("avm_lang")?.value === "en" ? "en" : "pt",
    theme: c.get("avm_theme")?.value === "light" ? "light" : "dark",
    dataMode: c.get("avm_data")?.value === "real" ? "real" : "all",
  };
}
