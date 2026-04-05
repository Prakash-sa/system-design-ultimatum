#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// ─── Helpers ────────────────────────────────────────────────────────────────

const escapeHtml = (str = '') =>
  String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const toHtmlFileName = (filePath, ext) =>
  filePath.replace(/^\.\//, '').replace(/\//g, '_').replace(ext, '.html');

const safeHref = (fileName) => escapeHtml(encodeURI(fileName));

const slugify = (text) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// Create docs directory
const docsDir = './docs';
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}

// ─── Markdown to HTML (with heading IDs + TOC extraction) ───────────────────

function markdownToHtml(markdown) {
  const headings = []; // collected for TOC

  const applyInline = (text = '') => {
    let t = escapeHtml(text);
    t = t.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" loading="lazy" />');
    t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    t = t.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/__(.*?)__/g, '<strong>$1</strong>');
    t = t.replace(/\*(.*?)\*/g, '<em>$1</em>');
    t = t.replace(/_(.*?)_/g, '<em>$1</em>');
    t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
    return t;
  };

  // Strip inline markup for plain text (used in TOC)
  const stripInline = (text = '') =>
    text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/_(.*?)_/g, '$1')
      .replace(/`([^`]+)`/g, '$1');

  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html = [];

  let inCode = false;
  let codeLang = '';
  let codeLines = [];
  let inUl = false;
  let inOl = false;
  let inBlockquote = false;
  let paragraph = '';

  const closeParagraph = () => {
    if (paragraph.trim()) {
      html.push('<p>' + applyInline(paragraph.trim()) + '</p>');
      paragraph = '';
    }
  };

  const closeLists = () => {
    if (inUl) { html.push('</ul>'); inUl = false; }
    if (inOl) { html.push('</ol>'); inOl = false; }
  };

  const closeBlockquote = () => {
    if (inBlockquote) { html.push('</blockquote>'); inBlockquote = false; }
  };

  const isSeparatorRow = (row) => /^\s*\|?\s*:?-{3,}:?(?:\s*\|\s*:?-{3,}:?)*\s*\|?\s*$/.test(row);
  const splitCells = (row) => row.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(c => applyInline(c.trim()));

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trimEnd();

    // Handle <details> and <summary> tags
    if (line.trim() === '<details>' || line.trim().startsWith('<details ')) {
      closeParagraph(); closeLists(); closeBlockquote();
      html.push(line.trim());
      continue;
    }
    if (line.trim() === '</details>') { html.push(line.trim()); continue; }
    if (line.trim().startsWith('<summary>') || line.trim() === '<summary>') { html.push(line.trim()); continue; }
    if (line.trim() === '</summary>') { html.push(line.trim()); continue; }

    if (line.startsWith('```')) {
      if (inCode) {
        const langClass = codeLang ? ` class="language-${escapeHtml(codeLang)}"` : '';
        html.push(`<pre><code${langClass}>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
        codeLines = []; codeLang = ''; inCode = false;
      } else {
        closeParagraph(); closeLists(); closeBlockquote();
        inCode = true;
        codeLang = line.replace(/```/, '').trim();
      }
      continue;
    }

    if (inCode) { codeLines.push(rawLine); continue; }
    if (!line) { closeParagraph(); closeLists(); closeBlockquote(); continue; }

    if (/^(\*\s*\*\s*\*|---)$/.test(line)) {
      closeParagraph(); closeLists(); closeBlockquote();
      html.push('<hr/>');
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      closeParagraph(); closeLists(); closeBlockquote();
      const level = headingMatch[1].length;
      const rawText = headingMatch[2].trim();
      const plainText = stripInline(rawText);
      const id = slugify(plainText);
      headings.push({ level, text: plainText, id });
      html.push(`<h${level} id="${escapeHtml(id)}">${applyInline(rawText)}</h${level}>`);
      continue;
    }

    // Tables
    const nextLine = lines[i + 1]?.trim();
    if (line.startsWith('|') && nextLine && nextLine.startsWith('|')) {
      const tableLines = [];
      let j = i;
      while (j < lines.length && lines[j].trim().startsWith('|')) { tableLines.push(lines[j].trim()); j++; }
      if (tableLines.length >= 2) {
        closeParagraph(); closeLists(); closeBlockquote();
        const headerCells = splitCells(tableLines[0]);
        const bodyLines = isSeparatorRow(tableLines[1]) ? tableLines.slice(2) : tableLines.slice(1);
        const bodyRows = bodyLines.map(splitCells);
        let tableHtml = '<div class="table-wrap"><table><thead><tr>' + headerCells.map(h => '<th>' + h + '</th>').join('') + '</tr></thead><tbody>';
        bodyRows.forEach(row => { tableHtml += '<tr>' + row.map(c => '<td>' + c + '</td>').join('') + '</tr>'; });
        tableHtml += '</tbody></table></div>';
        html.push(tableHtml);
        i = j - 1;
        continue;
      }
    }

    if (line.startsWith('>')) {
      closeParagraph(); closeLists();
      if (!inBlockquote) { html.push('<blockquote>'); inBlockquote = true; }
      html.push('<p>' + applyInline(line.replace(/^>\s?/, '').trim()) + '</p>');
      continue;
    }

    const olMatch = line.match(/^\d+\.\s+(.*)$/);
    if (olMatch) {
      closeParagraph();
      if (inUl) { html.push('</ul>'); inUl = false; }
      if (!inOl) { html.push('<ol>'); inOl = true; }
      html.push('<li>' + applyInline(olMatch[1]) + '</li>');
      continue;
    }

    const ulMatch = line.match(/^[-*]\s+(.*)$/);
    if (ulMatch) {
      closeParagraph();
      if (inOl) { html.push('</ol>'); inOl = false; }
      if (!inUl) { html.push('<ul>'); inUl = true; }
      html.push('<li>' + applyInline(ulMatch[1]) + '</li>');
      continue;
    }

    paragraph = paragraph ? paragraph + ' ' + line.trim() : line.trim();
  }

  closeParagraph(); closeLists(); closeBlockquote();
  if (inCode) { html.push('<pre><code>' + escapeHtml(codeLines.join('\n')) + '</code></pre>'); }

  return { html: html.join('\n'), headings };
}

// ─── Excalidraw SVG Generator (kept from original) ─────────────────────────

