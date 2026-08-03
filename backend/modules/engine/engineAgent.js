import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import updateManager from './updateManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENGINE_PATH = path.join(__dirname, '..', 'pay-hours', 'engine', 'wageEngine.js');

const SYSTEM_PROMPT = `You are the Pay Rules Assistant for Kangaroo Care, a disability support workforce platform.

Your audience is HR, payroll, and operations staff — not software developers.

Guidelines:
- Speak in clear, friendly plain English. Avoid code, diffs, file names, and developer jargon unless the user explicitly asks for technical detail.
- Help users understand how pay rules work: overtime, penalties, allowances, sleepovers, broken shifts, public holidays, etc.
- When someone asks how something works, use read_pay_rules if needed, then explain in everyday payroll terms with short examples.
- When someone wants a change, clarify their intent if needed, then use propose_rule_change to draft it. Explain the impact simply and ask if they want to apply it.
- Never claim a change was applied — the user must approve in the UI.
- Keep replies concise (2-4 short paragraphs max). Use bullet points for multi-part explanations.
- If unsure, say what you know and what you'd need to confirm.`;

export const ENGINE_AGENT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_engine_status',
      description: 'Check whether the pay rules system is healthy and which version is active.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_pay_rules',
      description: 'Load the current pay calculation rules for wages, overtime, penalties, and allowances.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_rule_change',
      description:
        'Draft a pay rule change for user approval. Never applies automatically — only creates a proposal.',
      parameters: {
        type: 'object',
        properties: {
          summary: {
            type: 'string',
            description: 'One-sentence plain-English summary of the change',
          },
          impact: {
            type: 'string',
            description: 'Who is affected and what will differ on payslips',
          },
          changeDescription: {
            type: 'string',
            description: 'Precise description of the rule change for the code editor',
          },
        },
        required: ['summary', 'impact', 'changeDescription'],
        additionalProperties: false,
      },
    },
  },
];

const TOOL_LABELS = {
  get_engine_status: 'Checked pay rules system status',
  read_pay_rules: 'Reviewed current pay rules',
  propose_rule_change: 'Drafted a proposed change',
};

function readEngineSource() {
  return fs.readFileSync(ENGINE_PATH, 'utf8');
}

