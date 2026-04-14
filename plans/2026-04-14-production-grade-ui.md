# Production-Grade UI Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `build-site.js` so that all CSS and client JS live in editable source files under `assets/`, adopt a Vercel/Nextra-style visual language, and add Cmd-K palette + standard modern-docs interactions — preserving every existing feature.

**Architecture:** Extract `globalStyles` and the inline `clientScript` from `build-site.js` into `assets/site.css` and `assets/site.js`. A new `loadAssets()` helper reads them at build time, content-hashes them, writes them to `docs/assets/`, and returns hashed hrefs injected into the page template via `<link>` and `<script defer>`. A tiny inline `<head>` script handles theme FOUC prevention. Vanilla JS only — no new runtime dependencies.

**Tech Stack:** Node.js (no framework), vanilla HTML/CSS/JS, Google Fonts (Geist + Geist Mono), PrismJS (unchanged), Excalidraw viewer (unchanged).

**Spec:** [specs/2026-04-14-production-grade-ui-design.md](../specs/2026-04-14-production-grade-ui-design.md)

**Conventions across all tasks:**
- After each task, verify with: `node build-site.js && open docs/index.html` (macOS) or `xdg-open` / `start` as appropriate.
- Commit after every task. Commit messages use `feat:` / `refactor:` / `style:` prefixes.
- `docs/` is gitignored — never commit generated output.
- Source files live in `assets/` (tracked).

---

## File Structure

**New files (tracked in git):**
- `assets/site.css` — all stylesheets
- `assets/site.js` — all client JS (initialized on `DOMContentLoaded`)

**Modified files:**
- `build-site.js` — remove `globalStyles` constant, remove `clientScript` constant, add `loadAssets()` helper, update `generateNav()` + `generatePageTemplate()`

**Generated (gitignored via existing `docs/` rule):**
- `docs/assets/site.<hash>.css`
- `docs/assets/site.<hash>.js`

---

## Task 1: Scaffold `assets/site.css` with tokens, base styles, and typography

**Files:**
- Create: `assets/site.css`

- [ ] **Step 1: Create the assets directory and file**

Run: `mkdir -p assets && touch assets/site.css`

- [ ] **Step 2: Write the token + base + typography block**

Write this exact content to `assets/site.css`:

```css
/* ==========================================================================
   System Design Ultimatum — site.css
   Vercel/Nextra-style documentation theme.
   Edit this file; build-site.js copies it to docs/assets/site.<hash>.css.
   ========================================================================== */

@import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap');

/* ── Design tokens ─────────────────────────────────────────────────────── */
:root {
  --bg: #ffffff;
  --bg-subtle: #fafafa;
  --bg-muted: #f4f4f5;
  --text: #0a0a0a;
  --text-secondary: #52525b;
  --text-muted: #a1a1aa;
  --border: #e4e4e7;
  --border-strong: #d4d4d8;
  --accent: #0070f3;
  --accent-bg: rgba(0, 112, 243, 0.08);
  --accent-border: rgba(0, 112, 243, 0.22);
  --info: #0070f3;
  --warn: #f59e0b;
  --success: #10b981;
  --danger: #ef4444;

  --code-bg: #0a0a0a;
  --code-text: #e4e4e7;

  --topbar-h: 56px;
  --sidebar-w: 280px;
  --toc-w: 240px;
  --content-max: 720px;

  --radius-sm: 4px;
  --radius: 6px;
  --radius-lg: 10px;

  --shadow-lg: 0 16px 48px rgba(0, 0, 0, 0.12), 0 4px 12px rgba(0, 0, 0, 0.06);

  --font-sans: 'Geist', Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'Geist Mono', 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
}

html[data-theme="dark"] {
  --bg: #0a0a0a;
  --bg-subtle: #111111;
  --bg-muted: #18181b;
  --text: #fafafa;
  --text-secondary: #a1a1aa;
  --text-muted: #71717a;
  --border: #27272a;
  --border-strong: #3f3f46;
  --accent: #3b82f6;
  --accent-bg: rgba(59, 130, 246, 0.14);
  --accent-border: rgba(59, 130, 246, 0.35);
  --code-bg: #000000;
  --code-text: #e4e4e7;
  --shadow-lg: 0 16px 48px rgba(0, 0, 0, 0.6), 0 4px 12px rgba(0, 0, 0, 0.4);
}

/* ── Reset + base ──────────────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
html { -webkit-text-size-adjust: 100%; }

body {
  font-family: var(--font-sans);
  font-size: 15px;
  line-height: 1.7;
  color: var(--text);
  background: var(--bg);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  transition: background-color 0.2s ease, color 0.2s ease;
}

::selection { background: var(--accent-bg); color: var(--text); }

a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; text-underline-offset: 3px; }

button { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; }

:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

/* Skip link */
.skip-link {
  position: absolute;
  left: -9999px;
  top: 0;
  background: var(--bg);
  color: var(--text);
  padding: 0.5rem 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  z-index: 1000;
}
.skip-link:focus { left: 1rem; top: 1rem; }

/* ── Article typography ────────────────────────────────────────────────── */
.content-body h1,
.content-body h2,
.content-body h3,
.content-body h4 {
  color: var(--text);
  font-weight: 600;
  letter-spacing: -0.02em;
  scroll-margin-top: calc(var(--topbar-h) + 1rem);
}
.content-body h1 {
  font-size: 2rem;
  margin: 0 0 1rem;
  line-height: 1.2;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border);
}
.content-body h2 {
  font-size: 1.5rem;
  margin: 2.5rem 0 0.75rem;
  line-height: 1.3;
}
.content-body h3 {
  font-size: 1.2rem;
  margin: 2rem 0 0.5rem;
  line-height: 1.4;
}
.content-body h4 {
  font-size: 1rem;
  margin: 1.5rem 0 0.5rem;
}

.content-body p { margin: 0 0 1rem; color: var(--text-secondary); }
.content-body strong { color: var(--text); font-weight: 600; }
.content-body a { border-bottom: 1px solid transparent; transition: border-color 0.15s; }
.content-body a:hover { text-decoration: none; border-bottom-color: var(--accent); }

.content-body ul, .content-body ol { margin: 0 0 1rem 1.5rem; color: var(--text-secondary); }
.content-body li { margin: 0.3rem 0; }

.content-body blockquote {
  border-left: 3px solid var(--accent);
  padding: 0.75rem 1rem;
  margin: 1rem 0;
  background: var(--accent-bg);
  border-radius: 0 var(--radius) var(--radius) 0;
  color: var(--text-secondary);
}
.content-body blockquote p:last-child { margin-bottom: 0; }

.content-body hr { border: 0; border-top: 1px solid var(--border); margin: 2.5rem 0; }

.content-body img {
  max-width: 100%;
  height: auto;
  border-radius: var(--radius);
  margin: 1.25rem 0;
  border: 1px solid var(--border);
}

/* Heading anchor links */
.content-body h2, .content-body h3, .content-body h4 { position: relative; }
.heading-anchor {
  position: absolute;
  left: -1.25rem;
  top: 0;
  bottom: 0;
  display: inline-flex;
  align-items: center;
  padding-right: 0.25rem;
  color: var(--text-muted);
  opacity: 0;
  border: 0;
  text-decoration: none;
  font-weight: 400;
  transition: opacity 0.15s;
}
.content-body h2:hover .heading-anchor,
.content-body h3:hover .heading-anchor,
.content-body h4:hover .heading-anchor { opacity: 1; }
.heading-anchor:hover { color: var(--accent); }
```

