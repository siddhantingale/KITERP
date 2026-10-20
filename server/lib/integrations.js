// Replacements for the hosted "Core" integrations:
// InvokeLLM, ExtractDataFromUploadedFile, SendEmail, SendSMS, GenerateImage.
// File uploads are handled by the HTTP route in server/index.js.
import fs from 'node:fs';
import path from 'node:path';
import nodemailer from 'nodemailer';
import ExcelJS from 'exceljs';
import { DATA_DIR } from './db.js';

export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MIME = {
  '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.csv': 'text/csv', '.txt': 'text/plain', '.json': 'application/json',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.xls': 'application/vnd.ms-excel',
};

// Read a file given its URL: local uploads are read from disk, anything else is downloaded.
export async function readFileFromUrl(fileUrl) {
  const u = new URL(fileUrl, 'http://local');
  const name = decodeURIComponent(path.basename(u.pathname));
  const ext = path.extname(name).toLowerCase();
  if (u.pathname.startsWith('/uploads/')) {
    const p = path.join(UPLOAD_DIR, path.basename(u.pathname));
    if (!p.startsWith(UPLOAD_DIR) || !fs.existsSync(p)) throw new Error(`File not found: ${name}`);
    return { buffer: fs.readFileSync(p), mime: MIME[ext] || 'application/octet-stream', name, ext };
  }
  const res = await fetch(fileUrl);
  if (!res.ok) throw new Error(`Could not download file (${res.status})`);
  const mime = (res.headers.get('content-type') || MIME[ext] || 'application/octet-stream').split(';')[0];
  return { buffer: Buffer.from(await res.arrayBuffer()), mime, name, ext };
}

