import type { MiddlewareHandler } from 'hono';
import type { Env } from '../types';

const RATE_LIMIT = 100;

export const ratelimit: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? 'unknown';
  const key = `ratelimit:${ip}`;
  let count = 0;
  try {
    const raw = await c.env.KV.get(key);
    count = raw ? parseInt(raw, 10) : 0;
    if (count >= RATE_LIMIT) {
      c.header('X-RateLimit-Limit', String(RATE_LIMIT));
      c.header('X-RateLimit-Remaining', '0');
      return c.json({ error: 'Rate limit exceeded' }, 429);
    }
    await c.env.KV.put(key, String(count + 1), { expirationTtl: 3600 });
  } catch {
    /* fail open */
  }
  c.header('X-RateLimit-Limit', String(RATE_LIMIT));
  c.header('X-RateLimit-Remaining', String(Math.max(0, RATE_LIMIT - count - 1)));
  await next();
};
