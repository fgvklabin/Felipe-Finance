import "server-only";
import { cookies } from "next/headers";
import { getMemberships, type Membership, type User } from "./auth";
import { getMacro, getSummaryItem } from "./market";
import { monthlyRate } from "./procurement";

export const WS_COOKIE = "avm_ws";

/** Workspace ativo do usuário (cookie), restrito às suas associações. */
export async function currentWorkspace(user: User): Promise<Membership | null> {
  const ms = await getMemberships(user.id);
  if (!ms.length) return null;
  const c = (await cookies()).get(WS_COOKIE)?.value;
  return ms.find((m) => m.workspace_id === c) ?? ms[0];
}

/** Taxas reais usadas nos cálculos: PTAX mais recente e Selic (meta) convertida para taxa mensal. */
export function marketParams() {
  const usd = getSummaryItem("usdbrl")?.stats;
  const eur = getSummaryItem("eurbrl")?.stats;
  const selicPts = getMacro().indicators["selic-meta"]?.points ?? [];
  const selic = selicPts.length ? selicPts[selicPts.length - 1] : null;
  return {
    fx: { USD: usd?.last ?? 0, EUR: eur?.last ?? 0 },
    fxDate: usd?.lastDate ?? null,
    selicAnnual: selic?.[1] ?? null,
    selicDate: selic?.[0] ?? null,
    rateMonthly: selic ? monthlyRate(selic[1]) : 0,
  };
}
