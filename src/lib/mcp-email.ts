/**
 * OWNER: Person 3 (Royce/OpenClaw)
 * PURPOSE: Claude API + MCP connector for Gmail operations
 * DEPENDENCIES: None (raw fetch to Anthropic Messages API)
 * STATUS: LIVE — Claude connects to Gmail MCP server directly via MCP connector beta
 *
 * Uses Anthropic's MCP connector (anthropic-beta: mcp-client-2025-11-20) so Claude
 * gets direct tool access to Gmail. Alter's backend calls Claude, Claude calls
 * Gmail tools, and we get structured results back — no custom Gmail OAuth needed
 * in production for AI-initiated email operations.
 *
 * Auth flow:
 *   1. User authorizes Gmail MCP via OAuth (MCP Inspector or app OAuth flow)
 *   2. We store the access_token in the user's DB record
 *   3. Every Claude API call passes that token as authorization_token
 *   4. Claude uses Gmail MCP tools directly (read, search, send, draft)
 */

// ─── Config ──────────────────────────────────────────────────────────

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const ANTHROPIC_BETA = 'mcp-client-2025-11-20';
const MODEL = 'claude-sonnet-4-20250514';
const GMAIL_MCP_URL = 'https://gmail.mcp.claude.com/mcp';
const GMAIL_MCP_NAME = 'gmail';
const MAX_AGENTIC_TURNS = 10;

// ─── Types ───────────────────────────────────────────────────────────

interface McpMessage {
  role: 'user' | 'assistant';
  content: string | McpContentBlock[];
}

interface McpContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  server_name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  is_error?: boolean;
  content?: McpContentBlock[];
}

interface McpApiResponse {
  id: string;
  type: string;
  role: string;
  content: McpContentBlock[];
  model: string;
  stop_reason: string;
  usage: { input_tokens: number; output_tokens: number };
}

export interface EmailMessage {
  id?: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  date?: string;
  threadId?: string;
  snippet?: string;
}

export interface DraftResult {
  draft: string;
  confidence: number;
  model: string;
  tokensUsed: number;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  message: string;
  raw: string;
}

export interface ReadResult {
  success: boolean;
  emails: EmailMessage[];
  raw: string;
  tokensUsed: number;
}

// ─── Core: call Claude API with MCP connector ───────────────────────

/**
 * Single-turn call to Claude with Gmail MCP server attached.
 */
async function callClaude(params: {
  system?: string;
  messages: McpMessage[];
  maxTokens?: number;
  gmailToken: string;
}): Promise<McpApiResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

  const body = {
    model: MODEL,
    max_tokens: params.maxTokens || 4096,
    ...(params.system ? { system: params.system } : {}),
    messages: params.messages,
    mcp_servers: [
      {
        type: 'url',
        url: GMAIL_MCP_URL,
        name: GMAIL_MCP_NAME,
        authorization_token: params.gmailToken,
      },
    ],
    tools: [
      {
        type: 'mcp_toolset',
        mcp_server_name: GMAIL_MCP_NAME,
      },
    ],
  };

  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-beta': ANTHROPIC_BETA,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${errorText}`);
  }

  return (await res.json()) as McpApiResponse;
}

/**
 * Agentic loop: keeps calling Claude until it stops using tools.
 * Claude may call Gmail MCP tools (mcp_tool_use), the API auto-executes them
 * and returns mcp_tool_result blocks. We feed those back until Claude produces
 * a final text response (stop_reason === 'end_turn').
 */
async function agenticLoop(params: {
  system?: string;
  initialPrompt: string;
  maxTokens?: number;
  gmailToken: string;
}): Promise<{ text: string; totalTokens: number }> {
  const messages: McpMessage[] = [
    { role: 'user', content: params.initialPrompt },
  ];

  let totalTokens = 0;

  for (let turn = 0; turn < MAX_AGENTIC_TURNS; turn++) {
    const response = await callClaude({
      system: params.system,
      messages,
      maxTokens: params.maxTokens,
      gmailToken: params.gmailToken,
    });

    totalTokens += response.usage.input_tokens + response.usage.output_tokens;

    // If Claude's done (no more tool calls), extract text and return
    if (response.stop_reason === 'end_turn') {
      const text = response.content
        .filter((b) => b.type === 'text' && b.text)
        .map((b) => b.text!)
        .join('\n');
      return { text, totalTokens };
    }

    // Claude wants to use MCP tools — feed the full response back as assistant turn
    messages.push({ role: 'assistant', content: response.content });

    // Build tool results from any mcp_tool_use blocks
    // The MCP connector auto-executes tools server-side, so results come back
    // in the same response as mcp_tool_result blocks. But if stop_reason is
    // 'tool_use', we need to send back a user message with the tool results.
    const toolResults: McpContentBlock[] = response.content
      .filter((b) => b.type === 'mcp_tool_use')
      .map((toolUse) => ({
        type: 'mcp_tool_result',
        tool_use_id: toolUse.id!,
        is_error: false,
        content: [{ type: 'text', text: 'Tool executed by MCP connector.' }],
      }));

    if (toolResults.length > 0) {
      messages.push({ role: 'user', content: toolResults });
    } else {
      // No tool calls but not end_turn — shouldn't happen, but break to be safe
      const text = response.content
        .filter((b) => b.type === 'text' && b.text)
        .map((b) => b.text!)
        .join('\n');
      return { text, totalTokens };
    }

    console.log(`[mcp-email] agentic turn ${turn + 1}: ${response.stop_reason}, ${toolResults.length} tool calls`);
  }

  throw new Error(`[mcp-email] Exceeded ${MAX_AGENTIC_TURNS} agentic turns`);
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Read emails from the user's Gmail via Claude + MCP connector.
 *
 * @param query - Natural language query, e.g. "my last 10 emails" or "unread from sarah@company.com"
 * @param gmailToken - OAuth access token for the Gmail MCP server
 */
export async function readEmails(query: string, gmailToken: string): Promise<ReadResult> {
  console.log(`[mcp-email] readEmails: "${query}"`);

  const { text, totalTokens } = await agenticLoop({
    system: [
      'You are Alter, an email assistant with direct Gmail access via MCP tools.',
      'Use the Gmail MCP tools to read the user\'s emails as requested.',
      'After reading, return a JSON array with fields: from, to, subject, body (first 300 chars), date, threadId.',
      'Wrap the JSON in ```json code fences.',
    ].join(' '),
    initialPrompt: query,
    maxTokens: 4096,
    gmailToken,
  });

  // Parse JSON from Claude's final response
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\[[\s\S]*\])/);
  let emails: EmailMessage[] = [];

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      emails = Array.isArray(parsed) ? parsed : [parsed];
    } catch (parseErr) {
      console.warn('[mcp-email] Failed to parse email JSON:', parseErr);
    }
  }

  console.log(`[mcp-email] readEmails: ${emails.length} emails, ${totalTokens} tokens`);

  return {
    success: emails.length > 0,
    emails,
    raw: text,
    tokensUsed: totalTokens,
  };
}

