/** State hooks for the Search screen (data + keyboard only; visuals animate elsewhere). */
import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { searchProducts } from '@/api';
import type { Product } from '@/types/models';

interface SearchState {
  /** The query the current `results` / `error` belong to. */
  query: string;
  results: Product[];
  /**
   * Set when nothing matched every word and the results match only some of them
   * (e.g. "oat latte" → lattes): the words that did match.
   */
  partialTerms: string[] | undefined;
  error: Error | undefined;
  loading: boolean;
}

const IDLE: SearchState = { query: '', results: [], partialTerms: undefined, error: undefined, loading: false };

/**
 * All-words search first (api.searchProducts); if that finds nothing for a multi-word query,
 * fall back to any-word matches so a near miss still shows food instead of a dead end.
 */
async function searchWithFallback(q: string): Promise<Pick<SearchState, 'results' | 'partialTerms'>> {
  const exact = await searchProducts(q);
  const words = [...new Set(q.toLowerCase().split(/\s+/).filter(Boolean))];
  if (exact.length > 0 || words.length < 2) return { results: exact, partialTerms: undefined };
  const perWord = await Promise.all(words.map((w) => searchProducts(w)));
  const seen = new Set<string>();
  const results: Product[] = [];
  for (const list of perWord) {
    for (const p of list) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      results.push(p);
    }
  }
  const partialTerms = words.filter((_, i) => (perWord[i]?.length ?? 0) > 0);
  return { results, partialTerms: results.length > 0 ? partialTerms : undefined };
}

/**
 * Debounced `api.searchProducts`. Keeps the previous results on screen while the next query
 * is in flight (`pending`), so the list re-flows instead of flashing to a skeleton per keystroke.
 */
export function useProductSearch(query: string, delayMs = 250) {
  const q = query.trim();
  const [state, setState] = useState<SearchState>(IDLE);
  const [nonce, setNonce] = useState(0);

  // Clearing the field drops the old results (adjusted during render, so no stale frame): the next
  // query starts from the skeleton instead of re-flowing results for a search the user abandoned.
  if (!q && state !== IDLE) setState(IDLE);

  useEffect(() => {
    if (!q) return;
    let alive = true;
    const timer = setTimeout(() => {
      searchWithFallback(q)
        .then(({ results, partialTerms }) => {
          if (alive) setState({ query: q, results, partialTerms, error: undefined, loading: false });
        })
        .catch((e: unknown) => {
          if (!alive) return;
          const error = e instanceof Error ? e : new Error(String(e));
          setState({ query: q, results: [], partialTerms: undefined, error, loading: false });
        });
    }, delayMs);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [q, nonce, delayMs]);

  return {
    ...state,
    /** True while the visible results don't yet match what's typed. */
    pending: q.length > 0 && (state.loading || state.query !== q),
    retry: () => {
      setState((s) => ({ ...s, loading: true }));
      setNonce((n) => n + 1);
    },
  };
}

/** Whether the software keyboard is up (iOS "will" events feel instant; Android only has "did"). */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}
