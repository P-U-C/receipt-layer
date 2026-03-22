import type { MiddlewareHandler } from 'hono';

export const cors: MiddlewareHandler = async (c, next) => {
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id');
  c.header('Access-Control-Expose-Headers', 'X-Receipt-Version, X-Request-Id, X-RateLimit-Limit, X-RateLimit-Remaining, x-payment-accepted, x-free-commits-remaining, x-free-tier-limit, x-payment-error');
  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204);
  }
  await next();
};