- [ ] **Step 3: Commit**

```bash
git add assets/site.css
git commit -m "feat(ui): scaffold site.css with tokens and typography"
```

---

## Task 2: Add layout styles (top bar, sidebar, TOC, content column)

**Files:**
- Modify: `assets/site.css` (append)

- [ ] **Step 1: Append layout block to `assets/site.css`**

Append this exactly to the end of `assets/site.css`:

```css
/* ── App shell layout ──────────────────────────────────────────────────── */
.app {
  display: grid;
  grid-template-columns: var(--sidebar-w) minmax(0, 1fr) var(--toc-w);
  min-height: 100vh;
}
@media (max-width: 1280px) { .app { grid-template-columns: var(--sidebar-w) minmax(0, 1fr); } }
@media (max-width: 900px)  { .app { grid-template-columns: minmax(0, 1fr); } }

/* ── Top bar ──────────────────────────────────────────────────────────── */
.topbar {
  position: sticky;
  top: 0;
  z-index: 50;
  height: var(--topbar-h);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0 1rem;
  background: color-mix(in srgb, var(--bg) 82%, transparent);
  backdrop-filter: saturate(180%) blur(8px);
  -webkit-backdrop-filter: saturate(180%) blur(8px);
  border-bottom: 1px solid var(--border);
  grid-column: 1 / -1;
}
.topbar-brand {
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text);
  font-size: 0.95rem;
}
.topbar-brand:hover { text-decoration: none; color: var(--accent); }
.topbar-spacer { flex: 1; }

.topbar-search {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.6rem 0.4rem 0.75rem;
  min-width: 240px;
  max-width: 360px;
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-muted);
  font-size: 0.85rem;
  transition: border-color 0.15s, color 0.15s;
}
.topbar-search:hover { border-color: var(--border-strong); color: var(--text-secondary); }
.topbar-search .kbd {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  padding: 1px 5px;
  background: var(--bg-muted);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-muted);
}

.topbar-icon-btn {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius);
  color: var(--text-secondary);
  border: 1px solid transparent;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.topbar-icon-btn:hover { background: var(--bg-muted); border-color: var(--border); color: var(--text); }

.topbar-hamburger { display: none; }
@media (max-width: 900px) { .topbar-hamburger { display: inline-flex; } .topbar-search { min-width: 0; flex: 1; } }

/* ── Sidebar ──────────────────────────────────────────────────────────── */
.sidebar {
  position: sticky;
  top: var(--topbar-h);
  height: calc(100vh - var(--topbar-h));
  overflow-y: auto;
  border-right: 1px solid var(--border);
  padding: 1rem 0.5rem 2rem;
  background: var(--bg);
}
.sidebar::-webkit-scrollbar { width: 8px; }
.sidebar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }

.nav-section-label {
  padding: 0.5rem 0.75rem 0.25rem;
  margin-top: 0.5rem;
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.nav-folder { margin: 0; }
.nav-folder > summary {
  list-style: none;
  cursor: pointer;
  padding: 0.35rem 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--text-secondary);
  border-radius: var(--radius);
  user-select: none;
}
.nav-folder > summary::-webkit-details-marker { display: none; }
.nav-folder > summary:hover { background: var(--bg-muted); color: var(--text); }
.nav-folder > summary .folder-chevron {
  display: inline-block;
  font-size: 0.55rem;
  color: var(--text-muted);
  transition: transform 0.15s;
}
.nav-folder[open] > summary .folder-chevron { transform: rotate(90deg); }

.nav-folder-body { padding-left: 0.5rem; margin: 0.1rem 0 0.35rem; }

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.75rem 0.3rem 1.25rem;
  font-size: 0.82rem;
  color: var(--text-secondary);
  border-left: 2px solid transparent;
  border-radius: 0 var(--radius) var(--radius) 0;
  margin-left: 0.25rem;
}
.nav-item:hover { background: var(--bg-muted); color: var(--text); text-decoration: none; }
.nav-item.is-active {
  color: var(--accent);
  background: var(--accent-bg);
  border-left-color: var(--accent);
  font-weight: 600;
}
.nav-item .nav-icon { font-size: 0.7rem; opacity: 0.6; flex-shrink: 0; }
.nav-item.is-hidden, .nav-folder.is-hidden { display: none; }

/* ── Main + content column ────────────────────────────────────────────── */
.main {
  min-width: 0;
  padding: 2rem 2.5rem 4rem;
}
.content-layout {
  display: block;
  max-width: var(--content-max);
  margin: 0 auto;
}
.content-body { min-width: 0; }

.page-header { margin-bottom: 1.5rem; }
.breadcrumb {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  font-size: 0.78rem;
  color: var(--text-muted);
  margin-bottom: 0.75rem;
}
.breadcrumb a { color: var(--text-muted); }
.breadcrumb a:hover { color: var(--accent); text-decoration: none; }
.breadcrumb .bc-sep { opacity: 0.5; }

/* ── TOC right rail ───────────────────────────────────────────────────── */
.toc-sidebar {
  position: sticky;
  top: var(--topbar-h);
  align-self: flex-start;
  height: calc(100vh - var(--topbar-h));
  overflow-y: auto;
  padding: 2rem 1rem 2rem 0;
}
.toc-sidebar nav {
  border-left: 1px solid var(--border);
  padding-left: 1rem;
}
.toc-title {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 0.6rem;
}
.toc-sidebar a {
  display: block;
  font-size: 0.78rem;
  color: var(--text-muted);
  padding: 0.25rem 0;
  line-height: 1.45;
  border-left: 1px solid transparent;
  margin-left: -1rem;
  padding-left: 1rem;
  transition: color 0.15s, border-color 0.15s;
}
.toc-sidebar a:hover { color: var(--text); text-decoration: none; }
.toc-sidebar a.is-active { color: var(--accent); border-left-color: var(--accent); font-weight: 500; }
.toc-sidebar a.toc-h3 { padding-left: 1.75rem; font-size: 0.75rem; }
@media (max-width: 1280px) { .toc-sidebar { display: none; } }

/* ── Progress bar ─────────────────────────────────────────────────────── */
.progress-bar {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: transparent;
  z-index: 100;
  pointer-events: none;
}
.progress-bar .progress-fill {
  height: 100%;
  width: calc(var(--progress, 0) * 100%);
  background: var(--accent);
  transition: width 80ms linear;
}
```

