import type { Fund } from "./market";
import type { FundRow } from "@/components/invest/FundsTable";

export function toFundRows(funds: Fund[]): FundRow[] {
  return funds.map((f) => ({
    cnpj: f.cnpj, cnpjDigits: f.cnpjDigits, name: f.name, vehicle: f.vehicle, classification: f.classification, manager: f.manager, netAssets: f.netAssets,
    tags: f.tags, exposureType: f.exposureType, return12m: f.performance?.return12m ?? null, returnYtd: f.performance?.returnYtd ?? null,
    vol: f.performance?.volatility12m ?? null, dd: f.performance?.maxDrawdown12m ?? null, fee: f.documents?.managementFee ?? null, quotaDate: f.performance?.quotaDate ?? null,
  }));
}
