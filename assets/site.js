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

  const ICONS = {
    sun:  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
    moon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
  };

  /* ── Theme ─────────────────────────────────────────────────────────── */
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
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
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

  /* ── Command palette ──────────────────────────────────────────────── */
  const palette = (() => {
    let backdrop, input, resultsEl, items = [], focused = 0, cache = null;

    async function loadIndex() {
      if (cache) return cache;
      try {
        const url = new URL('search-index.json', location.href);
        const res = await fetch(url.toString());
        cache = await res.json();
      } catch { cache = []; }
      return cache;
    }

    function escapeHtml(s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
        </div>`;
      document.body.appendChild(backdrop);
      input = backdrop.querySelector('.cmdk-input');
      resultsEl = backdrop.querySelector('.cmdk-results');
      backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
      input.addEventListener('input', onInput);
      input.addEventListener('keydown', onKey);
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
      const tgt = e.target;
      const inField = tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable);
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); palette.open(); return; }
      if (e.key === '/' && !inField) { e.preventDefault(); palette.open(); return; }
    });
  }

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

  /* ── Boot ─────────────────────────────────────────────────────────── */
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
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
