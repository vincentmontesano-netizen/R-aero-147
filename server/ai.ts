/**
 * Multi-provider AI service for the e-learning maker.
 *  - Text  : OpenAI · Anthropic (Claude) · Google (Gemini) · Mistral
 *  - Image : OpenAI (gpt-image-1) · Google (Imagen)
 *  - Speech: OpenAI (TTS) · Google (Cloud TTS)
 * Keys come from environment variables; missing keys degrade gracefully.
 * Generated media is persisted through the local storage layer.
 */
import { storagePut } from "./storage";

export type AIProvider = "openai" | "anthropic" | "google" | "mistral";
export type AICapability = "text" | "image" | "tts";

export class AIError extends Error {}

const envKey = (name: string) => (process.env[name] ?? "").trim();
const KEY = {
  openai: () => envKey("OPENAI_API_KEY"),
  anthropic: () => envKey("ANTHROPIC_API_KEY"),
  google: () => envKey("GEMINI_API_KEY") || envKey("GOOGLE_API_KEY"),
  mistral: () => envKey("MISTRAL_API_KEY"),
};

const MODEL = {
  openaiText: () => envKey("OPENAI_TEXT_MODEL") || "gpt-4o-mini",
  openaiImage: () => envKey("OPENAI_IMAGE_MODEL") || "gpt-image-1",
  openaiTTS: () => envKey("OPENAI_TTS_MODEL") || "gpt-4o-mini-tts",
  openaiVoice: () => envKey("OPENAI_TTS_VOICE") || "alloy",
  anthropic: () => envKey("ANTHROPIC_MODEL") || "claude-sonnet-4-6",
  google: () => envKey("GEMINI_MODEL") || "gemini-1.5-flash",
  googleImage: () => envKey("GEMINI_IMAGE_MODEL") || "imagen-3.0-generate-002",
  mistralImage: () => envKey("MISTRAL_IMAGE_MODEL") || "mistral-medium-latest",
  mistralTTS: () => envKey("MISTRAL_TTS_MODEL") || "voxtral-mini-tts-2603",
  mistralVoice: () => envKey("MISTRAL_TTS_VOICE") || "en_paul_neutral",
};

/** Capability matrix exposed to the UI (which providers are usable). */
export function aiProviderStatus() {
  return {
    openai: { label: "OpenAI", text: !!KEY.openai(), image: !!KEY.openai(), tts: !!KEY.openai() },
    anthropic: { label: "Anthropic (Claude)", text: !!KEY.anthropic(), image: false, tts: false },
    google: { label: "Google (Gemini)", text: !!KEY.google(), image: !!KEY.google(), tts: !!KEY.google() },
    // Mistral does text, image (image_generation agent tool) and TTS (Voxtral).
    mistral: { label: "Mistral", text: !!KEY.mistral(), image: !!KEY.mistral(), tts: !!KEY.mistral() },
  };
}

function requireKey(provider: AIProvider): string {
  const k = KEY[provider]();
  if (!k) throw new AIError(`Clé API manquante pour ${provider}. Configurez la variable d'environnement correspondante.`);
  return k;
}

// ─── Text generation ──────────────────────────────────────────────────────────
export async function generateText(opts: {
  provider: AIProvider;
  system?: string;
  prompt: string;
  json?: boolean;
  maxTokens?: number;
}): Promise<string> {
  const { provider, system, prompt, json, maxTokens = 2000 } = opts;
  requireKey(provider);

  if (provider === "openai" || provider === "mistral") {
    const base = provider === "openai" ? "https://api.openai.com/v1" : "https://api.mistral.ai/v1";
    const model = provider === "openai" ? MODEL.openaiText() : (envKey("MISTRAL_MODEL") || "mistral-large-latest");
    const body: any = {
      model,
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: prompt },
      ],
      max_tokens: maxTokens,
    };
    if (json) body.response_format = { type: "json_object" };
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY[provider]()}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new AIError(`${provider}: ${res.status} ${await res.text().catch(() => "")}`.slice(0, 300));
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? "";
  }

  if (provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": KEY.anthropic(),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL.anthropic(),
        max_tokens: maxTokens,
        ...(system ? { system: system + (json ? " Répondez uniquement avec du JSON valide." : "") } : json ? { system: "Répondez uniquement avec du JSON valide." } : {}),
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new AIError(`anthropic: ${res.status} ${await res.text().catch(() => "")}`.slice(0, 300));
    const data = await res.json();
    return (data.content ?? []).map((b: any) => b.text ?? "").join("");
  }

  // google (gemini)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL.google()}:generateContent?key=${KEY.google()}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens, ...(json ? { responseMimeType: "application/json" } : {}) },
    }),
  });
  if (!res.ok) throw new AIError(`google: ${res.status} ${await res.text().catch(() => "")}`.slice(0, 300));
  const data = await res.json();
  return (data.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join("");
}

