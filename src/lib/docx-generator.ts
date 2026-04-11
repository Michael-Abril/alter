/**
 * OWNER: Person 3 (Royce/OpenClaw)
 * PURPOSE: Generate formatted Word documents from markdown content
 * DEPENDENCIES: docx
 * STATUS: LIVE — converts markdown to .docx with proper formatting
 */

import {
  Document, Paragraph, TextRun, HeadingLevel, AlignmentType,
  convertInchesToTwip, ShadingType, BorderStyle, TabStopType,
  TabStopPosition,
} from 'docx';
import fs from 'fs';

interface DocxOptions {
  title: string;
  content: string;
  author?: string;
  subject?: string;
}

// ─── Content Segments ────────────────────────────────────────────────────────

interface ContentSegment {
  type: 'markdown' | 'code';
  content: string;
  language?: string;
}

/**
 * Split raw content into alternating markdown / code-fence segments.
 * Code fences are extracted so they can be rendered with monospace styling.
 */
function splitIntoSegments(raw: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const fence = /^```(\w*)$/gm;
  let insideCode = false;
  let codeLang = '';
  let lastCut = 0;
  let codeStart = 0;
  let match: RegExpExecArray | null;

  while ((match = fence.exec(raw)) !== null) {
    if (!insideCode) {
      // Opening fence — flush preceding markdown
      if (match.index > lastCut) {
        segments.push({ type: 'markdown', content: raw.slice(lastCut, match.index) });
      }
      insideCode = true;
      codeLang = match[1] || '';
      codeStart = match.index + match[0].length + 1; // skip the newline
    } else {
      // Closing fence
      const codeContent = raw.slice(codeStart, match.index);
      segments.push({ type: 'code', content: codeContent, language: codeLang || undefined });
      insideCode = false;
      lastCut = match.index + match[0].length + 1;
    }
  }

  // Remaining content (or entire content if no fences)
  const tail = raw.slice(lastCut);
  if (tail.length > 0) {
    segments.push({ type: insideCode ? 'code' : 'markdown', content: tail });
  }

  return segments;
}

// ─── Pre-processing ──────────────────────────────────────────────────────────

function normalizeContent(raw: string): string {
  let s = raw;
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // Strip common HTML tags that LLMs sometimes inject
  s = s.replace(/<\/?(?:br|p|div|span|b|i|em|strong|a|ul|ol|li|h[1-6]|blockquote|code|pre|hr)[^>]*>/gi, '');
  // Collapse 3+ consecutive blank lines into 1
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

// ─── Inline Formatting ───────────────────────────────────────────────────────

const MONO_FONT = 'Courier New';
const MONO_SIZE = 20; // half-points → 10pt

/**
 * Parse a single line of text into richly-styled TextRuns.
 * Handles (in precedence order): bold+italic, bold, italic, inline code, links.
 */
function parseInlineFormatting(text: string): TextRun[] {
  if (!text) return [new TextRun({ text: '' })];

  const runs: TextRun[] = [];
  // Combined regex — order matters: bold-italic before bold before italic
  const re =
    /\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|(?<!\*)\*([^*\n]+?)\*(?!\*)|_([^_\n]+?)_|`([^`\n]+?)`|\[([^\]\n]+?)\]\(([^)\n]+?)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      runs.push(new TextRun({ text: text.slice(last, m.index) }));
    }
    if (m[1] !== undefined) {
      runs.push(new TextRun({ text: m[1], bold: true, italics: true }));
    } else if (m[2] !== undefined) {
      runs.push(new TextRun({ text: m[2], bold: true }));
    } else if (m[3] !== undefined) {
      runs.push(new TextRun({ text: m[3], italics: true }));
    } else if (m[4] !== undefined) {
      runs.push(new TextRun({ text: m[4], italics: true }));
    } else if (m[5] !== undefined) {
      runs.push(new TextRun({
        text: m[5],
        font: { name: MONO_FONT },
        size: MONO_SIZE,
        shading: { type: ShadingType.SOLID, color: 'E8E8E8', fill: 'E8E8E8' },
      }));
    } else if (m[6] !== undefined) {
      runs.push(new TextRun({
        text: m[6],
        style: 'Hyperlink',
        underline: { type: 'single' as any },
      }));
    }
    last = m.index + m[0].length;
  }

  if (last < text.length) {
    runs.push(new TextRun({ text: text.slice(last) }));
  }

  return runs.length > 0 ? runs : [new TextRun({ text })];
}

// ─── Paragraph Parsing ───────────────────────────────────────────────────────

