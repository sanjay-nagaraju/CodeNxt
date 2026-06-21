#!/usr/bin/env node

import { execSync, spawn } from "child_process";
import path from "path";
import fs from "fs";

const BANNER = `
╔══════════════════════════════════════════╗
║                                          ║
║      ▄████▄   ▄▄▄▄   ▄▄▄▄▄▄▄ ▄       ║
║     ██▀  ▀█  ██  ██    ██    ████      ║
║     ██       ██  ██    ██     ██       ║
║     ██       ██  ██    ██     ██       ║
║      ▀████▀  ▀▀▀▀     ██     ██       ║
║                                          ║
║   CodeNXT — Autonomous Multi-Agent       ║
║              Coding Platform             ║
╚══════════════════════════════════════════╝
`;

async function main() {
  console.log(BANNER);

  const projectPath = process.cwd();
  console.log(`📁 Project: ${projectPath}`);

  // Verify this is a git repo
  if (!fs.existsSync(path.join(projectPath, ".git"))) {
    console.error("❌ Not a git repository. Run 'git init' first.");
    process.exit(1);
  }

  // Verify package.json exists
  if (!fs.existsSync(path.join(projectPath, "package.json"))) {
    console.error("❌ No package.json found. This must be a Node.js project.");
    process.exit(1);
  }

  const codenxtDir = path.resolve(__dirname, "..");

  // Check Docker services
  console.log("\\n🐳 Checking Docker services...");
  try {
    execSync("docker compose ps --format json", {
      cwd: codenxtDir,
      encoding: "utf-8",
    });
    console.log("  ✓ Docker services detected");
  } catch {
    console.log("  ⚠ Starting Docker services...");
    try {
      execSync("docker compose up -d", {
        cwd: codenxtDir,
        encoding: "utf-8",
        stdio: "inherit",
      });
      console.log("  ✓ Docker services started");

      // Wait for services to be ready
      console.log("  ⏳ Waiting for services...");
      await new Promise((resolve) => setTimeout(resolve, 3000));
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error(
        "  ❌ Failed to start Docker services:",
        err.message
      );
      console.error(
        "  Please ensure Docker is installed and run: docker compose up -d"
      );
      process.exit(1);
    }
  }

  // Run Prisma migrations
  console.log("\\n📦 Setting up database...");
  try {
    execSync("npx prisma db push", {
      cwd: codenxtDir,
      encoding: "utf-8",
      stdio: "inherit",
      env: { ...process.env },
    });
    console.log("  ✓ Database ready");
  } catch {
    console.error("  ⚠ Database setup warning (may already be configured)");
  }

  // Register project
  console.log("\\n📝 Registering project...");
  const projectName = path.basename(projectPath);

  // Start the Next.js dev server
  console.log("\\n🚀 Starting CodeNXT dashboard...");

  const nextProcess = spawn("npm", ["run", "dev"], {
    cwd: codenxtDir,
    stdio: "pipe",
    env: {
      ...process.env,
      NEXT_PUBLIC_PROJECT_PATH: projectPath,
    },
  });

  nextProcess.stdout?.on("data", (data: Buffer) => {
    const output = data.toString();
    if (output.includes("Ready")) {
      console.log("  ✓ Dashboard ready at http://localhost:3000");
    }
    process.stdout.write(`  [Next] ${output}`);
  });

  nextProcess.stderr?.on("data", (data: Buffer) => {
    process.stderr.write(`  [Next] ${data.toString()}`);
  });

  // Start the worker
  console.log("\\n⚙️  Starting worker...");

  const workerProcess = spawn("npx", ["tsx", "src/worker.ts"], {
    cwd: codenxtDir,
    stdio: "pipe",
    env: {
      ...process.env,
      NEXT_PUBLIC_PROJECT_PATH: projectPath,
    },
  });

  workerProcess.stdout?.on("data", (data: Buffer) => {
    process.stdout.write(`  [Worker] ${data.toString()}`);
  });

  workerProcess.stderr?.on("data", (data: Buffer) => {
    process.stderr.write(`  [Worker] ${data.toString()}`);
  });

  console.log(`
╔══════════════════════════════════════════╗
║  CodeNXT is running!                     ║
║                                          ║
║  Dashboard: http://localhost:3000        ║
║  Project:   ${projectName.padEnd(29)}║
║                                          ║
║  Press Ctrl+C to stop                    ║
╚══════════════════════════════════════════╝
`);

  // Handle shutdown
  process.on("SIGINT", () => {
    console.log("\\n🛑 Shutting down CodeNXT...");
    nextProcess.kill();
    workerProcess.kill();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    nextProcess.kill();
    workerProcess.kill();
    process.exit(0);
  });
}

main().catch(console.error);
