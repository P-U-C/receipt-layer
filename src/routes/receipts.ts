import { Hono } from 'hono';
import type { Env, CommitBody, AgentIdentity, AgentProtocol, PaymentRail } from '../types';
import { createReceipt, getReceipt, updateDelivery, updateAck } from '../lib/db';
import { canTransition, validateAddress } from '../lib/receipt';
import { checkFreeTier, verifyPayment, buildPaymentRequest, FREE_COMMITS_PER_DAY } from '../lib/mpp';

export const receiptsRouter = new Hono<{ Bindings: Env }>();

// POST /v1/receipt/commit
receiptsRouter.post('/commit', async (c) => {
  let body: Record<string, unknown>;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }

  const raw = body as {
    capability?: unknown;
    provider?: Record<string, unknown>;
    consumer?: Record<string, unknown>;
    spec_hash?: string;
    provider_signature?: string;
    payment?: Record<string, unknown>;
  };

  if (!raw.capability || typeof raw.capability !== 'string')
    return c.json({ error: 'capability is required' }, 400);
  if (!raw.provider?.address || !validateAddress(String(raw.provider.address)))
    return c.json({ error: 'provider.address must be a valid Ethereum address' }, 400);
  if (!raw.consumer?.address || !validateAddress(String(raw.consumer.address)))
    return c.json({ error: 'consumer.address must be a valid Ethereum address' }, 400);

  // Payment gate
  const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? 'unknown';
  const xPayment = c.req.header('x-payment');

  if (xPayment) {
    const { valid, reason } = await verifyPayment(c.env, xPayment);
    if (!valid) {
      c.header('x-payment-error', reason ?? 'invalid payment');
      return c.json({ error: `Payment verification failed: ${reason}` }, 402);
    }
    c.header('x-payment-accepted', 'true');
  } else {
    const { allowed, remaining } = await checkFreeTier(c.env, ip);
    c.header('x-free-commits-remaining', String(remaining));
    c.header('x-free-tier-limit', String(FREE_COMMITS_PER_DAY));
    if (!allowed) {
      c.header('Access-Control-Expose-Headers', [
        'x-payment-accepted', 'x-free-commits-remaining', 'x-free-tier-limit', 'x-payment-error',
        'X-Request-Id', 'X-Receipt-Version', 'X-RateLimit-Limit', 'X-RateLimit-Remaining',
      ].join(', '));
      return c.json(buildPaymentRequest(String(raw.capability)), 402);
    }
  }

  const provider: AgentIdentity = {
    address: String(raw.provider.address),
    protocol: (raw.provider.protocol ?? 'http') as AgentProtocol,
    agent_id: (raw.provider.agent_id as string) ?? null,
    endpoint: (raw.provider.endpoint as string) ?? null,
  };
  const consumer: AgentIdentity = {
    address: String(raw.consumer.address),
    protocol: (raw.consumer.protocol ?? 'http') as AgentProtocol,
    agent_id: (raw.consumer.agent_id as string) ?? null,
  };
  const commitBody: CommitBody = {
    capability: raw.capability,
    provider,
    consumer,
    spec_hash: raw.spec_hash,
    provider_signature: raw.provider_signature,
  };
  if (raw.payment?.amount !== undefined) {
    commitBody.payment = {
      amount: String(raw.payment.amount),
      asset: String(raw.payment.asset ?? 'USDC'),
      rail: (raw.payment.rail ?? 'other') as PaymentRail,
      chain: Number(raw.payment.chain ?? 0),
      tx_hash: (raw.payment.tx_hash as string) ?? null,
    };
  }

  try {
    const receipt = await createReceipt(c.env, commitBody);
    return c.json(receipt, 201);
  } catch {
    return c.json({ error: 'Failed to create receipt' }, 503);
  }
});

// POST /v1/receipt/:id/deliver
receiptsRouter.post('/:id/deliver', async (c) => {
  const receipt_id = c.req.param('id');
  let body: Record<string, unknown>;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }

  const { output_hash, execution_metadata, provider_signature } = body as {
    output_hash: unknown;
    execution_metadata: unknown;
    provider_signature: unknown;
  };
  if (!output_hash || typeof output_hash !== 'string')
    return c.json({ error: 'output_hash is required' }, 400);

  const existing = await getReceipt(c.env, receipt_id).catch(() => null);
  if (!existing) return c.json({ error: 'Receipt not found' }, 404);
  if (!canTransition(existing.status, 'delivered'))
    return c.json({ error: `Cannot transition from '${existing.status}' to 'delivered'` }, 409);

  try {
    const updated = await updateDelivery(
      c.env, existing, output_hash,
      execution_metadata as Record<string, unknown> | null,
      (provider_signature as string) ?? null
    );
    return c.json(updated);
  } catch {
    return c.json({ error: 'Failed to record delivery' }, 503);
  }
});

// POST /v1/receipt/:id/ack
receiptsRouter.post('/:id/ack', async (c) => {
  const receipt_id = c.req.param('id');
  let body: Record<string, unknown>;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }

  const { consumer_signature } = body as { consumer_signature: unknown };
  if (!consumer_signature || typeof consumer_signature !== 'string')
    return c.json({ error: 'consumer_signature is required' }, 400);

  const existing = await getReceipt(c.env, receipt_id).catch(() => null);
  if (!existing) return c.json({ error: 'Receipt not found' }, 404);
  if (!canTransition(existing.status, 'acknowledged'))
    return c.json({ error: `Cannot transition from '${existing.status}' to 'acknowledged'` }, 409);

  try {
    const updated = await updateAck(c.env, existing, consumer_signature);
    return c.json(updated);
  } catch {
    return c.json({ error: 'Failed to acknowledge receipt' }, 503);
  }
});

// GET /v1/receipt/:id
receiptsRouter.get('/:id', async (c) => {
  const receipt = await getReceipt(c.env, c.req.param('id')).catch(() => null);
  if (!receipt) return c.json({ error: 'Receipt not found' }, 404);
  return c.json(receipt);
});
