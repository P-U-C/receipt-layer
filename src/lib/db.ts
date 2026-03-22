import type { Env, ReceiptRow, CommitBody, Receipt, ExecutionMetadata } from '../types';
import { rowToReceipt, generateReceiptId } from './receipt';
import { storeOnWalrus } from './walrus';

const CACHE_TTL = 300;
const WALRUS_AGGREGATOR = 'https://aggregator.walrus-testnet.walrus.space';

async function cacheReceipt(env: Env, receipt: Receipt): Promise<void> {
  await env.KV.put(`receipt:${receipt.receipt_id}`, JSON.stringify(receipt), { expirationTtl: CACHE_TTL }).catch(() => {});
}

async function anchorWalrus(env: Env, receipt: Receipt): Promise<Receipt> {
  const blobId = await storeOnWalrus(receipt);
  if (blobId) {
    await env.DB.prepare('UPDATE receipts SET walrus_blob_id = ? WHERE receipt_id = ?')
      .bind(blobId, receipt.receipt_id).run().catch(() => {});
    receipt.walrus_blob_id = blobId;
    receipt.walrus_url = `${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`;
  }
  return receipt;
}

export async function getReceipt(env: Env, receipt_id: string): Promise<Receipt | null> {
  try {
    const cached = await env.KV.get(`receipt:${receipt_id}`);
    if (cached) return JSON.parse(cached) as Receipt;
  } catch { /* cache miss */ }

  const row = await env.DB.prepare('SELECT * FROM receipts WHERE receipt_id = ?')
    .bind(receipt_id).first<ReceiptRow>().catch(() => null);
  if (!row) return null;
  const receipt = rowToReceipt(row);
  await cacheReceipt(env, receipt);
  return receipt;
}

export async function createReceipt(env: Env, body: CommitBody): Promise<Receipt> {
  const now = new Date().toISOString();
  const receipt_id = generateReceiptId(
    body.provider.address,
    body.consumer.address,
    body.capability,
    now
  );

  await env.DB.prepare(`
    INSERT INTO receipts (
      receipt_id, capability,
      provider_agent_id, provider_address, provider_protocol, provider_endpoint,
      consumer_agent_id, consumer_address, consumer_protocol,
      spec_hash, payment_amount, payment_asset, payment_rail, payment_chain,
      provider_signature, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'committed', ?)
  `).bind(
    receipt_id, body.capability,
    body.provider.agent_id ?? null, body.provider.address, body.provider.protocol, body.provider.endpoint ?? null,
    body.consumer.agent_id ?? null, body.consumer.address, body.consumer.protocol,
    body.spec_hash ?? null,
    body.payment?.amount ?? null, body.payment?.asset ?? null,
    body.payment?.rail ?? null, body.payment?.chain ?? null,
    body.provider_signature ?? null,
    now
  ).run();

  // Build receipt object in memory — avoid immediate re-read lag
  const receipt: Receipt = {
    receipt_id,
    version: '0.1.0',
    capability: body.capability,
    provider: { ...body.provider },
    consumer: { ...body.consumer },
    spec_hash: body.spec_hash ?? null,
    payment: body.payment ? { ...body.payment } : null,
    provider_signature: body.provider_signature ?? null,
    consumer_signature: null,
    output_hash: null,
    execution_metadata: null,
    status: 'committed',
    chain_anchor: null,
    walrus_blob_id: null,
    walrus_url: null,
    created_at: now,
    delivered_at: null,
    acknowledged_at: null,
  };

  const anchored = await anchorWalrus(env, receipt);
  await cacheReceipt(env, anchored);
  return anchored;
}

export async function updateDelivery(
  env: Env,
  existing: Receipt,
  output_hash: string,
  execution_metadata: Record<string, unknown> | null,
  provider_signature: string | null
): Promise<Receipt> {
  const now = new Date().toISOString();
  const receipt_id = existing.receipt_id;

  await env.KV.delete(`receipt:${receipt_id}`).catch(() => {});

  await env.DB.prepare(`
    UPDATE receipts SET status = 'delivered', output_hash = ?,
      execution_metadata = ?,
      provider_signature = COALESCE(?, provider_signature),
      delivered_at = ?
    WHERE receipt_id = ?
  `).bind(
    output_hash,
    execution_metadata ? JSON.stringify(execution_metadata) : null,
    provider_signature, now, receipt_id
  ).run();

  // Build updated receipt in memory
  const receipt: Receipt = {
    ...existing,
    status: 'delivered',
    output_hash,
    execution_metadata: execution_metadata as ExecutionMetadata | null,
    provider_signature: provider_signature ?? existing.provider_signature,
    delivered_at: now,
  };

  const anchored = await anchorWalrus(env, receipt);
  await cacheReceipt(env, anchored);
  return anchored;
}

export async function updateAck(
  env: Env,
  existing: Receipt,
  consumer_signature: string
): Promise<Receipt> {
  const now = new Date().toISOString();
  const receipt_id = existing.receipt_id;

  await env.KV.delete(`receipt:${receipt_id}`).catch(() => {});

  await env.DB.prepare(`
    UPDATE receipts SET status = 'acknowledged', consumer_signature = ?, acknowledged_at = ?
    WHERE receipt_id = ?
  `).bind(consumer_signature, now, receipt_id).run();

  // Build updated receipt in memory
  const receipt: Receipt = {
    ...existing,
    status: 'acknowledged',
    consumer_signature,
    acknowledged_at: now,
  };

  const anchored = await anchorWalrus(env, receipt);
  await cacheReceipt(env, anchored);
  return anchored;
}

export async function getReceiptsByAddress(
  env: Env,
  address: string,
  status?: string,
  limit = 20
): Promise<Receipt[]> {
  const addr = address.toLowerCase();
  let query = `SELECT * FROM receipts WHERE (LOWER(provider_address) = ? OR LOWER(consumer_address) = ?)`;
  const params: (string | number)[] = [addr, addr];
  if (status) { query += ` AND status = ?`; params.push(status); }
  query += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(Math.min(limit, 100));
  const result = await env.DB.prepare(query).bind(...params).all<ReceiptRow>().catch(() => ({ results: [] }));
  return result.results.map(rowToReceipt);
}
