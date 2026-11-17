"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { setPref } from "./shell/Topbar";
import { btnClass, cn, inputClass, labelClass } from "./ui";

async function post(body: unknown) {
  const r = await fetch("/api/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.issues?.[0]?.message ?? d.error ?? "Erro");
  return d;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="panel space-y-3 p-4"><div className="text-sm font-semibold">{title}</div>{children}</div>;
}

export function SettingsForms({ user, theme, dataMode }: { user: { name: string; email: string; locale: string; notification_prefs: { inApp?: boolean; email?: boolean } }; theme: string; dataMode: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<Record<string, string>>({});
  const run = (key: string, fn: () => Promise<unknown>, ok = "Salvo.") => fn().then(() => { setMsg((m) => ({ ...m, [key]: ok })); router.refresh(); }).catch((e) => setMsg((m) => ({ ...m, [key]: (e as Error).message })));
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Section title="Perfil">
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); setPref("avm_lang", String(fd.get("locale"))); run("profile", () => post({ action: "profile", name: fd.get("name"), locale: fd.get("locale") })); }}>
          <div><label className={labelClass}>Nome</label><input name="name" defaultValue={user.name} className={inputClass} /></div>
          <div><label className={labelClass}>E-mail</label><input value={user.email} disabled className={cn(inputClass, "opacity-60")} /></div>
          <div><label className={labelClass}>Idioma</label><select name="locale" defaultValue={user.locale} className={inputClass}><option value="pt">Português</option><option value="en">English (navegação)</option></select></div>
          <button className={btnClass("primary", "sm")}>Salvar</button> <span className="text-xs text-muted">{msg.profile}</span>
        </form>
      </Section>
      <Section title="Aparência e dados">
        <div className="flex flex-wrap gap-2 text-sm">
          <button className={btnClass(theme === "dark" ? "primary" : "outline", "sm")} onClick={() => { setPref("avm_theme", "dark"); document.documentElement.className = "dark"; router.refresh(); }}>Tema escuro</button>
          <button className={btnClass(theme === "light" ? "primary" : "outline", "sm")} onClick={() => { setPref("avm_theme", "light"); document.documentElement.className = "light"; router.refresh(); }}>Tema claro</button>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <button className={btnClass(dataMode === "real" ? "primary" : "outline", "sm")} onClick={() => { setPref("avm_data", "real"); router.refresh(); }}>Só dados reais</button>
          <button className={btnClass(dataMode === "all" ? "primary" : "outline", "sm")} onClick={() => { setPref("avm_data", "all"); router.refresh(); }}>Reais + demonstração</button>
        </div>
      </Section>
      <Section title="Notificações">
        <form className="space-y-2 text-sm" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); run("notif", () => post({ action: "notifications", inApp: fd.get("inApp") === "on", email: fd.get("email") === "on" })); }}>
          <label className="flex items-center gap-2"><input type="checkbox" name="inApp" defaultChecked={user.notification_prefs?.inApp !== false} /> No aplicativo</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="email" defaultChecked={!!user.notification_prefs?.email} /> Por e-mail</label>
          <label className="flex items-center gap-2 text-muted"><input type="checkbox" disabled /> WhatsApp (em breve, somente com sua autorização)</label>
          <button className={btnClass("primary", "sm")}>Salvar</button> <span className="text-xs text-muted">{msg.notif}</span>
        </form>
      </Section>
      <Section title="Senha">
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); run("pw", () => post({ action: "password", current: fd.get("current"), next: fd.get("next") }), "Senha alterada."); (e.target as HTMLFormElement).reset(); }}>
          <div><label className={labelClass}>Senha atual</label><input type="password" name="current" required className={inputClass} autoComplete="current-password" /></div>
          <div><label className={labelClass}>Nova senha</label><input type="password" name="next" required minLength={10} className={inputClass} autoComplete="new-password" /></div>
          <button className={btnClass("primary", "sm")}>Alterar</button> <span className="text-xs text-muted">{msg.pw}</span>
        </form>
      </Section>
      <Section title="Seus dados (LGPD)">
        <p className="text-xs text-muted">Baixe uma cópia de tudo o que guardamos sobre você e sobre os workspaces que você administra.</p>
        <a href="/api/account" className={btnClass("outline", "sm")}>Exportar meus dados (JSON)</a>
        <details className="rounded-lg border border-red-500/30 p-3">
          <summary className="cursor-pointer text-sm text-red-400">Excluir minha conta</summary>
          <form className="mt-2 space-y-2" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); post({ action: "delete", password: fd.get("password"), confirm: fd.get("confirm") }).then(() => { window.location.href = "/"; }).catch((x) => setMsg((m) => ({ ...m, del: (x as Error).message }))); }}>
            <p className="text-xs text-muted">Apaga watchlists, alertas, conversas, carteiras e workspaces em que você é o único membro. A ação não pode ser desfeita.</p>
            <input type="password" name="password" required placeholder="Sua senha" className={inputClass} />
            <input name="confirm" required placeholder='Digite EXCLUIR' className={inputClass} />
            <button className={btnClass("danger", "sm")}>Excluir definitivamente</button> <span className="text-xs text-red-400">{msg.del}</span>
          </form>
        </details>
      </Section>
      <Section title="Fale conosco">
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); run("fb", () => post({ action: "feedback", message: fd.get("message"), rating: Number(fd.get("rating")) || null, page: "/configuracoes" }), "Obrigado pelo retorno!"); (e.target as HTMLFormElement).reset(); }}>
          <textarea name="message" required rows={3} className={cn(inputClass, "h-auto py-2")} placeholder="O que podemos melhorar?" />
          <select name="rating" className={inputClass}><option value="">Nota (opcional)</option>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}</select>
          <button className={btnClass("primary", "sm")}>Enviar</button> <span className="text-xs text-muted">{msg.fb}</span>
        </form>
      </Section>
    </div>
  );
}
