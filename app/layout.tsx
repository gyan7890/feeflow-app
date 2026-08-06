import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { PwaRegister } from "./pwa-register";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "FeeFlow | Tuition Fee Management SaaS",
  applicationName: "FeeFlow",
  description:
    "Premium mobile app for tuition teachers to collect fees, manage students, send WhatsApp reminders, receipts, and reports.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/app-icon-192.png",
    shortcut: "/icons/app-icon-192.png",
    apple: "/icons/app-icon-192.png",
  },
  appleWebApp: {
    capable: true,
    title: "FeeFlow",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "FeeFlow | Tuition Fee Management SaaS",
    description:
      "Collect fees, manage students, send WhatsApp reminders, generate receipts, and view reports from one premium mobile app.",
    type: "website",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-title": "FeeFlow",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased selection:bg-indigo-600 selection:text-white`} suppressHydrationWarning>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
