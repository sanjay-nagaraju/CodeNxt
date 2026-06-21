import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

// ─── Types ──────────────────────────────────────────────────────────

export interface PlanStep {
  id: string;
  description: string;
  targetFiles: string[];
  action: "create" | "modify" | "delete" | "install";
}

export interface Plan {
  summary: string;
  steps: PlanStep[];
  dependencies: string[];
  acceptanceCriteria: string[];
}

export interface AnalysisResult {
  symbols: Array<{
    name: string;
    type: string;
    path: string;
    line: number;
  }>;
  files: string[];
  dependencies: Array<{
    source: string;
    target: string;
  }>;
}

export interface CodeChange {
  file: string;
  action: "create" | "modify" | "delete";
  content?: string;
  diff?: string;
}

export interface BuildResult {
  success: boolean;
  output: string;
  errors: string[];
}

export interface ReviewResult {
  approved: boolean;
  issues: Array<{
    file: string;
    line?: number;
    severity: "error" | "warning" | "info";
    message: string;
    category: "quality" | "security" | "accessibility" | "performance" | "type-safety";
  }>;
}

export interface QAResult {
  passed: boolean;
  testResults: {
    total: number;
    passed: number;
    failed: number;
  };
  failedScenarios: Array<{
    scenario: string;
    reason: string;
  }>;
}

export interface RepoMap {
  routes: string[];
  components: string[];
  services: string[];
  hooks: string[];
  contexts: string[];
  stores: string[];
  utils: string[];
}

// ─── Agent State Definition ─────────────────────────────────────────

export const AgentState = Annotation.Root({
  // Task info
  task: Annotation<string>(),
  projectPath: Annotation<string>(),
  projectId: Annotation<string>(),
  runId: Annotation<string>(),
  branchName: Annotation<string>(),
  image: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),

  // Data flowing through the pipeline
  repoMap: Annotation<RepoMap | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  plan: Annotation<Plan | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  analysis: Annotation<AnalysisResult | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  codeChanges: Annotation<CodeChange[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  buildResult: Annotation<BuildResult | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  reviewResult: Annotation<ReviewResult | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  qaResult: Annotation<QAResult | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),

  // Agent tracking
  currentAgent: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
  retryCount: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),
  maxRetries: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 3,
  }),

  // LLM messages
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),

  // Error tracking
  errors: Annotation<string[]>({
    reducer: (prev, next) => [...(prev ?? []), ...next],
    default: () => [],
  }),
});

export type AgentStateType = typeof AgentState.State;
