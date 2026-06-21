import { getModel } from "@/lib/llm/model";
import { findSymbolTool, searchCodeTool, readFileTool } from "@/lib/tools";
import { emitEvent, emitAgentStart, emitAgentComplete } from "@/lib/workflow/event-emitter";
import type { AgentStateType, Plan } from "./state";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const PLANNER_SYSTEM_PROMPT = `You are a senior software architect and technical planner for Next.js applications.

Your role is to analyze a task and create a detailed implementation plan. You NEVER modify code — you only plan.

Given a task and a repository map, you must:
1. Understand the requirement fully
2. Identify which files and symbols need to be modified or created
3. Create a step-by-step implementation plan
4. Define acceptance criteria for validation
5. List any npm packages that need to be installed

Use the available tools to explore the codebase and understand the project structure before planning.

IMPORTANT: Respond with a JSON object in this exact format:
{
  "summary": "Brief description of what needs to be done",
  "steps": [
    {
      "id": "step-1",
      "description": "What to do in this step",
      "targetFiles": ["path/to/file.tsx"],
      "action": "create" | "modify" | "delete" | "install"
    }
  ],
  "dependencies": ["package-name"],
  "acceptanceCriteria": ["The forgot password button appears on the login page", ...]
}`;

export async function plannerAgent(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  const { task, projectId, projectPath, runId, repoMap } = state;

  await emitAgentStart(runId, "Planner");

  const model = getModel();
  const tools = [
    findSymbolTool,
    searchCodeTool,
    readFileTool,
  ];
  const modelWithTools = model.bindTools(tools);

  const messages = [
    new SystemMessage(PLANNER_SYSTEM_PROMPT),
    new HumanMessage(
      `Task: ${task}\n\nRepository Map:\n${JSON.stringify(repoMap, null, 2)}\n\nProject ID: ${projectId}\nProject Path: ${projectPath}\n\nAnalyze the codebase using the available tools, then create an implementation plan.`
    ),
  ];

  // Run the agent loop — let it use tools to explore
  let currentMessages = [...messages];
  let iterations = 0;
  const maxIterations = 10;

  while (iterations < maxIterations) {
    iterations++;
    const response = await modelWithTools.invoke(currentMessages);
    currentMessages.push(response);

    // Check if the model wants to use tools
    const toolCalls = response.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      // No more tool calls — extract the plan from the response
      const content = typeof response.content === "string" ? response.content : "";

      await emitEvent({
        runId,
        agent: "Planner",
        message: `Generated implementation plan`,
        metadata: { iterations },
      });

      const plan = extractPlan(content);
      await emitAgentComplete(runId, "Planner", { plan });

      return {
        plan,
        currentAgent: "planner",
      };
    }

    // Execute tool calls
    for (const toolCall of toolCalls) {
      const tool = tools.find((t) => t.name === toolCall.name);
      if (!tool) continue;

      await emitEvent({
        runId,
        agent: "Planner",
        message: `Using tool: ${toolCall.name}`,
        level: "DEBUG",
        metadata: { tool: toolCall.name, args: toolCall.args },
      });

      try {
        const result = await tool.invoke(toolCall.args);
        const { ToolMessage } = await import("@langchain/core/messages");
        currentMessages.push(
          new ToolMessage({
            content: typeof result === "string" ? result : JSON.stringify(result),
            tool_call_id: toolCall.id!,
          })
        );
      } catch (error: unknown) {
        const err = error as { message?: string };
        const { ToolMessage } = await import("@langchain/core/messages");
        currentMessages.push(
          new ToolMessage({
            content: `Tool error: ${err.message}`,
            tool_call_id: toolCall.id!,
          })
        );
      }
    }
  }

  // Fallback plan if max iterations reached
  const fallbackPlan: Plan = {
    summary: task,
    steps: [
      {
        id: "step-1",
        description: `Implement: ${task}`,
        targetFiles: [],
        action: "modify",
      },
    ],
    dependencies: [],
    acceptanceCriteria: [`The feature "${task}" is implemented and working`],
  };

  await emitAgentComplete(runId, "Planner", { plan: fallbackPlan });
  return { plan: fallbackPlan, currentAgent: "planner" };
}

function extractPlan(content: string): Plan {
  // Try to find JSON in the response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        summary: parsed.summary || "",
        steps: (parsed.steps || []).map((s: Record<string, unknown>, i: number) => ({
          id: (s.id as string) || `step-${i + 1}`,
          description: (s.description as string) || "",
          targetFiles: (s.targetFiles as string[]) || [],
          action: (s.action as string) || "modify",
        })),
        dependencies: parsed.dependencies || [],
        acceptanceCriteria: parsed.acceptanceCriteria || [],
      };
    } catch {
      // JSON parse failed
    }
  }

  // Fallback: create a basic plan from the text
  return {
    summary: content.slice(0, 200),
    steps: [
      {
        id: "step-1",
        description: content,
        targetFiles: [],
        action: "modify",
      },
    ],
    dependencies: [],
    acceptanceCriteria: [],
  };
}
