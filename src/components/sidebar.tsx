"use client";

import { Activity, Home, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeToggle } from "./theme-toggle";

export function Sidebar() {
  const pathname = usePathname();
  const [modelInfo, setModelInfo] = useState<{ provider: string; model: string } | null>(null);

  const isHome = pathname === "/";
  const isRuns = pathname?.startsWith("/runs");

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => setModelInfo(data))
      .catch(() => setModelInfo({ provider: "Unknown", model: "—" }));
  }, []);

  return (
    <aside className="w-[260px] bg-zinc-50 dark:bg-[#0A0A0A] border-r border-zinc-200 dark:border-zinc-900 flex flex-col shrink-0 transition-all">
      {/* Logo Area */}
      <div className="h-14 flex items-center px-6 border-b border-zinc-200 dark:border-zinc-900 justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white dark:text-black" fill="currentColor" />
          </div>
          <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
            CodeNXT
          </h1>
        </div>
        <ThemeToggle />
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5">
        <Link
          href="/"
          className={`group flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all ${
            isHome
              ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm border border-zinc-300/50 dark:border-zinc-700/50"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/50 dark:hover:bg-zinc-900/50 border border-transparent"
          }`}
        >
          <Home className={`w-4 h-4 ${isHome ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400"}`} />
          Home
        </Link>
        <Link
          href="/runs"
          className={`group flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all ${
            isRuns
              ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm border border-zinc-300/50 dark:border-zinc-700/50"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/50 dark:hover:bg-zinc-900/50 border border-transparent"
          }`}
        >
          <Activity className={`w-4 h-4 ${isRuns ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400"}`} />
          Runs
        </Link>
      </nav>

      {/* Footer Area */}
      <div className="p-4">
        <div className="bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 rounded-lg p-3">
          <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1">
            Engine
          </p>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-zinc-900 dark:text-zinc-300 truncate">
              {modelInfo ? `${modelInfo.provider} · ${modelInfo.model}` : "Loading..."}
            </p>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0 ml-2" />
          </div>
        </div>
      </div>
    </aside>
  );
}
