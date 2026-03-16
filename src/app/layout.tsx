import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import SupportWidget from "@/components/SupportWidget";
import CommandPalette from "@/components/CommandPalette";
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
  title: "Nexus CRM",
  description: "AI-first CRM for managing contacts, deals, and activities",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-50 font-[family-name:var(--font-geist-sans)]`}>
        <Sidebar />
        <main className="ml-64 min-h-screen p-8">
          {children}
        </main>
        <CommandPalette />
        <SupportWidget />
      </body>
    </html>
  );
}
