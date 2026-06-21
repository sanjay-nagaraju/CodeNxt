"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Folder, Sparkles, Code2, GitCommit, CheckCircle2, ChevronRight, Loader2 } from "lucide-react";

const AGENT_STAGES = [
  { name: "Planner", icon: <ClipboardIcon className="w-4 h-4" />, description: "Analyzing requirements & creating plan" },
  { name: "Analyzer", icon: <SearchIcon className="w-4 h-4" />, description: "Locating impacted files & symbols" },
  { name: "Coder", icon: <Code2 className="w-4 h-4" />, description: "Implementing code changes" },
  { name: "Reviewer", icon: <EyeIcon className="w-4 h-4" />, description: "Reviewing code quality & security" },
  { name: "QA", icon: <CheckCircle2 className="w-4 h-4" />, description: "Validating acceptance criteria" },
];

// Helper Icons
function ClipboardIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>
}
function SearchIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
}
function EyeIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
}

export default function HomePage() {
  const [task, setTask] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [events, setEvents] = useState<Array<{
    agent: string;
    message: string;
    level: string;
    createdAt: string;
  }>>([]);
  const [currentStatus, setCurrentStatus] = useState<string>("");
  const [projects, setProjects] = useState<Array<{ id: string; name: string; path: string }>>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [isBrowsing, setIsBrowsing] = useState(false);

  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => {
        setProjects(data);
        if (data.length > 0 && !projectId) {
          setProjectId(data[0].id);
        }
      })
      .catch((err) => console.error("Failed to load projects:", err));
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  async function handleBrowse() {
    setIsBrowsing(true);
    try {
      const res = await fetch("/api/projects/browse");
      if (!res.ok) {
        if (res.status === 400) return; // User canceled
        throw new Error("Browse failed");
      }
      const { path } = await res.json();
      
      const name = path.split('/').filter(Boolean).pop() || "Local Project";
      const createRes = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, path }),
      });
      const newProject = await createRes.json();
      
      setProjects((prev) => {
        const exists = prev.find((p) => p.id === newProject.id);
        if (exists) return prev;
        return [newProject, ...prev];
      });
      setProjectId(newProject.id);
    } catch (err) {
      console.error(err);
      alert("Failed to open folder picker. Make sure you are running locally.");
    } finally {
      setIsBrowsing(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!task.trim() || isSubmitting || !projectId) return;

    setIsSubmitting(true);
    setEvents([]);
    setCurrentStatus("PENDING");

    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, task: task.trim() }),
      });

      const run = await res.json();
      setActiveRunId(run.id);

      const evtSource = new EventSource(`/api/runs/${run.id}/events`);

      evtSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "connected") {
            setCurrentStatus(data.status);
            return;
          }

          setEvents((prev) => [...prev, data]);
          setCurrentStatus(data.agent || "");

          if (
            data.message?.includes("completed successfully") ||
            data.message?.includes("Workflow failed")
          ) {
            setTimeout(() => {
              evtSource.close();
              setIsSubmitting(false);
            }, 1000);
          }
        } catch {
          // ignore
        }
      };

      evtSource.onerror = () => {
        evtSource.close();
        setIsSubmitting(false);
      };
    } catch (error) {
      console.error("Failed to submit task:", error);
      setIsSubmitting(false);
    }
  }

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

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-zinc-900/50 to-transparent pointer-events-none" />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10 w-full max-w-4xl mx-auto mt-12 mb-8">
        
        {/* Header / Empty State */}
        {!activeRunId && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-10 w-full"
          >
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-zinc-100 mb-3">
              What do you want to build?
            </h1>
            <p className="text-zinc-400 text-sm md:text-base">
              Select a project and describe the changes. CodeNXT will autonomously implement them.
            </p>
          </motion.div>
        )}

        {/* Input Area (Claude-style) */}
        <motion.div 
          layout
          className={`w-full transition-all duration-500 ${activeRunId ? "mb-6" : "mb-0"}`}
        >
          <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-2 shadow-2xl backdrop-blur-xl">
            
            {/* Project Selector Bar */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800/50 mb-2">
              <Folder className="w-4 h-4 text-zinc-500" />
              <select
                id="project-select"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="bg-transparent text-sm font-medium text-zinc-300 focus:outline-none flex-1 appearance-none cursor-pointer"
                disabled={isSubmitting || projects.length === 0}
              >
                {projects.length === 0 ? (
                  <option value="">No projects available...</option>
                ) : (
                  projects.map((p) => (
                    <option key={p.id} value={p.id} className="bg-zinc-900 text-zinc-300">
                      {p.name}
                    </option>
                  ))
                )}
              </select>
              <button
                type="button"
                onClick={handleBrowse}
                disabled={isSubmitting || isBrowsing}
                className="text-xs font-medium px-3 py-1.5 rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors flex items-center gap-1.5"
              >
                {isBrowsing ? (
                  <><Loader2 className="w-3 h-3 animate-spin" /> Browsing</>
                ) : (
                  "Browse local..."
                )}
              </button>
            </div>

            {/* Prompt Form */}
            <form onSubmit={handleSubmit} className="relative flex flex-col group">
              <textarea
                value={task}
                onChange={(e) => setTask(e.target.value)}
                placeholder="Message CodeNXT..."
                rows={activeRunId ? 2 : 4}
                className="w-full bg-transparent px-3 py-2 text-zinc-100 placeholder-zinc-500 resize-none focus:outline-none text-base transition-all duration-300"
                disabled={isSubmitting}
                autoFocus
              />
              
              <div className="flex items-center justify-between px-3 pb-2 pt-2">
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  {isSubmitting && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1.5 text-zinc-400">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Running autonomous workflow...
                    </motion.div>
                  )}
                </div>
                
                <button
                  type="submit"
                  disabled={!task.trim() || isSubmitting || !projectId}
                  className="bg-zinc-100 hover:bg-white text-black disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg font-medium text-sm transition-all flex items-center gap-1.5"
                >
                  {isSubmitting ? "Running" : "Run"}
                  <Play className="w-3.5 h-3.5 fill-current" />
                </button>
              </div>
            </form>
          </div>

          {/* Quick Actions (Only show when empty) */}
          {!activeRunId && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              transition={{ delay: 0.2 }}
              className="flex flex-wrap gap-2 justify-center mt-6"
            >
              {["Create a dashboard page", "Add authentication flow", "Refactor the database schema"].map((example) => (
                <button
                  key={example}
                  onClick={() => setTask(example)}
                  className="text-xs px-3 py-1.5 rounded-full border border-zinc-800 bg-zinc-900/30 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors flex items-center gap-1.5"
                >
                  <Sparkles className="w-3 h-3" />
                  {example}
                </button>
              ))}
            </motion.div>
          )}
        </motion.div>

        {/* Active Execution UI */}
        {activeRunId && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full flex-1 flex flex-col min-h-0 space-y-4"
          >
            {/* Elegant Pipeline Stepper */}
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 shrink-0 backdrop-blur-md">
              <div className="flex items-center justify-between overflow-x-auto gap-2 scrollbar-hide">
                {AGENT_STAGES.map((stage, i) => {
                  const isActive = events.some(
                    (e) => e.agent === stage.name && !events.some(
                      (e2) => e2.agent === stage.name && e2.message.includes("completed")
                    )
                  );
                  const isComplete = events.some(
                    (e) => e.agent === stage.name && e.message.includes("completed")
                  );
                  
                  // Compute dynamic color state
                  const stateClass = isActive 
                    ? "text-zinc-100 bg-zinc-800/80 border-zinc-700 shadow-sm" 
                    : isComplete 
                    ? "text-zinc-400 bg-zinc-900/50 border-zinc-800/50" 
                    : "text-zinc-600 bg-transparent border-transparent";

                  return (
                    <div key={stage.name} className="flex items-center">
                      <motion.div
                        layout
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm font-medium transition-all duration-300 ${stateClass}`}
                      >
                        {isActive ? (
                          <Loader2 className="w-4 h-4 animate-spin text-zinc-300" />
                        ) : isComplete ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <span className="opacity-50">{stage.icon}</span>
                        )}
                        <span className="whitespace-nowrap">{stage.name}</span>
                      </motion.div>
                      {i < AGENT_STAGES.length - 1 && (
                        <ChevronRight className="w-4 h-4 mx-2 text-zinc-700 shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Terminal-style Log Stream */}
            <div className="flex-1 bg-[#0A0A0A] border border-zinc-800 rounded-xl overflow-hidden flex flex-col shadow-lg">
              <div className="h-10 bg-zinc-900/50 border-b border-zinc-800 flex items-center px-4">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                </div>
                <span className="ml-4 text-xs font-mono text-zinc-500 uppercase tracking-wider">Console Output</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 font-mono text-[13px] leading-relaxed">
                <AnimatePresence initial={false}>
                  {events.map((event, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex gap-4 py-0.5 hover:bg-zinc-900/30 rounded px-1 -mx-1"
                    >
                      <span className="text-zinc-600 shrink-0 w-20 select-none">
                        {new Date(event.createdAt).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}
                      </span>
                      <span className={`font-medium shrink-0 w-24 select-none ${getAgentColor(event.agent)}`}>
                        {event.agent.toLowerCase()}
                      </span>
                      <span className={`break-words ${
                        event.level === "ERROR" ? "text-rose-400" : 
                        event.level === "WARN" ? "text-amber-400" : 
                        "text-zinc-300"
                      }`}>
                        {event.message}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
                <div ref={logEndRef} className="h-4" />
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
