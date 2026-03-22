import { Hono } from 'hono';
import type { Env, VerifyResult } from '../types';
import { getReceipt } from '../lib/db';

const AGGREGATOR = 'https://aggregator.walrus-testnet.walrus.space';

export const verifyRouter = new Hono<{ Bindings: Env }>();

verifyRouter.get('/:id', async (c) => {
  const receipt = await getReceipt(c.env, c.req.param('id')).catch(() => null);
  if (!receipt) return c.json({ error: 'Receipt not found' }, 404);
  const walrus_url = receipt.walrus_blob_id ? `${AGGREGATOR}/v1/blobs/${receipt.walrus_blob_id}` : null;
  const result: VerifyResult = {
    receipt_id: receipt.receipt_id,
    status: receipt.status,
    provider_verified: !!receipt.provider_signature,
    consumer_verified: !!receipt.consumer_signature,
    walrus_verified: !!receipt.walrus_blob_id,
    walrus_url,
    chain_anchor: receipt.chain_anchor,
    receipt,
  };
  return c.json(result);
});