function cleanSyntaxError(error = '') {
  return error.replace(/\u001b\[[0-9;]*m/g, '').trim();
}

function normalizeGeneratedCode(raw = '') {
  return raw
    .trim()
    .replace(/^```(?:javascript|js)?\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim();
}

async function callOpenAI(messages, tools = ENGINE_AGENT_TOOLS, options = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Pay Rules Assistant is not configured yet. Please ask an administrator to set up the AI service.');
  }

  const payload = {
    model: process.env.ENGINE_AGENT_MODEL || 'gpt-4o-mini',
    messages,
    temperature: options.temperature ?? 0.3,
    max_tokens: options.max_tokens ?? 2000,
  };

  if (tools) {
    payload.tools = tools;
    payload.tool_choice = 'auto';
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`AI service error: ${response.status}`);
  }

  return response.json();
}

const MAX_CODE_GEN_ATTEMPTS = 3;
const CODE_GEN_MAX_TOKENS = 16000;

async function generateUpdatedEngineCode(changeDescription) {
  const currentCode = readEngineSource();
  const expectedLines = currentCode.split('\n').length;
  const codeGenPrompt = `You update an ES module JavaScript pay calculation engine.

Rules:
- Return ONLY the complete updated source file.
- The file is about ${expectedLines} lines — return every line, not a partial snippet.
- Keep all existing import and export statements unless the change truly requires new ones.
- Preserve the module format (import/export). Do not wrap the file in markdown fences.
- Make the smallest change that satisfies the request.`;

  const conversation = [
    { role: 'system', content: codeGenPrompt },
    {
      role: 'user',
      content: `Change requested:\n${changeDescription}\n\nCurrent source:\n${currentCode}`,
    },
  ];

  let lastError = 'Unknown syntax error';

  for (let attempt = 1; attempt <= MAX_CODE_GEN_ATTEMPTS; attempt += 1) {
    const response = await callOpenAI(conversation, undefined, {
      max_tokens: CODE_GEN_MAX_TOKENS,
      temperature: 0.1,
    });

    const code = normalizeGeneratedCode(response.choices?.[0]?.message?.content || '');
    if (!code) {
      lastError = 'empty response from code editor';
      conversation.push({
        role: 'user',
        content: `Attempt ${attempt}/${MAX_CODE_GEN_ATTEMPTS} returned no code. Return the COMPLETE updated source file.`,
      });
      continue;
    }

    const syntaxCheck = await updateManager.validateSyntax(code);
    if (syntaxCheck.valid) {
      return code;
    }

    lastError = cleanSyntaxError(syntaxCheck.error);
    const generatedLines = code.split('\n').length;

    conversation.push({
      role: 'user',
      content: `That draft failed validation on attempt ${attempt}/${MAX_CODE_GEN_ATTEMPTS}.

Syntax error:
${lastError}

You returned ${generatedLines} lines but the original file has ${expectedLines} lines, so the output was likely truncated or incomplete.

Return the COMPLETE updated source file with the requested change applied. No markdown fences, no explanation.`,
    });
  }

  throw new Error(
    `Could not draft a valid rule change after ${MAX_CODE_GEN_ATTEMPTS} attempts: ${lastError}`
  );
}

async function executeTool(name, args) {
  switch (name) {
    case 'get_engine_status': {
      const status = updateManager.getEngineStatus();
      return {
        healthy: true,
        version: status.currentVersion || 'default',
        ready: status.ready,
        savedVersions: status.versions?.length || 0,
        message: status.ready
          ? `Pay rules engine is running (version ${status.currentVersion || 'default'}).`
          : 'Pay rules engine is starting up.',
      };
    }
    case 'read_pay_rules': {
      const code = readEngineSource();
      return {
        lineCount: code.split('\n').length,
        source: code,
      };
    }
    case 'propose_rule_change': {
      const code = await generateUpdatedEngineCode(args.changeDescription);
      const proposalId = randomUUID();
      return {
        proposalId,
        summary: args.summary,
        impact: args.impact,
        changeDescription: args.changeDescription,
        code,
      };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

export async function runEngineAgentChat(messages = []) {
  const openAiMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const steps = [];
  let proposal = null;
  const maxTurns = 6;

  for (let turn = 0; turn < maxTurns; turn += 1) {
    const data = await callOpenAI(openAiMessages);
    const choice = data.choices?.[0]?.message;

    if (!choice) {
      throw new Error('No response from Pay Rules Assistant');
    }

    const toolCalls = choice.tool_calls || [];
    if (!toolCalls.length) {
      return {
        reply: choice.content?.trim() || 'I could not generate a response. Please try again.',
        steps,
        proposal,
      };
    }

    openAiMessages.push(choice);

    for (const toolCall of toolCalls) {
      const fn = toolCall.function;
      const args = fn.arguments ? JSON.parse(fn.arguments) : {};
      const result = await executeTool(fn.name, args);

      steps.push({
        tool: fn.name,
        label: TOOL_LABELS[fn.name] || fn.name,
        status: 'done',
      });

      if (fn.name === 'propose_rule_change' && result.code) {
        proposal = {
          id: result.proposalId,
          summary: result.summary,
          impact: result.impact,
          changeDescription: result.changeDescription,
          code: result.code,
        };
      }

      openAiMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(
          fn.name === 'propose_rule_change'
            ? {
                proposalId: result.proposalId,
                summary: result.summary,
                impact: result.impact,
                status: 'draft_ready',
                note: 'Proposal created. Explain it to the user and ask if they want to apply it.',
              }
            : result
        ),
      });
    }
  }

  return {
    reply: 'I need a bit more information to help with that. Could you tell me more about what you want to change?',
    steps,
    proposal,
  };
}
