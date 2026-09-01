---
layout: default
title: Claude Code Interview Guide
permalink: /claude-code/
---

# Claude Code Interview Guide

This file is an interview-ready guide for Claude Code, Claude CLI, Claude models, Claude workflows, and related learning roadmaps.

Important note: Claude Code evolves quickly. Commands, plans, plugins, and model defaults can vary by version, platform, account type, and enabled features. Treat this as a current study guide, not a timeless spec.

## 1. What is Claude Code?

Claude Code is Anthropic’s agentic coding tool that runs in your terminal. It can inspect a codebase, plan tasks, edit files, run commands, use tools, connect to external systems through MCP, and manage multi-step software work.

Interview answer:
- Claude Code is a terminal-first coding agent, not just a chatbot.
- It is designed to operate on real projects with tools like file read/write, shell, web, MCP, hooks, subagents, worktrees, and checkpointing.
- Its main value is turning natural-language requests into agentic loops: analyze, plan, act, verify, and iterate.

Official references:
- Claude Code overview: https://code.claude.com/docs/en/overview
- Quickstart: https://code.claude.com/docs/en/quickstart

## 2. Claude Code, CLI, Coding Agent, and Vibe Coding

### What is Claude Code?

Claude Code is the product. It includes the CLI, built-in tools, slash commands, permissions, hooks, memory, and automation capabilities.

### Claude CLI introduction

The CLI is how you launch and control Claude Code from the terminal.

Core commands:
- `claude` starts an interactive session.
- `claude "query"` starts an interactive session with an initial prompt.
- `claude -p "query"` runs in headless/print mode and exits.
- `claude -c` continues the latest conversation in the current directory.
- `claude -r "<session>" "query"` resumes a specific session by ID or name.
- `claude --add-dir ../apps ../lib` grants Claude access to additional directories.

Interview answer:
- The CLI supports both interactive development and automation.
- Interactive mode is for iterative work; `-p` is for scripts, CI, and headless workflows.
- `--continue`, `--resume`, `--worktree`, `--permission-mode`, `--model`, and `--effort` are high-value flags to remember.

Official reference:
- CLI reference: https://code.claude.com/docs/en/cli-reference

### What is a coding agent?

A coding agent is an AI system that can do more than answer questions. It can:
- inspect files
- reason over project structure
- call tools
- edit code
- run commands and tests
- maintain state across steps
- recover from errors

Claude Code is a coding agent because it can complete multi-step software tasks with tool use and feedback loops.

### What is Vibe Coding?

Vibe coding usually means steering development by describing intent in natural language and letting the AI generate, refactor, or explore quickly. The risk is shallow correctness. The best version of vibe coding still includes verification, tests, checkpoints, and tight prompting.

Interview answer:
- Vibe coding is high-speed, intent-driven development with AI.
- It is useful for prototyping, scaffolding, and exploration.
- It becomes dangerous when developers stop validating behavior, security, or maintainability.

Roadmap:
- Vibe Coding roadmap: https://roadmap.sh/vibe-coding

### What is an agentic loop?

An agentic loop is the repeated cycle of:
1. understand the task
2. gather context
3. choose tools
4. act
5. observe results
6. revise plan
7. continue until done

Claude Code is built around this pattern.

## 3. Ways to use Claude

Claude can be used in several ways:
- Claude web and app experiences for chat and coding
- Claude Code in the terminal
- Claude Desktop and mobile experiences
- Anthropic API for product integration
- IDE integrations for VS Code and JetBrains
- Remote and web sessions from Claude Code

Interview answer:
- Use Claude Code when you want local repo access and tool execution.
- Use the API when you are building your own product or automation.
- Use the web/app products for general-purpose usage, collaboration, or remote session handoff.

Official references:
- IDE integrations: https://code.claude.com/docs/en/ide-integrations
- Models overview: https://docs.anthropic.com/en/docs/models-overview

## 4. Subscription vs API usage

This is a common interview topic.

### Subscription usage

With a Claude.ai subscription, Claude Code is used as part of your Claude account experience. Some commands and features are plan-specific. The docs explicitly note that not all commands are visible to every user and some depend on platform, plan, or environment.

Examples:
- `/desktop` appears only on macOS and Windows.
- `/upgrade` and `/privacy-settings` are only available on Pro and Max plans.
- `/cost` is not mainly intended for Max and Pro subscribers.

### API usage

