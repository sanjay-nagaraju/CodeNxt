# CodeNXT 🚀

**CodeNXT** is a powerful, autonomous AI coding agent platform that seamlessly integrates into your local development environment. Built with Next.js, LangGraph, and PostgreSQL, CodeNXT takes your high-level tasks, intelligently plans the implementation, analyzes your codebase, writes code, reviews it, and even commits the results—all monitored through a beautiful, real-time dashboard.

## ✨ Features

- **Multi-Agent Orchestration**: Powered by LangGraph, featuring specialized agents (Planner, Analyzer, Coder, Reviewer, QA, and Git).
- **Local-First Project Selector**: Native macOS folder picker to effortlessly target any local project on your machine.
- **Real-Time Log Streaming**: Watch the AI agents think, plan, and execute live via Server-Sent Events (SSE).
- **Background Processing**: Reliable task queuing and asynchronous execution using Redis and BullMQ.
- **AST-Based Intelligence**: Deep codebase understanding, intelligent parsing, and dependency mapping via `ts-morph`.
- **Bring Your Own LLM**: Integrated with OpenRouter to leverage top-tier models (like GPT-4, Claude 3, Qwen, etc.).

## 🏗 System Architecture

CodeNXT uses a decoupled, event-driven architecture to ensure the heavy lifting of AI orchestration doesn't block the beautiful, real-time UI.

```mermaid
graph TD
    %% Define Styles
    classDef ui fill:#4f46e5,stroke:#312e81,stroke-width:2px,color:#fff
    classDef api fill:#0891b2,stroke:#164e63,stroke-width:2px,color:#fff
    classDef queue fill:#ea580c,stroke:#7c2d12,stroke-width:2px,color:#fff
    classDef worker fill:#16a34a,stroke:#14532d,stroke-width:2px,color:#fff
    classDef db fill:#ca8a04,stroke:#713f12,stroke-width:2px,color:#fff
    classDef agent fill:#9333ea,stroke:#581c87,stroke-width:2px,color:#fff

    User([👤 User]) -->|Submits Task| UI(Next.js Dashboard):::ui
    UI -->|API Request| API(Next.js API Routes):::api
    
    API -->|Enqueues Task| Queue[(BullMQ / Redis)]:::queue
    API -.->|Listens for SSE| PubSub[(Redis PubSub)]:::queue
    
    Worker(Background TSX Worker):::worker -->|Pulls Task| Queue
    Worker -->|Initializes| Graph(LangGraph Orchestrator):::worker
    
    Graph --> Planner[🧠 Planner Agent]:::agent
    Planner --> Analyzer[🔍 Analyzer Agent]:::agent
    Analyzer --> Coder[💻 Coder Agent]:::agent
    Coder --> Reviewer[👀 Reviewer Agent]:::agent
    Reviewer --> QA[🧪 QA Agent]:::agent
    QA --> Git[🌿 Git Agent]:::agent
    
    Graph -->|Saves State| DB[(PostgreSQL / Prisma)]:::db
    Graph -->|Publishes Events| PubSub
    PubSub -.->|Streams Live Logs| UI
```

### Core Technologies & Packages

We selected the following stack to ensure extreme reliability, type safety, and a premium developer experience:

- **Frontend & Core Framework**: 
  - `next` (v15 App Router) / `react` / `react-dom`
- **Premium UI & Styling**: 
  - `tailwindcss` (v4) for utility-first styling.
  - `framer-motion` for fluid, physics-based micro-interactions and layout transitions.
  - `lucide-react` for crisp, highly-legible SVG iconography.
  - `clsx` & `tailwind-merge` for dynamic class resolution.
- **AI & Agent Orchestration**: 
  - `@langchain/langgraph` to build stateful, multi-actor applications with LLMs.
  - `@langchain/core` & `@langchain/openai` to interface seamlessly with OpenRouter and top-tier models.
- **Background Processing & Real-time**: 
  - `bullmq` & `ioredis` for robust, persistent job queuing and real-time Pub/Sub event broadcasting (Server-Sent Events).
- **Database & Persistence**: 
  - `@prisma/client` & `postgresql` for heavily typed, relational storage of runs, events, and AST mappings.
- **AST Parsing & Git Integration**: 
  - `ts-morph` for deep TypeScript Abstract Syntax Tree parsing (finding dependencies, exports, and interfaces).
  - `simple-git`, `diff`, and `diff2html` for autonomous git branch management and code diff generation.
- **Validation**: 
  - `zod` for impenetrable runtime type schemas.

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
