import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Sidebar } from "@/components/sidebar";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "CodeNXT — Autonomous AI Engineering",
  description:
    "An autonomous multi-agent platform that understands requirements, plans, codes, reviews, and deploys.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans min-h-screen bg-black text-zinc-300 antialiased selection:bg-zinc-800 selection:text-zinc-100`}
      >
        <div className="flex h-screen overflow-hidden">
          {/* Sidebar */}
          <Sidebar />

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto bg-black relative">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
