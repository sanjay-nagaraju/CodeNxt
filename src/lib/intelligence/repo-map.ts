import path from "path";
import type { RepoMap } from "@/lib/agents/state";

const CATEGORY_DIRS: Record<keyof RepoMap, string[]> = {
  routes: ["app", "pages", "src/app", "src/pages"],
  components: ["components", "src/components"],
  services: ["services", "src/services", "api", "src/api"],
  hooks: ["hooks", "src/hooks"],
  contexts: ["contexts", "context", "src/contexts", "src/context"],
  stores: ["store", "stores", "src/store", "src/stores"],
  utils: ["utils", "lib", "helpers", "src/utils", "src/lib", "src/helpers"],
};

export function categorizeFile(filePath: string): keyof RepoMap | null {
  const normalized = filePath.replace(/\\/g, "/");

  for (const [category, dirs] of Object.entries(CATEGORY_DIRS)) {
    for (const dir of dirs) {
      if (normalized.startsWith(dir + "/") || normalized.startsWith("./" + dir + "/")) {
        return category as keyof RepoMap;
      }
    }
  }

  // Check by filename patterns
  if (normalized.includes("/hook") || normalized.match(/use[A-Z]/)) {
    return "hooks";
  }
  if (normalized.includes("/context")) {
    return "contexts";
  }

  return null;
}

export function buildRepoMap(filePaths: string[], projectPath: string): RepoMap {
  const repoMap: RepoMap = {
    routes: [],
    components: [],
    services: [],
    hooks: [],
    contexts: [],
    stores: [],
    utils: [],
  };

  for (const filePath of filePaths) {
    const relativePath = path.relative(projectPath, filePath).replace(/\\/g, "/");
    const category = categorizeFile(relativePath);

    if (category) {
      repoMap[category].push(relativePath);
    }
  }

  return repoMap;
}
