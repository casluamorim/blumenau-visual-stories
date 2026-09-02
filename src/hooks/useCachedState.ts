import { useCallback, useRef, useState } from 'react';

/**
 * Cache em memória (vive enquanto a aba está aberta) para o estado de dados das
 * páginas. Ao voltar para uma tela já visitada, os dados aparecem na hora e a
 * atualização acontece em segundo plano — sem tela de "Carregando...".
 */
const pageCache = new Map<string, unknown>();

export function hasPageCache(key: string) {
  return pageCache.has(key);
}

export function clearPageCache(prefix?: string) {
  if (!prefix) return pageCache.clear();
  for (const k of Array.from(pageCache.keys())) {
    if (k.startsWith(prefix)) pageCache.delete(k);
  }
}

export function useCachedState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() =>
    pageCache.has(key) ? (pageCache.get(key) as T) : initial,
  );

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        pageCache.set(key, resolved);
        return resolved;
      });
    },
    [key],
  );

  return [value, set] as const;
}

/**
 * `true` somente na primeira visita da sessão (quando ainda não há cache).
 * Use para decidir se mostra o estado de carregamento.
 */
export function useIsFirstLoad(key: string) {
  const first = useRef(!hasPageCache(key));
  return first.current;
}