/** Parse JSON from a model response, tolerating ```json fences and surrounding prose. */
export function parseJsonLoose<T = any>(text: string): T {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const first = Math.min(...["{", "["].map((c) => { const i = t.indexOf(c); return i === -1 ? Infinity : i; }));
  const lastObj = t.lastIndexOf("}");
  const lastArr = t.lastIndexOf("]");
  const last = Math.max(lastObj, lastArr);
  if (first !== Infinity && last !== -1) t = t.slice(first, last + 1);
  return JSON.parse(t) as T;
}

// ─── Image generation ─────────────────────────────────────────────────────────
function pickProvider(pref: AIProvider | undefined, cap: "image" | "tts"): AIProvider {
  const status = aiProviderStatus();
  if (pref && (status as any)[pref]?.[cap]) return pref;
  if (status.openai[cap]) return "openai";
  if (status.google[cap]) return "google";
  if (status.mistral[cap]) return "mistral";
  throw new AIError(`Aucun fournisseur configuré pour la génération ${cap === "image" ? "d'image" : "audio"} (Mistral, OpenAI ou Google requis).`);
}

// Mistral image generation uses the Agents API: a cached agent with the
// `image_generation` tool → a conversation → a generated file we download.
let _mistralImageAgentId: string | null = null;
async function mistralImageAgent(): Promise<string> {
  if (_mistralImageAgentId) return _mistralImageAgentId;
  const res = await fetch("https://api.mistral.ai/v1/agents", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY.mistral()}` },
    body: JSON.stringify({ model: MODEL.mistralImage(), name: "R-AERO image generator", tools: [{ type: "image_generation" }] }),
  });
  if (!res.ok) throw new AIError(`mistral agent: ${res.status} ${await res.text().catch(() => "")}`.slice(0, 300));
  const agent = await res.json();
  _mistralImageAgentId = agent.id;
  return agent.id;
}

async function mistralGenerateImage(prompt: string): Promise<Buffer> {
  const agentId = await mistralImageAgent();
  const convRes = await fetch("https://api.mistral.ai/v1/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY.mistral()}` },
    body: JSON.stringify({ agent_id: agentId, inputs: prompt }),
  });
  if (!convRes.ok) throw new AIError(`mistral image: ${convRes.status} ${await convRes.text().catch(() => "")}`.slice(0, 300));
  const conv = await convRes.json();
  const fileId: string | undefined = (JSON.stringify(conv).match(/"file_id":"([^"]+)"/) || [])[1];
  if (!fileId) throw new AIError("Mistral n'a retourné aucune image.");
  const fileRes = await fetch(`https://api.mistral.ai/v1/files/${fileId}/content`, {
    headers: { Authorization: `Bearer ${KEY.mistral()}` },
  });
  if (!fileRes.ok) throw new AIError(`mistral file: ${fileRes.status}`.slice(0, 300));
  return Buffer.from(await fileRes.arrayBuffer());
}

export async function generateImage(opts: { provider?: AIProvider; prompt: string }): Promise<{ url: string }> {
  const provider = pickProvider(opts.provider, "image");
  let buffer: Buffer;
  let ext = "png";
  let contentType = "image/png";

  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY.openai()}` },
      body: JSON.stringify({ model: MODEL.openaiImage(), prompt: opts.prompt, n: 1, size: "1024x1024" }),
    });
    if (!res.ok) throw new AIError(`openai image: ${res.status} ${await res.text().catch(() => "")}`.slice(0, 300));
    const data = await res.json();
    buffer = Buffer.from(data.data[0].b64_json, "base64");
  } else if (provider === "mistral") {
    buffer = await mistralGenerateImage(opts.prompt);
    ext = "jpg"; contentType = "image/jpeg";
  } else {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL.googleImage()}:predict?key=${KEY.google()}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instances: [{ prompt: opts.prompt }], parameters: { sampleCount: 1 } }),
    });
    if (!res.ok) throw new AIError(`google image: ${res.status} ${await res.text().catch(() => "")}`.slice(0, 300));
    const data = await res.json();
    const b64 = data.predictions?.[0]?.bytesBase64Encoded;
    if (!b64) throw new AIError("Google Imagen n'a retourné aucune image.");
    buffer = Buffer.from(b64, "base64");
  }

  const { url } = await storagePut(`courses/images/slide-${Date.now()}.${ext}`, buffer, contentType);
  return { url };
}

// ─── Speech (text-to-speech) ────────────────────────────────────────────────
export async function generateSpeech(opts: { provider?: AIProvider; text: string; language?: string }): Promise<{ url: string }> {
  const provider = pickProvider(opts.provider, "tts");
  let buffer: Buffer;
  let contentType = "audio/mpeg";
  let ext = "mp3";

  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY.openai()}` },
      body: JSON.stringify({ model: MODEL.openaiTTS(), voice: MODEL.openaiVoice(), input: opts.text, response_format: "mp3" }),
    });
    if (!res.ok) throw new AIError(`openai tts: ${res.status} ${await res.text().catch(() => "")}`.slice(0, 300));
    buffer = Buffer.from(await res.arrayBuffer());
  } else if (provider === "mistral") {
    const res = await fetch("https://api.mistral.ai/v1/audio/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY.mistral()}` },
      body: JSON.stringify({ model: MODEL.mistralTTS(), input: opts.text, voice_id: MODEL.mistralVoice(), response_format: "mp3", stream: false }),
    });
    if (!res.ok) throw new AIError(`mistral tts: ${res.status} ${await res.text().catch(() => "")}`.slice(0, 300));
    const data = await res.json();
    if (!data.audio_data) throw new AIError("Mistral TTS n'a retourné aucun audio.");
    buffer = Buffer.from(data.audio_data, "base64");
  } else {
    const langCode = (opts.language ?? "en").startsWith("fr") ? "fr-FR" : "en-US";
    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${KEY.google()}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text: opts.text },
        voice: { languageCode: langCode, ssmlGender: "NEUTRAL" },
        audioConfig: { audioEncoding: "MP3" },
      }),
    });
    if (!res.ok) throw new AIError(`google tts: ${res.status} ${await res.text().catch(() => "")}`.slice(0, 300));
    const data = await res.json();
    if (!data.audioContent) throw new AIError("Google TTS n'a retourné aucun audio.");
    buffer = Buffer.from(data.audioContent, "base64");
  }

  const { url } = await storagePut(`courses/audio/narration-${Date.now()}.${ext}`, buffer, contentType);
  return { url };
}

