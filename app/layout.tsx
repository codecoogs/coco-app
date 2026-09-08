import { ThemeScript } from "@/app/components/ThemeScript";
import { ThemeProvider } from "@/app/contexts/ThemeContext";
import { getSiteUrl } from "@/lib/site-url";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
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
  metadataBase: new URL(getSiteUrl() || "http://localhost:3000"),
  title: "Coco App",
  description: "Coco community dashboard for members.",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Coco App",
    description: "Coco community dashboard for members.",
    siteName: "Coco App",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Coco App",
    description: "Coco community dashboard for members.",
  },
};

const THEME_COOKIE = "coco-theme";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get(THEME_COOKIE)?.value;
  const htmlClass =
    themeCookie === "dark" ? "dark" : themeCookie === "light" ? "" : undefined;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${htmlClass ?? ""}`}
      suppressHydrationWarning
    >
      <body className="antialiased">
        <ThemeScript />
        <ThemeProvider>{children}</ThemeProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