With Anthropic Console authentication, Claude Code usage is billed through API consumption. When you first authenticate with an Anthropic Console account, a workspace named `Claude Code` is created for centralized cost tracking.

Interview answer:
- Subscription is product-centric.
- API usage is token-billed, workspace-managed, and better for org-level cost control and automation.
- Teams using API, Bedrock, or Vertex care more about rate limits, spend controls, and usage reporting.

Official references:
- Claude Code quickstart: https://code.claude.com/docs/en/quickstart
- Cost management: https://code.claude.com/docs/en/costs
- Usage and Cost API: https://docs.anthropic.com/en/api/usage-cost-api

## 5. Understand the basics

The basics you should be able to explain:
- Claude Code is terminal-native and tool-using.
- It is permission-based by default.
- It supports memory via `CLAUDE.md`.
- It supports context compaction.
- It can be extended through skills, hooks, MCP, plugins, and subagents.
- It supports checkpointing, worktrees, headless mode, and automation.

## 6. CLAUDE.md, memory, and skills

### What is `CLAUDE.md`?

`CLAUDE.md` is Claude Code’s memory/instruction file. It stores reusable context such as project architecture, commands, conventions, guardrails, and preferences.

Memory hierarchy:
- enterprise memory
- project memory: `./CLAUDE.md`
- user memory: `~/.claude/CLAUDE.md`
- local project memory: `./CLAUDE.local.md` is deprecated in favor of imports

Claude can also import extra files using `@path/to/file`.

Interview answer:
- `CLAUDE.md` reduces repeated prompting.
- It is the right place for project commands, coding conventions, architecture notes, and compact-summary guidance.
- It improves consistency across sessions and teams.

Official reference:
- Memory: https://code.claude.com/docs/en/memory

### How to structure `CLAUDE.md`

Good sections:
- project overview
- build, test, lint commands
- coding standards
- architecture rules
- repo-specific pitfalls
- security constraints
- compact-summary instructions
- links to imported docs

### Skills

Skills are reusable prompt-based extensions defined with a `SKILL.md` file. They can be personal, project-level, or plugin-scoped.

Skills can:
- add instructions
- expose slash-style workflows
- restrict tools
- run in subagent contexts
- accept arguments
- attach lifecycle hooks

Interview answer:
- A skill is a reusable workflow or instruction bundle.
- It is prompt-driven, not a new native tool.
- Use skills for repeated tasks like review, deployment, API conventions, or explanation modes.

Official reference:
- Skills: https://code.claude.com/docs/en/slash-commands

## 7. Tools

Claude Code has built-in tools such as:
- `Read`, `Write`, `Edit`
- `Bash`
- `Glob`, `Grep`
- `WebFetch`, `WebSearch`
- `Agent`
- `LSP`
- task-management tools
- MCP resource tools

Interview answer:
- Tools are what convert Claude from an LLM into an agent.
- The most important distinction is between reasoning and acting. The model reasons; the tools act.

Official reference:
- Tools reference: https://code.claude.com/docs/en/tools-reference

## 8. Context modes, permission modes, and context management

### Permission modes

Common modes:
- `default`
- `acceptEdits`
- `plan`
- `auto`
- `dontAsk`
- `bypassPermissions`

`Shift+Tab` cycles through permission modes in interactive sessions.

### Plan Mode

Plan Mode is for read-only analysis and planning before execution.

Use it when:
- exploring a codebase
- designing a multi-file change
- doing safe architecture review
- preparing a migration plan

Examples:
- `claude --permission-mode plan`
- `claude --permission-mode plan -p "Analyze auth and suggest improvements"`
- `/plan fix the auth bug`

### Context management

High-signal commands:
- `/context` to inspect context usage
- `/compact` to compress conversation state
- `/clear` to reset history
- `/rewind` to restore or summarize from a prior checkpoint

Interview answer:
- Context is a scarce resource. Good Claude users manage it actively.
- `CLAUDE.md`, `/compact`, `/clear`, and subagents are all context-management tools.

Official references:
- Built-in commands: https://code.claude.com/docs/en/commands
- Checkpointing: https://code.claude.com/docs/en/checkpointing
- Common workflows: https://code.claude.com/docs/en/common-workflows

## 9. Models, thinking modes, and effort

### Models

Current Claude Code model aliases:
- `sonnet`
- `opus`
- `haiku`
- `sonnet[1m]`
- `opusplan`