function generateExcalidrawSvgPreview(data, name = 'Diagram') {
  const elements = (data.elements || []).filter(el => el && !el.isDeleted);
  if (elements.length === 0) {
    return { svg: '<p style="color: #999; text-align: center;">No elements in diagram</p>', hasElements: false };
  }

  const background = data.appState?.viewBackgroundColor || '#ffffff';
  const patternCache = new Map();
  const defs = [];

  const safeNumber = (val, fallback = 0) => (Number.isFinite(val) ? val : fallback);
  const safePositive = (val, fallback = 1) => { const n = safeNumber(val, fallback); return Math.abs(n) > 0 ? Math.abs(n) : fallback; };
  const clamp = (val, fallback = 0) => (Number.isFinite(val) ? val : fallback);

  const rotatePoint = (px, py, cx, cy, angle) => {
    const cos = Math.cos(angle); const sin = Math.sin(angle);
    return [cx + (px - cx) * cos - (py - cy) * sin, cy + (px - cx) * sin + (py - cy) * cos];
  };

  const getRoundness = (element) => {
    if (!element.roundness) return 0;
    if (typeof element.roundness === 'number') return element.roundness;
    return clamp(element.roundness.value, 0);
  };

  const normalizeElement = (element) => ({
    ...element,
    x: safeNumber(element.x, 0), y: safeNumber(element.y, 0),
    width: safePositive(element.width, 1), height: safePositive(element.height, 1),
    strokeWidth: safePositive(element.strokeWidth, 1),
    opacity: Number.isFinite(element.opacity) ? element.opacity : 100,
    angle: safeNumber(element.angle, 0),
  });

  const normalizedElements = elements.map(normalizeElement);
  const escapeText = (text = '') => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const getStrokeDasharray = (style, strokeWidth) => {
    if (style === 'dashed') return `${strokeWidth * 4} ${strokeWidth * 3}`;
    if (style === 'dotted') return `${strokeWidth} ${strokeWidth * 2.5}`;
    return '';
  };

  const ensurePattern = (fillStyle, strokeColor, backgroundColor) => {
    const key = `${fillStyle}-${strokeColor}-${backgroundColor}`;
    if (patternCache.has(key)) return patternCache.get(key);
    const id = `pattern-${patternCache.size + 1}`;
    let pattern = `<pattern id="${id}" patternUnits="userSpaceOnUse" width="8" height="8"><rect width="8" height="8" fill="${backgroundColor}"/>`;
    if (fillStyle === 'hachure') {
      pattern += `<path d="M0 8 L8 0" stroke="${strokeColor}" stroke-width="1" />`;
    } else {
      pattern += `<path d="M0 8 L8 0" stroke="${strokeColor}" stroke-width="1" /><path d="M0 0 L8 8" stroke="${strokeColor}" stroke-width="1" />`;
    }
    pattern += '</pattern>';
    patternCache.set(key, id);
    defs.push(pattern);
    return id;
  };

  const getFill = (element) => {
    const bg = element.backgroundColor || 'transparent';
    if (bg === 'transparent' || element.type === 'line' || element.type === 'arrow') return 'none';
    if (element.fillStyle === 'hachure' || element.fillStyle === 'cross-hatch') {
      return `url(#${ensurePattern(element.fillStyle, element.strokeColor || '#000000', bg)})`;
    }
    return bg;
  };

  const fontFamilyMap = { 1: 'Excalifont', 2: 'Excalifont', 3: 'Excalifont', 4: 'Excalifont', 5: 'Excalifont' };

  const getElementBounds = (element) => {
    const angle = clamp(element.angle, 0);
    if (element.type === 'arrow' || element.type === 'line') {
      const points = element.points && element.points.length ? element.points : [[0, 0], [element.width || 0, element.height || 0]];
      const coords = points.map(([px, py]) => [element.x + safeNumber(px, 0), element.y + safeNumber(py, 0)]);
      const cx = element.x + clamp(element.width, 0) / 2;
      const cy = element.y + clamp(element.height, 0) / 2;
      const rotated = angle ? coords.map(([px, py]) => rotatePoint(px, py, cx, cy, angle)) : coords;
      const xs = rotated.map(p => p[0]); const ys = rotated.map(p => p[1]);
      return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
    }
    const w = clamp(element.width, 0); const h = clamp(element.height, 0);
    const corners = [[element.x, element.y], [element.x + w, element.y], [element.x + w, element.y + h], [element.x, element.y + h]];
    const cx = element.x + w / 2; const cy = element.y + h / 2;
    const rotated = angle ? corners.map(([px, py]) => rotatePoint(px, py, cx, cy, angle)) : corners;
    const xs = rotated.map(p => p[0]); const ys = rotated.map(p => p[1]);
    return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
  };

  const bounds = normalizedElements.map(getElementBounds).reduce((acc, b) => ({
    minX: Math.min(acc.minX, b.minX), minY: Math.min(acc.minY, b.minY),
    maxX: Math.max(acc.maxX, b.maxX), maxY: Math.max(acc.maxY, b.maxY),
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });

  if (!Number.isFinite(bounds.minX)) {
    return { svg: '<p style="color: #999; text-align: center;">No drawable elements</p>', hasElements: false };
  }

  const padding = 32;
  const minX = Math.floor(bounds.minX - padding);
  const minY = Math.floor(bounds.minY - padding);
  const width = Math.ceil(bounds.maxX - bounds.minX + padding * 2) || 800;
  const height = Math.ceil(bounds.maxY - bounds.minY + padding * 2) || 600;

  defs.push('<style type="text/css">@font-face{font-family:"Excalifont";src:url("https://unpkg.com/@excalidraw/excalidraw@0.17.6/fonts/Excalifont-Regular.woff2") format("woff2");font-display:swap;} text{font-family:"Excalifont";}</style>');
  defs.push('<marker id="arrowhead" markerWidth="14" markerHeight="10" refX="10" refY="5" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L10,5 L0,10 z" fill="currentColor" /></marker>');

  const svgParts = [];
  svgParts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${minX} ${minY} ${width} ${height}" style="background:${background};">`);
  svgParts.push('<defs>' + defs.join('') + '</defs>');
  svgParts.push(`<rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="${background}" />`);

  const filesMap = data.files || {};

  const renderLinearElement = (element) => {
    const strokeWidth = clamp(element.strokeWidth, 1) || 1;
    const stroke = element.strokeColor || '#000000';
    const opacity = typeof element.opacity === 'number' ? element.opacity / 100 : 1;
    const points = Array.isArray(element.points) && element.points.length ? element.points : [[0, 0], [element.width || 0, element.height || 0]];
    const absPoints = points.map(([px, py]) => [element.x + safeNumber(px, 0), element.y + safeNumber(py, 0)]);
    const dashArray = getStrokeDasharray(element.strokeStyle, strokeWidth);
    const centerX = element.x + clamp(element.width, 0) / 2;
    const centerY = element.y + clamp(element.height, 0) / 2;
    const rotatedPoints = element.angle ? absPoints.map(([px, py]) => rotatePoint(px, py, centerX, centerY, element.angle)) : absPoints;
    const pointsAttr = rotatedPoints.map(([px, py]) => `${px},${py}`).join(' ');
    const startMarker = element.startArrowhead === 'arrow' ? 'url(#arrowhead)' : '';
    const endMarker = element.endArrowhead === 'arrow' ? 'url(#arrowhead)' : '';
    return `<polyline points="${pointsAttr}" fill="none" stroke="${stroke}" color="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"${dashArray ? ` stroke-dasharray="${dashArray}"` : ''} ${startMarker ? `marker-start="${startMarker}"` : ''} ${endMarker ? `marker-end="${endMarker}"` : ''} opacity="${opacity}" />`;
  };

  const renderTextElement = (element) => {
    const fontSize = clamp(element.fontSize, 16) || 16;
    const fontFamily = fontFamilyMap[element.fontFamily] || 'Arial, sans-serif';
    const opacity = typeof element.opacity === 'number' ? element.opacity / 100 : 1;
    const textLines = (element.text || '').split('\n');
    const lineHeightPx = (element.lineHeight || 1.25) * fontSize;
    const totalHeight = textLines.length * lineHeightPx;
    let x = element.x;
    if (element.textAlign === 'center') x = element.x + clamp(element.width, 0) / 2;
    else if (element.textAlign === 'right') x = element.x + clamp(element.width, 0);
    let y = element.y + fontSize;
    if (element.verticalAlign === 'middle') y = element.y + clamp(element.height, totalHeight) / 2 - totalHeight / 2 + fontSize;
    else if (element.verticalAlign === 'bottom') y = element.y + clamp(element.height, totalHeight) - totalHeight + fontSize * 0.9;
    const anchor = element.textAlign === 'center' ? 'middle' : element.textAlign === 'right' ? 'end' : 'start';
    const transform = element.angle ? ` transform="rotate(${(element.angle * 180 / Math.PI).toFixed(3)} ${x} ${y - fontSize})"` : '';
    const tspans = textLines.map((l, idx) => `<tspan x="${x}" dy="${idx === 0 ? 0 : lineHeightPx}">${escapeText(l)}</tspan>`).join('');
    return `<text x="${x}" y="${y}" font-size="${fontSize}" font-family="${fontFamily}" fill="${element.strokeColor || '#000'}" text-anchor="${anchor}" opacity="${opacity}"${transform}>${tspans}</text>`;
  };

  const renderShape = (element) => {
    const strokeWidth = clamp(element.strokeWidth, 1) || 1;
    const stroke = element.strokeColor || '#000000';
    const fill = getFill(element);
    const dashArray = getStrokeDasharray(element.strokeStyle, strokeWidth);
    const opacity = typeof element.opacity === 'number' ? element.opacity / 100 : 1;
    const roundness = getRoundness(element);
    const transform = element.angle ? ` transform="rotate(${(element.angle * 180 / Math.PI).toFixed(3)} ${element.x + element.width / 2} ${element.y + element.height / 2})"` : '';

    if (element.type === 'rectangle') {
      return `<rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" rx="${roundness}" ry="${roundness}"${dashArray ? ` stroke-dasharray="${dashArray}"` : ''} opacity="${opacity}"${transform} />`;
    }
    if (element.type === 'ellipse') {
      const cx = element.x + element.width / 2; const cy = element.y + element.height / 2;
      return `<ellipse cx="${cx}" cy="${cy}" rx="${element.width / 2}" ry="${element.height / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${dashArray ? ` stroke-dasharray="${dashArray}"` : ''} opacity="${opacity}"${transform} />`;
    }
    if (element.type === 'diamond') {
      const x = element.x; const y = element.y; const w = element.width; const h = element.height;
      const pts = [[x + w / 2, y], [x + w, y + h / 2], [x + w / 2, y + h], [x, y + h / 2]]
        .map(([px, py]) => (element.angle ? rotatePoint(px, py, x + w / 2, y + h / 2, element.angle) : [px, py]))
        .map(([px, py]) => `${px},${py}`).join(' ');
      return `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${dashArray ? ` stroke-dasharray="${dashArray}"` : ''} opacity="${opacity}" />`;
    }
    if (element.type === 'image') {
      const fileId = element.fileId;
      const imageData = fileId && filesMap[fileId];
      const href = imageData?.dataURL || '';
      const transformAttr = element.angle ? ` transform="rotate(${(element.angle * 180 / Math.PI).toFixed(3)} ${element.x + element.width / 2} ${element.y + element.height / 2})"` : '';
      if (!href) return `<rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" fill="#f5f5f5" stroke="#999" stroke-width="${strokeWidth}" opacity="${opacity}"${transformAttr} />`;
      return `<image href="${href}" x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" preserveAspectRatio="xMidYMid meet" opacity="${opacity}"${transformAttr} />`;
    }
    return '';
  };

  normalizedElements.forEach(element => {
    if (element.type === 'line' || element.type === 'arrow') svgParts.push(renderLinearElement(element));
    else if (element.type === 'text') svgParts.push(renderTextElement(element));
    else svgParts.push(renderShape(element));
  });

  svgParts.push('</svg>');
  return { svg: svgParts.join(''), hasElements: true };
}

// ─── File Discovery ─────────────────────────────────────────────────────────

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (!file.startsWith('.') && file !== 'node_modules' && file !== 'docs') {
        getAllFiles(filePath, fileList);
      }
    } else {
      fileList.push(filePath);
    }
  });
  return fileList;
}

