import { getModel } from "@/lib/llm/model";
import {
  findSymbolTool,
  findReferencesTool,
  getDependenciesTool,
  searchCodeTool,
  readFileTool,
} from "@/lib/tools";
import { emitEvent, emitAgentStart, emitAgentComplete } from "@/lib/workflow/event-emitter";
import type { AgentStateType, AnalysisResult } from "./state";
import { HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";

const ANALYZER_SYSTEM_PROMPT = `You are a codebase analysis expert for Next.js applications.

Your role is to locate all impacted symbols, files, and dependencies for a given task and plan.
You do NOT modify code — you only analyze.

Use the available tools to:
1. Find symbols mentioned in the plan
2. Find references to those symbols
3. Analyze dependencies between components
4. Read relevant files to understand the code

IMPORTANT: After your analysis, respond with a JSON object in this exact format:
{
  "symbols": [
    { "name": "LoginForm", "type": "COMPONENT", "path": "components/LoginForm.tsx", "line": 25 }
  ],
  "files": ["components/LoginForm.tsx", "app/login/page.tsx"],
  "dependencies": [
    { "source": "LoginPage", "target": "LoginForm" }
  ]
}`;

export async function analyzerAgent(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  const { task, projectId, projectPath, runId, plan } = state;

  await emitAgentStart(runId, "Analyzer");

  const model = getModel();
  const tools = [
    findSymbolTool,
    findReferencesTool,
    getDependenciesTool,
    searchCodeTool,
    readFileTool,
  ];
  const modelWithTools = model.bindTools(tools);

  const messages = [
    new SystemMessage(ANALYZER_SYSTEM_PROMPT),
    new HumanMessage(
      `Task: ${task}\n\nPlan:\n${JSON.stringify(plan, null, 2)}\n\nProject ID: ${projectId}\nProject Path: ${projectPath}\n\nAnalyze the codebase to find all impacted symbols, files, and dependencies.`
    ),
  ];

  let currentMessages = [...messages];
  let iterations = 0;
  const maxIterations = 15;

  while (iterations < maxIterations) {
    iterations++;
    const response = await modelWithTools.invoke(currentMessages);
    currentMessages.push(response);

    const toolCalls = response.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      const content = typeof response.content === "string" ? response.content : "";

      await emitEvent({
        runId,
        agent: "Analyzer",
        message: `Analysis complete`,
        metadata: { iterations },
      });

      const analysis = extractAnalysis(content);
      await emitAgentComplete(runId, "Analyzer", { analysis });

      return {
        analysis,
        currentAgent: "analyzer",
      };
    }

    for (const toolCall of toolCalls) {
      const tool = tools.find((t) => t.name === toolCall.name);
      if (!tool) continue;

      await emitEvent({
        runId,
        agent: "Analyzer",
        message: `Using tool: ${toolCall.name}`,
        level: "DEBUG",
        metadata: { tool: toolCall.name, args: toolCall.args },
      });

      try {
        const result = await tool.invoke(toolCall.args);
        currentMessages.push(
          new ToolMessage({
            content: typeof result === "string" ? result : JSON.stringify(result),
            tool_call_id: toolCall.id!,
          })
        );
      } catch (error: unknown) {
        const err = error as { message?: string };
        currentMessages.push(
          new ToolMessage({
            content: `Tool error: ${err.message}`,
            tool_call_id: toolCall.id!,
          })
        );
      }
    }
  }

  const fallbackAnalysis: AnalysisResult = {
    symbols: [],
    files: plan?.steps.flatMap((s) => s.targetFiles) || [],
    dependencies: [],
  };

  await emitAgentComplete(runId, "Analyzer", { analysis: fallbackAnalysis });
  return { analysis: fallbackAnalysis, currentAgent: "analyzer" };
}

function extractAnalysis(content: string): AnalysisResult {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        symbols: parsed.symbols || [],
        files: parsed.files || [],
        dependencies: parsed.dependencies || [],
      };
    } catch {
      // JSON parse failed
    }
  }

  return { symbols: [], files: [], dependencies: [] };
}
