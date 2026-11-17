import { ForgotForm } from "@/components/auth/AuthForms";

export const metadata = { title: "Recuperar senha" };

export default function ForgotPage() {
  return (
    <div className="panel w-full max-w-sm p-6">
      <h1 className="text-xl font-semibold">Recuperar senha</h1>
      <p className="mb-4 mt-1 text-sm text-muted">Enviaremos um link válido por 1 hora.</p>
      <ForgotForm />
    </div>
  );
}