const allFiles = getAllFiles('.');
const isExcludedTopLevel = (filePath) => {
  const relativeDir = path.relative('.', path.dirname(filePath));
  const top = relativeDir.split(path.sep)[0];
  return relativeDir === '' || relativeDir === '.' || top === 'Books';
};

const markdownFiles = allFiles
  .filter(f => f.endsWith('.md') && !f.includes('node_modules') && !f.includes('.github') && f !== './README.md' && !isExcludedTopLevel(f))
  .sort();

const excalidrawFiles = allFiles
  .filter(f => f.endsWith('.excalidraw') && !f.includes('node_modules') && !isExcludedTopLevel(f))
  .sort();

// ─── File Organization ──────────────────────────────────────────────────────

function getFilesByFolder() {
  const folders = {};
  markdownFiles.forEach(f => {
    const dir = path.dirname(f).replace(/^\.\//, '');
    if (!folders[dir]) folders[dir] = { markdown: [], excalidraw: [] };
    folders[dir].markdown.push(f);
  });
  excalidrawFiles.forEach(f => {
    const dir = path.dirname(f).replace(/^\.\//, '');
    if (!folders[dir]) folders[dir] = { markdown: [], excalidraw: [] };
    folders[dir].excalidraw.push(f);
  });
  return folders;
}

const filesByFolder = getFilesByFolder();

// Build ordered list of all pages for prev/next navigation
const allPages = [];
const folderNames = Object.keys(filesByFolder).sort((a, b) => {
  if (a === 'Notes' && b !== 'Notes') return -1;
  if (b === 'Notes' && a !== 'Notes') return 1;
  return a.localeCompare(b);
});

folderNames.forEach(folder => {
  const { markdown, excalidraw } = filesByFolder[folder];
  markdown.sort((a, b) => path.basename(a, '.md').localeCompare(path.basename(b, '.md')));
  excalidraw.sort((a, b) => path.basename(a, '.excalidraw').localeCompare(path.basename(b, '.excalidraw')));
  markdown.forEach(f => allPages.push({ file: f, type: 'md', name: path.basename(f, '.md'), folder, htmlFile: toHtmlFileName(f, '.md') }));
  excalidraw.forEach(f => allPages.push({ file: f, type: 'excalidraw', name: path.basename(f, '.excalidraw'), folder, htmlFile: toHtmlFileName(f, '.excalidraw') }));
});

function buildFolderTree() {
  const root = { name: 'Root', children: new Map(), files: { markdown: [], excalidraw: [] } };
  Object.entries(filesByFolder).forEach(([folder, files]) => {
    const parts = folder.split('/').filter(Boolean);
    let node = root;
    parts.forEach(part => {
      if (!node.children.has(part)) node.children.set(part, { name: part, children: new Map(), files: { markdown: [], excalidraw: [] } });
      node = node.children.get(part);
    });
    node.files.markdown.push(...files.markdown);
    node.files.excalidraw.push(...files.excalidraw);
  });
  return root;
}

// ─── Category metadata for dashboard ────────────────────────────────────────

const categoryMeta = {
  'Notes': { icon: 'book-open', color: '#6366f1', desc: 'Deep-dive study notes on databases, streaming, caching, and more' },
  'Foundational': { icon: 'layers', color: '#14b8a6', desc: 'Core building blocks: URL shorteners, rate limiters, load balancers' },
  'Content Delivery': { icon: 'globe', color: '#f59e0b', desc: 'CDN, media streaming, and content distribution systems' },
  'Social': { icon: 'message-circle', color: '#ec4899', desc: 'Chat, feeds, notifications, and social graph systems' },
  'Search': { icon: 'search', color: '#8b5cf6', desc: 'Search engines, recommendations, and discovery systems' },
  'Storage': { icon: 'database', color: '#06b6d4', desc: 'Distributed storage, key-value stores, file systems' },
  'Scalability': { icon: 'trending-up', color: '#10b981', desc: 'Scaling patterns, reliability, and fault tolerance' },
  'Analytics': { icon: 'bar-chart-2', color: '#f97316', desc: 'Data pipelines, streaming analytics, and real-time processing' },
  'Security': { icon: 'shield', color: '#ef4444', desc: 'Authentication, authorization, and security patterns' },
  'DevOps': { icon: 'terminal', color: '#64748b', desc: 'CI/CD, job schedulers, cloud infrastructure' },
  'Hybrid': { icon: 'cpu', color: '#a855f7', desc: 'AI-augmented and hybrid system designs' },
  'Deployment': { icon: 'upload-cloud', color: '#0ea5e9', desc: 'Blue-green, canary, and rolling deployment strategies' },
  'AI Design': { icon: 'brain', color: '#d946ef', desc: 'ML pipelines, inference, and AI system patterns' },
  'High Performance': { icon: 'zap', color: '#eab308', desc: 'HPC, low-latency, and high-throughput systems' },
};

function getCategoryInfo(folderName) {
  for (const [key, meta] of Object.entries(categoryMeta)) {
    if (folderName.toLowerCase().includes(key.toLowerCase())) return meta;
  }
  return { icon: 'folder', color: '#64748b', desc: 'System design topics' };
}

// ─── CSS Design System ──────────────────────────────────────────────────────

const globalStyles = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  --bg: #ffffff;
  --bg-secondary: #f8fafc;
  --bg-tertiary: #f1f5f9;
  --text: #1e293b;
  --text-secondary: #475569;
  --text-muted: #94a3b8;
  --border: #e2e8f0;
  --border-light: #f1f5f9;
  --accent: #6366f1;
  --accent-light: #818cf8;
  --accent-bg: rgba(99, 102, 241, 0.08);
  --accent-border: rgba(99, 102, 241, 0.2);
  --teal: #14b8a6;
  --teal-bg: rgba(20, 184, 166, 0.08);
  --amber: #f59e0b;
  --sidebar-bg: #fafbfc;
  --sidebar-width: 300px;
  --content-max: 860px;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.08);
  --shadow-lg: 0 12px 32px rgba(0,0,0,0.1);
  --radius: 8px;
  --radius-lg: 12px;
}

[data-theme="dark"] {
  --bg: #0f172a;
  --bg-secondary: #1e293b;
  --bg-tertiary: #334155;
  --text: #e2e8f0;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
  --border: #334155;
  --border-light: #1e293b;
  --accent: #818cf8;
  --accent-light: #a5b4fc;
  --accent-bg: rgba(129, 140, 248, 0.12);
  --accent-border: rgba(129, 140, 248, 0.25);
  --teal: #2dd4bf;
  --teal-bg: rgba(45, 212, 191, 0.1);
  --amber: #fbbf24;
  --sidebar-bg: #0f172a;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.2);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.3);
  --shadow-lg: 0 12px 32px rgba(0,0,0,0.4);
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  line-height: 1.65;
  color: var(--text);
  background: var(--bg);
  display: flex;
  min-height: 100vh;
  transition: background 0.3s, color 0.3s;
}

/* ── Reading Progress Bar ── */
.progress-bar {
  position: fixed; top: 0; left: 0; right: 0; height: 3px; z-index: 200;
  background: transparent;
}
.progress-bar .progress-fill {
  height: 100%; width: 0%;
  background: linear-gradient(90deg, var(--accent), var(--teal));
  transition: width 0.1s linear;
}

/* ── Sidebar ── */
.sidebar {
  position: fixed; left: 0; top: 0; width: var(--sidebar-width); height: 100vh;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--border);
  display: flex; flex-direction: column; z-index: 100;
  transition: background 0.3s, border-color 0.3s;
}

.nav-header {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;
}

.nav-brand {
  color: var(--text); text-decoration: none;
  font-size: 0.95rem; font-weight: 700; letter-spacing: -0.3px;
}
.nav-brand:hover { color: var(--accent); }

.nav-actions {
  display: flex; align-items: center; gap: 0.4rem;
}

.theme-toggle, .nav-close {
  background: var(--bg-secondary); border: 1px solid var(--border);
  color: var(--text-secondary); border-radius: 6px;
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; font-size: 0.85rem;
  transition: all 0.2s;
}
.theme-toggle:hover, .nav-close:hover {
  background: var(--accent-bg); border-color: var(--accent-border); color: var(--accent);
}
.nav-close { display: none; }