- [ ] **Step 2: Commit**

```bash
git add assets/site.css
git commit -m "feat(ui): add layout styles (top bar, sidebar, TOC)"
```

---

## Task 3: Add component styles (code blocks, tables, callouts, dashboard, command palette)

**Files:**
- Modify: `assets/site.css` (append)

- [ ] **Step 1: Append component block to `assets/site.css`**

Append this to `assets/site.css`:

```css
/* ── Inline + block code ──────────────────────────────────────────────── */
.content-body code {
  font-family: var(--font-mono);
  font-size: 0.86em;
  background: var(--bg-muted);
  color: var(--text);
  padding: 0.12em 0.4em;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
}
.content-body pre {
  position: relative;
  background: var(--code-bg);
  color: var(--code-text);
  padding: 1.1rem 1.25rem;
  border-radius: var(--radius-lg);
  overflow-x: auto;
  margin: 1.25rem 0;
  font-family: var(--font-mono);
  font-size: 0.82rem;
  line-height: 1.65;
  border: 1px solid var(--border);
}
.content-body pre code {
  background: transparent;
  color: inherit;
  padding: 0;
  border: 0;
  font-size: inherit;
}
.code-copy-btn {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  padding: 0.25rem 0.55rem;
  font-size: 0.7rem;
  font-family: var(--font-sans);
  color: var(--text-muted);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: var(--radius-sm);
  opacity: 0;
  transition: opacity 0.15s, color 0.15s, background 0.15s;
}
.content-body pre:hover .code-copy-btn { opacity: 1; }
.code-copy-btn:hover { color: #fff; background: rgba(255, 255, 255, 0.12); }
.code-copy-btn.is-copied { color: var(--success); }

/* ── Tables ───────────────────────────────────────────────────────────── */
.content-body .table-wrap { overflow-x: auto; margin: 1.25rem 0; border: 1px solid var(--border); border-radius: var(--radius); }
.content-body table { border-collapse: collapse; width: 100%; font-size: 0.88rem; }
.content-body th, .content-body td {
  padding: 0.65rem 0.85rem;
  text-align: left;
  border-bottom: 1px solid var(--border);
}
.content-body th {
  background: var(--bg-subtle);
  font-weight: 600;
  color: var(--text);
  font-size: 0.82rem;
}
.content-body tr:last-child td { border-bottom: 0; }
.content-body tr:hover td { background: var(--bg-subtle); }

/* ── Details/summary ──────────────────────────────────────────────────── */
.content-body details {
  margin: 1rem 0;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-subtle);
}
.content-body details > summary {
  cursor: pointer;
  padding: 0.7rem 1rem;
  font-weight: 600;
  color: var(--text);
  font-size: 0.9rem;
  user-select: none;
}
.content-body details[open] > summary { border-bottom: 1px solid var(--border); }
.content-body details > *:not(summary) { padding: 0.75rem 1rem; }

/* ── Prev/Next ────────────────────────────────────────────────────────── */
.page-nav {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin: 3rem 0 0;
  padding-top: 2rem;
  border-top: 1px solid var(--border);
}
.page-nav a {
  display: block;
  padding: 1rem 1.1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  transition: border-color 0.15s, background 0.15s;
}
.page-nav a:hover { border-color: var(--accent); background: var(--accent-bg); text-decoration: none; }
.page-nav .nav-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}
.page-nav .nav-title { font-size: 0.9rem; font-weight: 600; margin-top: 0.2rem; }
.page-nav .nav-next { text-align: right; }
@media (max-width: 640px) { .page-nav { grid-template-columns: 1fr; } }

/* ── Back to top ──────────────────────────────────────────────────────── */
.back-to-top {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-lg);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s, border-color 0.15s, color 0.15s;
  z-index: 40;
}
.back-to-top.is-visible { opacity: 1; pointer-events: auto; }
.back-to-top:hover { color: var(--accent); border-color: var(--accent); }

/* ── Dashboard / homepage ─────────────────────────────────────────────── */
.dashboard { max-width: 1100px; margin: 0 auto; padding: 3rem 2rem 4rem; }
.dash-hero { text-align: center; padding: 2rem 1rem 2.5rem; }
.dash-hero h1 {
  font-size: 2.5rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--text);
  margin: 0 0 0.75rem;
}
.dash-hero p { color: var(--text-secondary); font-size: 1.05rem; max-width: 620px; margin: 0 auto; }
.dash-stats { display: flex; justify-content: center; gap: 1rem; margin: 2rem 0; flex-wrap: wrap; }
.dash-stat {
  padding: 0.75rem 1.25rem;
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  min-width: 120px;
  text-align: center;
}
.dash-stat .stat-num { font-size: 1.4rem; font-weight: 700; color: var(--text); }
.dash-stat .stat-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

.dash-section-title {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin: 2.5rem 0 1rem;
}
.category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 0.75rem;
}
.category-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 1.1rem 1.15rem;
  background: var(--bg);
  transition: border-color 0.15s;
}
.category-card:hover { border-color: var(--border-strong); }
.category-card .cc-header { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.4rem; }
.category-card .cc-icon {
  width: 32px; height: 32px;
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.95rem; color: #fff;
  flex-shrink: 0;
}
.category-card .cc-name { font-size: 0.9rem; font-weight: 600; color: var(--text); }
.category-card .cc-desc { font-size: 0.78rem; color: var(--text-muted); line-height: 1.5; margin-bottom: 0.6rem; }
.category-card .cc-links { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.category-card .cc-links a {
  font-size: 0.72rem;
  padding: 0.15rem 0.5rem;
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
}
.category-card .cc-links a:hover { background: var(--accent-bg); border-color: var(--accent-border); color: var(--accent); text-decoration: none; }

/* ── Footer ──────────────────────────────────────────────────────────── */
footer {
  padding: 2rem;
  border-top: 1px solid var(--border);
  text-align: center;
  color: var(--text-muted);
  font-size: 0.8rem;
  margin-top: 3rem;
}

/* ── Diagram container (unchanged visual intent, re-themed) ──────────── */
.diagram-container {
  background: var(--bg-subtle);
  padding: 1.25rem;
  border-radius: var(--radius-lg);
  margin: 1.25rem 0;
  border: 1px solid var(--border);
}
.diagram-info {
  background: var(--accent-bg);
  padding: 0.85rem 1.1rem;
  border-left: 3px solid var(--accent);
  margin-bottom: 1rem;
  border-radius: 0 var(--radius) var(--radius) 0;
  font-size: 0.85rem;
  color: var(--text-secondary);
}
.diagram-preview {
  background: var(--bg);
  padding: 1rem;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  text-align: center;
  min-height: 200px;
}
.diagram-preview svg, .diagram-preview img { max-width: 100%; height: auto; display: block; margin: 0 auto; }
.diagram-viewer-container {
  width: 100%;
  height: 600px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  overflow: hidden;
  background: #fff;
}
.diagram-tabs { display: flex; gap: 0.4rem; margin-bottom: 0.85rem; }
.diagram-tab {
  padding: 0.35rem 0.85rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text-secondary);
  font-size: 0.78rem;
  font-weight: 500;
}
.diagram-tab:hover { border-color: var(--accent); color: var(--accent); }
.diagram-tab.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.diagram-json {
  background: var(--code-bg);
  color: var(--code-text);
  padding: 1rem;
  border-radius: var(--radius);
  max-height: 400px;
  overflow-y: auto;
  font-family: var(--font-mono);
  font-size: 0.78rem;
  white-space: pre-wrap;
  word-break: break-all;
}

/* ── Command palette (modal) ─────────────────────────────────────────── */
.cmdk-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 200;
  display: none;
  align-items: flex-start;
  justify-content: center;
  padding-top: 12vh;
  opacity: 0;
  transition: opacity 0.15s;
}
.cmdk-backdrop.is-open { display: flex; opacity: 1; }

.cmdk {
  width: min(640px, calc(100vw - 2rem));
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}
.cmdk-input {
  width: 100%;
  padding: 0.95rem 1.1rem;
  border: 0;
  border-bottom: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  font-size: 1rem;
  font-family: var(--font-sans);
}
.cmdk-input:focus { outline: none; }
.cmdk-input::placeholder { color: var(--text-muted); }

.cmdk-results { flex: 1; overflow-y: auto; padding: 0.35rem; }
.cmdk-empty { padding: 2rem 1rem; text-align: center; color: var(--text-muted); font-size: 0.85rem; }

.cmdk-result {
  display: block;
  padding: 0.65rem 0.85rem;
  border-radius: var(--radius);
  color: var(--text);
  cursor: pointer;
}
.cmdk-result.is-focused { background: var(--accent-bg); }
.cmdk-result:hover { text-decoration: none; }
.cmdk-result .cr-title { font-size: 0.9rem; font-weight: 500; }
.cmdk-result .cr-folder { font-size: 0.72rem; color: var(--text-muted); margin-top: 2px; }
.cmdk-result .cr-snippet { font-size: 0.76rem; color: var(--text-secondary); margin-top: 3px; line-height: 1.4; }
.cmdk-result .cr-snippet mark { background: var(--accent-bg); color: inherit; padding: 0 2px; border-radius: 2px; }

.cmdk-footer {
  display: flex;
  gap: 1rem;
  padding: 0.55rem 0.85rem;
  border-top: 1px solid var(--border);
  background: var(--bg-subtle);
  font-size: 0.72rem;
  color: var(--text-muted);
}
.cmdk-footer kbd {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  background: var(--bg-muted);
  border: 1px solid var(--border);
  padding: 1px 5px;
  border-radius: 3px;
  color: var(--text-secondary);
}

/* ── Mobile drawer ────────────────────────────────────────────────────── */
.nav-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
  z-index: 70;
}
html.nav-open .nav-overlay { opacity: 1; pointer-events: auto; }

@media (max-width: 900px) {
  .sidebar {
    position: fixed;
    top: var(--topbar-h);
    left: 0;
    width: min(85vw, 320px);
    height: calc(100vh - var(--topbar-h));
    transform: translateX(-105%);
    transition: transform 0.25s ease;
    z-index: 80;
    background: var(--bg);
  }
  html.nav-open .sidebar { transform: translateX(0); }
  .main { padding: 1.25rem 1rem 3rem; }
  .dashboard { padding: 2rem 1rem 3rem; }
  .dash-hero h1 { font-size: 1.75rem; }
}

/* ── Reduced motion ──────────────────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  html { scroll-behavior: auto !important; }
}
html { scroll-behavior: smooth; }
```