Key idea:
- Sonnet is the daily default for balanced coding work.
- Opus is for the hardest reasoning and planning tasks.
- Haiku is for simple, fast, cheaper tasks.
- `opusplan` uses Opus during planning and Sonnet during execution.

### Understand the differences: Opus, Sonnet, Haiku

Official model positioning:
- Opus: most capable and intelligent
- Sonnet: high-performance balance of reasoning and efficiency
- Haiku: fastest and most cost-efficient

Interview answer:
- Use Opus for architecture, complex debugging, difficult refactors, or ambiguous tasks.
- Use Sonnet for normal coding, editing, implementation, and day-to-day developer workflows.
- Use Haiku for lightweight tasks, classification, simple transforms, or cheap background operations.

### Thinking modes and effort

Claude Code supports effort levels:
- `low`
- `medium`
- `high`
- `max` where supported
- `auto`

Commands:
- `/effort [low|medium|high|max|auto]`
- `claude --effort high`

Prompting also matters:
- saying "think" triggers more reasoning
- "think harder" or stronger variants trigger deeper reasoning

Interview answer:
- Model choice controls capability class.
- Effort controls how much reasoning budget the model uses.
- The right setup is usually Sonnet plus higher effort before jumping straight to Opus.

Official references:
- Model configuration: https://code.claude.com/docs/en/model-config
- Models overview: https://docs.anthropic.com/en/docs/models-overview
- Common workflows: https://code.claude.com/docs/en/common-workflows

## 10. Using Claude Code

### Common use cases

Common use cases include:
- explain a codebase
- implement a feature from natural language
- fix a bug from an error trace
- refactor a subsystem
- write tests
- review a pull request
- investigate failing builds
- automate repetitive developer workflows

### Headless mode

Headless mode means non-interactive execution, usually with `-p`.

Examples:
- `claude -p "Explain this function"`
- `cat logs.txt | claude -p "Summarize failures"`
- `claude -c -p "Check for type errors"`

Use headless mode for:
- scripts
- CI
- one-shot analyses
- automation pipelines

### Git worktrees

Git worktrees let you run separate Claude sessions in isolated directories with shared repo history.

Why it matters:
- parallel features
- isolated experiments
- cleaner multi-branch agent workflows

Examples:
- `git worktree add ../project-feature-a -b feature-a`
- `claude -w feature-auth`

Interview answer:
- Worktrees are safer than juggling branches in one working tree when multiple agents or tasks run in parallel.

Official reference:
- Common workflows: https://code.claude.com/docs/en/common-workflows

## 11. Commands, slash commands, and shortcuts

### CLI cheat sheet

- `claude`
- `claude "query"`
- `claude -p`
- `claude -c`
- `claude -r`
- `claude --add-dir`

### Session and help commands

- `/help`
- `/clear`
- `/exit`
- `/status`
- `/usage`
- `/cost`
- `/export`
- `/resume`
- `/rewind`

### Context and memory

- `/context`
- `/compact`
- `/init`
- `/memory`

### Configuration

- `/config`
- `/permissions`
- `/model`
- `/doctor`
- `/hooks`
- `/mcp`
- `/plugin`
- `/agents`
- `/plan`
- `/statusline`

### Desktop and integrations

- `/desktop`
- `/ide`

### Shortcuts and prefixes

- `!` starts bash mode
- `@` imports files or folders into prompt context
- `\` + `Enter` is a multiline input shortcut in all terminals
- `/` starts slash commands
- `#` is the memory shortcut
- `Esc + Esc` edits the previous message
- `Shift+Tab` cycles permission modes
- `Ctrl+C` cancels current input or generation
- `Ctrl+R` reverse-searches command history where supported
- `Esc` is part of vim/normal mode behavior when enabled

Interview answer:
- The CLI handles startup behavior; slash commands handle in-session behavior.
- The most interview-worthy commands are `/compact`, `/context`, `/permissions`, `/model`, `/resume`, `/rewind`, `/mcp`, `/hooks`, and `/agents`.

Official references:
- Built-in commands: https://code.claude.com/docs/en/commands
- Interactive mode: https://code.claude.com/docs/en/interactive-mode

## 12. Hooks

Hooks let Claude Code run custom logic around lifecycle events.

Hook types:
- command hooks that run shell commands
- MCP hooks where supported through connected tooling

Hook inputs usually include:
- session ID
- transcript path
- working directory
- permission mode
- event name
- tool name and tool input for tool-related hooks