function parseCodeBlock(code: string): Paragraph[] {
  const lines = code.split('\n');
  // Remove a single trailing empty line (artifact of fence extraction)
  if (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();

  return lines.map(
    (line) =>
      new Paragraph({
        children: [
          new TextRun({
            text: line || ' ', // empty lines still need a space for spacing
            font: { name: MONO_FONT },
            size: MONO_SIZE,
          }),
        ],
        spacing: { before: 20, after: 20, line: 276 },
        shading: { type: ShadingType.SOLID, color: 'F5F5F5', fill: 'F5F5F5' },
        indent: { left: convertInchesToTwip(0.25) },
      })
  );
}

/**
 * Detect nested bullet depth.  Returns { depth, text } or null if not a bullet.
 *   "- foo"       → { depth: 0, text: "foo" }
 *   "  - foo"     → { depth: 1, text: "foo" }
 *   "    - foo"   → { depth: 2, text: "foo" }
 */
function parseBullet(line: string): { depth: number; text: string } | null {
  const m = line.match(/^(\s*)([-*])\s(.*)$/);
  if (!m) return null;
  const indent = m[1].length;
  const depth = Math.min(Math.floor(indent / 2), 4);
  return { depth, text: m[3] };
}

function parseMarkdownToParagraphs(markdown: string): Paragraph[] {
  const lines = markdown.split('\n');
  const paragraphs: Paragraph[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Empty line → spacing paragraph
    if (!line.trim()) {
      paragraphs.push(new Paragraph({ text: '' }));
      continue;
    }

    // Horizontal rule: ---, ***, ___  (3+ chars, optionally with spaces)
    if (/^[\s]*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(line)) {
      paragraphs.push(
        new Paragraph({
          text: '',
          spacing: { before: 120, after: 120 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, space: 1, color: 'CCCCCC' } },
        })
      );
      continue;
    }

    // Headers (H1–H4)
    const headerMatch = line.match(/^(#{1,4})\s+(.*)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const headingMap: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
        1: HeadingLevel.HEADING_1,
        2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3,
        4: HeadingLevel.HEADING_4,
      };
      const spacingMap: Record<number, { before: number; after: number }> = {
        1: { before: 240, after: 120 },
        2: { before: 200, after: 100 },
        3: { before: 160, after: 80 },
        4: { before: 140, after: 70 },
      };
      paragraphs.push(
        new Paragraph({
          children: parseInlineFormatting(headerMatch[2]),
          heading: headingMap[level],
          spacing: spacingMap[level],
        })
      );
      continue;
    }

    // Blockquote (> text)
    const bqMatch = line.match(/^>\s?(.*)$/);
    if (bqMatch) {
      paragraphs.push(
        new Paragraph({
          children: parseInlineFormatting(bqMatch[1]),
          indent: { left: convertInchesToTwip(0.5) },
          spacing: { before: 60, after: 60 },
          border: { left: { style: BorderStyle.SINGLE, size: 12, space: 8, color: 'BBBBBB' } },
        })
      );
      continue;
    }

    // Bullet points (with nesting support)
    const bullet = parseBullet(line);
    if (bullet) {
      paragraphs.push(
        new Paragraph({
          children: parseInlineFormatting(bullet.text),
          bullet: { level: bullet.depth },
          spacing: { before: 40, after: 40 },
        })
      );
      continue;
    }

    // Numbered lists
    const numMatch = line.match(/^(\s*)(\d+)\.\s(.*)$/);
    if (numMatch) {
      paragraphs.push(
        new Paragraph({
          children: parseInlineFormatting(numMatch[3]),
          numbering: { reference: 'default-numbering', level: 0 },
          spacing: { before: 40, after: 40 },
        })
      );
      continue;
    }

    // Regular paragraph with rich inline formatting
    paragraphs.push(
      new Paragraph({
        children: parseInlineFormatting(line),
        spacing: { before: 60, after: 60 },
      })
    );
  }

  return paragraphs;
}

// ─── Document Generation ─────────────────────────────────────────────────────

export async function generateDocx(options: DocxOptions): Promise<Buffer> {
  const { title, content, author = 'Alter', subject } = options;

  const cleaned = normalizeContent(content);
  const segments = splitIntoSegments(cleaned);

  const contentParagraphs: Paragraph[] = [];
  for (const seg of segments) {
    if (seg.type === 'code') {
      contentParagraphs.push(...parseCodeBlock(seg.content));
    } else {
      contentParagraphs.push(...parseMarkdownToParagraphs(seg.content));
    }
  }

  const doc = new Document({
    creator: author,
    title,
    subject: subject || title,
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        children: [
          new Paragraph({
            text: title,
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
          ...contentParagraphs,
        ],
      },
    ],
  });

  const { Packer } = await import('docx');
  return await Packer.toBuffer(doc);
}

export async function saveDocx(filePath: string, options: DocxOptions): Promise<void> {
  const buffer = await generateDocx(options);
  fs.writeFileSync(filePath, buffer);
  console.log(`[docx] Saved document to: ${filePath}`);
}
