import { describe, it, expect } from 'vitest';
import { requestSchema, TAILLE_MAX_ASSISTANT } from '@/lib/chatbot-scs/schema';
import { TAILLE_MAX_MESSAGE } from '@/lib/chatbot-scs/config';

describe('chatbot-scs requestSchema', () => {
  it('accepte un premier message utilisateur court', () => {
    const r = requestSchema.safeParse({
      messages: [{ role: 'user', content: 'Bonjour, quels sont les indicateurs ?' }],
    });
    expect(r.success).toBe(true);
  });

  it('rejette un message utilisateur > TAILLE_MAX_MESSAGE', () => {
    const r = requestSchema.safeParse({
      messages: [{ role: 'user', content: 'x'.repeat(TAILLE_MAX_MESSAGE + 1) }],
    });
    expect(r.success).toBe(false);
  });

  // Régression du bug initial : la conversation incluant une réponse assistant
  // longue (> 500 chars) faisait échouer le tour suivant en 400.
  it('accepte un historique avec un message assistant long suivi d’un message utilisateur court', () => {
    const reponseAssistantLongue = 'Voici une réponse détaillée. '.repeat(50); // ~1500 chars
    expect(reponseAssistantLongue.length).toBeGreaterThan(TAILLE_MAX_MESSAGE);

    const r = requestSchema.safeParse({
      messages: [
        { role: 'user', content: 'Dans quels pays intervenez-vous ?' },
        { role: 'assistant', content: reponseAssistantLongue },
        { role: 'user', content: 'Combien de jeunes accompagnés depuis 2018 ?' },
      ],
    });
    expect(r.success).toBe(true);
  });

  it('rejette un message assistant qui dépasse TAILLE_MAX_ASSISTANT', () => {
    const r = requestSchema.safeParse({
      messages: [
        { role: 'user', content: 'Bonjour' },
        { role: 'assistant', content: 'x'.repeat(TAILLE_MAX_ASSISTANT + 1) },
        { role: 'user', content: 'Continue' },
      ],
    });
    expect(r.success).toBe(false);
  });

  it('rejette un historique vide', () => {
    const r = requestSchema.safeParse({ messages: [] });
    expect(r.success).toBe(false);
  });

  it('rejette un rôle inconnu (system)', () => {
    const r = requestSchema.safeParse({
      messages: [{ role: 'system', content: 'Tu es un assistant.' }],
    });
    expect(r.success).toBe(false);
  });
});
