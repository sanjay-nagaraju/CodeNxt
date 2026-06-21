import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { execSync } from "child_process";

export const runCommandTool = tool(
  async ({ command, cwd }) => {
    // Block dangerous commands
    const blocked = ["rm -rf /", "sudo", "chmod 777", "mkfs"];
    if (blocked.some((b) => command.includes(b))) {
      return "Error: This command is blocked for safety reasons";
    }

    try {
      const output = execSync(command, {
        cwd,
        encoding: "utf-8",
        maxBuffer: 1024 * 1024 * 5,
        timeout: 120000, // 2 minute timeout
        env: { ...process.env, FORCE_COLOR: "0" },
      });

      // Truncate very long output
      if (output.length > 5000) {
        return (
          output.slice(0, 2500) +
          "\n\n... (output truncated) ...\n\n" +
          output.slice(-2500)
        );
      }

      return output || "(no output)";
    } catch (error: unknown) {
      const err = error as { stderr?: string; stdout?: string; message?: string };
      const stderr = err.stderr || "";
      const stdout = err.stdout || "";
      return `Command failed:\n${stderr}\n${stdout}`.trim();
    }
  },
  {
    name: "run_command",
    description:
      "Execute a shell command in the project directory. Has a 2 minute timeout. Dangerous commands are blocked.",
    schema: z.object({
      command: z.string().describe("The shell command to execute"),
      cwd: z.string().describe("Working directory for the command"),
    }),
  }
);
