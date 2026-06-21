import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { prisma } from "@/lib/db";

export const getDependenciesTool = tool(
  async ({ symbolName, projectId }) => {
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

    // Upstream: what this symbol depends on
    const upstream = await prisma.dependency.findMany({
      where: { sourceSymbolId: { in: symbolIds } },
      include: { target: true },
    });

    // Downstream: what depends on this symbol
    const downstream = await prisma.dependency.findMany({
      where: { targetSymbolId: { in: symbolIds } },
      include: { source: true },
    });

    return JSON.stringify(
      {
        symbol: symbolName,
        dependsOn: upstream.map((d) => ({
          name: d.target.name,
          type: d.target.type,
          path: d.target.path,
        })),
        dependedOnBy: downstream.map((d) => ({
          name: d.source.name,
          type: d.source.type,
          path: d.source.path,
        })),
      },
      null,
      2
    );
  },
  {
    name: "get_dependencies",
    description:
      "Get the upstream (what a symbol depends on) and downstream (what depends on the symbol) dependencies for a given symbol.",
    schema: z.object({
      symbolName: z.string().describe("Name of the symbol"),
      projectId: z.string().describe("The project ID"),
    }),
  }
);
