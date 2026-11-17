import { RegisterForm } from "@/components/auth/AuthForms";

export const metadata = { title: "Criar conta" };

export default function RegisterPage() {
  return (
    <div className="panel w-full max-w-2xl p-6">
      <h1 className="text-xl font-semibold">Crie sua conta gratuita</h1>
      <p className="mb-4 mt-1 text-sm text-muted">Sem assinatura nesta fase. Escolha o tipo de conta — você pode usar a plataforma de mercados sem login.</p>
      <RegisterForm />
    </div>
  );
}
