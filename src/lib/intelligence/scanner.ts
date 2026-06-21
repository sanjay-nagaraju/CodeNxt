import fs from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { createTsMorphProject, parseFile } from "./ts-parser";
import { buildRepoMap } from "./repo-map";
import { buildDependencyGraph } from "./dependency-graph";
import { setCachedRepoMap, invalidateProjectCache } from "./cache";
import type { RepoMap } from "@/lib/agents/state";

const IGNORED_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".cache",
  "__pycache__",
]);

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

export async function scanRepository(
  projectId: string,
  projectPath: string
): Promise<RepoMap> {
  // Invalidate caches
  await invalidateProjectCache(projectId);

  // Delete existing symbols for this project
  await prisma.symbol.deleteMany({ where: { projectId } });

  // Walk the file tree
  const filePaths = await walkDirectory(projectPath);

  // Build repo map
  const repoMap = buildRepoMap(filePaths, projectPath);

  // Parse all source files with ts-morph
  const project = createTsMorphProject(projectPath);
  const allImports: Array<{
    source: string;
    specifiers: string[];
    filePath: string;
  }> = [];

  const batchSize = 50;
  for (let i = 0; i < filePaths.length; i += batchSize) {
    const batch = filePaths.slice(i, i + batchSize);
    const parseResults = batch.map((fp) => parseFile(project, fp, projectPath));

    for (const { symbols, imports } of parseResults) {
      // Store symbols in DB
      if (symbols.length > 0) {
        await prisma.symbol.createMany({
          data: symbols.map((s) => ({
            projectId,
            name: s.name,
            type: s.type,
            path: s.path,
            line: s.line,
            exportType: s.exportType,
            signature: s.signature || null,
          })),
          skipDuplicates: true,
        });
      }

      allImports.push(...imports);
    }
  }

  // Build dependency graph
  await buildDependencyGraph(projectId, allImports, projectPath);

  // Cache repo map
  await setCachedRepoMap(projectId, repoMap);

  return repoMap;
}

async function walkDirectory(dirPath: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(currentPath: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith(".") && entry.name !== ".") continue;
      if (IGNORED_DIRS.has(entry.name)) continue;

      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SOURCE_EXTENSIONS.has(ext)) {
          files.push(fullPath);
        }
      }
    }
  }

  await walk(dirPath);
  return files;
}