.nav-tools {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border);
}

.search-wrapper {
  position: relative;
}

.search-wrapper input {
  width: 100%; border-radius: var(--radius);
  border: 1px solid var(--border); background: var(--bg);
  padding: 0.5rem 0.75rem 0.5rem 2rem;
  font-size: 0.85rem; color: var(--text);
  transition: border-color 0.2s, box-shadow 0.2s;
}
.search-wrapper input:focus {
  outline: none; border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-bg);
}
.search-wrapper::before {
  content: '\\2315'; position: absolute; left: 0.65rem; top: 50%;
  transform: translateY(-50%); color: var(--text-muted); font-size: 0.85rem;
  pointer-events: none;
}

.search-kbd {
  position: absolute; right: 0.5rem; top: 50%; transform: translateY(-50%);
  background: var(--bg-tertiary); border: 1px solid var(--border);
  border-radius: 4px; padding: 0.1rem 0.35rem;
  font-size: 0.7rem; color: var(--text-muted); font-family: inherit;
  pointer-events: none;
}

.search-results {
  position: absolute; top: calc(100% + 4px); left: 0; right: 0;
  background: var(--bg); border: 1px solid var(--border);
  border-radius: var(--radius); box-shadow: var(--shadow-lg);
  max-height: 400px; overflow-y: auto; z-index: 200; display: none;
}
.search-results.is-open { display: block; }

.search-result-item {
  display: block; padding: 0.6rem 0.75rem;
  text-decoration: none; color: var(--text);
  border-bottom: 1px solid var(--border-light);
  transition: background 0.15s;
}
.search-result-item:hover, .search-result-item.is-focused {
  background: var(--accent-bg);
}
.search-result-item .sr-title {
  font-size: 0.85rem; font-weight: 500;
}
.search-result-item .sr-folder {
  font-size: 0.72rem; color: var(--text-muted); margin-top: 1px;
}
.search-result-item .sr-snippet {
  font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;
}
.search-result-item .sr-snippet mark {
  background: rgba(245, 158, 11, 0.3); color: inherit; border-radius: 2px; padding: 0 1px;
}

.nav-scroll {
  overflow-y: auto; flex: 1; padding-bottom: 2rem;
}

.nav-section-label {
  padding: 0.75rem 1.15rem 0.35rem;
  font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.1em;
  font-weight: 600; color: var(--text-muted);
}

.nav-folder { margin-bottom: 0.15rem; }

.nav-folder summary {
  padding: 0.45rem 1.15rem; font-weight: 600;
  color: var(--text-secondary); font-size: 0.78rem;
  cursor: pointer; list-style: none;
  display: flex; align-items: center; gap: 0.4rem;
  transition: color 0.15s;
}
.nav-folder summary:hover { color: var(--accent); }
.nav-folder summary::-webkit-details-marker { display: none; }

.nav-folder summary .folder-chevron {
  font-size: 0.6rem; transition: transform 0.2s; color: var(--text-muted);
}
.nav-folder[open] summary .folder-chevron { transform: rotate(90deg); }

.nav-folder-body { padding-left: 0.25rem; }

.nav-item {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.35rem 0.75rem 0.35rem 1.5rem;
  color: var(--text-secondary); text-decoration: none;
  font-size: 0.82rem; border-radius: 6px;
  margin: 1px 0.5rem; transition: all 0.15s;
}
.nav-item:hover {
  background: var(--accent-bg); color: var(--text);
}
.nav-item.is-active {
  background: var(--accent-bg); color: var(--accent);
  font-weight: 600;
}
.nav-item .nav-icon {
  font-size: 0.7rem; opacity: 0.7; flex-shrink: 0;
}

.nav-folder.is-hidden, .nav-item.is-hidden { display: none; }

/* ── Main Content ── */
.main-content {
  margin-left: var(--sidebar-width); flex: 1; min-height: 100vh;
  transition: margin-left 0.3s;
}

/* ── Page Header ── */
.page-header {
  padding: 1.5rem 2rem 1rem;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}
.breadcrumb {
  display: flex; align-items: center; gap: 0.35rem;
  font-size: 0.78rem; color: var(--text-muted); margin-bottom: 0.5rem;
  flex-wrap: wrap;
}
.breadcrumb a { color: var(--text-muted); text-decoration: none; }
.breadcrumb a:hover { color: var(--accent); }
.breadcrumb .bc-sep { opacity: 0.5; }

.page-header h1 {
  font-size: 1.75rem; font-weight: 700; color: var(--text);
  letter-spacing: -0.5px; line-height: 1.3;
}

/* ── Content Area with optional TOC ── */
.content-layout {
  display: flex; max-width: 1200px; margin: 0 auto; padding: 0 2rem;
}

.content-body {
  flex: 1; min-width: 0; max-width: var(--content-max);
  padding: 2rem 0;
}

/* ── Table of Contents ── */
.toc-sidebar {
  width: 220px; flex-shrink: 0;
  padding: 2rem 0 2rem 2rem;
  position: sticky; top: 1rem; align-self: flex-start;
  max-height: calc(100vh - 2rem); overflow-y: auto;
}
.toc-sidebar nav {
  border-left: 2px solid var(--border);
  padding-left: 1rem;
}
.toc-sidebar .toc-title {
  font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em;
  font-weight: 600; color: var(--text-muted); margin-bottom: 0.75rem;
}
.toc-sidebar a {
  display: block; font-size: 0.78rem; color: var(--text-muted);
  text-decoration: none; padding: 0.2rem 0; line-height: 1.4;
  transition: color 0.15s;
}
.toc-sidebar a:hover { color: var(--accent); }
.toc-sidebar a.is-active {
  color: var(--accent); font-weight: 500;
}
.toc-sidebar a.toc-h3 { padding-left: 0.75rem; font-size: 0.74rem; }

/* ── Article Typography ── */
.content-body h1 { font-size: 1.75rem; margin-top: 2rem; margin-bottom: 0.75rem; color: var(--text); border-bottom: 2px solid var(--accent-border); padding-bottom: 0.5rem; }
.content-body h2 { font-size: 1.35rem; margin-top: 2rem; margin-bottom: 0.6rem; color: var(--text); padding-top: 0.5rem; }
.content-body h3 { font-size: 1.1rem; margin-top: 1.5rem; margin-bottom: 0.5rem; color: var(--text); }
.content-body h4 { font-size: 0.95rem; margin-top: 1.25rem; margin-bottom: 0.4rem; color: var(--text-secondary); }

.content-body p { margin-bottom: 1rem; color: var(--text-secondary); line-height: 1.75; }
.content-body a { color: var(--accent); text-decoration: none; border-bottom: 1px solid transparent; transition: border-color 0.15s; }
.content-body a:hover { border-bottom-color: var(--accent); }

.content-body code {
  background: var(--bg-tertiary); padding: 0.15rem 0.4rem;
  border-radius: 4px; font-family: 'JetBrains Mono', monospace;
  font-size: 0.85em; color: var(--accent);
}

.content-body pre {
  background: #1e1e2e; color: #cdd6f4;
  padding: 1.25rem; border-radius: var(--radius-lg);
  overflow-x: auto; margin: 1.25rem 0;
  font-size: 0.85rem; line-height: 1.6;
  border: 1px solid rgba(255,255,255,0.06);
}
.content-body pre code {
  background: none; color: inherit; padding: 0;
  font-size: inherit; border-radius: 0;
}

.content-body .table-wrap { overflow-x: auto; margin: 1rem 0; }
.content-body table { border-collapse: collapse; width: 100%; font-size: 0.9rem; }
.content-body table th, .content-body table td {
  border: 1px solid var(--border); padding: 0.6rem 0.8rem; text-align: left;
}
.content-body table th { background: var(--bg-tertiary); font-weight: 600; color: var(--text); font-size: 0.85rem; }
.content-body table tr:nth-child(even) { background: var(--bg-secondary); }

.content-body ul, .content-body ol { margin-left: 1.5rem; margin-bottom: 1rem; color: var(--text-secondary); }
.content-body li { margin-bottom: 0.35rem; line-height: 1.7; }

.content-body blockquote {
  border-left: 3px solid var(--accent); padding: 0.75rem 1rem;
  margin: 1rem 0; background: var(--accent-bg); border-radius: 0 var(--radius) var(--radius) 0;
}
.content-body blockquote p { color: var(--text-secondary); margin-bottom: 0.5rem; }
.content-body blockquote p:last-child { margin-bottom: 0; }

.content-body hr { border: 0; border-top: 1px solid var(--border); margin: 2rem 0; }

.content-body img { max-width: 100%; height: auto; border-radius: var(--radius); margin: 1rem 0; }

.content-body details { margin: 1rem 0; border: 1px solid var(--border); border-radius: var(--radius); }
.content-body summary {
  cursor: pointer; padding: 0.75rem 1rem; background: var(--bg-secondary);
  border-radius: var(--radius); font-weight: 600; color: var(--accent);
  user-select: none; font-size: 0.9rem;
}
.content-body details[open] summary { border-radius: var(--radius) var(--radius) 0 0; border-bottom: 1px solid var(--border); }
.content-body summary:hover { background: var(--accent-bg); }

