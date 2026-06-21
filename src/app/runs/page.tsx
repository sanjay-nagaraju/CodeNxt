"use client";

import { useEffect, useState } from "react";

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

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  PENDING: { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground" },
  PLANNING: { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-400" },
  ANALYZING: { bg: "bg-cyan-500/10", text: "text-cyan-400", dot: "bg-cyan-400" },
  CODING: { bg: "bg-green-500/10", text: "text-green-400", dot: "bg-green-400" },
  BUILDING: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400" },
  REVIEWING: { bg: "bg-yellow-500/10", text: "text-yellow-400", dot: "bg-yellow-400" },
  QA: { bg: "bg-purple-500/10", text: "text-purple-400", dot: "bg-purple-400" },
  COMMITTING: { bg: "bg-orange-500/10", text: "text-orange-400", dot: "bg-orange-400" },
  COMPLETED: { bg: "bg-success/10", text: "text-success", dot: "bg-success" },
  FAILED: { bg: "bg-destructive/10", text: "text-destructive", dot: "bg-destructive" },
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
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Runs</h1>
            <p className="text-muted-foreground mt-1">
              Track all autonomous coding tasks
            </p>
          </div>
          <a
            href="/"
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium transition-colors"
          >
            + New Task
          </a>
        </div>

        {/* Runs Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : runs.length === 0 ? (
          <div className="glass rounded-xl p-12 text-center">
            <p className="text-muted-foreground">No runs yet. Create your first task!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {runs.map((run) => {
              const style = STATUS_STYLES[run.status] || STATUS_STYLES.PENDING;

              return (
                <a
                  key={run.id}
                  href={`/runs/${run.id}`}
                  className="block glass glass-hover rounded-xl p-5 transition-all slide-up"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${style.dot} ${
                              !["COMPLETED", "FAILED"].includes(run.status)
                                ? "animate-pulse"
                                : ""
                            }`}
                          />
                          {run.status}
                        </span>
                        {run.branchName && (
                          <span className="text-xs text-muted-foreground font-mono bg-secondary px-2 py-0.5 rounded">
                            {run.branchName}
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-medium truncate">{run.task}</h3>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>{run.project.name}</span>
                        <span>•</span>
                        <span>{run._count.events} events</span>
                        <span>•</span>
                        <span>{formatDuration(run.createdAt, run.completedAt)}</span>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0">
                      {new Date(run.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