Hook outputs can:
- allow the flow to continue
- block an action with a reason
- add context back to Claude
- modify MCP tool output in supported cases

Important hook events:
- `SessionStart`
- `SessionEnd`
- `UserPromptSubmit`
- `PreToolUse`
- `PostToolUse`
- `PostToolUseFailure`
- `Stop`
- `SubagentStop`

Common interview talking points:
- `SessionStart` is useful for loading repo context or env setup.
- `PreToolUse` can allow, deny, ask, defer, or modify tool input.
- `PostToolUse` can give Claude feedback after execution.
- `UserPromptSubmit` can validate or enrich prompts.
- `Stop` can prevent Claude from stopping if work is incomplete.

Matchers:
- tool hooks match tool names such as `Bash`, `Write`, `Edit`, or MCP tool names
- non-tool events like `UserPromptSubmit` and `Stop` do not use matchers

Interview answer:
- Hooks are the automation and governance layer around Claude’s behavior.
- They are powerful for security, linting, logging, prompt validation, and policy enforcement.

Official reference:
- Hooks reference: https://code.claude.com/docs/en/hooks

## 13. Subagents, agent teams, and plugins

### Subagents

Subagents are specialized AI assistants with their own prompt, tool access, and context window.

Benefits:
- preserve main context
- create specialized roles
- improve delegation
- reduce prompt clutter

Locations:
- project: `.claude/agents/`
- user: `~/.claude/agents/`

### Agent teams

Claude Code can support coordinated multi-agent workflows. This is useful for parallel tasking, decomposition, and larger orchestrated changes.

### Plugins

Plugins package capabilities such as:
- skills
- hooks
- MCP connections
- other reusable Claude extensions

Interview answer:
- Skills are reusable prompt workflows.
- Subagents are specialized delegate agents with separate context.
- Hooks are lifecycle automation.
- MCP connects external tools and data.
- Plugins package and distribute these capabilities cleanly.

Official references:
- Subagents: https://code.claude.com/docs/en/sub-agents
- Plugins reference: https://code.claude.com/docs/en/plugins-reference

## 14. Code intelligence, desktop app, and community tools

### Code intelligence

Claude Code becomes significantly better when it can use project-aware signals such as:
- file structure
- symbols and diagnostics from LSP
- git diff and history
- test output
- build and lint results

Interview answer:
- Code intelligence is not one magic feature; it is the combination of repo context, IDE signals, diagnostics, tools, and iterative reasoning.

### Desktop app

Claude Code supports handing a session to the Claude Code Desktop app with `/desktop` on supported platforms. This is useful when you want a richer UI without losing session state.

### Community tools

The ecosystem around Claude Code also includes:
- official plugins
- community plugins
- MCP servers built by third parties
- shared skills and team conventions

Best-practice answer:
- community tooling increases leverage, but it should be treated with the same caution as running third-party code or scripts.

## 15. MCP, extensions, and external tools

### Connecting tools with MCP

MCP stands for Model Context Protocol. It is the standard way to connect Claude Code to external tools, APIs, databases, and services.

What MCP enables:
- GitHub workflows
- issue trackers
- databases
- monitoring tools
- design tools
- custom internal systems

### Be mindful of extensions and MCP plugins

This is both a security and interview topic.

Best-practice answer:
- only trust MCP servers and plugins from sources you trust
- review granted permissions carefully
- prefer project-scoped config for team-shared integrations
- use hooks and permission rules to constrain risky actions
- do not assume third-party plugins are audited by Anthropic

Official references:
- MCP: https://code.claude.com/docs/en/mcp
- Security: https://code.claude.com/docs/en/security
- IDE integrations: https://code.claude.com/docs/en/ide-integrations

## 16. Pricing, usage, prompt caching, and scaling

### Understand Claude pricing

For Claude Code API usage:
- cost depends on tokens consumed
- Sonnet is the normal cost/performance default
- Opus is more expensive but stronger
- Haiku is the cheapest and fastest

Official model pricing examples:
- Opus 4 base input: $15 per million tokens
- Sonnet 4 base input: $3 per million tokens
- Haiku 3.5 base input: $0.80 per million tokens

### Understand Claude Code cost behavior

Anthropic’s Claude Code docs say:
- average cost is about $6 per developer per day
- 90% of users stay below $12 per day
- API team usage averages about $100 to $200 per developer per month with Sonnet 4, but varies widely

