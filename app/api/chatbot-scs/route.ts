import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import {
  SYSTEM_PROMPT_CHATBOT_SCS,
  HORS_SUJET_KEYWORDS,
  SUGGESTIONS_REDIRECTION,
  TAILLE_MAX_MESSAGE,
} from '@/lib/chatbot-scs/config';

/**
 * Endpoint chatbot SCS public — V2.5.0.
 *
 * Public (pas d'auth requise), rate-limité par IP, pré-filtre les
 * questions hors-sujet AVANT d'appeler Claude pour économiser tokens
 * et latence.
 *
 * Pas de persistance BDD — l'historique vit dans le localStorage du
 * client uniquement (anonyme, RGPD-friendly).
 */

// Rate limit en mémoire : 30 req / 1h / IP.
type RateEntry = { count: number; resetAt: number };
const rateLimitMap = new Map<string, RateEntry>();
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 30;

function getIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  );
}

function checkRateLimit(ip: string): { allowed: boolean; resetAt: number; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || entry.resetAt <= now) {
    const resetAt = now + RATE_WINDOW_MS;
    rateLimitMap.set(ip, { count: 1, resetAt });
    // GC opportuniste si la map grossit
    if (rateLimitMap.size > 5000) {
      for (const [k, v] of rateLimitMap.entries()) {
        if (v.resetAt <= now) rateLimitMap.delete(k);
      }
    }
    return { allowed: true, resetAt, remaining: RATE_MAX - 1 };
  }
  if (entry.count >= RATE_MAX) {
    return { allowed: false, resetAt: entry.resetAt, remaining: 0 };
  }
  entry.count++;
  return { allowed: true, resetAt: entry.resetAt, remaining: RATE_MAX - entry.count };
}

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(TAILLE_MAX_MESSAGE),
});

const requestSchema = z.object({
  messages: z.array(messageSchema).min(1).max(20),
});

export type SuggestionPayload = { emoji?: string; texte: string; question: string };

export type ChatbotResponse = {
  reponse: string;
  suggestions: SuggestionPayload[];
  isIntense: boolean;
  preFilter?: 'hors_sujet';
};

/**
 * Détecte un hors-sujet via keywords. Retourne TRUE si la question
 * contient un terme manifestement hors champ OIF.
 */
function isHorsSujet(message: string): boolean {
  const normalized = message.toLowerCase();
  return HORS_SUJET_KEYWORDS.some((kw) => normalized.includes(kw));
}

/**
 * Extrait les bulles de clarification d'une réponse Claude.
 * Format attendu : [BULLES]\n- 💡 texte\n...\n[/BULLES]
 *
 * Retourne :
 *   - texte épuré (sans le bloc [BULLES])
 *   - liste de suggestions parsées
 */
function extraireBulles(reponse: string): { texte: string; suggestions: SuggestionPayload[] } {
  const match = reponse.match(/\[BULLES\]([\s\S]*?)\[\/BULLES\]/);
  if (!match) return { texte: reponse, suggestions: [] };

  const texte = reponse.replace(match[0], '').trim();
  const interieur = match[1] ?? '';
  const lignes = interieur
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('-'))
    .map((l) => l.slice(1).trim());

  const suggestions: SuggestionPayload[] = [];
  for (const ligne of lignes.slice(0, 6)) {
    // Détection emoji optionnel en début de ligne
    const emojiMatch = ligne.match(
      /^(\p{Emoji}\p{Emoji_Modifier_Base}?\p{Emoji_Modifier}?)\s+(.*)$/u,
    );
    const emoji = emojiMatch?.[1];
    const texteSugg = emojiMatch?.[2];
    if (emoji && texteSugg) {
      suggestions.push({ emoji, texte: texteSugg, question: texteSugg });
    } else {
      suggestions.push({ texte: ligne, question: ligne });
    }
  }

  return { texte, suggestions };
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ChatbotResponse | { erreur: string }>> {
  // 1. Rate limit
  const ip = getIp(request);
  const rl = checkRateLimit(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        erreur: `Limite de 30 requêtes par heure atteinte. Réessayez dans ${Math.ceil(
          (rl.resetAt - Date.now()) / 60_000,
        )} minutes.`,
      },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      },
    );
  }

  // 2. Validation payload
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erreur: 'JSON invalide.' }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ erreur: 'Format de requête invalide.' }, { status: 400 });
  }

  const dernierMessage = parsed.data.messages[parsed.data.messages.length - 1];
  if (!dernierMessage || dernierMessage.role !== 'user') {
    return NextResponse.json(
      { erreur: "Le dernier message doit être de l'utilisateur." },
      { status: 400 },
    );
  }

  // 3. Pré-filtrage hors-sujet (économie tokens + instantané)
  if (isHorsSujet(dernierMessage.content)) {
    return NextResponse.json<ChatbotResponse>({
      reponse:
        "Désolé, je suis spécialisé sur la plateforme OIF Emploi Jeunes. Je peux vous parler de nos 18 indicateurs, de nos projets ou de nos pays d'intervention. Que souhaitez-vous savoir ?",
      suggestions: SUGGESTIONS_REDIRECTION,
      isIntense: false,
      preFilter: 'hors_sujet',
    });
  }

  // 4. Config Claude
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Fallback : message d'erreur générique avec suggestions
    return NextResponse.json<ChatbotResponse>({
      reponse:
        'Le service IA est temporairement indisponible. Vous pouvez explorer le site directement ou nous contacter.',
      suggestions: SUGGESTIONS_REDIRECTION,
      isIntense: false,
    });
  }

  // 5. Appel Claude
  try {
    const client = new Anthropic({ apiKey });
    const reponse = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT_CHATBOT_SCS,
      messages: parsed.data.messages,
    });

    const texteBrut = reponse.content
      .filter((b) => b.type === 'text')
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('\n');

    const { texte, suggestions } = extraireBulles(texteBrut);

    return NextResponse.json<ChatbotResponse>({
      reponse: texte || '(Réponse vide. Reformulez votre question.)',
      suggestions,
      isIntense: true,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur inconnue';
    // eslint-disable-next-line no-console
    console.error('[chatbot-scs] Échec Claude', { message, ip });
    return NextResponse.json(
      {
        erreur:
          'Le service IA rencontre un incident temporaire. Réessayez dans quelques instants ou contactez-nous via /contact.',
      },
      { status: 502 },
    );
  }
}