/* ── Diagram Container ── */
.diagram-container {
  background: var(--bg-secondary); padding: 1.5rem; border-radius: var(--radius-lg);
  margin: 1rem 0; border: 1px solid var(--border);
}
.diagram-info {
  background: var(--accent-bg); padding: 1rem 1.25rem; border-left: 3px solid var(--accent);
  margin-bottom: 1.5rem; border-radius: 0 var(--radius) var(--radius) 0;
  font-size: 0.9rem; color: var(--text-secondary);
}
.diagram-preview {
  background: var(--bg); padding: 1rem; border-radius: var(--radius);
  margin-bottom: 1rem; text-align: center; border: 1px solid var(--border);
  overflow: hidden; position: relative; min-height: 200px;
}
.diagram-preview svg, .diagram-preview img { max-width: 100%; height: auto; display: block; margin: 0 auto; }

.diagram-viewer-container {
  width: 100%; height: 600px; border-radius: var(--radius);
  border: 1px solid var(--border); overflow: hidden; background: #fff;
}

.diagram-tabs {
  display: flex; gap: 0.5rem; margin-bottom: 1rem;
}
.diagram-tab {
  padding: 0.45rem 1rem; border-radius: 6px; border: 1px solid var(--border);
  background: var(--bg); color: var(--text-secondary); cursor: pointer;
  font-size: 0.82rem; font-weight: 500; transition: all 0.15s;
}
.diagram-tab:hover { border-color: var(--accent-border); color: var(--accent); }
.diagram-tab.active { background: var(--accent); color: #fff; border-color: var(--accent); }

.diagram-json {
  background: #1e1e2e; color: #cdd6f4; padding: 1rem;
  border-radius: var(--radius); max-height: 400px; overflow-y: auto;
  font-family: 'JetBrains Mono', monospace; font-size: 0.8rem;
  white-space: pre-wrap; word-break: break-all;
}

/* ── Prev/Next Navigation ── */
.page-nav {
  display: flex; gap: 1rem; padding: 2rem 0;
  border-top: 1px solid var(--border); margin-top: 2rem;
}
.page-nav a {
  flex: 1; padding: 1rem; border: 1px solid var(--border);
  border-radius: var(--radius); text-decoration: none;
  color: var(--text); transition: all 0.2s;
}
.page-nav a:hover { border-color: var(--accent-border); background: var(--accent-bg); }
.page-nav .nav-label { font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
.page-nav .nav-title { font-size: 0.9rem; font-weight: 500; margin-top: 0.15rem; }
.page-nav .nav-next { text-align: right; }

/* ── Back to Top ── */
.back-to-top {
  position: fixed; bottom: 2rem; right: 2rem;
  width: 40px; height: 40px; border-radius: 50%;
  background: var(--accent); color: #fff; border: none;
  font-size: 1.1rem; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  box-shadow: var(--shadow-md); transition: all 0.2s;
  opacity: 0; pointer-events: none; z-index: 50;
}
.back-to-top.is-visible { opacity: 1; pointer-events: auto; }
.back-to-top:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); }

/* ── Dashboard / Homepage ── */
.dashboard { padding: 2rem; max-width: 1100px; margin: 0 auto; }

.dash-hero {
  text-align: center; padding: 3rem 1rem 2rem;
}
.dash-hero h1 {
  font-size: 2.25rem; font-weight: 700; color: var(--text);
  letter-spacing: -0.5px; margin-bottom: 0.5rem;
}
.dash-hero p { color: var(--text-secondary); font-size: 1.05rem; max-width: 600px; margin: 0 auto; }

.dash-stats {
  display: flex; justify-content: center; gap: 2rem;
  margin: 1.5rem 0 2.5rem; flex-wrap: wrap;
}
.dash-stat {
  text-align: center; padding: 0.75rem 1.5rem;
  background: var(--bg-secondary); border: 1px solid var(--border);
  border-radius: var(--radius); min-width: 120px;
}
.dash-stat .stat-num { font-size: 1.5rem; font-weight: 700; color: var(--accent); }
.dash-stat .stat-label { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }

.dash-section-title {
  font-size: 1.1rem; font-weight: 600; color: var(--text);
  margin: 2rem 0 1rem; padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--border);
}

.category-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

.category-card {
  border: 1px solid var(--border); border-radius: var(--radius-lg);
  padding: 1.25rem; background: var(--bg);
  transition: all 0.2s; cursor: default;
}
.category-card:hover {
  border-color: var(--accent-border); box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}
.category-card .cc-header {
  display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.5rem;
}
.category-card .cc-icon {
  width: 36px; height: 36px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 1rem; color: #fff; flex-shrink: 0;
}
.category-card .cc-name { font-size: 0.95rem; font-weight: 600; color: var(--text); }
.category-card .cc-desc { font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.75rem; line-height: 1.45; }
.category-card .cc-links {
  display: flex; flex-wrap: wrap; gap: 0.35rem;
}
.category-card .cc-links a {
  font-size: 0.75rem; padding: 0.2rem 0.5rem;
  background: var(--bg-secondary); border: 1px solid var(--border);
  border-radius: 4px; color: var(--text-secondary);
  text-decoration: none; transition: all 0.15s;
}
.category-card .cc-links a:hover {
  background: var(--accent-bg); border-color: var(--accent-border); color: var(--accent);
}

/* ── Footer ── */
footer {
  text-align: center; padding: 2rem;
  border-top: 1px solid var(--border);
  color: var(--text-muted); font-size: 0.8rem;
  margin-top: 3rem;
}

/* ── Mobile Overlay ── */
.nav-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4);
  opacity: 0; pointer-events: none; transition: opacity 0.2s; z-index: 90;
}
body.nav-open .nav-overlay { opacity: 1; pointer-events: auto; }

.nav-toggle {
  display: none; background: var(--bg-secondary); border: 1px solid var(--border);
  color: var(--text-secondary); border-radius: 6px;
  padding: 0.4rem 0.75rem; cursor: pointer; font-size: 0.82rem; font-weight: 500;
}

/* ── Keyboard shortcut hint ── */
.kbd-hint {
  position: fixed; bottom: 1rem; left: calc(var(--sidebar-width) + 1rem);
  background: var(--bg-secondary); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 0.5rem 0.75rem;
  font-size: 0.72rem; color: var(--text-muted);
  display: flex; gap: 1rem; z-index: 10;
  opacity: 0.7; transition: opacity 0.2s;
}
.kbd-hint:hover { opacity: 1; }
.kbd-hint kbd {
  background: var(--bg-tertiary); border: 1px solid var(--border);
  border-radius: 3px; padding: 0 0.3rem; font-family: inherit;
  font-size: 0.7rem;
}

@media (max-width: 1100px) {
  .toc-sidebar { display: none; }
  .kbd-hint { display: none; }
}

