import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { execSync } from "child_process";

export const installDependencyTool = tool(
  async ({ packages, dev, projectPath }) => {
    const pkgList = packages.join(" ");
    const flag = dev ? "--save-dev" : "--save";
    const command = `npm install ${flag} ${pkgList}`;

    try {
      const output = execSync(command, {
        cwd: projectPath,
        encoding: "utf-8",
        maxBuffer: 1024 * 1024,
        timeout: 120000,
        env: { ...process.env, FORCE_COLOR: "0" },
      });

      return `Successfully installed: ${pkgList}\n${output}`;
    } catch (error: unknown) {
      const err = error as { stderr?: string; message?: string };
      return `Failed to install packages: ${err.stderr || err.message}`;
    }
  },
  {
    name: "install_dependency",
    description:
      "Install npm packages in the project. Packages are installed via `npm install`.",
    schema: z.object({
      packages: z
        .array(z.string())
        .describe("List of package names to install, e.g. ['axios', 'lodash']"),
      dev: z
        .boolean()
        .default(false)
        .describe("If true, install as devDependency"),
      projectPath: z.string().describe("Absolute path to the project root"),
    }),
  }
);
