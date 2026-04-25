import type { Metadata, Viewport } from "next";
import { Playfair_Display, Tenor_Sans } from "next/font/google";
import { Header } from "@/components/shared/header";
import { LocaleProvider } from "@/lib/i18n/locale-context";
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

const SITE_NAME = "OenoBoost";
const TITLE = "OenoBoost — Apprenez le vin";
const DESCRIPTION =
  "Plateforme éducative sur le vin : vignobles, cépages, sols, vinification et dégustation.";

function getMetadataBase(): URL {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
  if (raw) {
    try {
      return new URL(raw);
    } catch {
      // ignore invalid env URL
    }
  }
  return new URL("http://localhost:3000");
}

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  applicationName: SITE_NAME,
  title: {
    default: TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  icons: {
    icon: [
      { url: "/favicon/favicon.ico", sizes: "48x48" },
      { url: "/favicon/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      {
        url: "/favicon/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/favicon/web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/favicon/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
    shortcut: ["/favicon/favicon.ico"],
    other: [
      {
        rel: "mask-icon",
        url: "/favicon/favicon.svg",
        color: "#7C2736",
      },
    ],
  },
  manifest: "/favicon/site.webmanifest",
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "default",
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: SITE_NAME,
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
    images: [
      {
        url: "/logo.png",
        alt: SITE_NAME,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/logo.png"],
  },
  other: {
    "msapplication-TileColor": "#7C2736",
    "msapplication-TileImage": "/favicon/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#7C2736" },
    { media: "(prefers-color-scheme: dark)", color: "#5e1d29" },
  ],
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
      <body className="flex min-h-screen flex-col bg-background font-sans text-foreground antialiased">
        <LocaleProvider>
          <Header />
          <main
            id="app-main"
            className="w-full px-6 pt-5 pb-8 lg:px-8"
          >
            {children}
          </main>
        </LocaleProvider>
      </body>
    </html>
  );
}
