import type { MiddlewareHandler } from 'hono';

export const requestId: MiddlewareHandler = async (c, next) => {
  const id = crypto.randomUUID();
  c.header('X-Request-Id', id);
  c.header('X-Receipt-Version', '0.1.0');
  await next();
};
