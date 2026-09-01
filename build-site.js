#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

const ASSETS = loadAssets();
console.log(`  Assets: ${ASSETS.cssHref}, ${ASSETS.jsHref}`);

// ─── Markdown to HTML (with heading IDs + TOC extraction) ───────────────────

function markdownToHtml(markdown) {
  const headings = []; // collected for TOC

  const applyInline = (text = '') => {
    let t = escapeHtml(text);
    t = t.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" loading="lazy" />');
    t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
      const external = /^https?:\/\//i.test(href);
      return `<a href="${href}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label}</a>`;
    });
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

// ─── Media pipeline (note-adjacent images: animations, screenshots) ─────────
// Page HTML is emitted flat into docs/, so a relative reference such as
// ./animations/foo.svg must resolve to docs/animations/foo.svg. Copy every
// locally-referenced image there, keeping the href intact.

function copyReferencedMedia(mdFiles) {
  const imageRefPattern = /!\[[^\]]*\]\(([^)\s]+)/g;
  const claimed = new Map(); // dest -> source, for collision detection
  const problems = [];
  let copied = 0;

  mdFiles.forEach(mdFile => {
    const markdown = fs.readFileSync(mdFile, 'utf8');
    let match;
    while ((match = imageRefPattern.exec(markdown)) !== null) {
      const href = match[1].trim();
      if (/^(https?:|data:|mailto:|#|\/\/)/i.test(href)) continue; // external

      const rel = href.replace(/^\.\//, '');
      if (path.isAbsolute(rel) || rel.split('/').includes('..')) {
        problems.push(`${mdFile}: unsupported image path "${href}" (flat output cannot host absolute or ../ paths)`);
        continue;
      }

      const src = path.join(path.dirname(mdFile), rel);
      if (!fs.existsSync(src)) {
        problems.push(`${mdFile}: referenced image not found "${href}"`);
        continue;
      }

      const dest = path.join(docsDir, rel);
      const prior = claimed.get(dest);
      if (prior) {
        if (path.resolve(prior) !== path.resolve(src)) {
          problems.push(`name collision for "${rel}": ${prior} vs ${src} — rename one of them`);
        }
        continue;
      }

      claimed.set(dest, src);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
      copied++;
    }
  });

  problems.forEach(p => console.log('  WARNING: ' + p));
  return copied;
}

const mediaCount = copyReferencedMedia(markdownFiles);
console.log(`  Media files copied: ${mediaCount}`);

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
  'Overview': { icon: 'book-open', color: '#6366f1', desc: 'Indexes, topic maps, and high-signal reference notes' },
  'Core Concepts': { icon: 'layers', color: '#14b8a6', desc: 'Foundational system design tradeoffs and patterns' },
  'Databases': { icon: 'database', color: '#06b6d4', desc: 'Database engines, caches, indexes, and storage systems' },
  'Streaming': { icon: 'bar-chart-2', color: '#f97316', desc: 'Kafka, Flink, coordination, and stream processing' },
  'Cloud': { icon: 'upload-cloud', color: '#0ea5e9', desc: 'Cloud services, infrastructure, and operations references' },
  'Geospatial': { icon: 'globe', color: '#22c55e', desc: 'Geospatial indexing and proximity query techniques' },
  'High Performance': { icon: 'zap', color: '#eab308', desc: 'HPC, Slurm, MPI, storage, networking, and interviews' },
  'AI and LLM': { icon: 'brain', color: '#d946ef', desc: 'LLM architecture, RAG, agents, and evaluation' },
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
  const leaf = parseFolderName(path.basename(folderName)).label.toLowerCase();
  for (const [key, meta] of Object.entries(categoryMeta)) {
    if (leaf.includes(key.toLowerCase())) return meta;
  }
  for (const [key, meta] of Object.entries(categoryMeta)) {
    if (key !== 'Notes' && folderName.toLowerCase().includes(key.toLowerCase())) return meta;
  }
  return { icon: 'folder', color: '#64748b', desc: 'System design topics' };
}

function displayFolderName(folderName) {
  return folderName
    .split('/')
    .filter(Boolean)
    .map(part => parseFolderName(part).label)
    .join(' / ');
}

// ─── SVG Icons (Feather-style, inline) ──────────────────────────────────────

const icons = {
  sun: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
  moon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
  up: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>',
  menu: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
  sidebar: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/><path d="M14 10l-2 2 2 2"/></svg>',
  search: '<svg class="topbar-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.65" y2="16.65"/></svg>',
  file: '<svg class="nav-file-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h5"/><path d="M9 13h6"/><path d="M9 17h4"/></svg>',
  diagram: '<svg class="nav-file-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="8.5" y="14" width="7" height="7" rx="1.5"/><path d="M10 6.5h4"/><path d="M17.5 10v4"/><path d="M6.5 10v3a1 1 0 0 0 1 1h1"/></svg>',
};

// ─── Navigation Generator ───────────────────────────────────────────────────

// Top-level folders are named like "🧩 1. Foundational(Introductory) Design".
// Split off the emoji and the chapter number so the nav can sort by chapter
// instead of by emoji codepoint, and render the emoji in its own column.
function parseFolderName(name) {
  const m = name.match(/^\s*([^\p{L}\p{N}\s]+)?\s*(?:(\d+)\s*\.)?\s*(.*)$/u);
  const emoji = (m && m[1]) || '';
  const order = m && m[2] ? parseInt(m[2], 10) : Number.POSITIVE_INFINITY;
  let label = ((m && m[3]) || '').trim() || name;
  label = label.charAt(0).toUpperCase() + label.slice(1);
  return { emoji, order, label };
}

function byChapter(a, b) {
  const A = parseFolderName(a);
  const B = parseFolderName(b);
  if (A.order !== B.order) return A.order - B.order;
  return A.label.localeCompare(B.label);
}

function countLeaves(node) {
  let n = node.files.markdown.length + node.files.excalidraw.length;
  node.children.forEach(child => { n += countLeaves(child); });
  return n;
}

function hasContent(node) {
  return countLeaves(node) > 0;
}

const chevronSvg =
  '<svg class="nav-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>';

function navItem(href, label, kind) {
  const cls = kind === 'diagram' ? 'nav-item is-diagram' : 'nav-item';
  const icon = kind === 'diagram' ? icons.diagram : icons.file;
  return `<a href="${safeHref(href)}" class="${cls}" title="${escapeHtml(label)}"><span class="nav-item-icon">${icon}</span><span class="nav-item-label">${escapeHtml(label)}</span></a>`;
}

// Files of a folder, markdown first, then diagrams — each alphabetical.
function navFiles(node) {
  const sortByName = (ext) => (a, b) => path.basename(a, ext).localeCompare(path.basename(b, ext));
  let html = '';
  node.files.markdown.slice().sort(sortByName('.md')).forEach(f => {
    html += navItem(toHtmlFileName(f, '.md'), path.basename(f, '.md'), 'note');
  });
  node.files.excalidraw.slice().sort(sortByName('.excalidraw')).forEach(f => {
    html += navItem(toHtmlFileName(f, '.excalidraw'), path.basename(f, '.excalidraw'), 'diagram');
  });
  return html;
}

function navFolder(name, node, depth = 0) {
  const { emoji, label } = parseFolderName(name);
  const count = countLeaves(node);
  let html = `<details class="nav-folder" data-depth="${depth}">`;
  html += '<summary>';
  html += chevronSvg;
  if (emoji) html += `<span class="nav-folder-emoji" aria-hidden="true">${escapeHtml(emoji)}</span>`;
  html += `<span class="nav-folder-label" title="${escapeHtml(label)}">${escapeHtml(label)}</span>`;
  html += `<span class="nav-folder-count">${count}</span>`;
  html += '</summary>';
  html += '<div class="nav-folder-body">';
  html += navFiles(node);
  Array.from(node.children.keys()).sort(byChapter).forEach(childName => {
    const child = node.children.get(childName);
    if (hasContent(child)) html += navFolder(childName, child, depth + 1);
  });
  html += '</div></details>';
  return html;
}

function generateNav() {
  const root = buildFolderTree();
  const notes = root.children.get('Notes');

  const topLevel = Array.from(root.children.keys()).filter(n => n !== 'Notes');
  const designs = topLevel.filter(n => Number.isFinite(parseFolderName(n).order)).sort(byChapter);
  const resources = topLevel.filter(n => !Number.isFinite(parseFolderName(n).order)).sort(byChapter);

  let nav = '<nav class="sidebar" aria-label="Primary">';

  if (notes && hasContent(notes)) {
    nav += '<div class="nav-section-label">Study Notes</div>';
    nav += navFiles(notes);
    Array.from(notes.children.keys()).sort(byChapter).forEach(name => {
      const child = notes.children.get(name);
      if (hasContent(child)) nav += navFolder(name, child);
    });
  }

  if (designs.length) {
    nav += '<div class="nav-section-label">System Designs</div>';
    designs.forEach(name => {
      const child = root.children.get(name);
      if (hasContent(child)) nav += navFolder(name, child);
    });
  }

  const visibleResources = resources.filter(name => hasContent(root.children.get(name)));
  if (visibleResources.length) {
    nav += '<div class="nav-section-label">Resources</div>';
    visibleResources.forEach(name => {
      nav += navFolder(name, root.children.get(name));
    });
  }

  nav += '</nav>';
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
    html += `<span>${escapeHtml(displayFolderName(folder))}</span><span class="bc-sep">/</span>`;
  }
  html += `<span>${escapeHtml(name)}</span>`;
  html += '</div>';
  return html;
}

