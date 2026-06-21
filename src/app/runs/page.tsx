"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Activity, Clock, FolderGit2, ChevronRight, CircleDashed, CheckCircle2, XCircle, TerminalSquare } from "lucide-react";

interface Run {
  id: string;
  task: string;
  status: string;
  branchName: string | null;
  createdAt: string;
  completedAt: string | null;
  project: { name: string; path: string };
  _count: { events: number };
}

const STATUS_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  PENDING: { icon: CircleDashed, color: "text-zinc-500", bg: "bg-zinc-900" },
  PLANNING: { icon: Activity, color: "text-blue-400", bg: "bg-blue-500/10" },
  ANALYZING: { icon: Activity, color: "text-indigo-400", bg: "bg-indigo-500/10" },
  CODING: { icon: TerminalSquare, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  BUILDING: { icon: Activity, color: "text-amber-400", bg: "bg-amber-500/10" },
  REVIEWING: { icon: Activity, color: "text-amber-400", bg: "bg-amber-500/10" },
  QA: { icon: CheckCircle2, color: "text-purple-400", bg: "bg-purple-500/10" },
  COMMITTING: { icon: FolderGit2, color: "text-rose-400", bg: "bg-rose-500/10" },
  COMPLETED: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  FAILED: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10" },
};

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRuns();
    const interval = setInterval(fetchRuns, 5000);
    return () => clearInterval(interval);
  }, []);

  async function fetchRuns() {
    try {
      const res = await fetch("/api/runs");
      const data = await res.json();
      setRuns(data);
    } catch (error) {
      console.error("Failed to fetch runs:", error);
    } finally {
      setLoading(false);
    }
  }

  function formatDuration(start: string, end: string | null): string {
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date();
    const diff = Math.floor((endDate.getTime() - startDate.getTime()) / 1000);

    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
    return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">Execution History</h1>
          <p className="text-zinc-500 dark:text-zinc-500 text-sm mt-1">
            Track all autonomous AI coding tasks across your projects.
          </p>
        </div>
        <a
          href="/"
          className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 hover:bg-black dark:hover:bg-white text-white dark:text-black rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Task
        </a>
      </div>

      {/* Runs List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <CircleDashed className="w-6 h-6 text-zinc-400 dark:text-zinc-600 animate-spin" />
        </div>
      ) : runs.length === 0 ? (
        <div className="border border-zinc-200 dark:border-zinc-800/50 bg-zinc-50 dark:bg-[#0A0A0A] rounded-xl p-12 text-center">
          <Activity className="w-8 h-8 text-zinc-400 dark:text-zinc-700 mx-auto mb-4" />
          <h3 className="text-zinc-900 dark:text-zinc-300 font-medium mb-1">No runs found</h3>
          <p className="text-zinc-500 dark:text-zinc-500 text-sm">Start your first autonomous task from the home page.</p>
        </div>
      ) : (
        <div className="border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#0A0A0A] rounded-xl overflow-hidden shadow-sm">
          {runs.map((run, index) => {
            const config = STATUS_CONFIG[run.status] || STATUS_CONFIG.PENDING;
            const Icon = config.icon;

            return (
              <motion.a
                key={run.id}
                href={`/runs/${run.id}`}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors last:border-0"
              >
                <div className="flex items-start gap-4 min-w-0 flex-1">
                  <div className={`mt-0.5 p-1.5 rounded-md ${config.bg} shrink-0`}>
                    <Icon className={`w-4 h-4 ${config.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-200 truncate group-hover:text-black dark:group-hover:text-zinc-100 transition-colors">
                        {run.task}
                      </h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-zinc-500">
                      <span className="flex items-center gap-1.5">
                        <FolderGit2 className="w-3.5 h-3.5" />
                        {run.project.name}
                      </span>
                      {run.branchName && (
                        <>
                          <span className="text-zinc-300 dark:text-zinc-700">•</span>
                          <span className="font-mono text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 px-1.5 rounded">
                            {run.branchName}
                          </span>
                        </>
                      )}
                      <span className="text-zinc-300 dark:text-zinc-700">•</span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDuration(run.createdAt, run.completedAt)}
                      </span>
                      <span className="text-zinc-300 dark:text-zinc-700">•</span>
                      <span className="flex items-center gap-1.5">
                        <TerminalSquare className="w-3.5 h-3.5" />
                        {run._count.events} events
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pl-11 sm:pl-0">
                  <div className="text-[13px] text-zinc-500 text-right">
                    {new Date(run.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-300 dark:text-zinc-700 group-hover:text-zinc-500 dark:group-hover:text-zinc-400 transition-colors hidden sm:block" />
                </div>
              </motion.a>
            );
          })}
        </div>
      )}
    </div>
  );
}