@media (max-width: 768px) {
  .sidebar {
    width: min(85vw, 320px);
    transform: translateX(-105%);
    transition: transform 0.25s ease;
  }
  body.nav-open .sidebar { transform: translateX(0); }
  .nav-close { display: flex; }
  .nav-toggle { display: inline-flex; }
  .main-content { margin-left: 0; }
  .page-header { padding: 1rem; }
  .page-header h1 { font-size: 1.35rem; }
  .content-layout { padding: 0 1rem; }
  .content-body { padding: 1rem 0; }
  .dashboard { padding: 1rem; }
  .dash-hero h1 { font-size: 1.5rem; }
  .category-grid { grid-template-columns: 1fr; }
  .page-nav { flex-direction: column; }
  .kbd-hint { display: none; }
}
`;

// ─── SVG Icons (Feather-style, inline) ──────────────────────────────────────

const icons = {
  sun: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
  moon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
  up: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>',
};

// ─── Navigation Generator ───────────────────────────────────────────────────

function generateNav() {
  const tree = buildFolderTree();

  function renderFolder(node, depth = 0) {
    let html = '';
    const childNames = Array.from(node.children.keys()).sort((a, b) => {
      if (depth === 0) {
        if (a === 'Notes' && b !== 'Notes') return -1;
        if (b === 'Notes' && a !== 'Notes') return 1;
      }
      return a.localeCompare(b);
    });

    childNames.forEach(name => {
      const child = node.children.get(name);
      const hasContent = child.files.markdown.length + child.files.excalidraw.length + child.children.size > 0;
      if (!hasContent) return;

      html += `<details class="nav-folder" data-depth="${depth}">`;
      html += `<summary><span class="folder-chevron">&#9654;</span> ${escapeHtml(name)}</summary>`;
      html += '<div class="nav-folder-body">';

      child.files.markdown.slice().sort((a, b) => path.basename(a, '.md').localeCompare(path.basename(b, '.md'))).forEach(f => {
        const itemName = path.basename(f, '.md');
        const htmlFile = toHtmlFileName(f, '.md');
        html += `<a href="${safeHref(htmlFile)}" class="nav-item"><span class="nav-icon">&#128196;</span> ${escapeHtml(itemName)}</a>`;
      });

      child.files.excalidraw.slice().sort((a, b) => path.basename(a, '.excalidraw').localeCompare(path.basename(b, '.excalidraw'))).forEach(f => {
        const itemName = path.basename(f, '.excalidraw');
        const htmlFile = toHtmlFileName(f, '.excalidraw');
        html += `<a href="${safeHref(htmlFile)}" class="nav-item"><span class="nav-icon">&#128202;</span> ${escapeHtml(itemName)}</a>`;
      });

      html += renderFolder(child, depth + 1);
      html += '</div></details>';
    });

    return html;
  }

  let nav = '<nav class="sidebar" aria-label="Sidebar navigation">';
  nav += `<div class="nav-header"><a class="nav-brand" href="${safeHref('index.html')}">System Design Ultimatum</a>`;
  nav += '<div class="nav-actions">';
  nav += `<button class="theme-toggle" type="button" aria-label="Toggle dark mode" title="Toggle dark mode">${icons.moon}</button>`;
  nav += '<button class="nav-close" type="button" aria-label="Close navigation">&#10005;</button>';
  nav += '</div></div>';
  nav += '<div class="nav-tools"><div class="search-wrapper"><input id="nav-search" type="search" placeholder="Search topics..." aria-label="Search" autocomplete="off"><span class="search-kbd">/</span></div>';
  nav += '<div class="search-results" id="search-results"></div></div>';
  nav += '<div class="nav-scroll"><div class="nav-content">';
  nav += '<div class="nav-section-label">Study Notes</div>';
  // Render Notes folder first
  const notesNode = buildFolderTree().children.get('Notes');
  if (notesNode) {
    notesNode.files.markdown.slice().sort((a, b) => path.basename(a, '.md').localeCompare(path.basename(b, '.md'))).forEach(f => {
      const itemName = path.basename(f, '.md');
      const htmlFile = toHtmlFileName(f, '.md');
      nav += `<a href="${safeHref(htmlFile)}" class="nav-item"><span class="nav-icon">&#128196;</span> ${escapeHtml(itemName)}</a>`;
    });
  }
  nav += '<div class="nav-section-label" style="margin-top:0.5rem">System Designs</div>';
  // Render all other folders
  const treeRoot = buildFolderTree();
  Array.from(treeRoot.children.keys()).sort((a, b) => a.localeCompare(b)).forEach(name => {
    if (name === 'Notes') return;
    const child = treeRoot.children.get(name);
    const hasContent = child.files.markdown.length + child.files.excalidraw.length + child.children.size > 0;
    if (!hasContent) return;

    nav += `<details class="nav-folder">`;
    nav += `<summary><span class="folder-chevron">&#9654;</span> ${escapeHtml(name)}</summary>`;
    nav += '<div class="nav-folder-body">';

    child.files.markdown.slice().sort((a, b) => path.basename(a, '.md').localeCompare(path.basename(b, '.md'))).forEach(f => {
      const itemName = path.basename(f, '.md');
      const htmlFile = toHtmlFileName(f, '.md');
      nav += `<a href="${safeHref(htmlFile)}" class="nav-item"><span class="nav-icon">&#128196;</span> ${escapeHtml(itemName)}</a>`;
    });

    child.files.excalidraw.slice().sort((a, b) => path.basename(a, '.excalidraw').localeCompare(path.basename(b, '.excalidraw'))).forEach(f => {
      const itemName = path.basename(f, '.excalidraw');
      const htmlFile = toHtmlFileName(f, '.excalidraw');
      nav += `<a href="${safeHref(htmlFile)}" class="nav-item"><span class="nav-icon">&#128202;</span> ${escapeHtml(itemName)}</a>`;
    });

    // Render sub-folders
    function renderSubFolders(parentNode) {
      let subHtml = '';
      Array.from(parentNode.children.keys()).sort().forEach(subName => {
        const subChild = parentNode.children.get(subName);
        const subHasContent = subChild.files.markdown.length + subChild.files.excalidraw.length + subChild.children.size > 0;
        if (!subHasContent) return;
        subHtml += `<details class="nav-folder"><summary><span class="folder-chevron">&#9654;</span> ${escapeHtml(subName)}</summary><div class="nav-folder-body">`;
        subChild.files.markdown.slice().sort((a, b) => path.basename(a, '.md').localeCompare(path.basename(b, '.md'))).forEach(f => {
          subHtml += `<a href="${safeHref(toHtmlFileName(f, '.md'))}" class="nav-item"><span class="nav-icon">&#128196;</span> ${escapeHtml(path.basename(f, '.md'))}</a>`;
        });
        subChild.files.excalidraw.slice().sort((a, b) => path.basename(a, '.excalidraw').localeCompare(path.basename(b, '.excalidraw'))).forEach(f => {
          subHtml += `<a href="${safeHref(toHtmlFileName(f, '.excalidraw'))}" class="nav-item"><span class="nav-icon">&#128202;</span> ${escapeHtml(path.basename(f, '.excalidraw'))}</a>`;
        });
        subHtml += renderSubFolders(subChild);
        subHtml += '</div></details>';
      });
      return subHtml;
    }
    nav += renderSubFolders(child);
    nav += '</div></details>';
  });

  nav += '</div></div></nav>';
  return nav;
}

// ─── TOC Generator ──────────────────────────────────────────────────────────

function generateTocHtml(headings) {
  const filtered = headings.filter(h => h.level === 2 || h.level === 3);
  if (filtered.length < 3) return '';

  let html = '<aside class="toc-sidebar"><nav><div class="toc-title">On this page</div>';
  filtered.forEach(h => {
    const cls = h.level === 3 ? ' class="toc-h3"' : '';
    html += `<a href="#${escapeHtml(h.id)}" data-toc-link${cls}>${escapeHtml(h.text)}</a>`;
  });
  html += '</nav></aside>';
  return html;
}

// ─── Prev/Next Navigation ───────────────────────────────────────────────────

function generatePrevNext(currentHtmlFile) {
  const idx = allPages.findIndex(p => p.htmlFile === currentHtmlFile);
  if (idx === -1) return '';

  const prev = idx > 0 ? allPages[idx - 1] : null;
  const next = idx < allPages.length - 1 ? allPages[idx + 1] : null;

  if (!prev && !next) return '';

  let html = '<div class="page-nav">';
  if (prev) {
    html += `<a href="${safeHref(prev.htmlFile)}"><div class="nav-label">Previous</div><div class="nav-title">${escapeHtml(prev.name)}</div></a>`;
  } else {
    html += '<span></span>';
  }
  if (next) {
    html += `<a href="${safeHref(next.htmlFile)}" class="nav-next"><div class="nav-label">Next</div><div class="nav-title">${escapeHtml(next.name)}</div></a>`;
  }
  html += '</div>';
  return html;
}

// ─── Breadcrumb Generator ───────────────────────────────────────────────────

function generateBreadcrumb(folder, name) {
  let html = '<div class="breadcrumb">';
  html += `<a href="index.html">Home</a><span class="bc-sep">/</span>`;
  if (folder && folder !== '.') {
    html += `<span>${escapeHtml(folder)}</span><span class="bc-sep">/</span>`;
  }
  html += `<span>${escapeHtml(name)}</span>`;
  html += '</div>';
  return html;
}

// ─── Client-side JavaScript ─────────────────────────────────────────────────