// ─── Page Template ──────────────────────────────────────────────────────────

function generatePageTemplate(title, content, { toc = '', breadcrumb = '', prevNext = '', isHome = false } = {}) {
  const safeTitle = escapeHtml(title);
  const themeInit = `<script>(function(){try{var t=localStorage.getItem('theme');if(!t)t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.setAttribute('data-theme',t);if(localStorage.getItem('sidebar:compact')==='true')document.documentElement.classList.add('nav-compact');}catch(e){}})();</script>`;
  const topbar = `
  <header class="topbar" role="banner">
    <button class="topbar-icon-btn topbar-hamburger" type="button" aria-label="Open navigation">${icons.menu}</button>
    <button id="sidebar-toggle" class="topbar-icon-btn topbar-sidebar-toggle" type="button" aria-label="Shrink navigation" aria-pressed="false">${icons.sidebar}</button>
    <a class="topbar-brand" href="index.html"><span class="topbar-mark" aria-hidden="true">SD</span>System Design Ultimatum</a>
    <button id="topbar-search" class="topbar-search" type="button" aria-label="Search (Cmd+K)">
      ${icons.search}
      <span>Search the docs…</span>
      <span class="kbd">⌘K</span>
    </button>
    <span class="topbar-spacer"></span>
    <button id="theme-toggle" class="topbar-icon-btn" type="button" aria-label="Toggle dark mode" aria-pressed="false"></button>
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
      folder: displayFolderName(folder),
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
      folder: displayFolderName(folder),
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

// Study Notes section (nested Notes collections)
const noteFolders = folderNames.filter(f => f === 'Notes' || f.startsWith('Notes/'));
if (noteFolders.length) {
  homeContent += '<div class="dash-section-title">Study Note Collections</div>';
  homeContent += '<div class="category-grid">';
  noteFolders.forEach(folder => {
    const { markdown, excalidraw } = filesByFolder[folder];
    const meta = getCategoryInfo(folder);
    const iconHtml = iconMap[meta.icon] || iconMap.folder;
    const totalFiles = markdown.length + excalidraw.length;

    homeContent += '<div class="category-card">';
    homeContent += `<div class="cc-header"><div class="cc-icon" style="background:${meta.color}">${iconHtml}</div><div class="cc-name">${escapeHtml(displayFolderName(folder).replace(/^Notes \/ /, ''))}</div></div>`;
    homeContent += `<div class="cc-desc">${escapeHtml(meta.desc)} &middot; ${totalFiles} file${totalFiles !== 1 ? 's' : ''}</div>`;
    homeContent += '<div class="cc-links">';

    markdown.slice(0, 5).forEach(f => {
      const name = path.basename(f, '.md');
      homeContent += `<a href="${safeHref(toHtmlFileName(f, '.md'))}">${escapeHtml(name)}</a>`;
    });

    const remaining = totalFiles - Math.min(markdown.length, 5);
    if (remaining > 0) {
      homeContent += `<span style="font-size:0.75rem;color:var(--text-muted);padding:0.2rem 0">+${remaining} more</span>`;
    }

    homeContent += '</div></div>';
  });
  homeContent += '</div>';
}

// System Design Categories
homeContent += '<div class="dash-section-title">System Design Categories</div>';
homeContent += '<div class="category-grid">';

folderNames.filter(f => f !== 'Notes' && !f.startsWith('Notes/')).forEach(folder => {
  const { markdown, excalidraw } = filesByFolder[folder];
  const meta = getCategoryInfo(folder);
  const iconHtml = iconMap[meta.icon] || iconMap.folder;
  const totalFiles = markdown.length + excalidraw.length;

  homeContent += '<div class="category-card">';
  homeContent += `<div class="cc-header"><div class="cc-icon" style="background:${meta.color}">${iconHtml}</div><div class="cc-name">${escapeHtml(displayFolderName(folder))}</div></div>`;
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