### Prompt caching

Prompt caching is an API optimization, not just a Claude Code trick.

Key facts:
- it caches the reusable prefix of `tools`, `system`, then `messages`
- default cache lifetime is 5 minutes
- a 1-hour cache option exists in beta
- it is best for repeated prompts, long context, many examples, and multi-turn workflows

Interview answer:
- Prompt caching reduces latency and input-token cost when large static prefixes repeat.
- Put stable instructions and context first, then mark cache breakpoints with `cache_control`.

### Scaling Claude

Best practices:
- use Sonnet by default, Opus selectively
- manage context aggressively with `/compact` and `/clear`
- use subagents to keep main context clean
- use worktrees for parallel isolation
- set spend limits for API workspaces
- use prompt caching for repeated large prefixes

Official references:
- Claude Code costs: https://code.claude.com/docs/en/costs
- Prompt caching: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
- Usage and Cost API: https://docs.anthropic.com/en/api/usage-cost-api

## 17. Security best practices

You should be ready to say this in an interview:
- Claude Code is permission-based by default.
- Sandboxing reduces blast radius for bash execution.
- Hooks can enforce policy.
- MCP servers and plugins should be treated as trusted-code decisions.
- Review generated commands and code before approval.
- Use worktrees, containers, or devcontainers for higher isolation.

Official references:
- Security: https://code.claude.com/docs/en/security
- Sandboxing: https://code.claude.com/docs/en/sandboxing

## 18. Output styles, status line, editor extensions, and setup

### Output styles

Claude Code supports built-in output styles:
- Default
- Explanatory
- Learning

Use them when you want more teaching, more collaboration, or more direct execution.

### Customize status line

The status line can display model, directory, branch, cost, and other context.

### Editor extensions

Claude Code integrates with:
- VS Code and forks like Cursor, Windsurf, VSCodium
- JetBrains IDEs

Capabilities include:
- quick launch
- diff viewing
- selection context sharing
- file reference shortcuts
- diagnostics sharing

### Setting up Claude

Basic install:
```bash
npm install -g @anthropic-ai/claude-code
claude
```

Interview answer:
- Claude Code works in any terminal, but IDE integrations improve workflow by sharing selection context, diagnostics, and inline diff viewing.

Official references:
- Output styles: https://code.claude.com/docs/en/output-styles
- Status line: https://code.claude.com/docs/en/statusline
- IDE integrations: https://code.claude.com/docs/en/ide-integrations

## 19. Common best practices

- Use `/compact` before context gets bloated.
- Use `/clear` between unrelated tasks.
- Put repo commands and conventions into `CLAUDE.md`.
- Use Plan Mode before high-risk or multi-file work.
- Use subagents for specialization and context isolation.
- Use hooks for policy, validation, and automation.
- Use worktrees for parallel isolated efforts.
- Prefer Sonnet for daily work and Opus for hard reasoning.
- Be explicit in prompts: goal, constraints, files, success criteria.

## 20. When to use what model?

Use Haiku when:
- latency matters most
- the task is simple
- you need cheap background processing

Use Sonnet when:
- you are doing normal coding work
- you need solid reasoning and implementation
- you want the best default balance

Use Opus when:
- the task is ambiguous or complex
- architectural reasoning matters
- debugging is deep and multi-step
- you are designing plans before execution

Use `opusplan` when:
- you want premium planning quality but efficient execution afterward

## 21. Ready-for-interview one-liners

### What is Claude Code?

Claude Code is Anthropic’s terminal-native coding agent that can inspect codebases, use tools, edit files, run commands, and automate software workflows.

### What is the difference between Claude Code and the Anthropic API?

Claude Code is a developer product and agentic workflow environment; the API is the programmable interface used to build your own applications and automations.

### What is `CLAUDE.md`?

It is Claude Code’s memory file for reusable project and user instructions.

### What is Plan Mode?

A read-focused planning mode that lets Claude analyze and propose a plan before making changes.

### What are hooks?

Hooks are lifecycle-triggered automations that can validate, block, modify, or enrich Claude’s behavior around prompts, tools, and stopping conditions.

### What is MCP?

MCP is the Model Context Protocol, an open standard for connecting Claude to external tools and data sources.

### What is agentic loop?

It is the repeated cycle of reasoning, tool use, observation, correction, and continuation until the task is complete.

### What is the difference between skills and subagents?

