import type { Metadata } from "next";
import { Playfair_Display, Tenor_Sans } from "next/font/google";
import { Header } from "@/components/shared/header";
import { getServerLocale } from "@/lib/i18n/server";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const tenorSans = Tenor_Sans({
  variable: "--font-tenor-sans",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "OenoBoost — Apprenez le vin",
  description:
    "Plateforme éducative sur le vin : vignobles, cépages, sols, vinification et dégustation.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getServerLocale();
  return (
    <html
      lang={locale}
      className={`${playfair.variable} ${tenorSans.variable}`}
    >
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <Header />
        <main className="mx-auto w-full max-w-[1200px] px-6 pb-16 pt-8 md:px-12">
          {children}
        </main>
      </body>
    </html>
  );
}
