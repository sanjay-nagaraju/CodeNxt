# CodeNXT - Autonomous Multi-Agent Coding Platform

## Vision

Build an autonomous multi-agent coding platform inspired by Claude Code, Devin, OpenHands, and Cursor Agent.

The system should work on an existing local Next.js repository and be capable of:

* Understanding natural language requirements
* Planning implementation
* Analyzing the codebase
* Locating relevant files and symbols
* Modifying code
* Installing dependencies
* Running builds
* Reviewing code
* Performing QA validation
* Creating commits and pull requests
* Providing a dashboard with real-time logs and execution visibility

The system should operate as an external wrapper around an existing Next.js project.

The target project is not cloned. The system works directly on the local repository selected through the CLI.

---

# User Workflow

Developer enters:

```bash
cd my-nextjs-project

codenxt start
```

CodeNXT automatically detects:

```ts
process.cwd()
```

and connects to the current repository.

Dashboard launches:

```text
http://localhost:3000
```

User enters:

```text
Add forgot password flow to login page
```

System automatically:

1. Creates feature branch
2. Plans implementation
3. Analyzes repository
4. Finds impacted files
5. Modifies code
6. Installs dependencies
7. Runs build
8. Reviews implementation
9. Executes QA validation
10. Creates commit
11. Creates PR

---

# High-Level Architecture

```text
Developer
    │
    ▼
CLI
    │
    ▼
Dashboard
    │
    ▼
LangGraph Orchestrator
    │
 ┌──┼──────────────┬────────────┬───────────┐
 ▼  ▼              ▼            ▼           ▼
Planner       Analyzer      Coder      Reviewer      QA
 Agent         Agent        Agent       Agent       Agent
    │
    ▼
Tool Layer
    │
 ┌──┼──────────────┬──────────────┬─────────────┐
 ▼  ▼              ▼              ▼             ▼
Repo Map     Symbol Index    Dependency     File System
                             Graph
```

---

# Repository Intelligence Architecture

The coding agent must not rely solely on ripgrep.

Implement a code intelligence layer.

```text
Next.js Repository
        │
        ▼
Repository Scanner
        │
        ▼
Tree-sitter + ts-morph
        │
 ┌──────┼──────────┬───────────┐
 ▼      ▼          ▼           ▼
Repo   Symbol   Dependency   Import
Map    Index      Graph       Graph
        │
        ▼
PostgreSQL
        │
        ▼
Redis Cache
        │
        ▼
Tool Layer
```

---

# Repository Map

Generate:

```json
{
  "routes": [],
  "components": [],
  "services": [],
  "hooks": [],
  "contexts": [],
  "stores": [],
  "utils": []
}
```

Purpose:

Provide high-level project understanding.

Used primarily by Planner Agent.

---

# Symbol Index

Extract:

* Components
* Functions
* Classes
* Hooks
* Contexts
* Types
* Interfaces

Example:

```json
{
  "name": "LoginForm",
  "type": "component",
  "path": "components/LoginForm.tsx",
  "line": 25
}
```

Used by:

* Analyzer Agent
* Coder Agent

---

# Dependency Graph

Generate relationships:

```text
LoginPage
    │
    ▼
LoginForm
    │
    ▼
AuthService
    │
    ▼
ApiClient
```

Used to identify impact radius of changes.

---

# Database Architecture

## PostgreSQL

Store:

### projects

```text
id
name
path
default_branch
created_at
```

### runs

```text
id
project_id
task
status
branch_name
created_at
```

### events

```text
id
run_id
agent
message
created_at
```

### symbols

```text
id
project_id
name
type
path
line
```

### dependencies

```text
source_symbol
target_symbol
```

### memories

```text
project_id
task
solution
files_changed
```

---

# Redis

Used for:

* Workflow state
* Active runs
* Agent logs
* Context cache
* Queue processing
* LangGraph checkpoints

---

# Tool Layer

All agents interact through tools.

Required tools:

```text
find_symbol()
find_references()
get_dependencies()
search_code()
read_file()
write_file()
create_file()
delete_file()
run_command()
install_dependency()
git_diff()
git_status()
```

---

# Planner Agent

