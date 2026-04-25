import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useBrouillonEnquete } from '@/components/enquetes/use-brouillon-enquete';

const STORAGE_KEY = 'enquete:draft:A:11111111-1111-4111-8111-111111111111';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

// jsdom expose `window.localStorage` mais sa méthode `clear` n'est pas
// fiable selon les versions ; on installe un shim Map-based pour les tests.
function installerStorageShim() {
  const map = new Map<string, string>();
  const shim: Storage = {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
  };
  Object.defineProperty(window, 'localStorage', {
    value: shim,
    configurable: true,
    writable: false,
  });
}

describe('useBrouillonEnquete', () => {
  beforeEach(() => {
    installerStorageShim();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initialise avec le payload initial si pas de brouillon stocké', () => {
    const { result } = renderHook(() =>
      useBrouillonEnquete('A', '11111111-1111-4111-8111-111111111111', { foo: 'bar' }),
    );
    expect(result.current.payload).toEqual({ foo: 'bar' });
    expect(result.current.derniereSauvegarde).toBeNull();
  });

  it('restaure un brouillon existant non expiré', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ payload: { foo: 'restored' }, savedAt: Date.now() - 1000 }),
    );
    const { result } = renderHook(() =>
      useBrouillonEnquete('A', '11111111-1111-4111-8111-111111111111', { foo: 'initial' }),
    );
    expect(result.current.payload).toEqual({ foo: 'restored' });
  });

  it('ignore et nettoie un brouillon expiré', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ payload: { foo: 'expired' }, savedAt: Date.now() - MAX_AGE_MS - 1000 }),
    );
    const { result } = renderHook(() =>
      useBrouillonEnquete('A', '11111111-1111-4111-8111-111111111111', { foo: 'initial' }),
    );
    expect(result.current.payload).toEqual({ foo: 'initial' });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('persiste les modifications après debounce 500ms', () => {
    const { result } = renderHook(() =>
      useBrouillonEnquete<{ foo: string }>('A', '11111111-1111-4111-8111-111111111111', {
        foo: 'initial',
      }),
    );

    act(() => {
      result.current.setPayload({ foo: 'changed' });
    });

    // Avant 500ms : pas encore persisté
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();

    // Après 500ms : persisté
    act(() => {
      vi.advanceTimersByTime(550);
    });
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!);
    expect(stored.payload).toEqual({ foo: 'changed' });
    expect(typeof stored.savedAt).toBe('number');
    expect(result.current.derniereSauvegarde).not.toBeNull();
  });

  it('effacer() supprime le brouillon du localStorage', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ payload: { foo: 'x' }, savedAt: Date.now() }),
    );
    const { result } = renderHook(() =>
      useBrouillonEnquete('A', '11111111-1111-4111-8111-111111111111', { foo: 'initial' }),
    );

    act(() => {
      result.current.effacer();
    });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(result.current.derniereSauvegarde).toBeNull();
  });

  it('utilise des clés distinctes par couple (questionnaire, cibleId)', () => {
    const cible1 = '11111111-1111-4111-8111-111111111111';
    const cible2 = '22222222-2222-4222-8222-222222222222';
    window.localStorage.setItem(
      `enquete:draft:A:${cible1}`,
      JSON.stringify({ payload: { v: 100 }, savedAt: Date.now() }),
    );
    window.localStorage.setItem(
      `enquete:draft:B:${cible2}`,
      JSON.stringify({ payload: { v: 200 }, savedAt: Date.now() }),
    );

    const { result: r1 } = renderHook(() => useBrouillonEnquete('A', cible1, { v: 0 }));
    const { result: r2 } = renderHook(() => useBrouillonEnquete('B', cible2, { v: 0 }));

    expect(r1.current.payload).toEqual({ v: 100 });
    expect(r2.current.payload).toEqual({ v: 200 });
  });
});
