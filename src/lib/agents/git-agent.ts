import simpleGit from "simple-git";
import { emitEvent, emitAgentStart, emitAgentComplete, emitAgentError } from "@/lib/workflow/event-emitter";
import type { AgentStateType } from "./state";
import { execSync } from "child_process";

export async function gitSetupAgent(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  const { task, projectPath, runId, branchName } = state;

  await emitAgentStart(runId, "Git");

  const git = simpleGit(projectPath);

  try {
    // Create a feature branch name from the task
    const safeBranchName =
      branchName ||
      `feature/${task
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 50)}`;

    await emitEvent({
      runId,
      agent: "Git",
      message: `Creating branch: ${safeBranchName}`,
    });

    // Get current branch as default
    const currentBranch = (await git.branch()).current;

    // Try to pull latest
    try {
      await git.pull();
    } catch {
      // May fail if no remote, that's ok
    }

    // Create and checkout new branch
    try {
      await git.checkoutLocalBranch(safeBranchName);
    } catch {
      // Branch might already exist
      await git.checkout(safeBranchName);
    }

    await emitAgentComplete(runId, "Git", {
      branch: safeBranchName,
      baseBranch: currentBranch,
    });

    return {
      branchName: safeBranchName,
      currentAgent: "git",
    };
  } catch (error: unknown) {
    const err = error as { message?: string };
    await emitAgentError(runId, "Git", err.message || "Git setup failed");
    return {
      errors: [`Git setup failed: ${err.message}`],
      currentAgent: "git",
    };
  }
}

export async function gitCommitAgent(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  const { task, projectPath, runId } = state;

  await emitAgentStart(runId, "Git-Commit");

  const git = simpleGit(projectPath);

  try {
    // Stage all changes
    await git.add(".");

    // Create commit message
    const commitMessage = `feat: ${task}\n\nImplemented by CodeNXT autonomous agent.`;
    const result = await git.commit(commitMessage);

    await emitEvent({
      runId,
      agent: "Git-Commit",
      message: `Committed: ${result.commit} (${result.summary.changes} files, +${result.summary.insertions} -${result.summary.deletions})`,
    });

    // Try to push
    try {
      const currentBranch = (await git.branch()).current;
      await git.push("origin", currentBranch, ["--set-upstream"]);
      await emitEvent({
        runId,
        agent: "Git-Commit",
        message: `Pushed to origin/${currentBranch}`,
      });
    } catch {
      await emitEvent({
        runId,
        agent: "Git-Commit",
        message: "Push skipped (no remote or auth issue)",
        level: "WARN",
      });
    }

    // Try to create PR
    try {
      const prOutput = execSync(
        `gh pr create --title "feat: ${task}" --body "Automated PR created by CodeNXT" --fill`,
        { cwd: projectPath, encoding: "utf-8", timeout: 30000 }
      );
      await emitEvent({
        runId,
        agent: "Git-Commit",
        message: `PR created: ${prOutput.trim()}`,
      });
    } catch {
      await emitEvent({
        runId,
        agent: "Git-Commit",
        message: "PR creation skipped (gh CLI not available or auth issue)",
        level: "WARN",
      });
    }

    await emitAgentComplete(runId, "Git-Commit", { commit: result.commit });
    return { currentAgent: "git-commit" };
  } catch (error: unknown) {
    const err = error as { message?: string };
    await emitAgentError(runId, "Git-Commit", err.message || "Commit failed");
    return {
      errors: [`Git commit failed: ${err.message}`],
      currentAgent: "git-commit",
    };
  }
}
