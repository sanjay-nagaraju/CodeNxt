# CodeNXT 🚀

**CodeNXT** is a powerful, autonomous AI coding agent platform that seamlessly integrates into your local development environment. Built with Next.js, LangGraph, and PostgreSQL, CodeNXT takes your high-level tasks, intelligently plans the implementation, analyzes your codebase, writes code, reviews it, and even commits the results—all monitored through a beautiful, real-time dashboard.

## ✨ Features

- **Multi-Agent Orchestration**: Powered by LangGraph, featuring specialized agents (Planner, Analyzer, Coder, Reviewer, QA, and Git).
- **Local-First Project Selector**: Native macOS folder picker to effortlessly target any local project on your machine.
- **Real-Time Log Streaming**: Watch the AI agents think, plan, and execute live via Server-Sent Events (SSE).
- **Background Processing**: Reliable task queuing and asynchronous execution using Redis and BullMQ.
- **AST-Based Intelligence**: Deep codebase understanding, intelligent parsing, and dependency mapping via `ts-morph`.
- **Bring Your Own LLM**: Integrated with OpenRouter to leverage top-tier models (like GPT-4, Claude 3, Qwen, etc.).

## 🏗 Architecture

- **Frontend**: Next.js App Router, Tailwind CSS, Lucide React
- **Backend APIs**: Next.js API Routes, BullMQ, Prisma ORM
- **Database / Queue**: PostgreSQL & Redis (Containerized via Docker)
- **AI / LLM Orchestration**: LangGraph, LangChain, OpenRouter

## 🚀 Getting Started

### 1. Prerequisites
- [Docker & Docker Compose](https://www.docker.com/) (Must be running on your machine)
- Node.js (v20+)
- An [OpenRouter API Key](https://openrouter.ai/)

### 2. Infrastructure Setup
Spin up the required PostgreSQL and Redis instances:
```bash
docker compose up -d
```

### 3. Environment Configuration
Copy the template and add your credentials:
```bash
cp .env.example .env
```
Ensure your `.env` contains:
```env
DATABASE_URL=postgresql://codenxt:codenxt@localhost:5432/codenxt
REDIS_URL=redis://localhost:6379
OPENROUTER_API_KEY=your-api-key-here
OPENROUTER_MODEL=qwen/qwen3-coder # Or your preferred model
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Database Initialization
Push the database schema:
```bash
npm run db:push
```

### 5. Start the Platform
You need two terminal windows to run CodeNXT.

**Terminal 1: Start the Dashboard (UI)**
```bash
npm run dev
```
*Open [http://localhost:3000](http://localhost:3000) in your browser.*

**Terminal 2: Start the Background Worker**
This process handles the task queue and executes the LangGraph multi-agent workflow.
```bash
npm run worker
```

## 🛠 Usage
1. Open the dashboard at `http://localhost:3000`.
2. Click **Browse...** to select the local project folder you want the AI to work on.
3. Describe your task (e.g., *"Add a dark mode toggle button to the header"*).
4. Hit **Run** and watch the agents autonomously analyze, code, and commit the changes!
