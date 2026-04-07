/**
 * OWNER: Person 3 (Royce/OpenClaw)
 * PURPOSE: Generate formatted Word documents from markdown content
 * DEPENDENCIES: docx
 * STATUS: LIVE — converts markdown to .docx with proper formatting
 */

import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, convertInchesToTwip } from 'docx';
import fs from 'fs';

interface DocxOptions {
  title: string;
  content: string;
  author?: string;
  subject?: string;
}

/**
 * Parse markdown and convert to docx paragraphs
 */
function parseMarkdownToParagraphs(markdown: string): Paragraph[] {
  const lines = markdown.split('\n');
  const paragraphs: Paragraph[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip empty lines
    if (!line.trim()) {
      paragraphs.push(new Paragraph({ text: '' }));
      continue;
    }
    
    // H1 headers
    if (line.startsWith('# ')) {
      paragraphs.push(
        new Paragraph({
          text: line.slice(2),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 240, after: 120 },
        })
      );
      continue;
    }
    
    // H2 headers
    if (line.startsWith('## ')) {
      paragraphs.push(
        new Paragraph({
          text: line.slice(3),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
        })
      );
      continue;
    }
    
    // H3 headers
    if (line.startsWith('### ')) {
      paragraphs.push(
        new Paragraph({
          text: line.slice(4),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 160, after: 80 },
        })
      );
      continue;
    }
    
    // Bullet points
    if (line.startsWith('- ') || line.startsWith('* ')) {
      paragraphs.push(
        new Paragraph({
          text: line.slice(2),
          bullet: { level: 0 },
          spacing: { before: 60, after: 60 },
        })
      );
      continue;
    }
    
    // Numbered lists
    if (/^\d+\.\s/.test(line)) {
      const text = line.replace(/^\d+\.\s/, '');
      paragraphs.push(
        new Paragraph({
          text,
          numbering: { reference: 'default-numbering', level: 0 },
          spacing: { before: 60, after: 60 },
        })
      );
      continue;
    }
    
    // Bold text handling
    const textRuns: TextRun[] = [];
    const boldRegex = /\*\*(.*?)\*\*/g;
    let lastIndex = 0;
    let match;
    
    while ((match = boldRegex.exec(line)) !== null) {
      // Add text before bold
      if (match.index > lastIndex) {
        textRuns.push(new TextRun({ text: line.slice(lastIndex, match.index) }));
      }
      // Add bold text
      textRuns.push(new TextRun({ text: match[1], bold: true }));
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < line.length) {
      textRuns.push(new TextRun({ text: line.slice(lastIndex) }));
    }
    
    // Regular paragraph
    if (textRuns.length > 0) {
      paragraphs.push(
        new Paragraph({
          children: textRuns,
          spacing: { before: 60, after: 60 },
        })
      );
    } else {
      paragraphs.push(
        new Paragraph({
          text: line,
          spacing: { before: 60, after: 60 },
        })
      );
    }
  }
  
  return paragraphs;
}

/**
 * Generate a Word document from markdown content
 */
export async function generateDocx(options: DocxOptions): Promise<Buffer> {
  const { title, content, author = 'NightShift AI', subject } = options;
  
  // Parse markdown to paragraphs
  const contentParagraphs = parseMarkdownToParagraphs(content);
  
  // Create document
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
          // Title
          new Paragraph({
            text: title,
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
          // Content
          ...contentParagraphs,
        ],
      },
    ],
  });
  
  // Generate buffer
  const { Packer } = await import('docx');
  return await Packer.toBuffer(doc);
}

/**
 * Save a Word document to disk
 */
export async function saveDocx(filePath: string, options: DocxOptions): Promise<void> {
  const buffer = await generateDocx(options);
  fs.writeFileSync(filePath, buffer);
  console.log(`[docx] Saved document to: ${filePath}`);
}
