import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { prisma } from "@/lib/db";

export const findSymbolTool = tool(
  async ({ name, type, projectId }) => {
    const where: Record<string, unknown> = { projectId };

    if (name) {
      where.name = { contains: name, mode: "insensitive" };
    }
    if (type) {
      where.type = type;
    }

    const symbols = await prisma.symbol.findMany({
      where: where as never,
      take: 20,
      orderBy: { name: "asc" },
    });

    if (symbols.length === 0) {
      return `No symbols found matching name="${name}"${type ? ` type="${type}"` : ""}`;
    }

    return JSON.stringify(
      symbols.map((s) => ({
        name: s.name,
        type: s.type,
        path: s.path,
        line: s.line,
        signature: s.signature,
      })),
      null,
      2
    );
  },
  {
    name: "find_symbol",
    description:
      "Search for code symbols (components, functions, classes, hooks, types, interfaces) in the project's symbol index. Returns matching symbols with their file paths and line numbers.",
    schema: z.object({
      name: z.string().describe("Name or partial name of the symbol to find"),
      type: z
        .enum([
          "COMPONENT",
          "FUNCTION",
          "CLASS",
          "HOOK",
          "CONTEXT",
          "TYPE",
          "INTERFACE",
          "ENUM",
          "VARIABLE",
        ])
        .optional()
        .describe("Filter by symbol type"),
      projectId: z.string().describe("The project ID to search in"),
    }),
  }
);
