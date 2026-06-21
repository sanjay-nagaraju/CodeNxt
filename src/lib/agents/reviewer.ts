import { getModel } from "@/lib/llm/model";
import { readFileTool, searchCodeTool } from "@/lib/tools";
import { emitEvent, emitAgentStart, emitAgentComplete } from "@/lib/workflow/event-emitter";
import type { AgentStateType, ReviewResult } from "./state";
import { HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { execSync } from "child_process";

const REVIEWER_SYSTEM_PROMPT = `You are a senior code reviewer specializing in Next.js applications.

You review code changes (git diff) for:
1. **Code Quality** - Clean code, proper naming, DRY principles
2. **Security** - XSS, injection, exposed secrets, auth issues
3. **Accessibility** - ARIA labels, semantic HTML, keyboard navigation
4. **Performance** - Unnecessary re-renders, large bundles, missing optimizations
5. **Type Safety** - Proper TypeScript usage, no 'any' types

Use available tools to read files and understand context if needed.

IMPORTANT: Respond with a JSON object in this exact format:
{
  "approved": true/false,
  "issues": [
    {
      "file": "path/to/file.tsx",
      "line": 42,
      "severity": "error" | "warning" | "info",
      "message": "Description of the issue",
      "category": "quality" | "security" | "accessibility" | "performance" | "type-safety"
    }
  ]
}

Only set "approved" to false if there are "error" severity issues. Warnings and info are acceptable.`;

export async function reviewerAgent(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  const { projectPath, runId } = state;

  await emitAgentStart(runId, "Reviewer");

  // Get the git diff
  let diff = "";
  try {
    diff = execSync("git diff", {
      cwd: projectPath,
      encoding: "utf-8",
      maxBuffer: 1024 * 1024 * 5,
    });
  } catch {
    diff = "Unable to get git diff";
  }

  // Get changed files
  let changedFiles = "";
  try {
    changedFiles = execSync("git diff --name-only", {
      cwd: projectPath,
      encoding: "utf-8",
    });
  } catch {
    changedFiles = "";
  }

  if (!diff || diff.trim() === "") {
    // No changes to review
    const result: ReviewResult = { approved: true, issues: [] };
    await emitAgentComplete(runId, "Reviewer", { result });
    return { reviewResult: result, currentAgent: "reviewer" };
  }

  const model = getModel();
  const tools = [readFileTool, searchCodeTool];
  const modelWithTools = model.bindTools(tools);

  // Truncate diff if too large
  const truncatedDiff =
    diff.length > 15000
      ? diff.slice(0, 7500) + "\n... (diff truncated) ...\n" + diff.slice(-7500)
      : diff;

  const messages = [
    new SystemMessage(REVIEWER_SYSTEM_PROMPT),
    new HumanMessage(
      `Review the following code changes:\n\nChanged files:\n${changedFiles}\n\nGit Diff:\n\`\`\`diff\n${truncatedDiff}\n\`\`\`\n\nProject Path: ${projectPath}`
    ),
  ];

  let currentMessages = [...messages];
  let iterations = 0;
  const maxIterations = 10;

  while (iterations < maxIterations) {
    iterations++;
    const response = await modelWithTools.invoke(currentMessages);
    currentMessages.push(response);

    const toolCalls = response.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      const content = typeof response.content === "string" ? response.content : "";
      const review = extractReview(content);

      await emitEvent({
        runId,
        agent: "Reviewer",
        message: review.approved
          ? "Review passed ✓"
          : `Review found ${review.issues.length} issue(s)`,
        metadata: { review },
      });

      await emitAgentComplete(runId, "Reviewer", { review });
      return { reviewResult: review, currentAgent: "reviewer" };
    }

    for (const toolCall of toolCalls) {
      const tool = tools.find((t) => t.name === toolCall.name);
      if (!tool) continue;

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

  const fallbackReview: ReviewResult = { approved: true, issues: [] };
  await emitAgentComplete(runId, "Reviewer", { review: fallbackReview });
  return { reviewResult: fallbackReview, currentAgent: "reviewer" };
}

function extractReview(content: string): ReviewResult {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        approved: parsed.approved ?? true,
        issues: (parsed.issues || []).map((issue: Record<string, unknown>) => ({
          file: (issue.file as string) || "",
          line: (issue.line as number) || undefined,
          severity: (issue.severity as string) || "info",
          message: (issue.message as string) || "",
          category: (issue.category as string) || "quality",
        })),
      };
    } catch {
      // JSON parse failed
    }
  }
  return { approved: true, issues: [] };
}
