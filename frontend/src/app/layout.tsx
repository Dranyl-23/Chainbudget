import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "ChainBudget — Blockchain Budget Management",
  description:
    "A blockchain-based budget management system for transparent organizational fund monitoring.",
  keywords: ["blockchain", "budget", "transparency", "organization", "audit"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-[var(--color-bg)] text-[var(--color-text)] antialiased">
        <AuthProvider>{children}</AuthProvider>
        <Toaster position="bottom-right" toastOptions={{ className: "text-sm", duration: 4000 }} />
      </body>
    </html>
  );
}
