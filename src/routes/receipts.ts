import { Hono } from 'hono';
import type { Env } from '../types';
import { createReceipt, getReceipt, updateDelivery, updateAck } from '../lib/db';
import { canTransition, validateAddress } from '../lib/receipt';

export const receiptsRouter = new Hono<{ Bindings: Env }>();

receiptsRouter.post('/commit', async (c) => {
  let body: Record<string, unknown>;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }
  const { capability, provider, consumer } = body as { capability: unknown; provider: Record<string, unknown>; consumer: Record<string, unknown> };
  if (!capability || typeof capability !== 'string') return c.json({ error: 'capability is required' }, 400);
  if (!provider?.address || !validateAddress(String(provider.address))) return c.json({ error: 'provider.address must be a valid Ethereum address' }, 400);
  if (!consumer?.address || !validateAddress(String(consumer.address))) return c.json({ error: 'consumer.address must be a valid Ethereum address' }, 400);
  try {
    const receipt = await createReceipt(c.env, body as Parameters<typeof createReceipt>[1]);
    return c.json(receipt, 201);
  } catch { return c.json({ error: 'Failed to create receipt' }, 503); }
});

receiptsRouter.post('/:id/deliver', async (c) => {
  const receipt_id = c.req.param('id');
  let body: Record<string, unknown>;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }
  const { output_hash, execution_metadata, provider_signature } = body as { output_hash: unknown; execution_metadata: unknown; provider_signature: unknown };
  if (!output_hash || typeof output_hash !== 'string') return c.json({ error: 'output_hash is required' }, 400);
  const existing = await getReceipt(c.env, receipt_id);
  if (!existing) return c.json({ error: 'Receipt not found' }, 404);
  if (!canTransition(existing.status, 'delivered')) return c.json({ error: `Cannot transition from '${existing.status}' to 'delivered'` }, 409);
  try {
    const updated = await updateDelivery(c.env, receipt_id, output_hash, execution_metadata as Record<string, unknown> | null, provider_signature as string | null);
    return c.json(updated ?? existing);
  } catch { return c.json({ error: 'Failed to record delivery' }, 503); }
});

receiptsRouter.post('/:id/ack', async (c) => {
  const receipt_id = c.req.param('id');
  let body: Record<string, unknown>;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }
  const { consumer_signature } = body as { consumer_signature: unknown };
  if (!consumer_signature || typeof consumer_signature !== 'string') return c.json({ error: 'consumer_signature is required' }, 400);
  const existing = await getReceipt(c.env, receipt_id);
  if (!existing) return c.json({ error: 'Receipt not found' }, 404);
  if (!canTransition(existing.status, 'acknowledged')) return c.json({ error: `Cannot transition from '${existing.status}' to 'acknowledged'` }, 409);
  try {
    const updated = await updateAck(c.env, receipt_id, consumer_signature);
    return c.json(updated ?? existing);
  } catch { return c.json({ error: 'Failed to acknowledge receipt' }, 503); }
});

receiptsRouter.get('/:id', async (c) => {
  const receipt = await getReceipt(c.env, c.req.param('id')).catch(() => null);
  if (!receipt) return c.json({ error: 'Receipt not found' }, 404);
  return c.json(receipt);
});
