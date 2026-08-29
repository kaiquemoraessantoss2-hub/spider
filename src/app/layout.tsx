import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono, Saira } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

// Fonte de display para micro-labels e headings: sans larga que sustenta o
// tracking aberto do HUD sem cair no clichê de "tudo monoespaçado".
const saira = Saira({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Spider",
  description: "Painel de status dos projetos e clientes",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${plexMono.variable} ${saira.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
