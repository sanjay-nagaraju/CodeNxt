import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Activity, Home, Zap } from "lucide-react";
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
          <aside className="w-[260px] bg-[#0A0A0A] border-r border-zinc-900 flex flex-col shrink-0 transition-all">
            {/* Logo Area */}
            <div className="h-14 flex items-center px-6 border-b border-zinc-900">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-md bg-zinc-100 flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5 text-black" fill="currentColor" />
                </div>
                <h1 className="text-sm font-semibold text-zinc-100 tracking-tight">
                  CodeNXT
                </h1>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-3 space-y-0.5">
              <a
                href="/"
                id="nav-home"
                className="group flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/50 transition-all"
              >
                <Home className="w-4 h-4" />
                Home
              </a>
              <a
                href="/runs"
                id="nav-runs"
                className="group flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/50 transition-all"
              >
                <Activity className="w-4 h-4" />
                Runs
              </a>
            </nav>

            {/* Footer Area */}
            <div className="p-4">
              <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-3">
                <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1">
                  Engine
                </p>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-zinc-300">LangGraph</p>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto bg-black relative">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