- [ ] **Step 2: Commit**

```bash
git add assets/site.css
git commit -m "feat(ui): add component styles (code, tables, dashboard, cmdk)"
```

---

## Task 4: Create `assets/site.js` with theme, drawer, folder persistence, progress, back-to-top

**Files:**
- Create: `assets/site.js`

- [ ] **Step 1: Create the file**

Run: `touch assets/site.js`

- [ ] **Step 2: Write the core module**

Write this to `assets/site.js`:

```javascript
/* ==========================================================================
   System Design Ultimatum — site.js
   All client-side interactions. Vanilla JS, no dependencies.
   Loaded via <script defer> at the bottom of the page template.
   ========================================================================== */

(() => {
  'use strict';

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const storage = {
    get(k, fallback = null) { try { return localStorage.getItem(k) ?? fallback; } catch { return fallback; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  /* ── Theme toggle (inline FOUC script already set data-theme) ─────── */
  function initTheme() {
    const btn = $('#theme-toggle');
    if (!btn) return;
    const render = () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      btn.setAttribute('aria-pressed', String(isDark));
      btn.innerHTML = isDark ? ICONS.sun : ICONS.moon;
    };
    render();
    btn.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      storage.set('theme', next);
      render();
    });
  }

  /* ── Mobile drawer ────────────────────────────────────────────────── */
  function initDrawer() {
    const hamburger = $('.topbar-hamburger');
    const overlay = $('.nav-overlay');
    const setOpen = (open) => document.documentElement.classList.toggle('nav-open', open);
    hamburger?.addEventListener('click', () => setOpen(true));
    overlay?.addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') setOpen(false);
    });
  }

  /* ── Active nav link + auto-open parent folder ────────────────────── */
  function initActiveNav() {
    const current = decodeURIComponent((location.pathname.split('/').pop() || 'index.html'));
    $$('.nav-item').forEach((item) => {
      const href = decodeURIComponent(item.getAttribute('href') || '');
      if (href === current) {
        item.classList.add('is-active');
        let parent = item.closest('.nav-folder');
        while (parent) {
          parent.open = true;
          parent = parent.parentElement?.closest('.nav-folder');
        }
      }
    });
  }

  /* ── Sidebar folder persistence ───────────────────────────────────── */
  function initFolderPersistence() {
    $$('.sidebar .nav-folder').forEach((folder) => {
      const summary = folder.querySelector(':scope > summary');
      const label = summary?.textContent.trim() || '';
      const key = 'nav:' + slugify(label);
      const stored = storage.get(key);
      if (stored === 'open') folder.open = true;
      else if (stored === 'closed' && !folder.querySelector('.nav-item.is-active')) folder.open = false;
      folder.addEventListener('toggle', () => {
        storage.set(key, folder.open ? 'open' : 'closed');
      });
    });
  }

  /* ── Reading progress bar ─────────────────────────────────────────── */
  function initProgressBar() {
    const bar = $('.progress-bar');
    if (!bar) return;
    let ticking = false;
    const update = () => {
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docH > 0 ? Math.min(window.scrollY / docH, 1) : 0;
      bar.style.setProperty('--progress', String(pct));
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    update();
  }

  /* ── Back-to-top ──────────────────────────────────────────────────── */
  function initBackToTop() {
    const btn = $('.back-to-top');
    if (!btn) return;
    window.addEventListener('scroll', () => {
      btn.classList.toggle('is-visible', window.scrollY > 400);
    }, { passive: true });
    btn.addEventListener('click', () => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    });
  }

  /* ── Inline icon strings used by JS ───────────────────────────────── */
  const ICONS = {
    sun:  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
    moon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    up:   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>',
  };
  window.__SDU_ICONS__ = ICONS;

  /* ── Boot ─────────────────────────────────────────────────────────── */
  function boot() {
    initTheme();
    initDrawer();
    initActiveNav();
    initFolderPersistence();
    initProgressBar();
    initBackToTop();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.__SDU__ = { $, $$, storage };
})();
```

