"use client";

import { useState, useEffect } from "react";

const AGENT_STAGES = [
  { name: "Planner", icon: "📋", description: "Analyzing requirements & creating plan" },
  { name: "Analyzer", icon: "🔍", description: "Locating impacted files & symbols" },
  { name: "Coder", icon: "💻", description: "Implementing code changes" },
  { name: "Reviewer", icon: "👀", description: "Reviewing code quality & security" },
  { name: "QA", icon: "✅", description: "Validating acceptance criteria" },
];

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

  async function handleBrowse() {
    setIsBrowsing(true);
    try {
      const res = await fetch("/api/projects/browse");
      if (!res.ok) {
        if (res.status === 400) return; // User canceled
        throw new Error("Browse failed");
      }
      const { path } = await res.json();
      
      // Upsert in DB
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

      // Connect to SSE for real-time updates
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

          // Check for completion
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
          // ignore parse errors
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
      <header className="p-8 pb-0">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-2">
            <span className="gradient-text">Autonomous Coding</span>
          </h1>
          <p className="text-muted-foreground text-lg">
            Describe your task and let the agents handle the rest.
          </p>
        </div>
      </header>

      {/* Task Input */}
      <section className="p-8">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="glass rounded-xl p-4 focus-within:ring-2 focus-within:ring-primary/50 transition-all flex flex-col gap-3">
            <label htmlFor="project-select" className="text-sm font-medium text-muted-foreground">Target Project</label>
            <div className="flex gap-2">
              <select
                id="project-select"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="flex-1 bg-transparent border border-border rounded-lg px-4 py-2 text-foreground focus:outline-none focus:border-primary text-sm"
                disabled={isSubmitting || projects.length === 0}
              >
                {projects.length === 0 ? (
                  <option value="">No projects available. Click Browse.</option>
                ) : (
                  projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.path}
                    </option>
                  ))
                )}
              </select>
              <button
                type="button"
                onClick={handleBrowse}
                disabled={isSubmitting || isBrowsing}
                className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                {isBrowsing ? (
                  <span className="animate-pulse">Opening...</span>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    Browse...
                  </>
                )}
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="relative">
            <div className="glass rounded-xl p-1 focus-within:ring-2 focus-within:ring-primary/50 transition-all">
              <textarea
                id="task-input"
                value={task}
                onChange={(e) => setTask(e.target.value)}
                placeholder="Describe your task... e.g. Add forgot password flow to login page"
                rows={3}
                className="w-full bg-transparent px-5 py-4 text-foreground placeholder-muted-foreground/50 resize-none focus:outline-none text-base"
                disabled={isSubmitting}
              />
              <div className="flex items-center justify-between px-4 pb-3">
                <div className="flex items-center gap-2">
                  {isSubmitting && (
                    <div className="flex items-center gap-2 text-sm text-primary">
                      <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      Processing...
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  id="submit-task"
                  disabled={!task.trim() || isSubmitting}
                  className="px-6 py-2.5 bg-primary hover:bg-primary/90 disabled:bg-primary/30 disabled:cursor-not-allowed text-primary-foreground font-medium rounded-lg transition-all text-sm flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <svg
                        className="w-4 h-4 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Running
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Run
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </section>

      {/* Agent Pipeline */}
      {activeRunId && (
        <section className="px-8 pb-4 fade-in">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {AGENT_STAGES.map((stage, i) => {
                const isActive = events.some(
                  (e) => e.agent === stage.name && !events.some(
                    (e2) => e2.agent === stage.name && e2.message.includes("completed")
                  )
                );
                const isComplete = events.some(
                  (e) => e.agent === stage.name && e.message.includes("completed")
                );

                return (
                  <div key={stage.name} className="flex items-center">
                    <div
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${
                        isActive
                          ? "glass pulse-glow text-foreground"
                          : isComplete
                          ? "bg-success/10 text-success border border-success/20"
                          : "bg-secondary/50 text-muted-foreground"
                      }`}
                    >
                      <span>{stage.icon}</span>
                      <span className="font-medium whitespace-nowrap">{stage.name}</span>
                      {isComplete && <span className="text-success">✓</span>}
                      {isActive && (
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      )}
                    </div>
                    {i < AGENT_STAGES.length - 1 && (
                      <svg
                        className="w-4 h-4 mx-1 text-border shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Live Log Stream */}
      {events.length > 0 && (
        <section className="flex-1 px-8 pb-8 min-h-0 fade-in">
          <div className="max-w-4xl mx-auto h-full flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Live Execution Log
              </h2>
              <span className="text-xs text-muted-foreground">
                {events.length} events
              </span>
            </div>
            <div
              className="flex-1 glass rounded-xl p-4 overflow-y-auto font-mono text-sm space-y-1"
              id="log-stream"
            >
              {events.map((event, i) => (
                <div
                  key={i}
                  className="flex gap-3 py-1 slide-up hover:bg-white/[0.02] rounded px-2 -mx-2"
                >
                  <span className="text-muted-foreground/50 text-xs shrink-0 w-16 pt-0.5">
                    {new Date(event.createdAt).toLocaleTimeString()}
                  </span>
                  <span
                    className={`font-semibold shrink-0 w-24 ${getAgentColor(
                      event.agent
                    )}`}
                  >
                    [{event.agent}]
                  </span>
                  <span
                    className={`${
                      event.level === "ERROR"
                        ? "text-destructive"
                        : event.level === "WARN"
                        ? "text-warning"
                        : "text-foreground/80"
                    }`}
                  >
                    {event.message}
                  </span>
                </div>
              ))}
              <div ref={(el) => el?.scrollIntoView({ behavior: "smooth" })} />
            </div>
          </div>
        </section>
      )}

      {/* Empty state */}
      {!activeRunId && (
        <section className="flex-1 flex items-center justify-center px-8 pb-16">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Ready to build</h3>
            <p className="text-muted-foreground text-sm">
              Enter a task above and CodeNXT will autonomously plan, implement, review, and deploy your changes.
            </p>
            <div className="flex flex-wrap gap-2 justify-center mt-6">
              {["Add dark mode toggle", "Create user profile page", "Add forgot password flow"].map((example) => (
                <button
                  key={example}
                  onClick={() => setTask(example)}
                  className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