const clientScript = `
<script>
(() => {
  // ── Dark Mode ──
  const theme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', theme);

  const themeBtn = document.querySelector('.theme-toggle');
  if (themeBtn) {
    const updateIcon = () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      themeBtn.innerHTML = isDark ? '${icons.sun.replace(/'/g, "\\'")}' : '${icons.moon.replace(/'/g, "\\'")}';
    };
    updateIcon();
    themeBtn.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      updateIcon();
    });
  }

  // ── Mobile Nav ──
  const navToggle = document.querySelector('.nav-toggle');
  const navClose = document.querySelector('.nav-close');
  const overlay = document.querySelector('.nav-overlay');
  const setNavOpen = (open) => document.body.classList.toggle('nav-open', open);
  if (navToggle) navToggle.addEventListener('click', () => setNavOpen(true));
  if (navClose) navClose.addEventListener('click', () => setNavOpen(false));
  if (overlay) overlay.addEventListener('click', () => setNavOpen(false));

  // ── Active Nav + Auto-expand ──
  const navItems = Array.from(document.querySelectorAll('.nav-item'));
  const folders = Array.from(document.querySelectorAll('.nav-folder'));
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';

  navItems.forEach(item => {
    const href = decodeURIComponent(item.getAttribute('href'));
    if (href === currentPage || href === decodeURIComponent(currentPage)) {
      item.classList.add('is-active');
      let parent = item.closest('.nav-folder');
      while (parent) { parent.open = true; parent = parent.parentElement?.closest('.nav-folder'); }
    }
  });

  // Remember initial open state for search reset
  folders.forEach(f => { if (f.hasAttribute('open')) f.dataset.initialOpen = 'true'; });

  // ── Search ──
  const searchInput = document.querySelector('#nav-search');
  const searchResults = document.querySelector('#search-results');
  let searchIndex = null;
  let focusedIdx = -1;

  async function loadSearchIndex() {
    if (searchIndex) return searchIndex;
    try {
      const res = await fetch('search-index.json');
      searchIndex = await res.json();
    } catch { searchIndex = []; }
    return searchIndex;
  }

  function renderSearchResults(results) {
    if (!results.length) { searchResults.classList.remove('is-open'); return; }
    searchResults.innerHTML = results.slice(0, 12).map((r, i) =>
      '<a class="search-result-item' + (i === 0 ? ' is-focused' : '') + '" href="' + r.href + '">' +
      '<div class="sr-title">' + r.name + '</div>' +
      '<div class="sr-folder">' + r.folder + '</div>' +
      (r.snippet ? '<div class="sr-snippet">' + r.snippet + '</div>' : '') +
      '</a>'
    ).join('');
    searchResults.classList.add('is-open');
    focusedIdx = 0;
  }

  if (searchInput) {
    let debounce = null;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounce);
      const q = searchInput.value.trim().toLowerCase();
      if (!q) {
        searchResults.classList.remove('is-open');
        // Reset nav filter
        navItems.forEach(i => i.classList.remove('is-hidden'));
        folders.forEach(f => { f.classList.remove('is-hidden'); f.open = f.dataset.initialOpen === 'true'; });
        return;
      }
      // Filter nav items
      navItems.forEach(i => i.classList.toggle('is-hidden', !i.textContent.toLowerCase().includes(q)));
      folders.forEach(f => {
        const has = f.querySelector('.nav-item:not(.is-hidden)');
        f.classList.toggle('is-hidden', !has);
        if (has) f.open = true;
      });
      // Full-text search with debounce
      debounce = setTimeout(async () => {
        const index = await loadSearchIndex();
        const results = index.filter(item =>
          item.name.toLowerCase().includes(q) || (item.text && item.text.toLowerCase().includes(q))
        ).map(item => {
          let snippet = '';
          if (item.text) {
            const idx = item.text.toLowerCase().indexOf(q);
            if (idx !== -1) {
              const start = Math.max(0, idx - 40);
              const end = Math.min(item.text.length, idx + q.length + 40);
              snippet = (start > 0 ? '...' : '') +
                item.text.substring(start, idx) +
                '<mark>' + item.text.substring(idx, idx + q.length) + '</mark>' +
                item.text.substring(idx + q.length, end) +
                (end < item.text.length ? '...' : '');
            }
          }
          return { ...item, snippet };
        });
        renderSearchResults(results);
      }, 200);
    });

    searchInput.addEventListener('keydown', (e) => {
      const items = searchResults.querySelectorAll('.search-result-item');
      if (!items.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); focusedIdx = Math.min(focusedIdx + 1, items.length - 1); items.forEach((it, i) => it.classList.toggle('is-focused', i === focusedIdx)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); focusedIdx = Math.max(focusedIdx - 1, 0); items.forEach((it, i) => it.classList.toggle('is-focused', i === focusedIdx)); }
      if (e.key === 'Enter' && focusedIdx >= 0) { e.preventDefault(); items[focusedIdx].click(); }
      if (e.key === 'Escape') { searchResults.classList.remove('is-open'); searchInput.blur(); }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.nav-tools')) searchResults.classList.remove('is-open');
    });
  }

  // ── Reading Progress Bar ──
  const progressFill = document.querySelector('.progress-fill');
  if (progressFill) {
    window.addEventListener('scroll', () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docHeight > 0 ? Math.min((scrollTop / docHeight) * 100, 100) : 0;
      progressFill.style.width = pct + '%';
    }, { passive: true });
  }

  // ── Scroll Spy for TOC ──
  const tocLinks = Array.from(document.querySelectorAll('[data-toc-link]'));
  if (tocLinks.length) {
    const headingIds = tocLinks.map(a => a.getAttribute('href').slice(1));
    const headingEls = headingIds.map(id => document.getElementById(id)).filter(Boolean);

    const onScroll = () => {
      let activeId = headingIds[0];
      for (const el of headingEls) {
        if (el.getBoundingClientRect().top <= 100) activeId = el.id;
      }
      tocLinks.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === '#' + activeId));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ── Back to Top ──
  const backToTop = document.querySelector('.back-to-top');
  if (backToTop) {
    window.addEventListener('scroll', () => {
      backToTop.classList.toggle('is-visible', window.scrollY > 400);
    }, { passive: true });
    backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  // ── Keyboard Shortcuts ──
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
    if (e.key === '/') { e.preventDefault(); searchInput?.focus(); }
    if (e.key === 'n') { const next = document.querySelector('.page-nav .nav-next'); if (next) next.click(); }
    if (e.key === 'p') { const prev = document.querySelector('.page-nav a:not(.nav-next)'); if (prev) prev.click(); }
    if (e.key === 't') {
      const toc = document.querySelector('.toc-sidebar');
      if (toc) toc.style.display = toc.style.display === 'none' ? '' : 'none';
    }
  });
})();
</script>`;

// ─── Page Template ──────────────────────────────────────────────────────────

function generatePageTemplate(title, content, { toc = '', breadcrumb = '', prevNext = '', isHome = false } = {}) {
  const safeTitle = escapeHtml(title);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle} - System Design Ultimatum</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <style>${globalStyles}</style>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-tomorrow.min.css">
</head>
<body>
<div class="progress-bar"><div class="progress-fill"></div></div>
${generateNav()}
<div class="nav-overlay" data-nav-overlay></div>
<div class="main-content">
${isHome ? '' : `
  <div class="page-header">
    <button class="nav-toggle" type="button" aria-label="Open navigation">Menu</button>
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
    ${toc}
  </div>
`}
  <footer>System Design Ultimatum &middot; Last updated ${new Date().toLocaleDateString()}</footer>
</div>
<button class="back-to-top" aria-label="Back to top">${icons.up}</button>
<div class="kbd-hint"><kbd>/</kbd> Search &nbsp; <kbd>n</kbd> Next &nbsp; <kbd>p</kbd> Prev &nbsp; <kbd>t</kbd> TOC</div>
<script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/prism.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/plugins/autoloader/prism-autoloader.min.js"></script>
${clientScript}
</body>
</html>`;
}

// ─── Search Index ───────────────────────────────────────────────────────────

const searchIndex = [];

// ─── Generate Markdown Pages ────────────────────────────────────────────────

markdownFiles.forEach(filePath => {
  const filename = path.basename(filePath, '.md');
  const folder = path.dirname(filePath).replace(/^\.\//, '');
  const htmlFileName = toHtmlFileName(filePath, '.md');

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const { html: htmlContent, headings } = markdownToHtml(content);
    const toc = generateTocHtml(headings);
    const breadcrumb = generateBreadcrumb(folder, filename);
    const prevNext = generatePrevNext(htmlFileName);

    const fullHtml = generatePageTemplate(filename, htmlContent, { toc, breadcrumb, prevNext });
    fs.writeFileSync(path.join(docsDir, htmlFileName), fullHtml);

    // Add to search index (first 500 chars of plain text)
    const plainText = content.replace(/^#{1,6}\s+/gm, '').replace(/[*_`#\[\]()>|]/g, '').replace(/\n+/g, ' ').trim();
    searchIndex.push({
      name: filename,
      href: htmlFileName,
      folder: folder,
      type: 'note',
      text: plainText.substring(0, 800),
    });

    console.log('  Generated: ' + htmlFileName);
  } catch (err) {
    console.log('  Error generating ' + filePath + ': ' + err.message);
  }
});

// ─── Generate Excalidraw Pages ──────────────────────────────────────────────