- [ ] **Step 3: Commit**

```bash
git add assets/site.js
git commit -m "feat(ui): add site.js core (theme, drawer, nav, progress)"
```

---

## Task 5: Add Cmd-K command palette to `assets/site.js`

**Files:**
- Modify: `assets/site.js`

- [ ] **Step 1: Append the palette module**

Append this block to `assets/site.js`, **inside** the IIFE but **before** the `function boot()` declaration. The easiest way: open the file, locate the line `/* ── Boot ─... */`, and paste this block immediately above it:

```javascript
  /* ── Command palette (Cmd-K) ──────────────────────────────────────── */
  const palette = (() => {
    let backdrop, input, resultsEl, items = [], focused = 0, index = null, cache = null;

    async function loadIndex() {
      if (cache) return cache;
      try {
        const res = await fetch('search-index.json');
        cache = await res.json();
      } catch { cache = []; }
      return cache;
    }

    function ensure() {
      if (backdrop) return;
      backdrop = document.createElement('div');
      backdrop.className = 'cmdk-backdrop';
      backdrop.setAttribute('role', 'dialog');
      backdrop.setAttribute('aria-modal', 'true');
      backdrop.setAttribute('aria-label', 'Search');
      backdrop.innerHTML = `
        <div class="cmdk" role="combobox" aria-expanded="true" aria-owns="cmdk-results">
          <input class="cmdk-input" type="search" placeholder="Search the docs..." aria-label="Search the docs" autocomplete="off" spellcheck="false" />
          <div class="cmdk-results" id="cmdk-results" role="listbox"></div>
          <div class="cmdk-footer">
            <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
            <span><kbd>↵</kbd> open</span>
            <span><kbd>esc</kbd> close</span>
          </div>
        </div>
      `;
      document.body.appendChild(backdrop);
      input = backdrop.querySelector('.cmdk-input');
      resultsEl = backdrop.querySelector('.cmdk-results');
      backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
      input.addEventListener('input', onInput);
      input.addEventListener('keydown', onKey);
    }

    function highlight(text, q) {
      if (!text) return '';
      const lower = text.toLowerCase();
      const idx = lower.indexOf(q);
      if (idx === -1) return escapeHtml(text.slice(0, 120));
      const start = Math.max(0, idx - 40);
      const end = Math.min(text.length, idx + q.length + 60);
      const before = (start > 0 ? '…' : '') + escapeHtml(text.slice(start, idx));
      const match = '<mark>' + escapeHtml(text.slice(idx, idx + q.length)) + '</mark>';
      const after = escapeHtml(text.slice(idx + q.length, end)) + (end < text.length ? '…' : '');
      return before + match + after;
    }
    function escapeHtml(s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function render(results, q) {
      if (!results.length) {
        resultsEl.innerHTML = '<div class="cmdk-empty">' + (q ? 'No results for "' + escapeHtml(q) + '"' : 'Type to search…') + '</div>';
        items = [];
        return;
      }
      resultsEl.innerHTML = results.slice(0, 20).map((r, i) => (
        '<a class="cmdk-result' + (i === 0 ? ' is-focused' : '') + '" href="' + escapeHtml(r.href) + '" role="option">' +
          '<div class="cr-title">' + escapeHtml(r.name) + '</div>' +
          '<div class="cr-folder">' + escapeHtml(r.folder || '') + '</div>' +
          (q && r.text ? '<div class="cr-snippet">' + highlight(r.text, q) + '</div>' : '') +
        '</a>'
      )).join('');
      items = Array.from(resultsEl.querySelectorAll('.cmdk-result'));
      focused = 0;
    }

    async function onInput() {
      const q = input.value.trim().toLowerCase();
      const data = await loadIndex();
      if (!q) { render(data.slice(0, 10), ''); return; }
      const matches = data.filter((it) =>
        (it.name && it.name.toLowerCase().includes(q)) ||
        (it.text && it.text.toLowerCase().includes(q)) ||
        (it.folder && it.folder.toLowerCase().includes(q))
      );
      render(matches, q);
    }

    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (!items.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        focused = (focused + 1) % items.length;
        syncFocus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        focused = (focused - 1 + items.length) % items.length;
        syncFocus();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const link = items[focused];
        if (!link) return;
        if (e.metaKey || e.ctrlKey) window.open(link.href, '_blank');
        else location.href = link.href;
      }
    }
    function syncFocus() {
      items.forEach((el, i) => el.classList.toggle('is-focused', i === focused));
      items[focused]?.scrollIntoView({ block: 'nearest' });
    }

    let lastFocus = null;
    function open() {
      ensure();
      lastFocus = document.activeElement;
      backdrop.classList.add('is-open');
      input.value = '';
      onInput();
      setTimeout(() => input.focus(), 0);
    }
    function close() {
      if (!backdrop) return;
      backdrop.classList.remove('is-open');
      if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    }

    return { open, close };
  })();

  function initPalette() {
    const trigger = $('#topbar-search');
    trigger?.addEventListener('click', () => palette.open());
    document.addEventListener('keydown', (e) => {
      const inField = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable);
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); palette.open(); return; }
      if (e.key === '/' && !inField) { e.preventDefault(); palette.open(); return; }
    });
  }
```