async function spreadsheetToText(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const parts = [];
  wb.eachSheet((ws) => {
    parts.push(`### Sheet: ${ws.name}`);
    ws.eachRow({ includeEmpty: false }, (row) => {
      const vals = row.values.slice(1).map((v) => {
        if (v == null) return '';
        if (typeof v === 'object') return v.text ?? v.result ?? (v instanceof Date ? v.toISOString().slice(0, 10) : JSON.stringify(v));
        return String(v);
      });
      parts.push(vals.map((x) => (/[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x)).join(','));
    });
  });
  return parts.join('\n');
}

// Turn a file into model input: text for spreadsheets/CSV, native parts for PDFs and images.
async function fileToParts(fileUrl) {
  const f = await readFileFromUrl(fileUrl);
  if (f.ext === '.xlsx' || f.mime.includes('spreadsheetml')) {
    return [{ kind: 'text', text: `File "${f.name}" (spreadsheet as CSV):\n${await spreadsheetToText(f.buffer)}` }];
  }
  if (f.mime.startsWith('text/') || ['.csv', '.txt', '.json'].includes(f.ext)) {
    return [{ kind: 'text', text: `File "${f.name}":\n${f.buffer.toString('utf8')}` }];
  }
  if (f.mime === 'application/pdf' || f.mime.startsWith('image/')) {
    return [{ kind: f.mime === 'application/pdf' ? 'pdf' : 'image', mime: f.mime, name: f.name, data: f.buffer.toString('base64') }];
  }
  throw new Error(`Unsupported file type for AI reading: ${f.name}`);
}

// ---------- LLM ----------
function llmConfig() {
  const provider = (process.env.LLM_PROVIDER || (process.env.ANTHROPIC_API_KEY ? 'anthropic' : process.env.OPENAI_API_KEY ? 'openai' : '')).toLowerCase();
  const apiKey = process.env.LLM_API_KEY || (provider === 'anthropic' ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY);
  if (!provider || !apiKey) return null;
  return {
    provider,
    apiKey,
    model: process.env.LLM_MODEL || (provider === 'anthropic' ? 'claude-sonnet-5-5' : 'gpt-4o-mini'),
    baseUrl: (process.env.LLM_BASE_URL || (provider === 'anthropic' ? 'https://api.anthropic.com' : 'https://api.openai.com/v1')).replace(/\/$/, ''),
  };
}

export function aiEnabled() {
  return !!llmConfig();
}

function extractJson(text) {
  const t = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(t); } catch { /* fall through */ }
  const start = t.search(/[[{]/);
  if (start >= 0) {
    const open = t[start], close = open === '{' ? '}' : ']';
    const end = t.lastIndexOf(close);
    if (end > start) { try { return JSON.parse(t.slice(start, end + 1)); } catch { /* ignore */ } }
  }
  throw new Error('The AI response was not valid JSON');
}

async function callModel(promptText, parts = [], wantJson = false) {
  const cfg = llmConfig();
  if (!cfg) {
    const e = new Error('AI features are not configured. Set LLM_PROVIDER and LLM_API_KEY in the .env file.');
    e.status = 503;
    throw e;
  }
  const textParts = parts.filter((p) => p.kind === 'text').map((p) => p.text);
  const fullPrompt = [promptText, ...textParts].join('\n\n') +
    (wantJson ? '\n\nRespond with ONLY valid JSON (no markdown, no commentary).' : '');

  if (cfg.provider === 'anthropic') {
    const content = [];
    for (const p of parts) {
      if (p.kind === 'pdf') content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: p.data } });
      if (p.kind === 'image') content.push({ type: 'image', source: { type: 'base64', media_type: p.mime, data: p.data } });
    }
    content.push({ type: 'text', text: fullPrompt });
    const res = await fetch(`${cfg.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: cfg.model, max_tokens: 8192, messages: [{ role: 'user', content }] }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error?.message || `AI request failed (${res.status})`);
    return json.content.filter((c) => c.type === 'text').map((c) => c.text).join('');
  }

  // OpenAI-compatible (OpenAI, Groq, OpenRouter, Gemini's OpenAI endpoint, local Ollama, ...)
  const content = [{ type: 'text', text: fullPrompt }];
  for (const p of parts) {
    if (p.kind === 'image') content.push({ type: 'image_url', image_url: { url: `data:${p.mime};base64,${p.data}` } });
    if (p.kind === 'pdf') content.push({ type: 'file', file: { filename: p.name, file_data: `data:application/pdf;base64,${p.data}` } });
  }
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: cfg.model,
      messages: [{ role: 'user', content }],
      ...(wantJson ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || `AI request failed (${res.status})`);
  return json.choices?.[0]?.message?.content || '';
}

export async function InvokeLLM({ prompt, response_json_schema, file_urls } = {}) {
  const parts = [];
  for (const url of [].concat(file_urls || [])) parts.push(...(await fileToParts(url)));
  if (response_json_schema) {
    const text = await callModel(
      `${prompt}\n\nReturn a JSON object that follows this JSON schema exactly:\n${JSON.stringify(response_json_schema)}`,
      parts, true);
    return extractJson(text);
  }
  return callModel(prompt, parts, false);
}

export async function ExtractDataFromUploadedFile({ file_url, json_schema } = {}) {
  try {
    const parts = await fileToParts(file_url);
    const text = await callModel(
      'Extract the data from the attached file. Read every row and every column carefully; do not skip or invent values.\n' +
      `Return a JSON object matching this JSON schema exactly:\n${JSON.stringify(json_schema || {})}`,
      parts, true);
    return { status: 'success', output: extractJson(text) };
  } catch (err) {
    return { status: 'error', details: err.message, output: null };
  }
}

// ---------- Email ----------
let transporter = null;
function getTransport() {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_USER, EMAIL_PASS } = process.env;
  if (SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST, port: Number(SMTP_PORT || 587), secure: Number(SMTP_PORT) === 465,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });
  } else if (EMAIL_USER && EMAIL_PASS) {
    transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: EMAIL_USER, pass: EMAIL_PASS } });
  }
  return transporter;
}

export async function SendEmail({ to, subject, body, from_name } = {}) {
  const t = getTransport();
  if (!t) {
    console.warn(`✉️  Email not sent (SMTP not configured): "${subject}" → ${to}`);
    return { success: false, skipped: true, message: 'Email is not configured on the server' };
  }
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER || process.env.EMAIL_USER;
  const isHtml = /<[a-z][\s\S]*>/i.test(body || '');
  const info = await t.sendMail({
    from: from_name ? `"${from_name}" <${from}>` : from,
    to, subject,
    ...(isHtml ? { html: body } : { text: body }),
  });
  return { success: true, id: info.messageId };
}

export async function SendSMS({ to, message } = {}) {
  console.warn(`📱 SMS not sent (no SMS provider configured): ${to}: ${message}`);
  return { success: false, skipped: true, message: 'SMS provider is not configured' };
}

export async function GenerateImage() {
  const e = new Error('Image generation is not available in the self-hosted version.');
  e.status = 501;
  throw e;
}

export const Core = { InvokeLLM, ExtractDataFromUploadedFile, SendEmail, SendSMS, GenerateImage };
