import { tool } from "@langchain/core/tools";
import { z } from "zod";
import simpleGit, { SimpleGit } from "simple-git";

function getGit(projectPath: string): SimpleGit {
  return simpleGit(projectPath);
}

export const gitStatusTool = tool(
  async ({ projectPath }) => {
    const git = getGit(projectPath);
    const status = await git.status();

    return JSON.stringify(
      {
        current: status.current,
        tracking: status.tracking,
        staged: status.staged,
        modified: status.modified,
        created: status.created,
        deleted: status.deleted,
        not_added: status.not_added,
        conflicted: status.conflicted,
        isClean: status.isClean(),
      },
      null,
      2
    );
  },
  {
    name: "git_status",
    description: "Get the current git status of the project repository.",
    schema: z.object({
      projectPath: z.string().describe("Absolute path to the project root"),
    }),
  }
);

export const gitDiffTool = tool(
  async ({ projectPath, staged }) => {
    const git = getGit(projectPath);
    const diff = staged ? await git.diff(["--staged"]) : await git.diff();

    if (!diff) {
      return "No differences found";
    }

    // Truncate very long diffs
    if (diff.length > 10000) {
      return (
        diff.slice(0, 5000) +
        "\n\n... (diff truncated, showing first and last 5000 chars) ...\n\n" +
        diff.slice(-5000)
      );
    }

    return diff;
  },
  {
    name: "git_diff",
    description:
      "Get the git diff of changes in the repository. Can show staged or unstaged changes.",
    schema: z.object({
      projectPath: z.string().describe("Absolute path to the project root"),
      staged: z
        .boolean()
        .default(false)
        .describe("If true, show only staged changes"),
    }),
  }
);

export const createBranchTool = tool(
  async ({ branchName, baseBranch, projectPath }) => {
    const git = getGit(projectPath);

    try {
      // Checkout base branch and pull latest
      if (baseBranch) {
        await git.checkout(baseBranch);
        try {
          await git.pull();
        } catch {
          // May fail if no remote, that's ok
        }
      }

      // Create and checkout new branch
      await git.checkoutLocalBranch(branchName);
      return `Created and checked out branch: ${branchName}`;
    } catch (error: unknown) {
      const err = error as { message?: string };
      return `Error creating branch: ${err.message}`;
    }
  },
  {
    name: "create_branch",
    description:
      "Create a new git branch and check it out. Optionally pulls latest from a base branch first.",
    schema: z.object({
      branchName: z.string().describe("Name of the new branch"),
      baseBranch: z
        .string()
        .optional()
        .describe("Base branch to create from (e.g., 'main', 'develop')"),
      projectPath: z.string().describe("Absolute path to the project root"),
    }),
  }
);

export const gitCommitTool = tool(
  async ({ message, projectPath }) => {
    const git = getGit(projectPath);

    try {
      await git.add(".");
      const result = await git.commit(message);
      return `Committed: ${result.commit}\nFiles changed: ${result.summary.changes}\nInsertions: ${result.summary.insertions}\nDeletions: ${result.summary.deletions}`;
    } catch (error: unknown) {
      const err = error as { message?: string };
      return `Error committing: ${err.message}`;
    }
  },
  {
    name: "git_commit",
    description:
      "Stage all changes and create a git commit with the given message.",
    schema: z.object({
      message: z.string().describe("Commit message"),
      projectPath: z.string().describe("Absolute path to the project root"),
    }),
  }
);

export const gitPushTool = tool(
  async ({ projectPath }) => {
    const git = getGit(projectPath);

    try {
      const currentBranch = (await git.branch()).current;
      await git.push("origin", currentBranch, ["--set-upstream"]);
      return `Pushed branch ${currentBranch} to origin`;
    } catch (error: unknown) {
      const err = error as { message?: string };
      return `Error pushing: ${err.message}`;
    }
  },
  {
    name: "git_push",
    description: "Push the current branch to the remote origin.",
    schema: z.object({
      projectPath: z.string().describe("Absolute path to the project root"),
    }),
  }
);
