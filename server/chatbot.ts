// ─── Landing-page assistant: LLM (Mistral/OpenAI-compatible) + tool calling ────
// Context-grounded on R-AERO; can search the catalogue, list events, and submit a
// B2B quote on the visitor's behalf. Stateless per request (the client sends the
// visible conversation; tool/assistant-tool turns stay server-side).
import { getPublicTrainings, getWebinars, getUpcomingSessions, createQuoteRequest } from "./db";

export class ChatError extends Error {}

type ChatMsg = { role: "system" | "user" | "assistant" | "tool"; content: string; tool_calls?: any[]; tool_call_id?: string; name?: string };

function provider(): { base: string; key: string; model: string } | null {
  const mistral = (process.env.MISTRAL_API_KEY ?? "").trim();
  if (mistral) return { base: "https://api.mistral.ai/v1", key: mistral, model: (process.env.MISTRAL_MODEL ?? "").trim() || "mistral-large-latest" };
  const openai = (process.env.OPENAI_API_KEY ?? "").trim();
  if (openai) return { base: "https://api.openai.com/v1", key: openai, model: (process.env.OPENAI_TEXT_MODEL ?? "").trim() || "gpt-4o-mini" };
  return null;
}

const LINKS = {
  catalogue: "/catalogue", devis: "/devis", webinars: "/webinars", sessions: "/sessions",
  login: "/login", register: "/register", contact: "/contact", glossaire: "/glossaire",
};

const SYSTEM = `Tu es l'assistant virtuel de R-AERO Training Academy, organisme de formation aéronautique agréé EASA Part-147.
Rôle : renseigner les visiteurs et les orienter, en français par défaut (réponds dans la langue du visiteur si différente).
Contexte produit :
- Catalogue de formations Part-66 / Part-147 : Facteurs Humains (HF), EWIS, Fuel Tank Safety (FTS/CDCCL), SMS, Module 9, Type Rating (QT), etc. Formats e-learning, webinaire, qualification de type, séminaire.
- Formations initiales et de recyclage (récurrent), certificats vérifiables par QR.
- Offre entreprise (B2B) : suivi de conformité, abonnement, devis sur mesure.
Liens utiles (donne-les quand pertinent) : catalogue ${LINKS.catalogue} · demande de devis ${LINKS.devis} · webinaires ${LINKS.webinars} · sessions ${LINKS.sessions} · connexion ${LINKS.login}.
Règles :
- Sois concis et utile. Ne jamais inventer de prix, de dates ou de contenus : utilise les outils (search_trainings, list_webinars, list_sessions) pour les données réelles.
- Pour un devis (create_quote), recueille au minimum le nom de société, le nom du contact et un email valide avant d'appeler l'outil ; confirme ensuite que la demande a bien été envoyée.
- Tu n'as pas accès aux données personnelles des comptes ; pour ça, invite à se connecter.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_trainings",
      description: "Cherche des formations dans le catalogue public R-AERO (par mots-clés et/ou domaine).",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Mots-clés (ex. 'facteurs humains', 'fuel tank')." },
          domain: { type: "string", enum: ["b1", "b2", "b1b2", "part66", "general", "management"], description: "Domaine Part-66 optionnel." },
        },
      },
    },
  },
  { type: "function", function: { name: "list_webinars", description: "Liste les prochains webinaires R-AERO.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "list_sessions", description: "Liste les prochaines sessions présentielles / inter-entreprises.", parameters: { type: "object", properties: {} } } },
  {
    type: "function",
    function: {
      name: "create_quote",
      description: "Soumet une demande de devis B2B pour l'entreprise du visiteur. Exige companyName, contactName et un email valide.",
      parameters: {
        type: "object",
        properties: {
          companyName: { type: "string" }, contactName: { type: "string" }, contactEmail: { type: "string" },
          contactPhone: { type: "string" }, employeeCount: { type: "number" }, trainingTypes: { type: "string", description: "Formations souhaitées (texte libre)." }, message: { type: "string" },
        },
        required: ["companyName", "contactName", "contactEmail"],
      },
    },
  },
];

async function executeTool(name: string, args: any): Promise<unknown> {
  if (name === "search_trainings") {
    const list = await getPublicTrainings({ search: args?.query, domain: args?.domain });
    return (list as any[]).slice(0, 6).map((t) => ({
      title: t.title, url: `/formation/${t.slug}`, type: t.type, domain: t.domain,
      durationHours: t.durationHours, priceTtc: t.priceTtc, ref: t.part147Reference,
    }));
  }
  if (name === "list_webinars") {
    const list = await getWebinars();
    return (list as any[]).slice(0, 6).map((w) => ({ title: w.title, scheduledAt: w.scheduledAt, instructor: w.instructorName, status: w.status }));
  }
  if (name === "list_sessions") {
    const list = await getUpcomingSessions();
    return (list as any[]).slice(0, 6).map((s) => ({ title: s.title, startDate: s.startDate, location: s.location, format: s.format, seatsLeft: (s.seats ?? 0) - (s.seatsTaken ?? 0) }));
  }
  if (name === "create_quote") {
    if (!args?.companyName || !args?.contactName || !args?.contactEmail) return { ok: false, error: "Champs requis manquants (société, contact, email)." };
    await createQuoteRequest({
      companyName: args.companyName, contactName: args.contactName, contactEmail: args.contactEmail,
      contactPhone: args.contactPhone, employeeCount: args.employeeCount, trainingTypes: args.trainingTypes, message: args.message,
    });
    return { ok: true, message: "Demande de devis enregistrée. Notre équipe vous recontactera." };
  }
  return { error: "unknown tool" };
}

async function callLLM(p: { base: string; key: string; model: string }, messages: ChatMsg[]) {
  const res = await fetch(`${p.base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.key}` },
    body: JSON.stringify({ model: p.model, messages, tools: TOOLS, tool_choice: "auto", temperature: 0.3, max_tokens: 800 }),
  });
  if (!res.ok) throw new ChatError(`LLM ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const data = await res.json();
  return data.choices?.[0]?.message as ChatMsg & { tool_calls?: any[] };
}

/** Run the chat with a tool-calling loop. `history` = visible turns (user/assistant text). */
export async function runChat(history: { role: "user" | "assistant"; content: string }[]): Promise<{ reply: string; actions: string[] }> {
  const p = provider();
  if (!p) throw new ChatError("Assistant indisponible : aucune clé IA configurée (Paramètres → clé Mistral).");

  const messages: ChatMsg[] = [{ role: "system", content: SYSTEM }, ...history.slice(-12).map((m) => ({ role: m.role, content: m.content }))];
  const actions: string[] = [];

  for (let i = 0; i < 5; i++) {
    const msg = await callLLM(p, messages);
    if (msg?.tool_calls?.length) {
      messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: msg.tool_calls });
      for (const tc of msg.tool_calls) {
        let args: any = {};
        try { args = JSON.parse(tc.function?.arguments ?? "{}"); } catch { /* ignore */ }
        const result = await executeTool(tc.function?.name, args);
        actions.push(tc.function?.name);
        messages.push({ role: "tool", tool_call_id: tc.id, name: tc.function?.name, content: JSON.stringify(result) });
      }
      continue;
    }
    return { reply: (msg?.content ?? "").trim() || "Je n'ai pas de réponse pour le moment.", actions };
  }
  return { reply: "Désolé, je n'ai pas pu finaliser la réponse. Reformulez votre demande ?", actions };
}
