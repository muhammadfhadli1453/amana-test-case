import { useState, useRef, useCallback } from "react";
import mammoth from "mammoth";

// ── Color tokens ──────────────────────────────────────────────────────────────
const ACCENT = "#1D9E75";
const ACCENT_LIGHT = "#E1F5EE";
const DANGER = "#E24B4A";
const DANGER_LIGHT = "#FCEBEB";
const WARN = "#EF9F27";
const WARN_LIGHT = "#FAEEDA";
const INFO = "#378ADD";
const INFO_LIGHT = "#E6F1FB";

const SECTION_STYLE = {
  background: "#fff",
  border: "0.5px solid #e0e0e0",
  borderRadius: 12,
  padding: "1.25rem 1.5rem",
  marginBottom: "1rem",
};

const BADGE = (color, bg) => ({
  display: "inline-block",
  background: bg,
  color: color,
  borderRadius: 6,
  padding: "2px 10px",
  fontSize: 12,
  fontWeight: 500,
});

const scoreColor = (score) => {
  if (score >= 75) return { fg: "#0F6E56", bg: "#E1F5EE" };
  if (score >= 50) return { fg: "#854F0B", bg: "#FAEEDA" };
  return { fg: "#A32D2D", bg: "#FCEBEB" };
};

// ── Logger ────────────────────────────────────────────────────────────────────
const LOG_LEVELS = { info: { color: INFO, icon: "ℹ" }, success: { color: ACCENT, icon: "✓" }, warn: { color: WARN, icon: "⚠" }, error: { color: DANGER, icon: "✗" } };

function createLogger(setLogs) {
  const log = (level, message, detail = null) => {
    const entry = { id: Date.now() + Math.random(), level, message, detail, time: new Date().toISOString().substring(11, 23) };
    console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](`[${entry.time}] [${level.toUpperCase()}] ${message}`, detail ?? "");
    setLogs(prev => [...prev.slice(-199), entry]);
    return entry;
  };
  return {
    info: (msg, detail) => log("info", msg, detail),
    success: (msg, detail) => log("success", msg, detail),
    warn: (msg, detail) => log("warn", msg, detail),
    error: (msg, detail) => log("error", msg, detail),
  };
}

// ── Provider definitions ──────────────────────────────────────────────────────
const PROVIDERS = {
  anthropic: { label: "Anthropic (Claude)", icon: "🟠", defaultBase: "https://api.anthropic.com", defaultModel: "claude-sonnet-4-20250514", modelPlaceholder: "claude-sonnet-4-20250514", needsKey: true, keyLabel: "API key", keyPlaceholder: "sk-ant-…", baseEditable: false, hint: "Get your key at console.anthropic.com" },
  openai: { label: "OpenAI (ChatGPT)", icon: "🟢", defaultBase: "https://api.openai.com/v1", defaultModel: "gpt-4o", modelPlaceholder: "gpt-4o / gpt-4-turbo", needsKey: true, keyLabel: "API key", keyPlaceholder: "sk-…", baseEditable: false, hint: "Get your key at platform.openai.com" },
  gemini: { label: "Google Gemini", icon: "🔵", defaultBase: "https://generativelanguage.googleapis.com/v1beta", defaultModel: "gemini-1.5-pro", modelPlaceholder: "gemini-1.5-pro / gemini-2.0-flash", needsKey: true, keyLabel: "API key", keyPlaceholder: "AIza…", baseEditable: false, hint: "Get your key at aistudio.google.com" },
  openrouter: { label: "OpenRouter", icon: "🔀", defaultBase: "https://openrouter.ai/api/v1", defaultModel: "qwen/qwen3.7-max", modelPlaceholder: "qwen/qwen3.7-max", needsKey: true, keyLabel: "API key", keyPlaceholder: "sk-or-…", baseEditable: false, hint: "Browse models at openrouter.ai/models" },
  ollama: { label: "Ollama (local)", icon: "🦙", defaultBase: "http://localhost:11434", defaultModel: "llama3", modelPlaceholder: "llama3 / mistral / gemma3", needsKey: false, keyLabel: "", keyPlaceholder: "", baseEditable: true, hint: "Make sure Ollama is running locally" },
  vllm: { label: "vLLM (served model)", icon: "⚡", defaultBase: "http://localhost:8000/v1", defaultModel: "your-model-name", modelPlaceholder: "model name as served by vLLM", needsKey: false, keyLabel: "API key (optional)", keyPlaceholder: "token-xxx (if auth enabled)", baseEditable: true, hint: "Set the base URL of your vLLM server" },
};

// ── Document readers ──────────────────────────────────────────────────────────

async function readFileAsText(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = e => res(e.target.result);
    r.onerror = () => rej(new Error(`FileReader failed for ${file.name}`));
    r.readAsText(file);
  });
}

async function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = e => res(e.target.result.split(",")[1]);
    r.onerror = () => rej(new Error(`Base64 encoding failed for ${file.name}`));
    r.readAsDataURL(file);
  });
}

async function readDocx(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  if (result.messages?.length) {
    console.warn("[DOCX] Mammoth warnings:", result.messages);
  }
  return result.value;
}