Skills are reusable prompt-based workflows; subagents are delegated specialist agents with their own context windows and tool permissions.

### What is prompt caching?

An API feature that reuses repeated prompt prefixes to cut cost and latency.

### Why use Git worktrees with Claude?

They allow isolated parallel branches and cleaner multi-agent or multi-task workflows.

## 22. Related roadmaps and detailed roadmap links

### Main roadmap hub

- roadmap.sh home: https://roadmap.sh/
- all roadmaps: https://roadmap.sh/roadmaps

### Direct roadmap links

- Claude Code: https://roadmap.sh/claude-code
- Vibe Coding: https://roadmap.sh/vibe-coding
- Prompt Engineering: https://roadmap.sh/prompt-engineering
- AI Engineer: https://roadmap.sh/ai-engineer
- AI Agents: https://roadmap.sh/ai-agents
- Git and GitHub: https://roadmap.sh/git-github
- Shell / Bash: https://roadmap.sh/shell-bash

### Detailed roadmap PDF links

- Prompt Engineering detailed roadmap: https://roadmap.sh/pdfs/roadmaps/prompt-engineering.pdf
- AI Engineer detailed roadmap: https://roadmap.sh/pdfs/roadmaps/ai-engineer.pdf
- Git and GitHub detailed roadmap: https://roadmap.sh/pdfs/roadmaps/git-github.pdf
- Shell / Bash detailed roadmap: https://roadmap.sh/pdfs/roadmaps/shell-bash.pdf

Note: roadmap.sh search results clearly expose PDF versions for Prompt Engineering, AI Engineer, Git and GitHub, and Shell/Bash. The site also lists Claude Code and Vibe Coding as newer roadmap entries, but their PDF links were not surfaced in the retrieved results, so use the interactive roadmap pages for those.

### Similar roadmaps worth studying

If you are preparing for Claude Code or AI engineer interviews, these are the most relevant adjacent roadmaps:
- Prompt Engineering
- AI Engineer
- AI Agents
- Git and GitHub
- Shell / Bash
- MLOps: https://roadmap.sh/mlops
- AI Red Teaming: https://roadmap.sh/ai-red-teaming
- Data Engineer: https://roadmap.sh/data-engineer
- Linux: https://roadmap.sh/linux

### Good learning order

Recommended order:
1. Prompt Engineering
2. AI Engineer
3. AI Agents
4. Git and GitHub
5. Shell / Bash
6. Claude Code
7. Vibe Coding

## 23. Final interview positioning

If asked for a high-level summary, say this:

Claude Code is a terminal-native coding agent built by Anthropic. It combines LLM reasoning with tools, permissions, memory, hooks, subagents, MCP integrations, and workflow controls like Plan Mode, worktrees, headless execution, and checkpointing. In practice, the most important skills are choosing the right model, managing context, structuring `CLAUDE.md`, using hooks and subagents carefully, and balancing speed with verification and security.

## Sources

- Claude Code overview: https://code.claude.com/docs/en/overview
- Quickstart: https://code.claude.com/docs/en/quickstart
- CLI reference: https://code.claude.com/docs/en/cli-reference
- Built-in commands: https://code.claude.com/docs/en/commands
- Interactive mode: https://code.claude.com/docs/en/interactive-mode
- Tools reference: https://code.claude.com/docs/en/tools-reference
- Checkpointing: https://code.claude.com/docs/en/checkpointing
- Memory: https://code.claude.com/docs/en/memory
- Common workflows: https://code.claude.com/docs/en/common-workflows
- Hooks: https://code.claude.com/docs/en/hooks
- Subagents: https://code.claude.com/docs/en/sub-agents
- MCP: https://code.claude.com/docs/en/mcp
- Plugins: https://code.claude.com/docs/en/plugins-reference
- Security: https://code.claude.com/docs/en/security
- Sandboxing: https://code.claude.com/docs/en/sandboxing
- IDE integrations: https://code.claude.com/docs/en/ide-integrations
- Output styles: https://code.claude.com/docs/en/output-styles
- Status line: https://code.claude.com/docs/en/statusline
- Model configuration: https://code.claude.com/docs/en/model-config
- Models overview: https://docs.anthropic.com/en/docs/models-overview
- Prompt caching: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
- Usage and Cost API: https://docs.anthropic.com/en/api/usage-cost-api
- roadmap.sh roadmaps: https://roadmap.sh/roadmaps
