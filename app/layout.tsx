import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PoGo Shiny Radar | VIP Aristocrático",
  description:
    "Radar avançado de Pokémon GO Shiny com Blacklist Recursiva, Lazy Reveal de coordenadas e rastreador de capturas para celular.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PoGo Radar"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#05060a"
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-[#05060a] text-slate-100 font-sans selection:bg-purple-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