/**
 * Draft a reply to an email using Claude + MCP + voice profile.
 * Claude can use Gmail MCP to look up prior thread context.
 *
 * @param emailContext - The original email to reply to
 * @param voiceProfile - System prompt describing the user's writing style
 * @param gmailToken - OAuth access token for the Gmail MCP server
 */
export async function draftReply(
  emailContext: {
    from: string;
    subject: string;
    body: string;
    threadId?: string;
  },
  voiceProfile: string | undefined,
  gmailToken: string
): Promise<DraftResult> {
  console.log(`[mcp-email] draftReply: re "${emailContext.subject}" from ${emailContext.from}`);

  const voiceInstructions = voiceProfile
    ? `Write in the user's voice. Voice profile:\n${voiceProfile}`
    : 'Write in a professional, concise tone.';

  const { text: draft, totalTokens } = await agenticLoop({
    system: [
      'You are Alter, drafting email replies on behalf of the user.',
      voiceInstructions,
      'You have Gmail access via MCP — use it to look up the email thread for context if a threadId is provided.',
      'Output ONLY the reply body text. No subject line, no "Here\'s a draft:", no metadata.',
    ].join('\n'),
    initialPrompt: [
      `Draft a reply to this email:`,
      ``,
      `From: ${emailContext.from}`,
      `Subject: ${emailContext.subject}`,
      `Thread ID: ${emailContext.threadId || 'N/A'}`,
      ``,
      `--- Original message ---`,
      emailContext.body,
      `--- End ---`,
      ``,
      `Write the reply now.`,
    ].join('\n'),
    maxTokens: 1024,
    gmailToken,
  });

  // Confidence heuristic
  let confidence = 0.7;
  if (draft.length > 100) confidence += 0.05;
  if (draft.length > 300) confidence += 0.05;
  const subjectWords = emailContext.subject.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const draftLower = draft.toLowerCase();
  const relevance = subjectWords.filter((w) => draftLower.includes(w)).length;
  confidence += Math.min(relevance * 0.03, 0.1);
  if (draft.length < 30) confidence -= 0.2;
  confidence = Math.max(0, Math.min(1, confidence));

  console.log(`[mcp-email] draftReply: ${draft.length} chars, confidence=${confidence.toFixed(2)}, ${totalTokens} tokens`);

  return { draft, confidence, model: MODEL, tokensUsed: totalTokens };
}

/**
 * Send an email via Claude + Gmail MCP.
 *
 * @param to - Recipient email address
 * @param subject - Email subject
 * @param body - Email body text
 * @param gmailToken - OAuth access token for the Gmail MCP server
 * @param threadId - Optional Gmail thread ID for replies
 */
export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  gmailToken: string,
  threadId?: string
): Promise<SendResult> {
  console.log(`[mcp-email] sendEmail: to=${to}, subject="${subject}"`);

  const threadInstruction = threadId
    ? `This is a reply in thread ${threadId}. Use the thread ID when sending.`
    : 'This is a new email, not a reply.';

  const { text: raw, totalTokens } = await agenticLoop({
    system: [
      'You are Alter with direct Gmail access via MCP tools.',
      'Use the Gmail MCP tools to send this email exactly as specified.',
      'Do not modify the content. Send it as-is.',
      threadInstruction,
      'After sending, confirm with the message ID.',
    ].join(' '),
    initialPrompt: [
      `Send this email now:`,
      ``,
      `To: ${to}`,
      `Subject: ${subject}`,
      ``,
      body,
    ].join('\n'),
    maxTokens: 1024,
    gmailToken,
  });

  const success = raw.toLowerCase().includes('sent') || raw.toLowerCase().includes('success');
  const idMatch = raw.match(/message\s*id[:\s]+([a-zA-Z0-9]+)/i);

  console.log(`[mcp-email] sendEmail: ${success ? '✅' : '❌'} (${totalTokens} tokens)`);

  return {
    success,
    messageId: idMatch?.[1],
    message: raw,
    raw,
  };
}
