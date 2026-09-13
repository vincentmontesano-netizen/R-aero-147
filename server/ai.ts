import { z } from "zod";
/**
 * Multi-provider AI service for the e-learning maker.
 *  - Text  : OpenAI · Anthropic (Claude) · Google (Gemini) · Mistral
 *  - Image : OpenAI (gpt-image-1) · Google (Imagen)
 *  - Speech: OpenAI (TTS) · Google (Cloud TTS)
 * Keys come from environment variables; missing keys degrade gracefully.
 * Generated media is persisted through the local storage layer.
 */
import { saveCourseMedia } from "./courseMedia";

export type AIProvider = "openai" | "anthropic" | "google" | "mistral";
export type AICapability = "text" | "image" | "tts";

// Bound each provider request, including reading its response body.
function aiFetch(url:string,init?:RequestInit){return fetch(url,{...init,signal:AbortSignal.timeout(180000)});}

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
    const res = await aiFetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY[provider]()}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new AIError(`${provider}: ${res.status} ${await res.text().catch(() => "")}`.slice(0, 300));
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? "";
  }

  if (provider === "anthropic") {
    const res = await aiFetch("https://api.anthropic.com/v1/messages", {
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
  const res = await aiFetch(url, {
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
  if (typeof text !== "string" || text.length > 200000) throw new AIError("La réponse IA est vide, trop volumineuse ou invalide. Réessayez avec une demande plus courte.");
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const first = Math.min(...["{", "["].map((c) => { const i = t.indexOf(c); return i === -1 ? Infinity : i; }));
  const lastObj = t.lastIndexOf("}");
  const lastArr = t.lastIndexOf("]");
  const last = Math.max(lastObj, lastArr);
  if (first !== Infinity && last !== -1) t = t.slice(first, last + 1);
  try { return JSON.parse(t) as T; } catch { throw new AIError("La réponse IA ne contient pas un JSON exploitable. Réessayez."); }
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
  const res = await aiFetch("https://api.mistral.ai/v1/agents", {
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
  const convRes = await aiFetch("https://api.mistral.ai/v1/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY.mistral()}` },
    body: JSON.stringify({ agent_id: agentId, inputs: prompt }),
  });
  if (!convRes.ok) throw new AIError(`mistral image: ${convRes.status} ${await convRes.text().catch(() => "")}`.slice(0, 300));
  const conv = await convRes.json();
  const fileId: string | undefined = (JSON.stringify(conv).match(/"file_id":"([^"]+)"/) || [])[1];
  if (!fileId) throw new AIError("Mistral n'a retourné aucune image.");
  const fileRes = await aiFetch(`https://api.mistral.ai/v1/files/${fileId}/content`, {
    headers: { Authorization: `Bearer ${KEY.mistral()}` },
  });
  if (!fileRes.ok) throw new AIError(`mistral file: ${fileRes.status}`.slice(0, 300));
  return Buffer.from(await fileRes.arrayBuffer());
}

export async function generateImage(opts: { provider?: AIProvider; prompt: string; actor: { id: number; role: string }; trainingId: number }): Promise<{ url: string }> {
  const provider = pickProvider(opts.provider, "image");
  let buffer: Buffer;
  let contentType = "image/png";

  if (provider === "openai") {
    const res = await aiFetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY.openai()}` },
      body: JSON.stringify({ model: MODEL.openaiImage(), prompt: opts.prompt, n: 1, size: "1024x1024" }),
    });
    if (!res.ok) throw new AIError(`openai image: ${res.status} ${await res.text().catch(() => "")}`.slice(0, 300));
    const data = await res.json();
    buffer = Buffer.from(data.data[0].b64_json, "base64");
  } else if (provider === "mistral") {
    buffer = await mistralGenerateImage(opts.prompt);
    contentType = "image/jpeg";
  } else {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL.googleImage()}:predict?key=${KEY.google()}`;
    const res = await aiFetch(url, {
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

  return saveCourseMedia(opts.actor, opts.trainingId, buffer, contentType);
}

async function speechBase64(response: Response, field: string): Promise<Buffer> {
  const data = await response.json().catch(() => { throw new AIError("Réponse audio JSON invalide."); });
  const value = data?.[field];
  if (typeof value !== "string" || !value.length || value.length > 69905068 || value.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(value)) throw new AIError("Réponse audio encodée invalide.");
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value) throw new AIError("Réponse audio encodée invalide.");
  return bytes;
}

// ─── Speech (text-to-speech) ────────────────────────────────────────────────
export async function generateSpeech(opts: { provider?: AIProvider; text: string; language?: string; actor: { id: number; role: string }; trainingId: number }): Promise<{ url: string }> {
  const language = z.enum(["fr", "en", "ar"]).parse(opts.language ?? "en");
  const text = z.string().trim().min(1).max(20000).parse(opts.text);
  const provider = pickProvider(opts.provider, "tts");
  let buffer: Buffer;
  let contentType = "audio/mpeg";

  if (provider === "openai") {
    const res = await aiFetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY.openai()}` },
      body: JSON.stringify({ model: MODEL.openaiTTS(), voice: MODEL.openaiVoice(), input: text, response_format: "mp3" }),
    });
    if (!res.ok) throw new AIError(`openai : génération audio refusée (HTTP ${res.status}).`);
    buffer = Buffer.from(await res.arrayBuffer());
  } else if (provider === "mistral") {
    const res = await aiFetch("https://api.mistral.ai/v1/audio/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY.mistral()}` },
      body: JSON.stringify({ model: MODEL.mistralTTS(), input: text, voice_id: MODEL.mistralVoice(), response_format: "mp3", stream: false }),
    });
    if (!res.ok) throw new AIError(`mistral : génération audio refusée (HTTP ${res.status}).`);
    buffer = await speechBase64(res, "audio_data");
  } else {
    const langCode = { fr: "fr-FR", en: "en-US", ar: "ar-XA" }[language];
    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${KEY.google()}`;
    const res = await aiFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: langCode, ssmlGender: "NEUTRAL" },
        audioConfig: { audioEncoding: "MP3" },
      }),
    });
    if (!res.ok) throw new AIError(`google : génération audio refusée (HTTP ${res.status}).`);
    buffer = await speechBase64(res, "audioContent");
  }

  if (!buffer.length || buffer.length > 50 * 1024 * 1024 || !(buffer.subarray(0, 3).toString() === "ID3" || (buffer[0] === 255 && (buffer[1] & 0xe0) === 0xe0))) throw new AIError("Réponse audio vide, trop volumineuse ou format MP3 non reconnu.");
  return saveCourseMedia(opts.actor, opts.trainingId, buffer, contentType);
}

// ─── High-level authoring helpers ─────────────────────────────────────────────
const LANG_NAME = (l?: string) => (l?.startsWith("ar") ? "العربية" : l?.startsWith("fr") ? "français" : "English");

const generatedQuizSchema = z.object({
  question:z.string().trim().min(2).max(2000),
  options:z.array(z.string().trim().min(1).max(2000)).length(4),
  correct:z.array(z.number().int().min(0).max(3)).min(1).max(4),
  explanation:z.string().trim().min(1).max(5000),
}).strict().refine(q=>new Set(q.correct).size===q.correct.length && new Set(q.options.map(option=>option.toLowerCase())).size===4);
const generatedSlideSchema = z.object({
  title:z.string().trim().min(1).max(255),body:z.string().trim().min(1).max(20000),
  imagePrompt:z.string().trim().max(10000).default(""),
  quiz:generatedQuizSchema.nullish().transform(value=>value??undefined),
}).strict();
export const generatedOutlineSchema=z.object({title:z.string().trim().min(1).max(255),description:z.string().trim().min(1).max(10000),slides:z.array(generatedSlideSchema).min(2).max(14)}).strict();
export type GeneratedSlide=z.infer<typeof generatedSlideSchema>;
function validatedAiJson<T>(raw:string,schema:z.ZodType<T>):T {
 const result=schema.safeParse(parseJsonLoose<unknown>(raw));
 if(!result.success)throw new AIError("La réponse IA contient une structure ou un QCM invalide. Aucune diapositive n’a été ajoutée. Réessayez.");
 return result.data;
}

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
  const parsed=validatedAiJson(raw,generatedOutlineSchema);
  const quizCount=parsed.slides.filter(slide=>slide.quiz!=null).length;
  const coverage=opts.quizCoverage??"some";
  if(parsed.slides.length!==n || (coverage==="all"&&quizCount!==n) || (coverage==="none"&&quizCount!==0) || (coverage==="some"&&(quizCount===0||quizCount===n))) {
    throw new AIError("La réponse IA ne respecte pas le nombre de diapositives ou la répartition des QCM demandés. Réessayez.");
  }
  return parsed;
}

export async function aiWriteSlideText(opts: { provider: AIProvider; instruction: string; language?: string }): Promise<string> {
  const system = `You are an instructional designer. Write in ${LANG_NAME(opts.language)}. Return only the slide body text (2-5 sentences), no markdown headings.`;
  const raw=await generateText({ provider: opts.provider, system, prompt: opts.instruction, maxTokens: 600 });
  const text=z.string().trim().min(1).max(20000).safeParse(raw);
  if(!text.success)throw new AIError("Le texte produit par l’IA est vide ou trop long. Réessayez.");
  return text.data;
}

export async function aiGenerateQuiz(opts: { provider: AIProvider; content: string; language?: string }): Promise<GeneratedSlide["quiz"]> {
  const system = `You write multiple-choice quiz questions in ${LANG_NAME(opts.language)}. Output strict JSON only.`;
  const prompt = `From the following slide content, write ONE multiple-choice question with 4 options.
Content: """${opts.content}"""
JSON: {"question": string, "options": [string,string,string,string], "correct": [number], "explanation": string}`;
  const raw = await generateText({ provider: opts.provider, system, prompt, json: true, maxTokens: 500 });
  return validatedAiJson(raw,generatedQuizSchema);
}