Responsibilities:

* Understand requirement
* Generate implementation plan
* Generate acceptance criteria
* Identify dependencies
* Estimate impact

Input:

```text
Task
Repository Map
```

Output:

```json
{
  "summary": "",
  "steps": [],
  "dependencies": [],
  "acceptanceCriteria": []
}
```

Planner never modifies code.

---

# Analyzer Agent

Responsibilities:

* Locate impacted symbols
* Locate impacted files
* Identify dependencies
* Build implementation context

Uses:

```text
find_symbol()
find_references()
get_dependencies()
search_code()
```

Output:

```json
{
  "symbols": [],
  "files": [],
  "dependencies": []
}
```

---

# Coder Agent

Most important agent.

Responsibilities:

* Create files
* Update files
* Delete files
* Install packages
* Generate implementation

Capabilities:

```text
read_file()
write_file()
create_file()
install_dependency()
run_command()
```

Coder receives:

```text
Task
Plan
Target Symbols
Target Files
Dependencies
```

Never receives the entire repository.

After coding:

```bash
npm run build
```

If build fails:

```text
Error
   ↓
Coder
   ↓
Fix
   ↓
Build
```

Retry until success or max retry count.

---

# Reviewer Agent

Runs after Coder.

Responsibilities:

* Code Quality Review
* Security Review
* Accessibility Review
* Performance Review
* Type Safety Review

Inputs:

```text
git diff
changed files
```

Checks:

```text
eslint
typescript
best practices
```

Output:

```json
{
  "approved": true,
  "issues": []
}
```

If issues found:

```text
Reviewer
   ↓
Coder
```

Loop until resolved.

---

# QA Agent

Responsibilities:

* Validate acceptance criteria
* Generate test scenarios
* Generate unit tests
* Generate integration tests
* Run tests

Commands:

```bash
npm test
```

Validate:

```text
Acceptance Criteria
Changed Files
```

Output:

```json
{
  "passed": true,
  "failedScenarios": []
}
```

If failed:

```text
QA
 ↓
Coder
```

Loop until success.

---

# Git Agent

Before execution:

```bash
git checkout develop
git pull
git checkout -b feature/task-name
```

After completion:

```bash
git add .
git commit
git push
```

Create pull request.

---

# LangGraph Workflow

```text
START
  │
  ▼
Planner
  │
  ▼
Analyzer
  │
  ▼
Coder
  │
  ▼
Build Validation
  │
  ▼
Reviewer
  │
  ├── Fail
  │      │
  │      ▼
  │    Coder
  │
  ▼
QA
  │
  ├── Fail
  │      │
  │      ▼
  │    Coder
  │
  ▼
Commit
  │
  ▼
PR
  │
  ▼
END
```

---

# Dashboard Requirements

Pages:

## Home

Task input

```text
Describe your task...
```

Run button.

---

## Runs

Show:

```text
Run ID
Task
Status
Branch
```

---

## Execution

Show:

```text
Planner
Analyzer
Coder
Reviewer
QA
```

Real-time status.

---

## Logs

Display:

```text
[Planner]
Generated plan

[Analyzer]
Found LoginForm

[Coder]
Installing dependency

[Reviewer]
Review completed

[QA]
Tests passed
```

---

## Diff Viewer

Display:

```diff
+ new file
~ modified file
- removed file
```

---

# Tech Stack

Frontend:

* Next.js
* Tailwind
* ShadCN

Backend:

* Next.js API Routes

Agents:

* LangGraph
* OpenRouter

Model:

* GLM-4.5-Air initially
* Future support for Claude Sonnet

Code Intelligence:

* Tree-sitter
* ts-morph
* ripgrep fallback

Database:

* PostgreSQL

Cache:

* Redis

Git:

* simple-git

Queue:

* BullMQ

Streaming:

* Server Sent Events

Containerization:

* Docker

---

# Success Criteria

Given a task:

```text
Add forgot password flow
```

The system should:

1. Create branch
2. Generate implementation plan
3. Locate impacted files
4. Modify code
5. Install dependencies
6. Pass build
7. Pass review
8. Pass QA
9. Commit changes
10. Create PR

with minimal human intervention.
