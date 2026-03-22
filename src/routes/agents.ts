import { Hono } from 'hono';
import type { Env } from '../types';
import { getReceiptsByAddress } from '../lib/db';
import { validateAddress } from '../lib/receipt';

export const agentsRouter = new Hono<{ Bindings: Env }>();

agentsRouter.get('/:address/receipts', async (c) => {
  const address = c.req.param('address');
  if (!validateAddress(address)) return c.json({ error: 'Invalid Ethereum address' }, 400);
  const status = c.req.query('status');
  const limit = parseInt(c.req.query('limit') ?? '20', 10);
  const receipts = await getReceiptsByAddress(c.env, address, status, limit).catch(() => []);
  return c.json({ address, count: receipts.length, receipts });
});