- [ ] **Step 2: Register the palette in `boot()`**

In the same file, modify the `boot()` function so its body becomes:

```javascript
  function boot() {
    initTheme();
    initDrawer();
    initActiveNav();
    initFolderPersistence();
    initProgressBar();
    initBackToTop();
    initPalette();
  }
```

- [ ] **Step 3: Commit**

```bash
git add assets/site.js
git commit -m "feat(ui): add Cmd-K command palette"
```

---

## Task 6: Add TOC scroll-spy, copy-code buttons, heading anchors, keyboard shortcuts

**Files:**
- Modify: `assets/site.js`

- [ ] **Step 1: Append these four modules above the `boot()` function**

```javascript
  /* ── TOC scroll-spy ───────────────────────────────────────────────── */
  function initTocSpy() {
    const links = $$('[data-toc-link]');
    if (!links.length || !('IntersectionObserver' in window)) return;
    const byId = new Map();
    const headings = [];
    links.forEach((a) => {
      const id = decodeURIComponent((a.getAttribute('href') || '').slice(1));
      const el = id && document.getElementById(id);
      if (el) { byId.set(id, a); headings.push(el); }
    });
    let current = null;
    const setActive = (id) => {
      if (id === current) return;
      current = id;
      links.forEach((a) => a.classList.remove('is-active'));
      const link = byId.get(id);
      if (link) link.classList.add('is-active');
    };
    const visible = new Set();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) visible.add(e.target.id);
        else visible.delete(e.target.id);
      });
      if (visible.size) {
        const first = headings.find((h) => visible.has(h.id));
        if (first) setActive(first.id);
      }
    }, { rootMargin: '-80px 0px -70% 0px', threshold: 0 });
    headings.forEach((h) => io.observe(h));
    if (headings[0]) setActive(headings[0].id);
  }

  /* ── Copy-code buttons ────────────────────────────────────────────── */
  function initCopyCode() {
    $$('.content-body pre').forEach((pre) => {
      if (pre.querySelector('.code-copy-btn')) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'code-copy-btn';
      btn.setAttribute('aria-label', 'Copy code to clipboard');
      btn.textContent = 'Copy';
      btn.addEventListener('click', async () => {
        const code = pre.querySelector('code')?.textContent ?? pre.textContent ?? '';
        try {
          await navigator.clipboard.writeText(code);
          btn.textContent = 'Copied';
          btn.classList.add('is-copied');
          setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('is-copied'); }, 1500);
        } catch {
          btn.textContent = 'Failed';
          setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
        }
      });
      pre.appendChild(btn);
    });
  }

  /* ── Heading anchor links ─────────────────────────────────────────── */
  function initHeadingAnchors() {
    $$('.content-body h2[id], .content-body h3[id], .content-body h4[id]').forEach((h) => {
      if (h.querySelector('.heading-anchor')) return;
      const id = h.id;
      const a = document.createElement('a');
      a.className = 'heading-anchor';
      a.href = '#' + id;
      a.textContent = '#';
      a.setAttribute('aria-label', 'Link to this section');
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const url = location.origin + location.pathname + '#' + id;
        history.replaceState(null, '', '#' + id);
        try { navigator.clipboard.writeText(url); } catch {}
        h.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      h.prepend(a);
    });
  }

  /* ── Global keyboard shortcuts ────────────────────────────────────── */
  function initShortcuts() {
    let gPending = false, gTimer = 0;
    document.addEventListener('keydown', (e) => {
      const tgt = e.target;
      const inField = tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable);
      if (inField) return;
      if (e.key === 't' && !e.metaKey && !e.ctrlKey && !e.altKey) { $('#theme-toggle')?.click(); return; }
      if (e.key === 'g' && !e.metaKey && !e.ctrlKey) {
        gPending = true;
        clearTimeout(gTimer);
        gTimer = setTimeout(() => { gPending = false; }, 800);
        return;
      }
      if (gPending && e.key === 'h') {
        gPending = false;
        location.href = 'index.html';
      }
    });
  }
```

