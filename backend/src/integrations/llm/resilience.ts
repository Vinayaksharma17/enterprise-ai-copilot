import { config } from '../../config/env';

/**
 * Bounded-reliability helpers shared by the Ollama providers. Local inference
 * on modest hardware is slow and can be temporarily unavailable (model still
 * loading, container restarting, or overloaded), so every model call is
 * wrapped with a hard timeout, bounded retries for transient failures, and a
 * concurrency limiter that returns a clear "busy" error instead of queueing
 * unbounded work.
 */

export class ProviderBusyError extends Error {
  constructor(label: string, maxConcurrency: number) {
    super(
      `${label} is at capacity (${maxConcurrency} concurrent requests). Please retry shortly.`
    );
    this.name = 'ProviderBusyError';
  }
}

export class ProviderTimeoutError extends Error {
  constructor(label: string, timeoutMs: number) {
    super(`${label} timed out after ${timeoutMs}ms`);
    this.name = 'ProviderTimeoutError';
  }
}

const TRANSIENT_ERROR_PATTERN =
  /econnrefused|econnreset|etimedout|eai_again|fetch failed|socket hang up|network|temporarily unavailable|server is busy|502|503|504|load_model|connection error/i;

const TRANSIENT_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EAI_AGAIN',
]);

/**
 * True for errors that are worth retrying (transient network / availability
 * failures). Application errors and timeouts raised by our own guards are not
 * retried here to keep behaviour predictable.
 */
export const isTransientError = (error: unknown): boolean => {
  if (error instanceof ProviderTimeoutError) {
    return false;
  }
  const code = (error as { code?: string } | null)?.code;
  if (code && TRANSIENT_ERROR_CODES.has(code)) {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return TRANSIENT_ERROR_PATTERN.test(message);
};

/**
 * A counting semaphore with a bounded wait queue. When the concurrency limit
 * is reached and the queue is full, `onBusy` is thrown so callers receive a
 * clear overload error instead of accumulating unbounded pending requests.
 */
export class Semaphore {
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(
    private readonly maxConcurrent: number,
    private readonly maxQueue: number
  ) {}

  private release = (): void => {
    const next = this.waiting.shift();
    if (next) {
      // Transfer the slot directly to the next waiter without decrementing the
      // active count, so `active` can never exceed `maxConcurrent`.
      next();
    } else {
      this.active -= 1;
    }
  };

  async run<T>(fn: () => Promise<T>, onBusy: () => Error): Promise<T> {
    if (this.active < this.maxConcurrent) {
      this.active += 1;
    } else {
      if (this.waiting.length >= this.maxQueue) {
        throw onBusy();
      }
      await new Promise<void>((resolve) => this.waiting.push(resolve));
      // Our slot was handed to us by a previous release().
    }

    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

/**
 * Runs `fn` but rejects with `ProviderTimeoutError` if it exceeds `timeoutMs`.
 * The provided AbortSignal is aborted so cooperating clients can cancel work.
 */
export const withTimeout = async <T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> => {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;

  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new ProviderTimeoutError(label, timeoutMs));
    }, timeoutMs);
  });

  try {
    return await Promise.race([fn(controller.signal), timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};

export interface RetryOptions {
  retries: number;
  baseDelayMs: number;
  label: string;
}

/** Retries transient failures with exponential backoff. */
export const withRetry = async <T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> => {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= options.retries || !isTransientError(error)) {
        throw error;
      }
      const delay = options.baseDelayMs * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt += 1;
    }
  }
};

let ollamaSemaphore: Semaphore | undefined;

/** Shared concurrency limiter for all Ollama model calls. */
export const getOllamaSemaphore = (): Semaphore => {
  if (!ollamaSemaphore) {
    const { maxConcurrency, maxQueue } = config.llm.ollama;
    ollamaSemaphore = new Semaphore(maxConcurrency, maxQueue);
  }
  return ollamaSemaphore;
};

/** Test hook: reset the shared Ollama semaphore between test cases. */
export const resetOllamaSemaphoreForTesting = (): void => {
  ollamaSemaphore = undefined;
};

/**
 * Runs a single Ollama operation with the configured concurrency limit,
 * timeout, and transient-error retries applied.
 */
export const withOllamaLimits = async <T>(
  label: string,
  op: (signal: AbortSignal) => Promise<T>
): Promise<T> => {
  const { timeoutMs, maxConcurrency, retries } = config.llm.ollama;

  return withRetry(
    () =>
      getOllamaSemaphore().run(
        () => withTimeout(op, timeoutMs, label),
        () => new ProviderBusyError(label, maxConcurrency)
      ),
    { retries, baseDelayMs: 400, label }
  );
};
