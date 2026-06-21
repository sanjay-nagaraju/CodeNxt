import { StateGraph, END, START } from "@langchain/langgraph";
import { AgentState, type AgentStateType } from "@/lib/agents/state";
import { plannerAgent } from "@/lib/agents/planner";
import { analyzerAgent } from "@/lib/agents/analyzer";
import { coderAgent } from "@/lib/agents/coder";
import { reviewerAgent } from "@/lib/agents/reviewer";
import { qaAgent } from "@/lib/agents/qa";
import { gitSetupAgent, gitCommitAgent } from "@/lib/agents/git-agent";
import { prisma } from "@/lib/db";
import { scanRepository } from "@/lib/intelligence/scanner";
import { getCachedRepoMap } from "@/lib/intelligence/cache";
import { emitEvent } from "@/lib/workflow/event-emitter";

// ─── Node Wrappers ──────────────────────────────────────────────────

async function initNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const { projectId, projectPath, runId } = state;

  await prisma.run.update({
    where: { id: runId },
    data: { status: "PENDING" },
  });

  // Get or build repo map
  let repoMap = await getCachedRepoMap(projectId);
  if (!repoMap) {
    await emitEvent({
      runId,
      agent: "System",
      message: "Scanning repository...",
    });
    repoMap = await scanRepository(projectId, projectPath);
  }

  return { repoMap };
}

async function gitSetupNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  await prisma.run.update({
    where: { id: state.runId },
    data: { status: "PENDING" },
  });
  return gitSetupAgent(state);
}

async function plannerNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  await prisma.run.update({
    where: { id: state.runId },
    data: { status: "PLANNING" },
  });
  const result = await plannerAgent(state);

  // Save plan to run
  if (result.plan) {
    await prisma.run.update({
      where: { id: state.runId },
      data: { plan: result.plan as unknown as Record<string, unknown> },
    });
  }

  return result;
}

async function analyzerNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  await prisma.run.update({
    where: { id: state.runId },
    data: { status: "ANALYZING" },
  });
  const result = await analyzerAgent(state);

  if (result.analysis) {
    await prisma.run.update({
      where: { id: state.runId },
      data: { analysis: result.analysis as unknown as Record<string, unknown> },
    });
  }

  return result;
}

async function coderNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  await prisma.run.update({
    where: { id: state.runId },
    data: { status: "CODING" },
  });
  return coderAgent(state);
}

async function buildCheckNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  await prisma.run.update({
    where: { id: state.runId },
    data: { status: "BUILDING" },
  });
  // Build is already done in coder agent — this node just returns
  return {};
}

async function reviewerNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  await prisma.run.update({
    where: { id: state.runId },
    data: { status: "REVIEWING" },
  });
  const result = await reviewerAgent(state);

  if (result.reviewResult) {
    await prisma.run.update({
      where: { id: state.runId },
      data: { review: result.reviewResult as unknown as Record<string, unknown> },
    });
  }

  return result;
}

async function qaNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  await prisma.run.update({
    where: { id: state.runId },
    data: { status: "QA" },
  });
  const result = await qaAgent(state);

  if (result.qaResult) {
    await prisma.run.update({
      where: { id: state.runId },
      data: { qa: result.qaResult as unknown as Record<string, unknown> },
    });
  }

  return result;
}

async function commitNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  await prisma.run.update({
    where: { id: state.runId },
    data: { status: "COMMITTING" },
  });
  return gitCommitAgent(state);
}

async function completeNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  await prisma.run.update({
    where: { id: state.runId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });

  await emitEvent({
    runId: state.runId,
    agent: "System",
    message: "🎉 All tasks completed successfully!",
  });

  return {};
}

// ─── Routing Functions ──────────────────────────────────────────────

function buildCheckRouter(state: AgentStateType): string {
  if (state.buildResult?.success) {
    return "reviewer";
  }
  if (state.retryCount < state.maxRetries) {
    return "coder_retry";
  }
  return "fail";
}

function reviewRouter(state: AgentStateType): string {
  if (state.reviewResult?.approved) {
    return "qa";
  }
  if (state.retryCount < state.maxRetries) {
    return "coder_retry";
  }
  return "qa"; // Proceed to QA even with warnings
}

function qaRouter(state: AgentStateType): string {
  if (state.qaResult?.passed) {
    return "commit";
  }
  if (state.retryCount < state.maxRetries) {
    return "coder_retry";
  }
  return "commit"; // Commit anyway if max retries reached
}

function retryIncrement(state: AgentStateType): Partial<AgentStateType> {
  return { retryCount: state.retryCount + 1 };
}

async function failNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  await prisma.run.update({
    where: { id: state.runId },
    data: {
      status: "FAILED",
      error: state.errors.join("\n") || "Build failed after max retries",
      completedAt: new Date(),
    },
  });

  await emitEvent({
    runId: state.runId,
    agent: "System",
    message: "❌ Workflow failed after maximum retries",
    level: "ERROR",
  });

  return {};
}

// ─── Graph Construction ─────────────────────────────────────────────

export function createWorkflowGraph() {
  const graph = new StateGraph(AgentState)
    // Add nodes
    .addNode("init", initNode)
    .addNode("git_setup", gitSetupNode)
    .addNode("planner", plannerNode)
    .addNode("analyzer", analyzerNode)
    .addNode("coder", coderNode)
    .addNode("build_check", buildCheckNode)
    .addNode("reviewer", reviewerNode)
    .addNode("qa", qaNode)
    .addNode("coder_retry", retryIncrement)
    .addNode("commit", commitNode)
    .addNode("complete", completeNode)
    .addNode("fail", failNode)

    // Add edges — the linear pipeline
    .addEdge(START, "init")
    .addEdge("init", "git_setup")
    .addEdge("git_setup", "planner")
    .addEdge("planner", "analyzer")
    .addEdge("analyzer", "coder")
    .addEdge("coder", "build_check")

    // Conditional edges — routing based on results
    .addConditionalEdges("build_check", buildCheckRouter, {
      reviewer: "reviewer",
      coder_retry: "coder_retry",
      fail: "fail",
    })
    .addConditionalEdges("reviewer", reviewRouter, {
      qa: "qa",
      coder_retry: "coder_retry",
    })
    .addConditionalEdges("qa", qaRouter, {
      commit: "commit",
      coder_retry: "coder_retry",
    })

    // Retry loops back to coder
    .addEdge("coder_retry", "coder")

    // Terminal edges
    .addEdge("commit", "complete")
    .addEdge("complete", END)
    .addEdge("fail", END);

  return graph.compile();
}
