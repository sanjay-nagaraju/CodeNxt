"use client";

import { useEffect, useState, use } from "react";

interface RunDetail {
  id: string;
  task: string;
  status: string;
  branchName: string | null;
  plan: Record<string, unknown> | null;
  analysis: Record<string, unknown> | null;
  review: Record<string, unknown> | null;
  qa: Record<string, unknown> | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
  project: { name: string; path: string };
  events: Array<{
    id: string;
    agent: string;
    message: string;
    level: string;
    metadata: Record<string, unknown> | null;
    createdAt: string;
  }>;
}

interface LiveEvent {
  id: string;
  agent: string;
  message: string;
  level: string;
  createdAt: string;
}

const PIPELINE_STAGES = [
  { key: "PLANNING", name: "Planner", icon: "📋" },
  { key: "ANALYZING", name: "Analyzer", icon: "🔍" },
  { key: "CODING", name: "Coder", icon: "💻" },
  { key: "BUILDING", name: "Build", icon: "🔨" },
  { key: "REVIEWING", name: "Reviewer", icon: "👀" },
  { key: "QA", name: "QA", icon: "✅" },
  { key: "COMMITTING", name: "Commit", icon: "📝" },
];

function getStageIndex(status: string): number {
  return PIPELINE_STAGES.findIndex((s) => s.key === status);
}

export default function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [run, setRun] = useState<RunDetail | null>(null);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"logs" | "plan" | "review" | "qa">("logs");

  useEffect(() => {
    fetchRun();
  }, [id]);

  useEffect(() => {
    if (!run || ["COMPLETED", "FAILED"].includes(run.status)) return;

    const evtSource = new EventSource(`/api/runs/${id}/events`);

    evtSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "connected") return;

        setLiveEvents((prev) => [...prev, data]);

        if (
          data.message?.includes("completed successfully") ||
          data.message?.includes("Workflow failed")
        ) {
          setTimeout(() => {
            evtSource.close();
            fetchRun();
          }, 2000);
        }
      } catch {
        // ignore
      }
    };

    evtSource.onerror = () => evtSource.close();
    return () => evtSource.close();
  }, [run?.status, id]);

  async function fetchRun() {
    try {
      const res = await fetch(`/api/runs/${id}`);
      const data = await res.json();
      setRun(data);
    } catch (error) {
      console.error("Failed to fetch run:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Run not found</p>
      </div>
    );
  }

  const allEvents = [
    ...run.events,
    ...liveEvents.filter(
      (le) => !run.events.some((re) => re.id === le.id)
    ),
  ];

  const currentStageIndex = getStageIndex(run.status);

  function getAgentColor(agent: string): string {
    const colors: Record<string, string> = {
      System: "text-muted-foreground",
      Planner: "text-blue-400",
      Analyzer: "text-cyan-400",
      Coder: "text-green-400",
      Reviewer: "text-yellow-400",
      QA: "text-purple-400",
      Git: "text-orange-400",
      "Git-Commit": "text-orange-400",
    };
    return colors[agent] || "text-muted-foreground";
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="p-6 border-b border-border">
        <div className="flex items-center gap-3 mb-1">
          <a
            href="/runs"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Runs
          </a>
          <span className="text-border">/</span>
          <span className="text-sm font-mono text-muted-foreground">
            {run.id.slice(0, 8)}
          </span>
        </div>
        <h1 className="text-2xl font-bold mt-2">{run.task}</h1>
        <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
          <span className="text-foreground font-medium">{run.status}</span>
          {run.branchName && (
            <span className="font-mono bg-secondary px-2 py-0.5 rounded text-xs">
              {run.branchName}
            </span>
          )}
          <span>{run.project.name}</span>
        </div>
      </header>

      {/* Pipeline Visualization */}
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center gap-1 overflow-x-auto">
          {PIPELINE_STAGES.map((stage, i) => {
            const isActive = stage.key === run.status;
            const isComplete = i < currentStageIndex || run.status === "COMPLETED";
            const isFailed = run.status === "FAILED" && i === currentStageIndex;

            return (
              <div key={stage.key} className="flex items-center">
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    isFailed
                      ? "bg-destructive/10 text-destructive border border-destructive/20"
                      : isActive
                      ? "glass pulse-glow text-foreground"
                      : isComplete
                      ? "bg-success/10 text-success"
                      : "bg-secondary/30 text-muted-foreground"
                  }`}
                >
                  <span>{stage.icon}</span>
                  <span className="whitespace-nowrap">{stage.name}</span>
                  {isComplete && !isFailed && <span>✓</span>}
                  {isActive && !isFailed && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  )}
                  {isFailed && <span>✗</span>}
                </div>
                {i < PIPELINE_STAGES.length - 1 && (
                  <svg className="w-3 h-3 mx-0.5 text-border" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-4 border-b border-border">
        <div className="flex gap-1">
          {(["logs", "plan", "review", "qa"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === tab
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === "logs" && (
          <div className="glass rounded-xl p-4 font-mono text-sm space-y-1 max-h-full overflow-y-auto">
            {allEvents.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No events yet...
              </p>
            ) : (
              allEvents.map((event, i) => (
                <div
                  key={event.id || i}
                  className="flex gap-3 py-1 hover:bg-white/[0.02] rounded px-2 -mx-2"
                >
                  <span className="text-muted-foreground/50 text-xs shrink-0 w-20 pt-0.5">
                    {new Date(event.createdAt).toLocaleTimeString()}
                  </span>
                  <span
                    className={`font-semibold shrink-0 w-28 ${getAgentColor(
                      event.agent
                    )}`}
                  >
                    [{event.agent}]
                  </span>
                  <span
                    className={
                      event.level === "ERROR"
                        ? "text-destructive"
                        : event.level === "WARN"
                        ? "text-warning"
                        : "text-foreground/80"
                    }
                  >
                    {event.message}
                  </span>
                </div>
              ))
            )}
            <div ref={(el) => el?.scrollIntoView({ behavior: "smooth" })} />
          </div>
        )}

        {activeTab === "plan" && (
          <div className="glass rounded-xl p-6">
            {run.plan ? (
              <pre className="text-sm text-foreground/80 whitespace-pre-wrap overflow-x-auto">
                {JSON.stringify(run.plan, null, 2)}
              </pre>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No plan generated yet
              </p>
            )}
          </div>
        )}

        {activeTab === "review" && (
          <div className="glass rounded-xl p-6">
            {run.review ? (
              <pre className="text-sm text-foreground/80 whitespace-pre-wrap overflow-x-auto">
                {JSON.stringify(run.review, null, 2)}
              </pre>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No review results yet
              </p>
            )}
          </div>
        )}

        {activeTab === "qa" && (
          <div className="glass rounded-xl p-6">
            {run.qa ? (
              <pre className="text-sm text-foreground/80 whitespace-pre-wrap overflow-x-auto">
                {JSON.stringify(run.qa, null, 2)}
              </pre>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No QA results yet
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