- [ ] **Step 2: Register the new modules in `boot()`**

`boot()` should now read:

```javascript
  function boot() {
    initTheme();
    initDrawer();
    initActiveNav();
    initFolderPersistence();
    initProgressBar();
    initBackToTop();
    initPalette();
    initTocSpy();
    initCopyCode();
    initHeadingAnchors();
    initShortcuts();
  }
```

- [ ] **Step 3: Commit**

```bash
git add assets/site.js
git commit -m "feat(ui): add TOC spy, copy-code, anchors, shortcuts"
```

---

## Task 7: Refactor `build-site.js` — add `loadAssets()` helper and wire hashed asset hrefs

**Files:**
- Modify: `build-site.js` (top-of-file helpers + later where `generatePageTemplate` is used)

- [ ] **Step 1: Add `crypto` import and `loadAssets()` helper**

Near the top of `build-site.js`, after the existing `const path = require('path');` line, add:

```javascript
const crypto = require('crypto');

// ─── Asset pipeline ─────────────────────────────────────────────────────────

function loadAssets() {
  const sources = [
    { src: path.join(__dirname, 'assets', 'site.css'), ext: '.css' },
    { src: path.join(__dirname, 'assets', 'site.js'),  ext: '.js'  },
  ];
  const outDir = path.join(docsDir, 'assets');
  fs.mkdirSync(outDir, { recursive: true });

  const result = {};
  for (const { src, ext } of sources) {
    const content = fs.readFileSync(src);
    const hash = crypto.createHash('sha1').update(content).digest('hex').slice(0, 8);
    const outName = `site.${hash}${ext}`;
    fs.writeFileSync(path.join(outDir, outName), content);
    if (ext === '.css') result.cssHref = `assets/${outName}`;
    if (ext === '.js')  result.jsHref  = `assets/${outName}`;
  }
  return result;
}
```

Note: `docsDir` is defined earlier in the file as `'./docs'`. `loadAssets()` must be called AFTER `docsDir` exists (it does, by file order).

- [ ] **Step 2: Call `loadAssets()` once at startup and expose its result**

Immediately after the existing `fs.mkdirSync(docsDir, { recursive: true });` block near the top, add:

```javascript
const ASSETS = loadAssets();
console.log(`  Assets: ${ASSETS.cssHref}, ${ASSETS.jsHref}`);
```

- [ ] **Step 3: Delete the `globalStyles` constant entirely**

Find the line `const globalStyles = \`` (around line 495) and delete from that line through the closing `` `; `` (around line 1038). The entire CSS template literal goes away.

- [ ] **Step 4: Delete the `clientScript` constant entirely**

Find `const clientScript = \`` (around line 1216) and delete through its closing `` `; `` (around line 1399). The entire inline script goes away.

- [ ] **Step 5: Update `generatePageTemplate()` to use hashed assets and a top bar**

Replace the entire body of `generatePageTemplate` with:

```javascript
function generatePageTemplate(title, content, { toc = '', breadcrumb = '', prevNext = '', isHome = false } = {}) {
  const safeTitle = escapeHtml(title);
  const themeInit = `<script>(function(){try{var t=localStorage.getItem('theme');if(!t)t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();</script>`;
  const topbar = `
  <header class="topbar" role="banner">
    <button class="topbar-icon-btn topbar-hamburger" type="button" aria-label="Open navigation">☰</button>
    <a class="topbar-brand" href="index.html">System Design Ultimatum</a>
    <button id="topbar-search" class="topbar-search" type="button" aria-label="Search (⌘K)">
      <span>Search the docs…</span>
      <span class="kbd">⌘K</span>
    </button>
    <span class="topbar-spacer"></span>
    <button id="theme-toggle" class="topbar-icon-btn" type="button" aria-label="Toggle dark mode" aria-pressed="false"></button>
    <a class="topbar-icon-btn" href="https://github.com/" target="_blank" rel="noopener" aria-label="GitHub">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
    </a>
  </header>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle} - System Design Ultimatum</title>
  ${themeInit}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="${ASSETS.cssHref}">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-tomorrow.min.css">
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<div class="progress-bar"><div class="progress-fill"></div></div>
${topbar}
<div class="nav-overlay" data-nav-overlay></div>
<div class="app">
${generateNav()}
<main class="main" id="main">
${isHome ? '' : `
  <div class="page-header">
    ${breadcrumb}
    <h1>${safeTitle}</h1>
  </div>
`}
${isHome ? content : `
  <div class="content-layout">
    <div class="content-body">
      ${content}
      ${prevNext}
    </div>
  </div>
`}
  <footer>System Design Ultimatum &middot; Last updated ${new Date().toLocaleDateString()}</footer>
</main>
${toc}
</div>
<button class="back-to-top" aria-label="Back to top">${icons.up}</button>
<script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/prism.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/plugins/autoloader/prism-autoloader.min.js"></script>
<script defer src="${ASSETS.jsHref}"></script>
</body>
</html>`;
}
```

Note two structural changes: (a) `.app` is now a CSS grid with sidebar + main + toc as siblings, so `generateNav()` must return the `.sidebar` element as the first grid child and the TOC must be the third grid child (both are already top-level elements, which matches the grid). (b) `.main` wraps the page content. (c) Top bar is outside the grid via `grid-column: 1 / -1`.

- [ ] **Step 6: Update `generateNav()` — remove in-sidebar header, search, and theme toggle**

In `generateNav()`, replace the block that builds the nav header + search + scroll wrapper (everything from `let nav = '<nav class="sidebar"...` through the initial `<div class="nav-scroll"><div class="nav-content">`) with:

