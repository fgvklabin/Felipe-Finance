"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Building2, LineChart, Truck } from "lucide-react";
import { btnClass, cn, inputClass, labelClass } from "../ui";

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.issues?.[0]?.message ?? d.error ?? "Falha na requisição.");
  return d;
}

function ErrorBox({ msg }: { msg: string | null }) {
  return msg ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400" role="alert">{msg}</div> : null;
}

export function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        const fd = new FormData(e.currentTarget);
        try {
          await post("/api/auth/login", { email: fd.get("email"), password: fd.get("password") });
          const next = sp.get("next");
          router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/visao-geral");
          router.refresh();
        } catch (x) {
          setErr((x as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div><label className={labelClass} htmlFor="email">E-mail</label><input id="email" name="email" type="email" autoComplete="email" required className={inputClass} /></div>
      <div><label className={labelClass} htmlFor="password">Senha</label><input id="password" name="password" type="password" autoComplete="current-password" required className={inputClass} /></div>
      <ErrorBox msg={err} />
      <button className={cn(btnClass(), "w-full")} disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
      <div className="flex justify-between text-xs text-muted">
        <Link href="/recuperar-senha" className="hover:text-fg">Esqueci minha senha</Link>
        <Link href="/cadastro" className="hover:text-fg">Criar conta</Link>
      </div>
    </form>
  );
}

const TYPES = [
  { id: "investor", icon: LineChart, title: "Investidor", body: "Avermont Invest: empresas, fundos, carteira e simulações educacionais." },
  { id: "business", icon: Building2, title: "Empresa compradora", body: "Avermont Business: custos de compra, fornecedores e cenários." },
  { id: "supplier", icon: Truck, title: "Fornecedor", body: "Receba pedidos de cotação e responda a compradores." },
] as const;

export function RegisterForm() {
  const router = useRouter();
  const [type, setType] = useState<(typeof TYPES)[number]["id"]>("investor");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        const fd = new FormData(e.currentTarget);
        try {
          const d = await post("/api/auth/register", {
            name: fd.get("name"), email: fd.get("email"), password: fd.get("password"), accountType: type,
            companyName: fd.get("companyName") || undefined, cnpj: fd.get("cnpj") || "", industry: fd.get("industry") || undefined, state: fd.get("state") || "",
            lgpdConsent: fd.get("lgpd") === "on",
          });
          router.push(d.next ?? "/visao-geral");
          router.refresh();
        } catch (x) {
          setErr((x as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Tipo de conta">
        {TYPES.map((t) => (
          <button type="button" key={t.id} role="radio" aria-checked={type === t.id} onClick={() => setType(t.id)} className={cn("rounded-lg border p-3 text-left transition-colors", type === t.id ? "border-brand bg-brand/10" : "border-line hover:border-line-strong")}>
            <t.icon size={18} className={type === t.id ? "text-brand" : "text-muted"} />
            <div className="mt-1 text-sm font-semibold">{t.title}</div>
            <div className="text-[11px] text-muted">{t.body}</div>
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={labelClass} htmlFor="name">Nome</label><input id="name" name="name" required minLength={2} className={inputClass} autoComplete="name" /></div>
        <div><label className={labelClass} htmlFor="email">E-mail</label><input id="email" name="email" type="email" required className={inputClass} autoComplete="email" /></div>
      </div>
      <div><label className={labelClass} htmlFor="password">Senha (mín. 10 caracteres, letras e números)</label><input id="password" name="password" type="password" required minLength={10} className={inputClass} autoComplete="new-password" /></div>
      {type !== "investor" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className={labelClass} htmlFor="companyName">Empresa</label><input id="companyName" name="companyName" required className={inputClass} /></div>
          <div><label className={labelClass} htmlFor="cnpj">CNPJ (opcional)</label><input id="cnpj" name="cnpj" placeholder="00.000.000/0000-00" className={inputClass} /></div>
          <div className="grid grid-cols-[1fr_80px] gap-2">
            <div><label className={labelClass} htmlFor="industry">Setor</label>
              <select id="industry" name="industry" className={inputClass}>
                {["Agronegócio", "Têxtil", "Ração animal", "Alimentos", "Construção", "Metalurgia", "Plásticos", "Química", "Embalagens", "Distribuição", "Cooperativa", "Outro"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div><label className={labelClass} htmlFor="state">UF</label><input id="state" name="state" maxLength={2} className={inputClass} /></div>
          </div>
        </div>
      )}
      <label className="flex items-start gap-2 text-xs text-fg-2">
        <input type="checkbox" name="lgpd" required className="mt-0.5" />
        <span>Li e aceito a <Link href="/privacidade" className="underline" target="_blank">política de privacidade</Link>. Meus dados serão tratados conforme a LGPD; dados comerciais da minha empresa ficam isolados no meu workspace.</span>
      </label>
      <ErrorBox msg={err} />
      <button className={cn(btnClass(), "w-full")} disabled={busy}>{busy ? "Criando conta…" : "Criar conta gratuita"}</button>
      <p className="text-center text-xs text-muted">Já tem conta? <Link href="/login" className="underline">Entrar</Link></p>
    </form>
  );
}

export function ForgotForm() {
  const [msg, setMsg] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setErr(null);
        try {
          const d = await post("/api/auth/forgot", { email: new FormData(e.currentTarget).get("email") });
          setMsg(d.message);
          setDevLink(d.devLink ?? null);
        } catch (x) {
          setErr((x as Error).message);
        }
      }}
    >
      <div><label className={labelClass} htmlFor="email">E-mail da conta</label><input id="email" name="email" type="email" required className={inputClass} /></div>
      <ErrorBox msg={err} />
      {msg && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-fg-2">{msg}</div>}
      {devLink && <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-fg-2">Ambiente de desenvolvimento sem provedor de e-mail: <a className="underline" href={devLink}>abrir link de redefinição</a></div>}
      <button className={cn(btnClass(), "w-full")}>Enviar instruções</button>
    </form>
  );
}

export function ResetForm() {
  const sp = useSearchParams();
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setErr(null);
        try {
          await post("/api/auth/reset", { token: sp.get("token"), password: new FormData(e.currentTarget).get("password") });
          setOk(true);
          setTimeout(() => router.push("/login"), 1200);
        } catch (x) {
          setErr((x as Error).message);
        }
      }}
    >
      <div><label className={labelClass} htmlFor="password">Nova senha</label><input id="password" name="password" type="password" required minLength={10} className={inputClass} autoComplete="new-password" /></div>
      <ErrorBox msg={err} />
      {ok && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs">Senha alterada. Redirecionando para o login…</div>}
      <button className={cn(btnClass(), "w-full")}>Salvar nova senha</button>
    </form>
  );
}
