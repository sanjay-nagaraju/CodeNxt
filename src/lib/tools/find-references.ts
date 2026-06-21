import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { prisma } from "@/lib/db";

export const findReferencesTool = tool(
  async ({ symbolName, projectId }) => {
    // Find the symbol first
    const symbols = await prisma.symbol.findMany({
      where: {
        projectId,
        name: { contains: symbolName, mode: "insensitive" },
      },
    });

    if (symbols.length === 0) {
      return `No symbol found with name "${symbolName}"`;
    }

    const symbolIds = symbols.map((s) => s.id);

    // Find all symbols that depend on this symbol (i.e., reference it)
    const references = await prisma.dependency.findMany({
      where: {
        targetSymbolId: { in: symbolIds },
      },
      include: {
        source: true,
      },
    });

    if (references.length === 0) {
      return `No references found for "${symbolName}"`;
    }

    const result = references.map((r) => ({
      referencedBy: r.source.name,
      type: r.source.type,
      path: r.source.path,
      line: r.source.line,
    }));

    return JSON.stringify(result, null, 2);
  },
  {
    name: "find_references",
    description:
      "Find all code locations that reference/use a given symbol. Returns files and symbols that depend on the target symbol.",
    schema: z.object({
      symbolName: z.string().describe("Name of the symbol to find references for"),
      projectId: z.string().describe("The project ID to search in"),
    }),
  }
);
