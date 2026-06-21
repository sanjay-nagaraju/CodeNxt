import { tool } from "@langchain/core/tools";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";

export const readFileTool = tool(
  async ({ filePath, projectPath, startLine, endLine }) => {
    const fullPath = path.resolve(projectPath, filePath);

    // Security: ensure we're within the project
    if (!fullPath.startsWith(path.resolve(projectPath))) {
      return "Error: Cannot read files outside the project directory";
    }

    try {
      const content = await fs.readFile(fullPath, "utf-8");
      const lines = content.split("\n");

      if (startLine !== undefined && endLine !== undefined) {
        const start = Math.max(0, startLine - 1);
        const end = Math.min(lines.length, endLine);
        const slice = lines.slice(start, end);
        return slice.map((line, i) => `${start + i + 1}: ${line}`).join("\n");
      }

      // For large files, return first 200 lines with a note
      if (lines.length > 200) {
        const slice = lines.slice(0, 200);
        return (
          slice.map((line, i) => `${i + 1}: ${line}`).join("\n") +
          `\n\n... (${lines.length - 200} more lines. Use startLine/endLine to read specific sections)`
        );
      }

      return lines.map((line, i) => `${i + 1}: ${line}`).join("\n");
    } catch {
      return `Error: File not found at ${filePath}`;
    }
  },
  {
    name: "read_file",
    description:
      "Read the contents of a file in the project. Returns numbered lines. For large files, use startLine/endLine to read specific sections.",
    schema: z.object({
      filePath: z.string().describe("Relative path to the file from project root"),
      projectPath: z.string().describe("Absolute path to the project root"),
      startLine: z.number().optional().describe("Start line number (1-indexed)"),
      endLine: z.number().optional().describe("End line number (1-indexed, inclusive)"),
    }),
  }
);

export const writeFileTool = tool(
  async ({ filePath, content, projectPath }) => {
    const fullPath = path.resolve(projectPath, filePath);

    if (!fullPath.startsWith(path.resolve(projectPath))) {
      return "Error: Cannot write files outside the project directory";
    }

    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, "utf-8");
      return `Successfully wrote to ${filePath}`;
    } catch (error: unknown) {
      const err = error as { message?: string };
      return `Error writing file: ${err.message}`;
    }
  },
  {
    name: "write_file",
    description:
      "Write content to a file, creating it if it doesn't exist or overwriting if it does. Parent directories are created automatically.",
    schema: z.object({
      filePath: z.string().describe("Relative path to the file from project root"),
      content: z.string().describe("The COMPLETE, raw source code to write. Must be a single plain text string containing the actual code. DO NOT pass JSON arrays, objects, or partial patches."),
      projectPath: z.string().describe("Absolute path to the project root"),
    }),
  }
);

export const createFileTool = tool(
  async ({ filePath, content, projectPath }) => {
    const fullPath = path.resolve(projectPath, filePath);

    if (!fullPath.startsWith(path.resolve(projectPath))) {
      return "Error: Cannot create files outside the project directory";
    }

    try {
      // Check if file already exists
      try {
        await fs.access(fullPath);
        return `Error: File already exists at ${filePath}. Use write_file to overwrite.`;
      } catch {
        // File doesn't exist, proceed
      }

      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, "utf-8");
      return `Successfully created ${filePath}`;
    } catch (error: unknown) {
      const err = error as { message?: string };
      return `Error creating file: ${err.message}`;
    }
  },
  {
    name: "create_file",
    description:
      "Create a new file with the given content. Fails if the file already exists. Parent directories are created automatically.",
    schema: z.object({
      filePath: z.string().describe("Relative path for the new file from project root"),
      content: z.string().describe("The COMPLETE, raw source code to write. Must be a single plain text string containing the actual code. DO NOT pass JSON arrays, objects, or partial patches."),
      projectPath: z.string().describe("Absolute path to the project root"),
    }),
  }
);

export const deleteFileTool = tool(
  async ({ filePath, projectPath }) => {
    const fullPath = path.resolve(projectPath, filePath);

    if (!fullPath.startsWith(path.resolve(projectPath))) {
      return "Error: Cannot delete files outside the project directory";
    }

    try {
      await fs.unlink(fullPath);
      return `Successfully deleted ${filePath}`;
    } catch {
      return `Error: File not found at ${filePath}`;
    }
  },
  {
    name: "delete_file",
    description: "Delete a file from the project.",
    schema: z.object({
      filePath: z.string().describe("Relative path to the file to delete"),
      projectPath: z.string().describe("Absolute path to the project root"),
    }),
  }
);