```javascript
  let nav = '<nav class="sidebar" aria-label="Primary">';
  nav += '<div class="nav-section-label">Study Notes</div>';
```

And remove the closing `</div></div></nav>` that matches `nav-scroll`/`nav-content`. The final nav should end with just:

```javascript
  nav += '</nav>';
  return nav;
```

The rest of the folder-rendering logic stays identical.

- [ ] **Step 7: Build and verify**

Run:

```bash
node build-site.js
```

Expected output contains `Assets: assets/site.<hash>.css, assets/site.<hash>.js` and many `Generated: ...html` lines with no errors.

Then:

```bash
ls docs/assets/
```

Expected: two `site.<hash>.{css,js}` files.

Open `docs/index.html` in a browser. Expected:
- Top bar shows brand, search trigger with `⌘K`, theme toggle, GitHub icon
- Sidebar renders on left under top bar with folders collapsed
- Clicking a page opens it with breadcrumbs, h1, content, and TOC on the right (at ≥1280px wide)
- Theme toggle flips light/dark with no flash on reload
- Cmd-K (or `/`) opens the command palette and searches

- [ ] **Step 8: Commit**

```bash
git add build-site.js
git commit -m "refactor(build): externalize CSS/JS and add top-bar layout"
```

---

## Task 8: Smoke test all features and fix regressions

**Files:**
- Possibly: `assets/site.css`, `assets/site.js`, `build-site.js` (fix-only)

- [ ] **Step 1: Run the build**

```bash
node build-site.js
```

Expected: exits 0 with asset banner + page generation logs.

- [ ] **Step 2: Manual QA checklist — open `docs/index.html` in a browser and verify each**

Check each box only after confirming:

- [ ] Homepage hero renders, category grid visible
- [ ] Top bar sticky, blurred background when scrolling
- [ ] Theme toggle flips light/dark, persists on reload, no FOUC
- [ ] Sidebar folders collapse/expand; state persists on reload
- [ ] Clicking a folder's page shows that page with correct breadcrumbs + H1
- [ ] Content column is 720px wide and centered
- [ ] Right-rail TOC shows at viewport ≥1280px and highlights current section while scrolling
- [ ] Each `<pre>` has a hover-visible Copy button that copies the code
- [ ] Hovering an h2/h3/h4 shows a `#` anchor; clicking it copies URL and scrolls
- [ ] Prev/next cards at bottom of pages navigate correctly
- [ ] Back-to-top button appears after 400px scroll and returns to top
- [ ] Reading progress bar fills as you scroll
- [ ] Cmd-K / Ctrl-K / `/` opens command palette; typing filters; ↑↓ navigates; ↵ opens; Esc closes
- [ ] `t` key toggles theme; `g h` navigates home
- [ ] Mobile (narrow viewport): top bar hamburger opens drawer; tapping overlay closes
- [ ] An Excalidraw diagram page renders its interactive viewer + SVG + JSON tabs
- [ ] Search index fetch in palette works from a non-index page (relative URL resolves)

- [ ] **Step 3: Fix any issues found**

For each failed checkbox, diagnose and fix in the appropriate file (`assets/site.css`, `assets/site.js`, or `build-site.js`), rebuild, re-verify. Common fixes:

- TOC not showing: confirm `generatePageTemplate` places `${toc}` as a sibling of `<main>` inside `.app` (grid child 3).
- Cmd-K fetch fails on nested pages: `search-index.json` is always at docs root and pages are all flat in `docs/`, so relative `search-index.json` works — if a page is inside a subfolder, use `new URL('search-index.json', location.href)` in `loadIndex()`.
- Folder persistence not working: check that `slugify(label)` keys don't collide across duplicate folder names at different depths — if they do, include the parent chain: `key = 'nav:' + path-slug`.

- [ ] **Step 4: Final commit of any fixes**

```bash
git add -A
git commit -m "fix(ui): resolve smoke-test regressions"
```

Skip this commit if nothing needed fixing.

---

## Self-Review Notes

- **Spec coverage:** §1 architecture (Task 7), §2 visual language (Tasks 1-3), §3 layout (Tasks 2-3, 7), §4 interactions (Tasks 4-6), §5 a11y/perf/build (Tasks 1, 7). All 14 acceptance criteria map to one or more tasks.
- **Placeholders:** none. Every code block is complete.
- **Naming consistency:** `initTheme`, `initDrawer`, `initActiveNav`, `initFolderPersistence`, `initProgressBar`, `initBackToTop`, `initPalette`, `initTocSpy`, `initCopyCode`, `initHeadingAnchors`, `initShortcuts` — all referenced by `boot()`. `ASSETS.cssHref` / `ASSETS.jsHref` are consistent across Task 7.
- **Known deviation from spec:** Geist is loaded via Google Fonts `@import`, not self-hosted woff2. Self-hosting can be added later by downloading the woff2 files into `assets/fonts/` and updating the `@import` to a local `@font-face`. This keeps the plan executable without binary asset downloads. The `<link rel="preconnect">` tags to `fonts.googleapis.com` / `fonts.gstatic.com` remain in the page template.
