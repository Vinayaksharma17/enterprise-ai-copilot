import {
  ProviderTimeoutError,
  Semaphore,
  isTransientError,
  withRetry,
  withTimeout,
} from '../../src/integrations/llm/resilience';

describe('isTransientError', () => {
  it('treats connection failures as transient', () => {
    expect(isTransientError(new Error('connect ECONNREFUSED 127.0.0.1:11434'))).toBe(true);
    expect(isTransientError(Object.assign(new Error('boom'), { code: 'ECONNRESET' }))).toBe(true);
    expect(isTransientError(new Error('fetch failed'))).toBe(true);
  });

  it('does not treat application errors or timeouts as transient', () => {
    expect(isTransientError(new Error('model "qwen2.5:3b" not found'))).toBe(false);
    expect(isTransientError(new Error('invalid request'))).toBe(false);
    expect(isTransientError(new ProviderTimeoutError('op', 10))).toBe(false);
  });
});

describe('Semaphore', () => {
  it('bounds the number of concurrently running tasks', async () => {
    const semaphore = new Semaphore(2, 100);
    let active = 0;
    let peak = 0;

    const task = () =>
      semaphore.run(async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 10));
        active -= 1;
      }, () => new Error('busy'));

    await Promise.all(Array.from({ length: 8 }, task));

    expect(peak).toBe(2);
  });

  it('throws a clear busy error when the wait queue is full', async () => {
    const semaphore = new Semaphore(1, 1);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const running = semaphore.run(() => gate, () => new Error('busy'));
    const queued = semaphore.run(async () => 'queued', () => new Error('busy'));

    await expect(
      semaphore.run(async () => 'third', () => new Error('busy'))
    ).rejects.toThrow('busy');

    release();
    await running;
    expect(await queued).toBe('queued');
  });
});

describe('withRetry', () => {
  it('retries transient failures and eventually succeeds', async () => {
    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts += 1;
        if (attempts < 3) {
          throw new Error('fetch failed');
        }
        return 'ok';
      },
      { retries: 3, baseDelayMs: 1, label: 'test' }
    );

    expect(result).toBe('ok');
    expect(attempts).toBe(3);
  });

  it('does not retry non-transient failures', async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async () => {
          attempts += 1;
          throw new Error('model "x" not found');
        },
        { retries: 3, baseDelayMs: 1, label: 'test' }
      )
    ).rejects.toThrow('not found');
    expect(attempts).toBe(1);
  });
});

describe('withTimeout', () => {
  it('resolves when the operation completes in time', async () => {
    const result = await withTimeout(
      async () => 'done',
      1000,
      'fast op'
    );
    expect(result).toBe('done');
  });

  it('rejects with a timeout error when the operation hangs', async () => {
    await expect(
      withTimeout(
        () => new Promise<never>(() => undefined),
        20,
        'hanging op'
      )
    ).rejects.toBeInstanceOf(ProviderTimeoutError);
  });
});
