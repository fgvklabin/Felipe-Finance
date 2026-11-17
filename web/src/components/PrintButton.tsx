"use client";

import { Printer } from "lucide-react";
import { btnClass } from "./ui";

export function PrintButton() {
  return (
    <button className={btnClass("outline", "sm")} onClick={() => window.print()}>
      <Printer size={14} /> Imprimir / PDF
    </button>
  );
}