// ─── High-level authoring helpers ─────────────────────────────────────────────
const LANG_NAME = (l?: string) => (l?.startsWith("fr") ? "français" : "English");

export type GeneratedSlide = {
  title: string;
  body: string;
  imagePrompt: string;
  quiz?: { question: string; options: string[]; correct: number[]; explanation: string };
};

export async function aiGenerateOutline(opts: {
  provider: AIProvider;
  topic: string;
  audience?: string;
  slideCount?: number;
  language?: string;
  level?: string;          // beginner | intermediate | advanced
  tone?: string;           // formal | conversational | technical
  domain?: string;         // Part-66 module / category, free text
  objectives?: string;     // must-cover key points (free text)
  quizCoverage?: string;   // none | some | all
  references?: boolean;     // cite EASA Part-66/147 references
}): Promise<{ title: string; description: string; slides: GeneratedSlide[] }> {
  const lang = LANG_NAME(opts.language);
  const n = Math.min(Math.max(opts.slideCount ?? 6, 2), 14);
  const quizRule = opts.quizCoverage === "all"
    ? "Add a quiz to EVERY slide."
    : opts.quizCoverage === "none"
      ? "Do NOT add any quiz (set quiz to null on every slide)."
      : "Add a quiz to roughly half of the slides.";
  const system = `You are an instructional designer creating EASA Part-147 aviation maintenance e-learning courses. Write everything in ${lang}. Be technically accurate, concise and pedagogical.`;
  const prompt = `Create a slide-based e-learning course about: "${opts.topic}".
Target audience: ${opts.audience || "aircraft maintenance technicians"}.
${opts.level ? `Difficulty level: ${opts.level}.\n` : ""}${opts.tone ? `Writing tone/style: ${opts.tone}.\n` : ""}${opts.domain ? `Part-66 domain / module: ${opts.domain}.\n` : ""}${opts.objectives ? `Key points that MUST be covered: ${opts.objectives}.\n` : ""}${opts.references ? `Where relevant, cite the applicable EASA Part-66 / Part-147 references.\n` : ""}Produce exactly ${n} slides. Output strict JSON of the form:
{"title": string, "description": string, "slides": [{"title": string, "body": string (2-5 sentences of learner-facing content), "imagePrompt": string (a concise English prompt to illustrate the slide), "quiz": {"question": string, "options": [string, string, string, string], "correct": [number] (indices of correct options), "explanation": string} | null }]}
${quizRule} Keep "body" suitable to be read aloud as narration.`;
  const raw = await generateText({ provider: opts.provider, system, prompt, json: true, maxTokens: 3500 });
  const parsed = parseJsonLoose<{ title: string; description: string; slides: GeneratedSlide[] }>(raw);
  parsed.slides = (parsed.slides ?? []).map((s) => ({
    title: s.title ?? "",
    body: s.body ?? "",
    imagePrompt: s.imagePrompt ?? "",
    quiz: s.quiz && s.quiz.question ? s.quiz : undefined,
  }));
  return parsed;
}

export async function aiWriteSlideText(opts: { provider: AIProvider; instruction: string; language?: string }): Promise<string> {
  const system = `You are an instructional designer. Write in ${LANG_NAME(opts.language)}. Return only the slide body text (2-5 sentences), no markdown headings.`;
  return (await generateText({ provider: opts.provider, system, prompt: opts.instruction, maxTokens: 600 })).trim();
}

export async function aiGenerateQuiz(opts: { provider: AIProvider; content: string; language?: string }): Promise<GeneratedSlide["quiz"]> {
  const system = `You write multiple-choice quiz questions in ${LANG_NAME(opts.language)}. Output strict JSON only.`;
  const prompt = `From the following slide content, write ONE multiple-choice question with 4 options.
Content: """${opts.content}"""
JSON: {"question": string, "options": [string,string,string,string], "correct": [number], "explanation": string}`;
  const raw = await generateText({ provider: opts.provider, system, prompt, json: true, maxTokens: 500 });
  return parseJsonLoose(raw);
}