async function fetchGoogleDoc(url) {
  // Extract document ID from various Google Docs URL formats
  const patterns = [
    /\/document\/d\/([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
  ];
  let docId = null;
  for (const p of patterns) {
    const m = url.match(p);
    if (m) { docId = m[1]; break; }
  }
  if (!docId) throw new Error("Could not extract Google Doc ID from URL. Make sure it's a valid Google Docs link.");

  const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
  const res = await fetch(exportUrl);
  if (!res.ok) {
    if (res.status === 403 || res.status === 401) throw new Error("Google Doc is not publicly accessible. Set sharing to 'Anyone with the link can view'.");
    throw new Error(`Google Docs fetch failed: HTTP ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  if (!text.trim()) throw new Error("Google Doc appears empty or could not be exported as text.");
  return text;
}

async function extractDocument(source, logger) {
  // source: { type: 'text'|'file'|'gdocs', value: string|File }
  if (source.type === "text") {
    logger.info("Using pasted text input", `${source.value.length} chars`);
    return { text: source.value, pdfB64: null };
  }

  if (source.type === "gdocs") {
    logger.info("Fetching Google Doc", source.value);
    const text = await fetchGoogleDoc(source.value);
    logger.success("Google Doc fetched", `${text.length} chars extracted`);
    return { text, pdfB64: null };
  }

  if (source.type === "file") {
    const file = source.value;
    const ext = file.name.split(".").pop().toLowerCase();
    logger.info(`Reading file: ${file.name}`, `type=${file.type}, size=${(file.size / 1024).toFixed(1)}KB, ext=${ext}`);

    if (ext === "pdf") {
      logger.info("PDF detected — will use native PDF (Anthropic) or Files API (OpenAI) or text fallback");
      return { text: null, pdfB64: await fileToBase64(file), pdfFile: file };
    }

    if (ext === "docx" || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      logger.info("DOCX detected — extracting with Mammoth");
      const text = await readDocx(file);
      logger.success("DOCX extracted", `${text.length} chars`);
      return { text, pdfB64: null };
    }

    if (ext === "doc") {
      logger.warn("Legacy .doc format detected", "Only .docx is fully supported. Attempting text read — may be garbled.");
      const text = await readFileAsText(file).catch(() => "");
      return { text: text || `[Binary .doc file: ${file.name} — please convert to .docx or paste text]`, pdfB64: null };
    }

    // Plain text / markdown / etc.
    logger.info(`Reading as plain text (ext: ${ext})`);
    const text = await readFileAsText(file);
    logger.success("Text file read", `${text.length} chars`);
    return { text, pdfB64: null };
  }

  throw new Error(`Unknown source type: ${source.type}`);
}

// ── LLM caller ────────────────────────────────────────────────────────────────

// Upload a PDF File object to OpenAI Files API, returns file_id
async function openaiUploadFile(file, apiKey, logger) {
  logger.info("OpenAI: uploading PDF via Files API", { name: file.name, size: `${(file.size / 1024).toFixed(1)}KB` });
  const formData = new FormData();
  formData.append("file", file, file.name);
  formData.append("purpose", "user_data");

  const res = await fetch("https://api.openai.com/v1/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });
  logger.info(`OpenAI Files API response: ${res.status} ${res.statusText}`);
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    logger.error("OpenAI Files API error", { status: res.status, body: e });
    throw new Error(`Files API: ${e.error?.message || `HTTP ${res.status}`}`);
  }
  const data = await res.json();
  logger.success("OpenAI file uploaded", { file_id: data.id, filename: data.filename, bytes: data.bytes });
  return data.id;
}

// Call OpenAI Responses API with an uploaded file_id
async function openaiResponsesWithFile({ apiKey, model, systemPrompt, userMessage, fileId, logger }) {
  logger.info("OpenAI: calling Responses API with file_id", { model, fileId });
  const body = {
    model,
    instructions: systemPrompt,
    input: [
      {
        role: "user",
        content: [
          { type: "input_file", file_id: fileId },
          { type: "input_text", text: userMessage },
        ],
      },
    ],
    max_output_tokens: 4000,
  };
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  logger.info(`OpenAI Responses API status: ${res.status} ${res.statusText}`);
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    logger.error("OpenAI Responses API error", { status: res.status, body: e });
    throw new Error(`Responses API: ${e.error?.message || `HTTP ${res.status}`}`);
  }
  const data = await res.json();
  logger.info("OpenAI Responses API response received", { id: data.id, status: data.status, usage: data.usage });
  // output_text is a convenience field; fall back to scanning output array
  const text = data.output_text
    ?? data.output?.flatMap(o => o.content ?? []).filter(c => c.type === "output_text").map(c => c.text).join("") 
    ?? "";
  logger.success("OpenAI Responses API parsed", `${text.length} chars`);
  return text;
}

async function callLLM({ provider, baseUrl, apiKey, model, systemPrompt, userMessage, proposalPdfB64, proposalPdfFile, logger }) {
  const base = baseUrl.replace(/\/$/, "");
  logger.info(`Calling LLM provider: ${provider}`, { model, base, messageLength: userMessage.length, hasPdf: !!proposalPdfB64 });

  try {
    // ── Anthropic ─────────────────────────────────────────────────────────────
    if (provider === "anthropic") {
      let content;
      if (proposalPdfB64) {
        content = [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: proposalPdfB64 } },
          { type: "text", text: userMessage },
        ];
        logger.info("Anthropic: sending native PDF + text");
      } else {
        content = userMessage;
        logger.info("Anthropic: sending text-only message");
      }
      const res = await fetch(`${base}/v1/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model, max_tokens: 4000, system: systemPrompt, messages: [{ role: "user", content }] }),
      });
      logger.info(`Anthropic response status: ${res.status} ${res.statusText}`);
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        logger.error("Anthropic API error", { status: res.status, body: e });
        throw new Error(e.error?.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      logger.info("Anthropic response received", { stopReason: data.stop_reason, inputTokens: data.usage?.input_tokens, outputTokens: data.usage?.output_tokens });
      const text = data.content?.map(b => b.text || "").join("") || "";
      logger.success("Anthropic response parsed", `${text.length} chars`);
      return text;
    }

    // ── OpenAI — PDF path: Files API → Responses API ──────────────────────────
    if (provider === "openai" && proposalPdfFile) {
      const fileId = await openaiUploadFile(proposalPdfFile, apiKey, logger);
      return await openaiResponsesWithFile({ apiKey, model, systemPrompt, userMessage, fileId, logger });
    }

    // ── OpenAI-compatible text path (OpenAI no-PDF, OpenRouter, vLLM, Ollama) ─
    if (["openai", "openrouter", "vllm", "ollama"].includes(provider)) {
      const endpoint = provider === "ollama" ? `${base}/v1/chat/completions` : `${base}/chat/completions`;
      const headers = { "Content-Type": "application/json" };
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
      if (provider === "openrouter") { headers["HTTP-Referer"] = "https://amana.solutions"; headers["X-Title"] = "AMANA BD Proposal Checker"; }
      logger.info(`${provider}: POST ${endpoint}`);
      const body = { model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }], max_tokens: 4000, temperature: 0.2 };
      const res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
      logger.info(`${provider} response status: ${res.status} ${res.statusText}`);
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        logger.error(`${provider} API error`, { status: res.status, body: e });
        throw new Error(e.error?.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      logger.info(`${provider} response received`, { model: data.model, finishReason: data.choices?.[0]?.finish_reason, usage: data.usage });
      const text = data.choices?.[0]?.message?.content || "";
      logger.success(`${provider} response parsed`, `${text.length} chars`);
      return text;
    }

    // ── Gemini ────────────────────────────────────────────────────────────────
    if (provider === "gemini") {
      const url = `${base}/models/${model}:generateContent?key=${apiKey}`;
      logger.info(`Gemini: POST ${url.replace(apiKey, "***")}`);
      const body = { system_instruction: { parts: [{ text: systemPrompt }] }, contents: [{ role: "user", parts: [{ text: userMessage }] }], generationConfig: { maxOutputTokens: 4000, temperature: 0.2 } };
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      logger.info(`Gemini response status: ${res.status} ${res.statusText}`);
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        logger.error("Gemini API error", { status: res.status, body: e });
        throw new Error(e.error?.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      logger.info("Gemini response received", { candidates: data.candidates?.length, finishReason: data.candidates?.[0]?.finishReason });
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      logger.success("Gemini response parsed", `${text.length} chars`);
      return text;
    }

    throw new Error("Unknown provider: " + provider);
  } catch (err) {
    logger.error(`LLM call failed [${provider}]`, { message: err.message, stack: err.stack });
    throw err;
  }
}

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an expert BD (Business Development) Proposal Review Agent.
Your job is to carefully analyze a proposal document against a client brief/TOR and produce a structured JSON review.

