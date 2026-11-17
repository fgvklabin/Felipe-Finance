import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { getPrefs } from "@/lib/prefs";

export const metadata: Metadata = {
  title: { default: "Avermont — Commodity Intelligence", template: "%s · Avermont" },
  description: "Understand markets. Anticipate opportunities. Inteligência de commodities conectando mercados físicos e financeiros.",
  applicationName: "Avermont",
};

export const viewport: Viewport = { themeColor: "#0B1423", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const prefs = await getPrefs();
  return (
    <html lang={prefs.locale === "en" ? "en" : "pt-BR"} className={prefs.theme}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
