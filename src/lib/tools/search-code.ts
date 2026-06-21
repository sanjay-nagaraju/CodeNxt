import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { execSync } from "child_process";
import path from "path";

export const searchCodeTool = tool(
  async ({ query, filePattern, projectPath }) => {
    try {
      const args = ["--color=never", "-n", "-i"];

      if (filePattern) {
        args.push(`--include=${filePattern}`);
      }

      // Exclude common non-source directories
      args.push(
        "--exclude-dir=node_modules",
        "--exclude-dir=.next",
        "--exclude-dir=.git",
        "--exclude-dir=dist",
        "--exclude-dir=build",
        "--exclude-dir=coverage"
      );

      args.push("-r", query, ".");

      const result = execSync(`grep ${args.join(" ")}`, {
        cwd: projectPath,
        encoding: "utf-8",
        maxBuffer: 1024 * 1024,
        timeout: 10000,
      });

      const lines = result.trim().split("\n").slice(0, 50);
      return lines
        .map((line) => {
          const relativePath = line.startsWith("./") ? line.slice(2) : line;
          return relativePath;
        })
        .join("\n");
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      if (err.status === 1) {
        return `No matches found for "${query}"`;
      }
      return `Search error: ${err.message || "Unknown error"}`;
    }
  },
  {
    name: "search_code",
    description:
      "Search for text patterns in the codebase using grep. Returns matching file paths, line numbers, and content. Results limited to 50 matches.",
    schema: z.object({
      query: z.string().describe("Search pattern (supports basic regex)"),
      filePattern: z
        .string()
        .optional()
        .describe("File glob pattern to filter, e.g. '*.tsx' or '*.ts'"),
      projectPath: z.string().describe("Absolute path to the project root"),
    }),
  }
);
