import { getModel } from "@/lib/llm/model";
import {
  readFileTool,
  writeFileTool,
  createFileTool,
  deleteFileTool,
  installDependencyTool,
  runCommandTool,
  searchCodeTool,
} from "@/lib/tools";
import { emitEvent, emitAgentStart, emitAgentComplete, emitAgentError } from "@/lib/workflow/event-emitter";
import type { AgentStateType, BuildResult } from "./state";
import { HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";

const CODER_SYSTEM_PROMPT = `You are an expert Next.js developer implementing features based on a plan and analysis.

You receive:
- A task description
- An implementation plan with steps
- Analysis results with target symbols, files, and dependencies
- Any previous review/QA feedback if this is a retry

Your job is to:
1. Read the relevant files to understand the current code
2. Implement the changes according to the plan
3. Create new files as needed
4. Install any required dependencies
5. Ensure TypeScript types are correct
6. Follow Next.js App Router best practices

Rules:
- Always read a file before modifying it
- Write complete, raw file contents as plain text (NOT patches, JSON arrays, or dictionaries)
- Install dependencies before using them in code
- Use TypeScript with proper types
- Follow existing code patterns and conventions
- After making all changes, the code should compile and build successfully

When you are DONE implementing all changes, respond with: "IMPLEMENTATION COMPLETE"`;

export async function coderAgent(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  const {
    task,
    projectPath,
    runId,
    plan,
    analysis,
    reviewResult,
    qaResult,
    retryCount,
  } = state;

  await emitAgentStart(runId, "Coder");

  const model = getModel();
  const tools = [
    readFileTool,
    writeFileTool,
    createFileTool,
    deleteFileTool,
    installDependencyTool,
    runCommandTool,
    searchCodeTool,
  ];
  const modelWithTools = model.bindTools(tools);

  // Build context message
  let contextMsg = `Task: ${task}\n\nPlan:\n${JSON.stringify(plan, null, 2)}\n\nAnalysis:\n${JSON.stringify(analysis, null, 2)}\n\nProject Path: ${projectPath}`;

  // Add feedback from previous iterations
  if (retryCount > 0 && reviewResult && !reviewResult.approved) {
    contextMsg += `\n\n⚠️ REVIEW FEEDBACK (retry #${retryCount}):\n${JSON.stringify(reviewResult.issues, null, 2)}\n\nPlease fix the issues identified by the reviewer.`;
  }
  if (retryCount > 0 && qaResult && !qaResult.passed) {
    contextMsg += `\n\n⚠️ QA FEEDBACK (retry #${retryCount}):\n${JSON.stringify(qaResult.failedScenarios, null, 2)}\n\nPlease fix the failed test scenarios.`;
  }

  const messages = [
    new SystemMessage(CODER_SYSTEM_PROMPT),
    new HumanMessage(contextMsg),
  ];

  let currentMessages = [...messages];
  let iterations = 0;
  const maxIterations = 30;

  while (iterations < maxIterations) {
    iterations++;
    const response = await modelWithTools.invoke(currentMessages);
    currentMessages.push(response);

    const toolCalls = response.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      // Coder is done implementing
      const content = typeof response.content === "string" ? response.content : "";

      await emitEvent({
        runId,
        agent: "Coder",
        message: `Implementation complete after ${iterations} iterations`,
        metadata: { iterations },
      });

      // Now run the build
      const buildResult = await runBuild(projectPath, runId);

      if (!buildResult.success) {
        await emitEvent({
          runId,
          agent: "Coder",
          message: `Build failed: ${buildResult.errors.join(", ")}`,
          level: "ERROR",
        });
      }

      await emitAgentComplete(runId, "Coder", {
        buildSuccess: buildResult.success,
        content: content.slice(0, 500),
      });

      return {
        buildResult,
        currentAgent: "coder",
      };
    }

    for (const toolCall of toolCalls) {
      const tool = tools.find((t) => t.name === toolCall.name);
      if (!tool) continue;

      const actionName =
        toolCall.name === "write_file" || toolCall.name === "create_file"
          ? `${toolCall.name}: ${(toolCall.args as Record<string, unknown>).filePath}`
          : toolCall.name;

      await emitEvent({
        runId,
        agent: "Coder",
        message: `${actionName}`,
        level: "INFO",
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

  await emitAgentError(runId, "Coder", "Max iterations reached");
  return {
    buildResult: { success: false, output: "", errors: ["Max iterations reached"] },
    currentAgent: "coder",
  };
}

async function runBuild(
  projectPath: string,
  runId: string
): Promise<BuildResult> {
  await emitEvent({
    runId,
    agent: "Coder",
    message: "Running npm run build...",
  });

  try {
    const { execSync } = await import("child_process");
    const output = execSync("npm run build", {
      cwd: projectPath,
      encoding: "utf-8",
      maxBuffer: 1024 * 1024 * 10,
      timeout: 180000, // 3 min timeout
      env: { ...process.env, FORCE_COLOR: "0" },
    });

    return { success: true, output, errors: [] };
  } catch (error: unknown) {
    const err = error as { stderr?: string; stdout?: string; message?: string };
    const stderr = err.stderr || "";
    const stdout = err.stdout || "";
    const errorOutput = `${stderr}\n${stdout}`.trim();

    // Extract error lines
    const errorLines = errorOutput
      .split("\n")
      .filter(
        (line) =>
          line.includes("error") ||
          line.includes("Error") ||
          line.includes("TS") ||
          line.includes("failed")
      )
      .slice(0, 20);

    return {
      success: false,
      output: errorOutput,
      errors: errorLines.length > 0 ? errorLines : [err.message || "Build failed"],
    };
  }
}
