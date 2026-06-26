import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import InstallPrompt from "@/components/InstallPrompt";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "ChainBudget — Blockchain Budget Management",
  description:
    "A blockchain-based budget management system for transparent organizational fund monitoring.",
  keywords: ["blockchain", "budget", "transparency", "organization", "audit"],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ChainBudget",
  },
};

export const viewport = {
  themeColor: "#6B55D9",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-[var(--color-bg)] text-[var(--color-text)] antialiased">
        <Providers>
          {children}
          <InstallPrompt />
        </Providers>
      </body>
    </html>
  );
}
