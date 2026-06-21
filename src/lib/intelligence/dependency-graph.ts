import { prisma } from "@/lib/db";
import type { ParsedImport } from "./ts-parser";
import path from "path";

export async function buildDependencyGraph(
  projectId: string,
  imports: ParsedImport[],
  projectPath: string
): Promise<void> {
  // Group imports by file
  const fileImports = new Map<string, ParsedImport[]>();
  for (const imp of imports) {
    const existing = fileImports.get(imp.filePath) ?? [];
    existing.push(imp);
    fileImports.set(imp.filePath, existing);
  }

  // Get all symbols for this project
  const allSymbols = await prisma.symbol.findMany({
    where: { projectId },
    select: { id: true, name: true, path: true },
  });

  // Build a lookup map: name -> symbol
  const symbolMap = new Map<string, typeof allSymbols>();
  for (const sym of allSymbols) {
    const existing = symbolMap.get(sym.name) ?? [];
    existing.push(sym);
    symbolMap.set(sym.name, existing);
  }

  const dependencies: Array<{
    sourceSymbolId: string;
    targetSymbolId: string;
  }> = [];

  for (const [filePath, fileImps] of fileImports) {
    // Find symbols defined in this file (sources)
    const sourceSymbols = allSymbols.filter((s) => s.path === filePath);
    if (sourceSymbols.length === 0) continue;

    for (const imp of fileImps) {
      // Resolve the import source to a file path
      const resolvedPath = resolveImportPath(imp.source, filePath, projectPath);

      for (const specifier of imp.specifiers) {
        // Find matching target symbol
        const candidates = symbolMap.get(specifier) ?? [];
        const target = resolvedPath
          ? candidates.find((c) => c.path === resolvedPath)
          : candidates[0];

        if (!target) continue;

        // Each source symbol in this file depends on the target
        for (const source of sourceSymbols) {
          if (source.id !== target.id) {
            dependencies.push({
              sourceSymbolId: source.id,
              targetSymbolId: target.id,
            });
          }
        }
      }
    }
  }

  // Batch upsert dependencies
  if (dependencies.length > 0) {
    // Delete existing dependencies for this project's symbols
    const symbolIds = allSymbols.map((s) => s.id);
    await prisma.dependency.deleteMany({
      where: {
        OR: [
          { sourceSymbolId: { in: symbolIds } },
          { targetSymbolId: { in: symbolIds } },
        ],
      },
    });

    // Insert new dependencies in batches
    const batchSize = 100;
    for (let i = 0; i < dependencies.length; i += batchSize) {
      const batch = dependencies.slice(i, i + batchSize);
      await prisma.dependency.createMany({
        data: batch,
        skipDuplicates: true,
      });
    }
  }
}

function resolveImportPath(
  importSource: string,
  currentFile: string,
  _projectPath: string
): string | null {
  // Only resolve relative imports
  if (!importSource.startsWith(".")) {
    return null;
  }

  const currentDir = path.dirname(currentFile);
  let resolved = path.normalize(path.join(currentDir, importSource));
  resolved = resolved.replace(/\\/g, "/");

  // Try common extensions
  const extensions = [".tsx", ".ts", ".jsx", ".js", "/index.tsx", "/index.ts"];
  for (const ext of extensions) {
    const candidate = resolved + ext;
    // We just return the path without checking fs, since we compare against known symbol paths
    return candidate;
  }

  return resolved;
}

export async function getImpactRadius(
  symbolName: string,
  projectId: string
): Promise<string[]> {
  const visited = new Set<string>();
  const impactedFiles = new Set<string>();

  async function traverse(name: string): Promise<void> {
    if (visited.has(name)) return;
    visited.add(name);

    // Find symbols with this name
    const symbols = await prisma.symbol.findMany({
      where: { projectId, name },
    });

    for (const sym of symbols) {
      impactedFiles.add(sym.path);

      // Find downstream dependents
      const dependents = await prisma.dependency.findMany({
        where: { targetSymbolId: sym.id },
        include: { source: true },
      });

      for (const dep of dependents) {
        impactedFiles.add(dep.source.path);
        await traverse(dep.source.name);
      }
    }
  }

  await traverse(symbolName);
  return Array.from(impactedFiles);
}