Return ONLY valid JSON (no markdown, no backticks, no preamble) with this exact structure:
{
  "proposal_summary": { "title": "string", "client": "string", "objective": "string", "proposed_solution": "string", "estimated_value": "string or null", "duration": "string or null" },
  "completeness_checklist": [
    { "section": "Executive Summary", "status": "present|missing", "note": "string" },
    { "section": "Problem Statement / Context", "status": "present|missing", "note": "string" },
    { "section": "Proposed Solution / Scope of Work", "status": "present|missing", "note": "string" },
    { "section": "Methodology / Approach", "status": "present|missing", "note": "string" },
    { "section": "Team / Qualifications", "status": "present|missing", "note": "string" },
    { "section": "Timeline / Deliverables", "status": "present|missing", "note": "string" },
    { "section": "Pricing / Commercial Terms", "status": "present|missing", "note": "string" },
    { "section": "Assumptions & Constraints", "status": "present|missing", "note": "string" },
    { "section": "Risk Management", "status": "present|missing", "note": "string" },
    { "section": "Legal / Compliance Terms", "status": "present|missing", "note": "string" }
  ],
  "requirement_match": [ { "requirement": "string", "status": "matched|partial|missing", "note": "string" } ],
  "key_gaps": [ { "title": "string", "severity": "high|medium|low", "description": "string", "citation": "string or null" } ],
  "commercial_risks": [ { "risk": "string", "severity": "high|medium|low", "mitigation": "string" } ],
  "recommendations": [ { "priority": "high|medium|low", "action": "string", "rationale": "string" } ],
  "readiness_score": 0,
  "readiness_label": "Ready|Needs Minor Revisions|Needs Major Revisions|Not Ready",
  "citations": [ { "ref": "string", "context": "string" } ]
}
Be thorough. If pricing or assumptions are missing, mark them missing and flag as high-severity gaps.`;

// ── Sub-components ────────────────────────────────────────────────────────────

function Input({ label, value, onChange, placeholder, type = "text", hint }) {
  return (
    <div style={{ marginBottom: "0.85rem" }}>
      {label && <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, color: "#555" }}>{label}</div>}
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: "100%", borderRadius: 7, border: "0.5px solid #ccc", padding: "8px 10px", fontSize: 13, fontFamily: "inherit", background: "#fafafa", boxSizing: "border-box" }} />
      {hint && <div style={{ fontSize: 11, color: "#aaa", marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

function TextArea({ label, value, onChange, placeholder, rows = 6 }) {
  return (
    <div style={{ marginBottom: "1rem" }}>
      {label && <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, color: "#444" }}>{label}</div>}
      <textarea rows={rows} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: "100%", borderRadius: 8, border: "0.5px solid #ccc", padding: "10px 12px", fontSize: 13, fontFamily: "inherit", resize: "vertical", background: "#fafafa", boxSizing: "border-box" }} />
    </div>
  );
}

function FileUploadBox({ value, onChange, accept, placeholder, isDragOver, onDragOver, onDragLeave, onDrop }) {
  const ref = useRef();
  return (
    <div
      onClick={() => ref.current.click()}
      onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
      style={{ border: `1.5px dashed ${isDragOver ? ACCENT : "#b4b2a9"}`, borderRadius: 10, padding: "1rem 1.25rem", cursor: "pointer", background: value ? ACCENT_LIGHT : isDragOver ? "#f0faf6" : "#fafafa", display: "flex", alignItems: "center", gap: 10, minHeight: 52, marginBottom: "0.75rem", transition: "all 0.15s" }}>
      <span style={{ fontSize: 18, color: value ? ACCENT : "#aaa" }}>{value ? "✓" : "＋"}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: value ? "#0F6E56" : "#999" }}>{value ? value.name : placeholder}</div>
        {value && <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>{(value.size / 1024).toFixed(1)} KB</div>}
      </div>
      {value && <button onClick={e => { e.stopPropagation(); onChange(null); }} style={{ fontSize: 11, color: "#aaa", background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}>✕ Clear</button>}
      <input ref={ref} type="file" accept={accept} style={{ display: "none" }} onChange={e => onChange(e.target.files[0])} />
    </div>
  );
}

// ── Document input panel ──────────────────────────────────────────────────────
const INPUT_MODES = [
  { id: "text", label: "Paste text", icon: "📝" },
  { id: "file", label: "Upload file", icon: "📎" },
  { id: "gdocs", label: "Google Docs URL", icon: "📄" },
];

function DocumentInput({ label, textValue, onTextChange, file, onFileChange, gdocsUrl, onGdocsChange, inputMode, onModeChange, provider, warningMsg }) {
  const [drag, setDrag] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) { onFileChange(f); onModeChange("file"); }
  };

  return (
    <div style={{ marginBottom: "1rem" }}>
      <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>{label}</div>

      {/* Mode tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {INPUT_MODES.map(m => (
          <button key={m.id} onClick={() => onModeChange(m.id)}
            style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: inputMode === m.id ? `1.5px solid ${ACCENT}` : "0.5px solid #ccc", background: inputMode === m.id ? ACCENT_LIGHT : "#fff", color: inputMode === m.id ? "#0F6E56" : "#555", cursor: "pointer", fontWeight: inputMode === m.id ? 500 : 400, display: "flex", alignItems: "center", gap: 4 }}>
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      {inputMode === "text" && (
        <TextArea value={textValue} onChange={onTextChange} placeholder="Paste document text here..." rows={7} />
      )}

      {inputMode === "file" && (
        <>
          <FileUploadBox
            value={file}
            onChange={onFileChange}
            accept=".pdf,.docx,.doc,.txt,.md"
            placeholder="Click to upload or drag & drop — PDF, DOCX, TXT supported"
            isDragOver={drag}
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={handleDrop}
          />
          <div style={{ fontSize: 11, color: "#bbb", marginBottom: 4 }}>
            Supported: <b>PDF</b> (native for Anthropic &amp; OpenAI via Files API, text-extracted for others) · <b>DOCX</b> · <b>TXT / MD</b>
          </div>
          {warningMsg && (
            <div style={{ fontSize: 12, color: WARN, background: WARN_LIGHT, borderRadius: 6, padding: "6px 10px", marginTop: 4 }}>
              ⚠️ {warningMsg}
            </div>
          )}
        </>
      )}

      {inputMode === "gdocs" && (
        <>
          <Input
            value={gdocsUrl}
            onChange={onGdocsChange}
            placeholder="https://docs.google.com/document/d/…/edit"
            hint='The document must be set to "Anyone with the link can view"'
          />
          {gdocsUrl && !gdocsUrl.includes("docs.google.com") && (
            <div style={{ fontSize: 12, color: DANGER, marginTop: -8, marginBottom: 8 }}>⚠️ This doesn't look like a Google Docs URL</div>
          )}
        </>
      )}
    </div>
  );
}

// ── Log panel ─────────────────────────────────────────────────────────────────
function LogPanel({ logs, onClear }) {
  const [open, setOpen] = useState(false);
  const logRef = useRef();

  const errorCount = logs.filter(l => l.level === "error").length;
  const warnCount = logs.filter(l => l.level === "warn").length;

  return (
    <div style={{ marginTop: "1rem", border: "0.5px solid #e0e0e0", borderRadius: 10, overflow: "hidden" }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", background: "#fafafa", cursor: "pointer", borderBottom: open ? "0.5px solid #e0e0e0" : "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 500, color: "#555" }}>
          🔍 Dev logs ({logs.length})
          {errorCount > 0 && <span style={{ ...BADGE(DANGER, DANGER_LIGHT) }}>{errorCount} error{errorCount !== 1 ? "s" : ""}</span>}
          {warnCount > 0 && <span style={{ ...BADGE("#854F0B", WARN_LIGHT) }}>{warnCount} warn</span>}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {logs.length > 0 && <button onClick={e => { e.stopPropagation(); onClear(); }} style={{ fontSize: 11, color: "#aaa", background: "none", border: "none", cursor: "pointer" }}>Clear</button>}
          <span style={{ fontSize: 11, color: "#aaa" }}>{open ? "▲" : "▼"}</span>
        </div>
      </div>

      {open && (
        <div ref={logRef} style={{ maxHeight: 300, overflowY: "auto", background: "#1a1a1a", fontFamily: "monospace" }}>
          {logs.length === 0
            ? <div style={{ padding: "1rem", fontSize: 12, color: "#555", textAlign: "center" }}>No logs yet. Run a check to see activity.</div>
            : logs.map(log => {
                const lc = LOG_LEVELS[log.level] || LOG_LEVELS.info;
                return (
                  <div key={log.id} style={{ padding: "3px 14px", borderBottom: "0.5px solid #222", display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ color: "#555", fontSize: 10, flexShrink: 0, marginTop: 2 }}>{log.time}</span>
                    <span style={{ color: lc.color, fontSize: 11, flexShrink: 0, marginTop: 1 }}>{lc.icon}</span>
                    <div style={{ flex: 1 }}>
                      <span style={{ color: "#e0e0e0", fontSize: 11 }}>{log.message}</span>
                      {log.detail != null && (
                        <div style={{ color: "#888", fontSize: 10, marginTop: 1, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                          {typeof log.detail === "string" ? log.detail : JSON.stringify(log.detail, null, 2)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
        </div>
      )}
    </div>
  );
}

// ── Result sub-components ─────────────────────────────────────────────────────

function ScoreRing({ score }) {
  const c = scoreColor(score);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 100, height: 100, borderRadius: "50%", background: c.bg, border: `3px solid ${c.fg}`, margin: "0 auto", flexShrink: 0 }}>
      <div style={{ fontSize: 28, fontWeight: 500, color: c.fg, lineHeight: 1 }}>{score}</div>
      <div style={{ fontSize: 10, color: c.fg }}>/ 100</div>
    </div>
  );
}

function ChecklistItem({ item }) {
  const ok = item.status === "present";
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "7px 0", borderBottom: "0.5px solid #f0f0f0" }}>
      <span style={{ fontSize: 15, color: ok ? ACCENT : DANGER, marginTop: 1, flexShrink: 0 }}>{ok ? "✓" : "✗"}</span>
      <div><div style={{ fontSize: 13, fontWeight: 500 }}>{item.section}</div><div style={{ fontSize: 12, color: "#888" }}>{item.note}</div></div>
    </div>
  );
}

function GapItem({ gap }) {
  const sc = { high: { fg: DANGER, bg: DANGER_LIGHT }, medium: { fg: "#854F0B", bg: WARN_LIGHT }, low: { fg: "#3B6D11", bg: "#EAF3DE" } };
  const c = sc[gap.severity] || sc.medium;
  return (
    <div style={{ padding: "9px 0", borderBottom: "0.5px solid #f0f0f0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
        <span style={{ ...BADGE(c.fg, c.bg), textTransform: "capitalize" }}>{gap.severity}</span>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{gap.title}</span>
      </div>
      <div style={{ fontSize: 12, color: "#666", marginBottom: 3 }}>{gap.description}</div>
      {gap.citation && <div style={{ fontSize: 11, color: INFO, background: INFO_LIGHT, borderRadius: 5, padding: "2px 8px", display: "inline-block" }}>📎 {gap.citation}</div>}
    </div>
  );
}

function ReqMatch({ req }) {
  const sc = { matched: { fg: "#0F6E56", bg: "#E1F5EE", label: "Matched" }, partial: { fg: "#854F0B", bg: WARN_LIGHT, label: "Partial" }, missing: { fg: DANGER, bg: DANGER_LIGHT, label: "Missing" } };
  const c = sc[req.status] || sc.partial;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "7px 0", borderBottom: "0.5px solid #f0f0f0" }}>
      <span style={{ ...BADGE(c.fg, c.bg), whiteSpace: "nowrap", marginTop: 2, flexShrink: 0 }}>{c.label}</span>
      <div><div style={{ fontSize: 13, fontWeight: 500 }}>{req.requirement}</div><div style={{ fontSize: 12, color: "#888" }}>{req.note}</div></div>
    </div>
  );
}

function JSONView({ data }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: "1.5rem" }}>
      <button onClick={() => setOpen(!open)} style={{ fontSize: 13, color: INFO, background: "none", border: "0.5px solid " + INFO, borderRadius: 6, padding: "5px 14px", cursor: "pointer" }}>
        {open ? "Hide" : "View"} structured JSON output
      </button>
      {open && (
        <pre style={{ marginTop: 10, background: "#1a1a1a", color: "#9fe1cb", borderRadius: 8, padding: "1rem", fontSize: 11, overflowX: "auto", maxHeight: 420, overflowY: "auto" }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ── Provider config panel ─────────────────────────────────────────────────────
function ProviderConfig({ cfg, setCfg }) {
  const prov = PROVIDERS[cfg.provider];
  return (
    <div style={{ ...SECTION_STYLE, background: "#f9f9f9" }}>
      <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>⚙️ Model configuration</div>
      <div style={{ marginBottom: "0.85rem" }}>
        <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 6, color: "#555" }}>Provider</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
          {Object.entries(PROVIDERS).map(([key, p]) => (
            <button key={key} onClick={() => setCfg(c => ({ ...c, provider: key, baseUrl: p.defaultBase, model: p.defaultModel, apiKey: "" }))}
              style={{ padding: "7px 6px", borderRadius: 7, border: cfg.provider === key ? `1.5px solid ${ACCENT}` : "0.5px solid #ddd", background: cfg.provider === key ? ACCENT_LIGHT : "#fff", color: cfg.provider === key ? "#0F6E56" : "#444", fontSize: 12, fontWeight: cfg.provider === key ? 500 : 400, cursor: "pointer", textAlign: "center", lineHeight: 1.3 }}>
              {p.icon} {p.label}
            </button>
          ))}
        </div>
        {prov.hint && <div style={{ fontSize: 11, color: "#aaa", marginTop: 5 }}>{prov.hint}</div>}
      </div>
      {prov.baseEditable && <Input label="Base URL" value={cfg.baseUrl} onChange={v => setCfg(c => ({ ...c, baseUrl: v }))} placeholder={prov.defaultBase} hint="URL of your local server" />}
      <Input label="Model" value={cfg.model} onChange={v => setCfg(c => ({ ...c, model: v }))} placeholder={prov.modelPlaceholder} />
      {(prov.needsKey || prov.keyPlaceholder) && <Input label={prov.keyLabel || "API key"} value={cfg.apiKey} onChange={v => setCfg(c => ({ ...c, apiKey: v }))} placeholder={prov.keyPlaceholder} type="password" />}
      {(cfg.provider === "ollama" || cfg.provider === "vllm") && (
        <div style={{ background: INFO_LIGHT, color: "#185FA5", borderRadius: 7, padding: "8px 12px", fontSize: 12, lineHeight: 1.6 }}>
          {cfg.provider === "ollama" ? "Make sure Ollama is running and the model is pulled. CORS must be enabled: set OLLAMA_ORIGINS=* before starting Ollama." : "Ensure your vLLM server is reachable from the browser. If auth is enabled, provide the bearer token above."}
        </div>
      )}
    </div>
  );
}

// ── Main app ──────────────────────────────────────────────────────────────────
export default function App() {
  const [cfg, setCfg] = useState({ provider: "anthropic", baseUrl: PROVIDERS.anthropic.defaultBase, model: PROVIDERS.anthropic.defaultModel, apiKey: "" });
  const [showCfg, setShowCfg] = useState(true);

  // Proposal state
  const [proposalMode, setProposalMode] = useState("text");
  const [proposalText, setProposalText] = useState("");
  const [proposalFile, setProposalFile] = useState(null);
  const [proposalGdocs, setProposalGdocs] = useState("");

  // TOR state
  const [torMode, setTorMode] = useState("text");
  const [torText, setTorText] = useState("");
  const [torFile, setTorFile] = useState(null);
  const [torGdocs, setTorGdocs] = useState("");

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [logs, setLogs] = useState([]);

  const logger = useCallback(createLogger(setLogs), []);

  // Warning messages
  const proposalWarning = proposalMode === "file" && proposalFile?.name.endsWith(".pdf") && !["anthropic", "openai"].includes(cfg.provider)
    ? "Native PDF is supported for Anthropic and OpenAI. For other providers, text will be extracted from the PDF."
    : proposalMode === "file" && proposalFile?.name.endsWith(".doc")
    ? "Legacy .doc is not fully supported. Convert to .docx for best results."
    : null;

  const torWarning = torMode === "file" && torFile?.name.endsWith(".doc")
    ? "Legacy .doc is not fully supported. Convert to .docx for best results."
    : null;

  const runCheck = async () => {
    setError("");
    logger.info("=== Starting proposal check ===");
    logger.info("Config", { provider: cfg.provider, model: cfg.model, baseUrl: cfg.baseUrl });

    const prov = PROVIDERS[cfg.provider];
    if (prov.needsKey && !cfg.apiKey) {
      const msg = "Please enter your API key in the config above.";
      setError(msg); logger.error("Validation failed", msg); return;
    }

    // Validate inputs
    const hasProposal = proposalMode === "text" ? proposalText.trim() : proposalMode === "file" ? proposalFile : proposalGdocs.trim();
    const hasTor = torMode === "text" ? torText.trim() : torMode === "file" ? torFile : torGdocs.trim();
    if (!hasProposal) { const m = "Please provide a proposal document."; setError(m); logger.error("Validation", m); return; }
    if (!hasTor) { const m = "Please provide a client brief / TOR."; setError(m); logger.error("Validation", m); return; }

    setLoading(true); setResult(null);

    try {
      // Extract proposal
      setStep("Reading proposal document...");
      logger.info("Extracting proposal document", { mode: proposalMode });
      const proposalSource = proposalMode === "text" ? { type: "text", value: proposalText }
        : proposalMode === "file" ? { type: "file", value: proposalFile }
        : { type: "gdocs", value: proposalGdocs };
      const { text: proposalContent, pdfB64, pdfFile } = await extractDocument(proposalSource, logger);
      logger.success("Proposal extracted", proposalContent ? `${proposalContent.length} chars` : "PDF ready");

      // Decide how to pass PDF to the LLM
      let finalProposalContent = proposalContent;
      let finalPdfB64 = pdfB64;
      let finalPdfFile = null;

      if (pdfB64) {
        if (cfg.provider === "anthropic") {
          // Anthropic: send as base64 document block
          logger.info("PDF strategy: Anthropic native base64");
          finalPdfB64 = pdfB64;
        } else if (cfg.provider === "openai") {
          // OpenAI: upload via Files API then use Responses API
          logger.info("PDF strategy: OpenAI Files API → Responses API");
          finalPdfFile = pdfFile;
          finalPdfB64 = null;
          finalProposalContent = userMessage => userMessage; // handled inside callLLM
        } else {
          // All other providers: fall back to placeholder text
          logger.warn(`PDF strategy: provider '${cfg.provider}' does not support native PDF — using placeholder`, "Upload DOCX or paste text for best results with this provider.");
          finalProposalContent = `[PDF file: ${proposalFile?.name}. Native PDF is not supported for the '${cfg.provider}' provider. Please upload a DOCX or paste the text instead.]`;
          finalPdfB64 = null;
        }
      }

      // Extract TOR
      setStep("Reading TOR / client brief...");
      logger.info("Extracting TOR document", { mode: torMode });
      const torSource = torMode === "text" ? { type: "text", value: torText }
        : torMode === "file" ? { type: "file", value: torFile }
        : { type: "gdocs", value: torGdocs };
      const { text: torContent } = await extractDocument(torSource, logger);
      logger.success("TOR extracted", `${torContent?.length} chars`);

      // Build user message
      // For OpenAI PDF path, the content array is built inside callLLM; userMessage is just the text instructions
      const userMsg = `PROPOSAL DOCUMENT:\n${finalPdfB64 ? "[PDF attached above]" : finalPdfFile ? "[PDF attached as uploaded file]" : finalProposalContent}\n\n---\nCLIENT BRIEF / TOR:\n${torContent}\n\nReview the proposal against this client brief and return the JSON analysis.`;
      logger.info("User message built", `${userMsg.length} chars total`);

      // Call LLM
      setStep("Analyzing proposal against TOR...");
      const raw = await callLLM({
        provider: cfg.provider,
        baseUrl: cfg.baseUrl,
        apiKey: cfg.apiKey,
        model: cfg.model,
        systemPrompt: SYSTEM_PROMPT,
        userMessage: userMsg,
        proposalPdfB64: finalPdfB64,
        proposalPdfFile: finalPdfFile,
        logger,
      });

      // Parse JSON
      logger.info("Parsing JSON response", `Raw length: ${raw.length}`);
      const clean = raw.replace(/```json[\s\S]*?```|```[\s\S]*?```/g, m => m.slice(m.indexOf("\n") + 1, m.lastIndexOf("```"))).replace(/```json|```/g, "").trim();
      let parsed;
      try {
        parsed = JSON.parse(clean);
        logger.success("JSON parsed successfully", { score: parsed.readiness_score, label: parsed.readiness_label });
      } catch (parseErr) {
        logger.error("JSON parse failed", { error: parseErr.message, rawPreview: clean.substring(0, 300) });
        throw new Error(`Response was not valid JSON: ${parseErr.message}. Raw preview: ${clean.substring(0, 200)}`);
      }

      setResult(parsed);
      logger.success("=== Analysis complete ===", { score: parsed.readiness_score });

    } catch (e) {
      const msg = e.message || String(e);
      setError("Analysis failed: " + msg);
      logger.error("=== Analysis FAILED ===", { message: msg, stack: e.stack });
    }

    setStep(""); setLoading(false);
  };

  const sc = result ? scoreColor(result.readiness_score) : {};
  const sevBadge = (s) => {
    const m = { high: { fg: DANGER, bg: DANGER_LIGHT }, medium: { fg: "#854F0B", bg: WARN_LIGHT }, low: { fg: "#3B6D11", bg: "#EAF3DE" } };
    return m[s] || m.medium;
  };

  return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: "1.5rem 1rem", fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ position: "absolute", fontSize: 0 }}>BD Proposal Checking Agent</h2>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 9, background: ACCENT_LIGHT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>📋</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 500, color: "#1a1a1a" }}>BD Proposal Checking Agent</div>
            <div style={{ fontSize: 12, color: "#999" }}>AMANA Solutions · {PROVIDERS[cfg.provider].icon} {PROVIDERS[cfg.provider].label} · {cfg.model}</div>
          </div>
        </div>
        {!result && (
          <button onClick={() => setShowCfg(s => !s)} style={{ fontSize: 12, color: "#666", background: showCfg ? "#f0f0f0" : "#fff", border: "0.5px solid #ddd", borderRadius: 6, padding: "5px 12px", cursor: "pointer" }}>
            ⚙️ {showCfg ? "Hide" : "Config"}
          </button>
        )}
      </div>

      {/* Config panel */}
      {!result && showCfg && <ProviderConfig cfg={cfg} setCfg={setCfg} />}

      {/* Input form */}
      {!result && (
        <div style={SECTION_STYLE}>
          <DocumentInput
            label="Proposal document"
            inputMode={proposalMode} onModeChange={setProposalMode}
            textValue={proposalText} onTextChange={setProposalText}
            file={proposalFile} onFileChange={setProposalFile}
            gdocsUrl={proposalGdocs} onGdocsChange={setProposalGdocs}
            provider={cfg.provider}
            warningMsg={proposalWarning}
          />

          <div style={{ height: 1, background: "#f0f0f0", margin: "0.5rem 0 1rem" }} />

          <DocumentInput
            label="Client brief / TOR"
            inputMode={torMode} onModeChange={setTorMode}
            textValue={torText} onTextChange={setTorText}
            file={torFile} onFileChange={setTorFile}
            gdocsUrl={torGdocs} onGdocsChange={setTorGdocs}
            provider={cfg.provider}
            warningMsg={torWarning}
          />

          {error && <div style={{ color: DANGER, fontSize: 13, marginBottom: 10, padding: "8px 12px", background: DANGER_LIGHT, borderRadius: 7 }}>⚠️ {error}</div>}

          <button onClick={runCheck} disabled={loading}
            style={{ background: loading ? "#ccc" : ACCENT, color: "#fff", border: "none", borderRadius: 8, padding: "10px 28px", fontSize: 14, fontWeight: 500, cursor: loading ? "not-allowed" : "pointer", width: "100%" }}>
            {loading ? `⏳ ${step || "Running analysis..."}` : "▶ Run proposal check"}
          </button>

          <LogPanel logs={logs} onClear={() => setLogs([])} />
        </div>
      )}

      {/* Results */}
      {result && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: "1rem" }}>
            <button onClick={() => setResult(null)} style={{ fontSize: 13, color: "#888", background: "none", border: "0.5px solid #ccc", borderRadius: 6, padding: "4px 12px", cursor: "pointer" }}>
              ← New check
            </button>
          </div>

          {/* Score + summary */}
          <div style={{ ...SECTION_STYLE, display: "grid", gridTemplateColumns: "110px 1fr", gap: "1.25rem", alignItems: "center" }}>
            <ScoreRing score={result.readiness_score} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>{result.proposal_summary?.title || "Proposal Review"}</div>
              <span style={{ ...BADGE(sc.fg, sc.bg), marginBottom: 8, display: "inline-block" }}>{result.readiness_label}</span>
              <div style={{ fontSize: 12, color: "#666", lineHeight: 1.7, marginTop: 4 }}>
                <b>Client:</b> {result.proposal_summary?.client} &nbsp;·&nbsp; <b>Duration:</b> {result.proposal_summary?.duration || "—"} &nbsp;·&nbsp; <b>Value:</b> {result.proposal_summary?.estimated_value || "—"}
              </div>
              <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>{result.proposal_summary?.objective}</div>
              <div style={{ fontSize: 11, color: "#bbb", marginTop: 6 }}>via {PROVIDERS[cfg.provider].icon} {PROVIDERS[cfg.provider].label} · {cfg.model}</div>
            </div>
          </div>

          <div style={SECTION_STYLE}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>Completeness checklist</div>
            {result.completeness_checklist?.map((item, i) => <ChecklistItem key={i} item={item} />)}
          </div>

          <div style={SECTION_STYLE}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>Requirement match</div>
            {result.requirement_match?.length
              ? result.requirement_match.map((r, i) => <ReqMatch key={i} req={r} />)
              : <div style={{ fontSize: 13, color: "#aaa" }}>No TOR requirements extracted.</div>}
          </div>

          <div style={SECTION_STYLE}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>
              Key gaps &nbsp;<span style={{ ...BADGE(DANGER, DANGER_LIGHT) }}>{result.key_gaps?.filter(g => g.severity === "high").length} high</span>
            </div>
            {result.key_gaps?.map((g, i) => <GapItem key={i} gap={g} />)}
          </div>

          <div style={SECTION_STYLE}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>Commercial risks</div>
            {result.commercial_risks?.map((r, i) => {
              const c = sevBadge(r.severity);
              return (
                <div key={i} style={{ padding: "9px 0", borderBottom: "0.5px solid #f0f0f0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span style={{ ...BADGE(c.fg, c.bg), textTransform: "capitalize" }}>{r.severity}</span>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{r.risk}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#888" }}>Mitigation: {r.mitigation}</div>
                </div>
              );
            })}
          </div>

          <div style={SECTION_STYLE}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>Recommendations</div>
            {result.recommendations?.map((r, i) => {
              const c = sevBadge(r.priority);
              return (
                <div key={i} style={{ padding: "9px 0", borderBottom: "0.5px solid #f0f0f0", display: "flex", gap: 10 }}>
                  <span style={{ ...BADGE(c.fg, c.bg), whiteSpace: "nowrap", height: "fit-content", marginTop: 2, textTransform: "capitalize", flexShrink: 0 }}>{r.priority}</span>
                  <div><div style={{ fontSize: 13, fontWeight: 500 }}>{r.action}</div><div style={{ fontSize: 12, color: "#888" }}>{r.rationale}</div></div>
                </div>
              );
            })}
          </div>

          {result.citations?.length > 0 && (
            <div style={SECTION_STYLE}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>Citations / references</div>
              {result.citations.map((c, i) => (
                <div key={i} style={{ padding: "6px 0", borderBottom: "0.5px solid #f0f0f0" }}>
                  <div style={{ fontSize: 12, color: INFO, fontWeight: 500 }}>📎 {c.ref}</div>
                  <div style={{ fontSize: 12, color: "#777" }}>{c.context}</div>
                </div>
              ))}
            </div>
          )}

          <JSONView data={result} />
          <LogPanel logs={logs} onClear={() => setLogs([])} />
        </div>
      )}
    </div>
  );
}