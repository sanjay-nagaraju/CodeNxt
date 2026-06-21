import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const runBuildTool = tool(
  async ({ projectPath }) => {
    try {
      const { execSync } = await import("child_process");
      const output = execSync("npm run build", {
        cwd: projectPath,
        encoding: "utf-8",
        maxBuffer: 1024 * 1024 * 10,
        timeout: 180000,
        env: { ...process.env, FORCE_COLOR: "0" },
      });

      return `Build successful:\n${output}`;
    } catch (error: unknown) {
      const err = error as { stderr?: string; stdout?: string; message?: string };
      const stderr = err.stderr || "";
      const stdout = err.stdout || "";
      const errorOutput = `${stderr}\n${stdout}`.trim();

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

      return `Build failed with errors:\n${errorLines.join("\n") || err.message}`;
    }
  },
  {
    name: "run_build",
    description: "Run 'npm run build' in the project directory to check for type errors and build success.",
    schema: z.object({
      projectPath: z.string().describe("Absolute path to the project root"),
    }),
  }
);
