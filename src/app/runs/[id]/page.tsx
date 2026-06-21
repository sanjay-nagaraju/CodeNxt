"use client";

import { useEffect, useState, use, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, GitBranch, FolderGit2, CheckCircle2, Activity, TerminalSquare, XCircle, Code2, GitCommit, FileDiff } from "lucide-react";

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
  { key: "PLANNING", name: "Planner", icon: Activity },
  { key: "ANALYZING", name: "Analyzer", icon: Activity },
  { key: "CODING", name: "Coder", icon: Code2 },
  { key: "BUILDING", name: "Build", icon: Activity },
  { key: "REVIEWING", name: "Reviewer", icon: Activity },
  { key: "QA", name: "QA", icon: CheckCircle2 },
  { key: "COMMITTING", name: "Commit", icon: GitCommit },
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
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchRun();
  }, [id]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [liveEvents, activeTab, run]);

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
        <Activity className="w-6 h-6 text-zinc-600 animate-spin" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-zinc-500">Run not found</p>
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
  const isRunComplete = ["COMPLETED", "FAILED"].includes(run.status);

  function getAgentColor(agent: string): string {
    const colors: Record<string, string> = {
      System: "text-zinc-500",
      Planner: "text-blue-400",
      Analyzer: "text-indigo-400",
      Coder: "text-emerald-400",
      Reviewer: "text-amber-400",
      QA: "text-purple-400",
      Git: "text-rose-400",
      "Git-Commit": "text-rose-400",
    };
    return colors[agent] || "text-zinc-500";
  }

  const tabs = ["logs", "plan", "review", "qa"] as const;

  return (
    <div className="h-full flex flex-col bg-white dark:bg-black">
      {/* Header */}
      <header className="px-8 py-6 border-b border-zinc-200 dark:border-zinc-900 shrink-0">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <a
                href="/runs"
                className="text-zinc-500 hover:text-zinc-100 transition-colors flex items-center gap-1.5 text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Runs
              </a>
              <span className="text-zinc-300 dark:text-zinc-800">/</span>
              <span className="text-sm font-mono text-zinc-500 dark:text-zinc-500">
                {run.id.slice(0, 8)}
              </span>
            </div>
            
            {isRunComplete && (
              <a
                href={`/runs/${id}/diff`}
                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-md text-sm font-medium transition-colors border border-zinc-200 dark:border-zinc-800"
              >
                <FileDiff className="w-4 h-4" />
                View Diffs
              </a>
            )}
          </div>
          
          <h1 className="text-xl md:text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight leading-tight max-w-4xl">
            {run.task}
          </h1>
          
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 text-[13px] text-zinc-500">
            <span className={`inline-flex items-center gap-1.5 font-medium px-2 py-0.5 rounded-md ${
              run.status === "COMPLETED" ? "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400" :
              run.status === "FAILED" ? "bg-rose-500/10 text-rose-500 dark:text-rose-400" :
              "bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300"
            }`}>
              {run.status === "COMPLETED" ? <CheckCircle2 className="w-3.5 h-3.5" /> : 
               run.status === "FAILED" ? <XCircle className="w-3.5 h-3.5" /> : 
               <Activity className="w-3.5 h-3.5" />}
              {run.status}
            </span>
            <span className="flex items-center gap-1.5">
              <FolderGit2 className="w-4 h-4" />
              {run.project.name}
            </span>
            {run.branchName && (
              <span className="flex items-center gap-1.5">
                <GitBranch className="w-4 h-4" />
                <span className="font-mono bg-zinc-100 dark:bg-zinc-900 px-1.5 rounded">{run.branchName}</span>
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Pipeline Visualization */}
      <div className="px-8 py-4 border-b border-zinc-200 dark:border-zinc-900 bg-zinc-50 dark:bg-[#050505] shrink-0">
        <div className="max-w-6xl mx-auto flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {PIPELINE_STAGES.map((stage, i) => {
            const isActive = stage.key === run.status;
            const isComplete = i < currentStageIndex || run.status === "COMPLETED";
            const isFailed = run.status === "FAILED" && i === currentStageIndex;
            const Icon = stage.icon;

            return (
              <div key={stage.key} className="flex items-center">
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] font-medium transition-all ${
                    isFailed
                      ? "bg-rose-500/10 text-rose-500 dark:text-rose-400 border border-rose-500/20"
                      : isActive
                      ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700 shadow-sm"
                      : isComplete
                      ? "bg-transparent text-emerald-500"
                      : "bg-transparent text-zinc-400 dark:text-zinc-600"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="whitespace-nowrap">{stage.name}</span>
                </div>
                {i < PIPELINE_STAGES.length - 1 && (
                  <div className="w-4 h-px bg-zinc-300 dark:bg-zinc-800 mx-2" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-8 border-b border-zinc-200 dark:border-zinc-900 shrink-0 bg-white dark:bg-black">
        <div className="max-w-6xl mx-auto flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="relative py-4 text-[13px] font-medium capitalize transition-colors"
            >
              <span className={activeTab === tab ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"}>
                {tab}
              </span>
              {activeTab === tab && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-900 dark:bg-zinc-100"
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-8 bg-zinc-50 dark:bg-[#050505]">
        <div className="max-w-6xl mx-auto h-full flex flex-col">
          {activeTab === "logs" && (
            <div className="flex-1 bg-white dark:bg-[#0A0A0A] border border-zinc-200 dark:border-zinc-800/80 rounded-xl flex flex-col shadow-lg overflow-hidden">
              <div className="h-10 bg-zinc-100 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-4 shrink-0">
                <TerminalSquare className="w-4 h-4 text-zinc-400 dark:text-zinc-500 mr-2" />
                <span className="text-xs font-mono text-zinc-500 tracking-wider">Console Output</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 font-mono text-[13px] leading-relaxed">
                {allEvents.length === 0 ? (
                  <p className="text-zinc-600 text-center py-8">No events yet...</p>
                ) : (
                  <AnimatePresence initial={false}>
                    {allEvents.map((event, i) => (
                      <motion.div
                        key={event.id || i}
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex gap-4 py-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-900/30 rounded px-1 -mx-1"
                      >
                        <span className="text-zinc-400 dark:text-zinc-600 shrink-0 w-20 select-none">
                          {new Date(event.createdAt).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}
                        </span>
                        <span className={`font-medium shrink-0 w-28 select-none ${getAgentColor(event.agent)}`}>
                          [{event.agent.toLowerCase()}]
                        </span>
                        <span className={`break-words ${
                          event.level === "ERROR" ? "text-rose-500 dark:text-rose-400" : 
                          event.level === "WARN" ? "text-amber-500 dark:text-amber-400" : 
                          "text-zinc-700 dark:text-zinc-300"
                        }`}>
                          {event.message}
                        </span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
                <div ref={logEndRef} className="h-4" />
              </div>
            </div>
          )}

          {activeTab === "plan" && (
            <div className="flex-1 bg-white dark:bg-[#0A0A0A] border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-6 overflow-y-auto shadow-sm">
              {run.plan ? (
                <pre className="text-[13px] text-zinc-700 dark:text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed">
                  {JSON.stringify(run.plan, null, 2)}
                </pre>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-zinc-600">
                  <Activity className="w-8 h-8 mb-3 opacity-20" />
                  <p>No plan generated yet</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "review" && (
            <div className="flex-1 bg-white dark:bg-[#0A0A0A] border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-6 overflow-y-auto shadow-sm">
              {run.review ? (
                <pre className="text-[13px] text-zinc-700 dark:text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed">
                  {JSON.stringify(run.review, null, 2)}
                </pre>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-zinc-600">
                  <Activity className="w-8 h-8 mb-3 opacity-20" />
                  <p>No review results yet</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "qa" && (
            <div className="flex-1 bg-white dark:bg-[#0A0A0A] border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-6 overflow-y-auto shadow-sm">
              {run.qa ? (
                <pre className="text-[13px] text-zinc-700 dark:text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed">
                  {JSON.stringify(run.qa, null, 2)}
                </pre>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-zinc-600">
                  <CheckCircle2 className="w-8 h-8 mb-3 opacity-20" />
                  <p>No QA results yet</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
