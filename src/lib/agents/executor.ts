import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import { getModel } from "@/lib/llm/model";
import { HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { execSync } from "child_process";
import { emitEvent, emitAgentStart, emitAgentComplete, emitAgentError } from "@/lib/workflow/event-emitter";
import type { AgentStateType } from "./state";
import * as availableTools from "@/lib/tools";

export interface AgentConfig {
  name: string;
  description: string;
  tools: string[];
  skills: string[];
  maxIterations?: number;
}

export async function runMarkdownAgent(
  agentName: string,
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  const { task, projectPath, projectId, runId, repoMap, plan, analysis, reviewResult, qaResult, retryCount } = state;

  // 1. Load markdown file
  const mdPath = path.join(process.cwd(), "src", "agents", `${agentName}.md`);
  let fileContent: string;
  try {
    fileContent = await fs.readFile(mdPath, "utf-8");
  } catch (error) {
    await emitAgentError(runId, agentName, `Missing agent definition: ${agentName}.md`);
    throw new Error(`Agent definition ${agentName}.md not found.`);
  }

  const { data, content: systemPromptTemplate } = matter(fileContent);
  const config = data as AgentConfig;
  const capitalizedName = config.name || agentName.charAt(0).toUpperCase() + agentName.slice(1);

  await emitAgentStart(runId, capitalizedName);

  // 2. Resolve tools
  const toolsToBind = (config.tools || []).map((toolName) => {
    // Look up tool dynamically from availableTools
    // Convert tool_name to toolNameTool format if needed, or exact match
    const tool = Object.values(availableTools).find((t: any) => t.name === toolName || t.name === toolName + "Tool");
    if (!tool) {
      console.warn(`[Executor] Warning: Tool ${toolName} requested by ${agentName} but not found in availableTools`);
    }
    return tool;
  }).filter(Boolean);

  const model = getModel();
  const modelWithTools = toolsToBind.length > 0 ? model.bindTools(toolsToBind) : model;

  // 3. Build context message
  // We provide ALL current state context. The specific agent can use what it needs.
  let contextMsg = `Task: ${task}\nProject ID: ${projectId}\nProject Path: ${projectPath}\n`;
  if (repoMap) contextMsg += `\nRepository Map:\n${JSON.stringify(repoMap, null, 2)}\n`;
  if (plan) contextMsg += `\nPlan:\n${JSON.stringify(plan, null, 2)}\n`;
  if (analysis) contextMsg += `\nAnalysis:\n${JSON.stringify(analysis, null, 2)}\n`;

  // Provide retry feedback if applicable
  if (retryCount > 0 && reviewResult && !reviewResult.approved) {
    contextMsg += `\n⚠️ REVIEW FEEDBACK (retry #${retryCount}):\n${JSON.stringify(reviewResult.issues, null, 2)}\nPlease fix these issues.\n`;
  }
  if (retryCount > 0 && qaResult && !qaResult.passed) {
    contextMsg += `\n⚠️ QA FEEDBACK (retry #${retryCount}):\n${JSON.stringify(qaResult.failedScenarios, null, 2)}\nPlease fix these failing scenarios.\n`;
  }

  // Inject Git Diff for Reviewer specifically
  if (agentName === "reviewer") {
    try {
      let diff = execSync("git diff", { cwd: projectPath, encoding: "utf-8", maxBuffer: 1024 * 1024 * 5 });
      const changedFiles = execSync("git diff --name-only", { cwd: projectPath, encoding: "utf-8" });
      const truncatedDiff = diff.length > 15000 ? diff.slice(0, 7500) + "\n... (diff truncated) ...\n" + diff.slice(-7500) : diff;
      contextMsg += `\nReview the following code changes:\n\nChanged files:\n${changedFiles}\n\nGit Diff:\n\`\`\`diff\n${truncatedDiff}\n\`\`\`\n`;
    } catch {
      contextMsg += `\nUnable to get git diff.\n`;
    }
  }

  const messages = [
    new SystemMessage(systemPromptTemplate),
    new HumanMessage(contextMsg),
  ];

  // 4. Execution loop
  let currentMessages = [...messages];
  let iterations = 0;
  const maxIterations = config.maxIterations || 15;

  while (iterations < maxIterations) {
    iterations++;
    let response;
    try {
      response = await modelWithTools.invoke(currentMessages);
    } catch (error: any) {
      const errMsg = error?.message || "Unknown LLM invocation error";
      await emitEvent({
        runId,
        agent: capitalizedName,
        message: `LLM Error: ${errMsg}`,
        level: "ERROR",
      });
      await emitAgentError(runId, capitalizedName, `Model crashed: ${errMsg}`);
      throw error;
    }
    
    currentMessages.push(response);

    const toolCalls = response.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      // Loop complete
      const content = typeof response.content === "string" ? response.content : "";
      
      await emitEvent({
        runId,
        agent: capitalizedName,
        message: `Execution complete after ${iterations} iterations`,
        metadata: { iterations },
      });

      // Try to parse JSON output to sync with state (e.g. Plan, Analysis)
      const parsedOutput = extractJsonOutput(content);
      
      // We map the parsed output dynamically based on the agent name
      const stateUpdate: Partial<AgentStateType> = { currentAgent: agentName };
      if (agentName === "planner") stateUpdate.plan = parsedOutput;
      if (agentName === "analyzer") stateUpdate.analysis = parsedOutput;
      if (agentName === "reviewer") stateUpdate.reviewResult = parsedOutput;
      if (agentName === "qa") stateUpdate.qaResult = parsedOutput;

      await emitAgentComplete(runId, capitalizedName, stateUpdate);
      return stateUpdate;
    }

    // Execute tool calls
    for (const toolCall of toolCalls) {
      const tool = toolsToBind.find((t: any) => t.name === toolCall.name);
      if (!tool) continue;

      const actionName = toolCall.name.includes("file")
        ? `${toolCall.name}: ${(toolCall.args as Record<string, unknown>).filePath}`
        : toolCall.name;

      await emitEvent({
        runId,
        agent: capitalizedName,
        message: `Using tool: ${actionName}`,
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

  await emitAgentError(runId, capitalizedName, "Max iterations reached");
  return { currentAgent: agentName };
}

function extractJsonOutput(content: string): any {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      // JSON parse failed
    }
  }
  return null;
}
