import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';

/**
 * Estado refletido na URL (query param) — sobrevive a refresh, back/forward e
 * a saída/retorno de módulo, porque a URL é a fonte da verdade.
 */
export function useUrlState(key: string, defaultValue: string) {
  const [params, setParams] = useSearchParams();
  const value = params.get(key) ?? defaultValue;

  const setValue = useCallback(
    (next: string) => {
      setParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          if (!next || next === defaultValue) n.delete(key);
          else n.set(key, next);
          return n;
        },
        { replace: true },
      );
    },
    [key, defaultValue, setParams],
  );

  return [value, setValue] as const;
}

/** Booleano na URL (?showArchived=1) */
export function useUrlBoolean(key: string, defaultValue = false) {
  const [raw, setRaw] = useUrlState(key, defaultValue ? '1' : '0');
  const setValue = useCallback((v: boolean) => setRaw(v ? '1' : '0'), [setRaw]);
  return [raw === '1', setValue] as const;
}

/**
 * Estado persistido em sessionStorage (não atravessa sessões do navegador).
 * Usado para o que não faz sentido na URL (ex: rascunhos de UI, scroll).
 */
export function useSessionState<T>(key: string, initial: T) {
  const storageKey = `racun:${key}`;
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      return raw !== null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }, [storageKey, value]);

  return [value, setValue] as const;
}

/**
 * Restaura a posição de scroll da página ao voltar para a mesma rota.
 */
export function useScrollRestoration() {
  const location = useLocation();
  const key = `racun:scroll:${location.pathname}${location.search}`;
  const restored = useRef(false);

  useEffect(() => {
    restored.current = false;
    const saved = Number(sessionStorage.getItem(key) ?? '0');

    let frames = 0;
    let raf = 0;
    const tryRestore = () => {
      frames++;
      if (saved > 0 && document.body.scrollHeight > saved + window.innerHeight * 0.5) {
        window.scrollTo({ top: saved });
        restored.current = true;
        return;
      }
      if (frames < 40) raf = requestAnimationFrame(tryRestore);
    };
    if (saved > 0) raf = requestAnimationFrame(tryRestore);

    let timer: number | undefined;
    const onScroll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        sessionStorage.setItem(key, String(window.scrollY));
      }, 150);
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
      sessionStorage.setItem(key, String(window.scrollY));
    };
  }, [key]);
}
