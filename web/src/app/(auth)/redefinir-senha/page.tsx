import { Suspense } from "react";
import { ResetForm } from "@/components/auth/AuthForms";

export const metadata = { title: "Redefinir senha" };

export default function ResetPage() {
  return (
    <div className="panel w-full max-w-sm p-6">
      <h1 className="text-xl font-semibold">Definir nova senha</h1>
      <p className="mb-4 mt-1 text-sm text-muted">Todas as sessões anteriores serão encerradas.</p>
      <Suspense><ResetForm /></Suspense>
    </div>
  );
}
