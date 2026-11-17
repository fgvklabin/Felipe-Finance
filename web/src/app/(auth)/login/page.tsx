import { Suspense } from "react";
import { LoginForm } from "@/components/auth/AuthForms";

export const metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <div className="panel w-full max-w-sm p-6">
      <h1 className="text-xl font-semibold">Entrar na Avermont</h1>
      <p className="mb-4 mt-1 text-sm text-muted">Acesse watchlists, alertas, Avermont Business e sua carteira.</p>
      <Suspense><LoginForm /></Suspense>
    </div>
  );
}
