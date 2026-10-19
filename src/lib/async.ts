/** Small promise helpers shared by screens and `src/lib` wrappers. */

/**
 * Resolves with `fallback` if `promise` hasn't settled after `ms`, or if it rejects.
 * Web permission prompts and GPS fixes can stay pending forever when the user ignores them.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

export type Attempt<T> = { ok: true; value: T } | { ok: false; error: unknown };

/**
 * Settles a promise into a result object. Lets components branch on outcomes without try/catch:
 * React Compiler skips components that use `try…finally`, or conditionals (`?.`, `??`, ternaries)
 * inside `try`/`catch` blocks.
 */
export function attempt<T>(promise: Promise<T>): Promise<Attempt<T>> {
  return promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
}
