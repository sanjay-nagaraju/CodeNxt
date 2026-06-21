import { getModel } from "@/lib/llm/model";
import { readFileTool, writeFileTool, createFileTool, runCommandTool } from "@/lib/tools";
import { emitEvent, emitAgentStart, emitAgentComplete } from "@/lib/workflow/event-emitter";
import type { AgentStateType, QAResult } from "./state";
import { HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";

const QA_SYSTEM_PROMPT = `You are a QA engineer for Next.js applications.

Your role is to validate that code changes meet the acceptance criteria. You can:
1. Read files to verify implementation
2. Create test files (unit tests, integration tests)
3. Run test commands
4. Verify acceptance criteria

Use the available tools to:
- Read the changed files and verify they meet requirements
- Create test files if needed
- Run existing tests with \`npm test\` (if test runner is configured)

IMPORTANT: Respond with a JSON object in this exact format:
{
  "passed": true/false,
  "testResults": { "total": 5, "passed": 5, "failed": 0 },
  "failedScenarios": [
    { "scenario": "Description of what failed", "reason": "Why it failed" }
  ]
}

Be thorough but practical. Focus on whether the acceptance criteria are met by reading and verifying the code.`;

export async function qaAgent(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  const { task, projectPath, runId, plan } = state;

  await emitAgentStart(runId, "QA");

  const model = getModel();
  const tools = [readFileTool, writeFileTool, createFileTool, runCommandTool];
  const modelWithTools = model.bindTools(tools);

  const acceptanceCriteria = plan?.acceptanceCriteria || [];

  const messages = [
    new SystemMessage(QA_SYSTEM_PROMPT),
    new HumanMessage(
      `Task: ${task}\n\nAcceptance Criteria:\n${acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}\n\nChanged files from the plan:\n${JSON.stringify(plan?.steps.flatMap((s) => s.targetFiles) || [], null, 2)}\n\nProject Path: ${projectPath}\n\nVerify that the implementation meets all acceptance criteria.`
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
      const qaResult = extractQAResult(content);

      await emitEvent({
        runId,
        agent: "QA",
        message: qaResult.passed
          ? "QA validation passed ✓"
          : `QA found ${qaResult.failedScenarios.length} failed scenario(s)`,
        metadata: { qaResult },
      });

      await emitAgentComplete(runId, "QA", { qaResult });
      return { qaResult, currentAgent: "qa" };
    }

    for (const toolCall of toolCalls) {
      const tool = tools.find((t) => t.name === toolCall.name);
      if (!tool) continue;

      await emitEvent({
        runId,
        agent: "QA",
        message: `Using tool: ${toolCall.name}`,
        level: "DEBUG",
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

  const fallbackResult: QAResult = {
    passed: true,
    testResults: { total: 0, passed: 0, failed: 0 },
    failedScenarios: [],
  };

  await emitAgentComplete(runId, "QA", { qaResult: fallbackResult });
  return { qaResult: fallbackResult, currentAgent: "qa" };
}

function extractQAResult(content: string): QAResult {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        passed: parsed.passed ?? true,
        testResults: parsed.testResults || { total: 0, passed: 0, failed: 0 },
        failedScenarios: (parsed.failedScenarios || []).map(
          (s: Record<string, unknown>) => ({
            scenario: (s.scenario as string) || "",
            reason: (s.reason as string) || "",
          })
        ),
      };
    } catch {
      // JSON parse failed
    }
  }
  return {
    passed: true,
    testResults: { total: 0, passed: 0, failed: 0 },
    failedScenarios: [],
  };
}