excalidrawFiles.forEach(filePath => {
  const filename = path.basename(filePath, '.excalidraw');
  const folder = path.dirname(filePath).replace(/^\.\//, '');
  const htmlFileName = toHtmlFileName(filePath, '.excalidraw');
  const svgFileName = htmlFileName.replace('.html', '.svg');
  const jsonFileName = htmlFileName.replace('.html', '.json');

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);

    // Generate SVG preview + standalone file
    const svgResult = generateExcalidrawSvgPreview(data, filename);
    if (svgResult.hasElements) {
      fs.writeFileSync(path.join(docsDir, svgFileName), svgResult.svg);
    }

    // Write excalidraw JSON for the interactive viewer
    fs.writeFileSync(path.join(docsDir, jsonFileName), content);

    const elementCount = data.elements ? data.elements.filter(e => !e.isDeleted).length : 0;

    let diagramContent = '<div class="diagram-container">';
    diagramContent += `<div class="diagram-info"><strong>Diagram:</strong> ${escapeHtml(filename)} &middot; <strong>${elementCount}</strong> elements</div>`;

    // Tabs for switching views
    diagramContent += '<div class="diagram-tabs">';
    diagramContent += '<button class="diagram-tab active" onclick="showDiagramView(\'interactive\')">Interactive</button>';
    diagramContent += '<button class="diagram-tab" onclick="showDiagramView(\'svg\')">Static SVG</button>';
    diagramContent += '<button class="diagram-tab" onclick="showDiagramView(\'json\')">JSON Data</button>';
    diagramContent += '</div>';

    // Interactive Excalidraw viewer
    diagramContent += `<div id="view-interactive" class="diagram-viewer-container"><div id="excalidraw-root" style="width:100%;height:100%;"></div></div>`;

    // SVG fallback view
    if (svgResult.hasElements) {
      diagramContent += `<div id="view-svg" class="diagram-preview" style="display:none"><img src="${safeHref(svgFileName)}" alt="${escapeHtml(filename)} diagram" loading="lazy"/></div>`;
      diagramContent += `<p id="svg-download" style="display:none;margin:0.5rem 0"><a href="${safeHref(svgFileName)}" download>Download SVG</a></p>`;
    } else {
      diagramContent += `<div id="view-svg" class="diagram-preview" style="display:none">${svgResult.svg}</div>`;
    }

    // JSON view
    diagramContent += `<div id="view-json" class="diagram-json" style="display:none">${JSON.stringify(data, null, 2).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`;

    diagramContent += '</div>';

    // Script to handle Excalidraw component + tab switching
    diagramContent += `
<script>
function showDiagramView(view) {
  document.getElementById('view-interactive').style.display = view === 'interactive' ? '' : 'none';
  var svgEl = document.getElementById('view-svg');
  var svgDl = document.getElementById('svg-download');
  if (svgEl) svgEl.style.display = view === 'svg' ? '' : 'none';
  if (svgDl) svgDl.style.display = view === 'svg' ? '' : 'none';
  document.getElementById('view-json').style.display = view === 'json' ? '' : 'none';
  document.querySelectorAll('.diagram-tab').forEach(function(btn, i) {
    btn.classList.toggle('active', (view === 'interactive' && i === 0) || (view === 'svg' && i === 1) || (view === 'json' && i === 2));
  });
}
</script>
<script type="module">
  import React from 'https://esm.sh/react@18.2.0';
  import ReactDOM from 'https://esm.sh/react-dom@18.2.0';
  import { Excalidraw } from 'https://esm.sh/@excalidraw/excalidraw@0.17.6?external=react,react-dom';

  async function init() {
    try {
      const res = await fetch('${escapeHtml(jsonFileName)}');
      const data = await res.json();
      const root = document.getElementById('excalidraw-root');
      if (!root) return;
      const elements = (data.elements || []).filter(e => !e.isDeleted);
      const appState = { ...(data.appState || {}), viewModeEnabled: true, zenModeEnabled: true, gridModeEnabled: false };
      const files = data.files || {};

      ReactDOM.render(
        React.createElement(Excalidraw, {
          initialData: { elements, appState, files },
          viewModeEnabled: true,
          zenModeEnabled: true,
          gridModeEnabled: false,
          UIOptions: { canvasActions: { export: false, saveAsImage: false, loadScene: false } },
        }),
        root
      );
    } catch (err) {
      console.error('Excalidraw load failed:', err);
      // Fallback to SVG view
      showDiagramView('svg');
    }
  }
  init();
</script>`;

    const breadcrumb = generateBreadcrumb(folder, filename);
    const prevNext = generatePrevNext(htmlFileName);

    const fullHtml = generatePageTemplate(filename, diagramContent, { breadcrumb, prevNext });
    fs.writeFileSync(path.join(docsDir, htmlFileName), fullHtml);

    // Add to search index
    const textContent = (data.elements || [])
      .filter(e => e.type === 'text' && !e.isDeleted)
      .map(e => e.text || '').join(' ');
    searchIndex.push({
      name: filename,
      href: htmlFileName,
      folder: folder,
      type: 'diagram',
      text: textContent.substring(0, 400),
    });

    console.log('  Generated: ' + htmlFileName);
  } catch (err) {
    console.log('  Error generating ' + filePath + ': ' + err.message);
  }
});

// ─── Generate Homepage ──────────────────────────────────────────────────────

const iconMap = {
  'book-open': '&#128214;', 'layers': '&#128203;', 'globe': '&#127760;',
  'message-circle': '&#128172;', 'search': '&#128269;', 'database': '&#128451;',
  'trending-up': '&#128200;', 'bar-chart-2': '&#128202;', 'shield': '&#128737;',
  'terminal': '&#128187;', 'cpu': '&#129302;', 'upload-cloud': '&#9729;',
  'brain': '&#129504;', 'zap': '&#9889;', 'folder': '&#128193;',
};

let homeContent = '<div class="dashboard">';
homeContent += '<div class="dash-hero">';
homeContent += '<button class="nav-toggle" type="button" aria-label="Open navigation" style="position:absolute;top:1rem;right:1rem">Menu</button>';
homeContent += '<h1>System Design Ultimatum</h1>';
homeContent += '<p>A comprehensive collection of system design notes, diagrams, and interview preparation resources.</p>';
homeContent += '</div>';

homeContent += '<div class="dash-stats">';
homeContent += `<div class="dash-stat"><div class="stat-num">${markdownFiles.length}</div><div class="stat-label">Study Notes</div></div>`;
homeContent += `<div class="dash-stat"><div class="stat-num">${excalidrawFiles.length}</div><div class="stat-label">Diagrams</div></div>`;
homeContent += `<div class="dash-stat"><div class="stat-num">${Object.keys(filesByFolder).length}</div><div class="stat-label">Categories</div></div>`;
homeContent += '</div>';

// Study Notes section (Notes folder)
const notesFolder = filesByFolder['Notes'];
if (notesFolder && notesFolder.markdown.length) {
  homeContent += '<div class="dash-section-title">Start Here: Study Notes</div>';
  homeContent += '<div class="category-grid">';
  notesFolder.markdown.slice().sort((a, b) => path.basename(a, '.md').localeCompare(path.basename(b, '.md'))).forEach(f => {
    const name = path.basename(f, '.md');
    const htmlFile = toHtmlFileName(f, '.md');
    homeContent += `<a href="${safeHref(htmlFile)}" style="text-decoration:none"><div class="category-card"><div class="cc-header"><div class="cc-icon" style="background:#6366f1">&#128214;</div><div class="cc-name">${escapeHtml(name)}</div></div></div></a>`;
  });
  homeContent += '</div>';
}

// System Design Categories
homeContent += '<div class="dash-section-title">System Design Categories</div>';
homeContent += '<div class="category-grid">';

folderNames.filter(f => f !== 'Notes').forEach(folder => {
  const { markdown, excalidraw } = filesByFolder[folder];
  const meta = getCategoryInfo(folder);
  const iconHtml = iconMap[meta.icon] || iconMap.folder;
  const totalFiles = markdown.length + excalidraw.length;

  homeContent += '<div class="category-card">';
  homeContent += `<div class="cc-header"><div class="cc-icon" style="background:${meta.color}">${iconHtml}</div><div class="cc-name">${escapeHtml(folder)}</div></div>`;
  homeContent += `<div class="cc-desc">${escapeHtml(meta.desc)} &middot; ${totalFiles} file${totalFiles !== 1 ? 's' : ''}</div>`;
  homeContent += '<div class="cc-links">';

  markdown.slice(0, 5).forEach(f => {
    const name = path.basename(f, '.md');
    homeContent += `<a href="${safeHref(toHtmlFileName(f, '.md'))}">${escapeHtml(name)}</a>`;
  });
  excalidraw.slice(0, 5).forEach(f => {
    const name = path.basename(f, '.excalidraw');
    homeContent += `<a href="${safeHref(toHtmlFileName(f, '.excalidraw'))}">${escapeHtml(name)}</a>`;
  });

  const remaining = totalFiles - Math.min(markdown.length, 5) - Math.min(excalidraw.length, 5);
  if (remaining > 0) {
    homeContent += `<span style="font-size:0.75rem;color:var(--text-muted);padding:0.2rem 0">+${remaining} more</span>`;
  }

  homeContent += '</div></div>';
});

homeContent += '</div></div>';

const indexHtml = generatePageTemplate('System Design Ultimatum', homeContent, { isHome: true });
fs.writeFileSync(path.join(docsDir, 'index.html'), indexHtml);
console.log('  Generated: index.html');

// ─── Write Search Index ─────────────────────────────────────────────────────

fs.writeFileSync(path.join(docsDir, 'search-index.json'), JSON.stringify(searchIndex));
console.log('  Generated: search-index.json');

// ─── .nojekyll ──────────────────────────────────────────────────────────────

fs.writeFileSync(path.join(docsDir, '.nojekyll'), '');

console.log('\n  Site generated successfully!');
console.log('  Output: ./docs/');
console.log(`  Total: ${markdownFiles.length} notes + ${excalidrawFiles.length} diagrams + index + search index`);
