import type { Env, ReceiptRow, CommitBody } from '../types';
import { rowToReceipt, generateReceiptId } from './receipt';
import type { Receipt } from '../types';
import { storeOnWalrus } from './walrus';

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
    receipt_id,
    body.capability,
    body.provider.agent_id ?? null,
    body.provider.address,
    body.provider.protocol,
    body.provider.endpoint ?? null,
    body.consumer.agent_id ?? null,
    body.consumer.address,
    body.consumer.protocol,
    body.spec_hash ?? null,
    body.payment?.amount ?? null,
    body.payment?.asset ?? null,
    body.payment?.rail ?? null,
    body.payment?.chain ?? null,
    body.provider_signature ?? null,
    now
  ).run();

  const row = await env.DB.prepare('SELECT * FROM receipts WHERE receipt_id = ?')
    .bind(receipt_id).first<ReceiptRow>();
  if (!row) throw new Error('Failed to create receipt');
  
  const receipt = rowToReceipt(row);
  
  // Store on Walrus (fail open)
  const blobId = await storeOnWalrus(receipt);
  if (blobId) {
    await env.DB.prepare('UPDATE receipts SET walrus_blob_id = ? WHERE receipt_id = ?')
      .bind(blobId, receipt_id).run().catch(() => {});
    receipt.walrus_blob_id = blobId;
  }
  
  return receipt;
}

export async function getReceipt(env: Env, receipt_id: string): Promise<Receipt | null> {
  // Try KV cache first
  try {
    const cached = await env.KV.get(`receipt:${receipt_id}`);
    if (cached) return JSON.parse(cached) as Receipt;
  } catch { /* cache miss */ }

  const row = await env.DB.prepare('SELECT * FROM receipts WHERE receipt_id = ?')
    .bind(receipt_id).first<ReceiptRow>().catch(() => null);
  if (!row) return null;
  const receipt = rowToReceipt(row);

  // Cache for 5 min
  await env.KV.put(`receipt:${receipt_id}`, JSON.stringify(receipt), { expirationTtl: 300 }).catch(() => {});
  return receipt;
}

export async function updateDelivery(
  env: Env,
  receipt_id: string,
  output_hash: string,
  execution_metadata: Record<string, unknown> | null,
  provider_signature: string | null
): Promise<Receipt | null> {
  const now = new Date().toISOString();
  await env.DB.prepare(`
    UPDATE receipts
    SET status = 'delivered',
        output_hash = ?,
        execution_metadata = ?,
        provider_signature = COALESCE(?, provider_signature),
        delivered_at = ?
    WHERE receipt_id = ? AND status = 'committed'
  `).bind(
    output_hash,
    execution_metadata ? JSON.stringify(execution_metadata) : null,
    provider_signature,
    now,
    receipt_id
  ).run();
  await env.KV.delete(`receipt:${receipt_id}`).catch(() => {});
  
  const receipt = await getReceipt(env, receipt_id);
  if (!receipt) return null;
  
  // Re-store updated receipt on Walrus (fail open)
  const blobId = await storeOnWalrus(receipt);
  if (blobId) {
    await env.DB.prepare('UPDATE receipts SET walrus_blob_id = ? WHERE receipt_id = ?')
      .bind(blobId, receipt_id).run().catch(() => {});
    receipt.walrus_blob_id = blobId;
  }
  
  return receipt;
}

export async function updateAck(
  env: Env,
  receipt_id: string,
  consumer_signature: string
): Promise<Receipt | null> {
  const now = new Date().toISOString();
  await env.DB.prepare(`
    UPDATE receipts
    SET status = 'acknowledged',
        consumer_signature = ?,
        acknowledged_at = ?
    WHERE receipt_id = ? AND status = 'delivered'
  `).bind(consumer_signature, now, receipt_id).run();
  await env.KV.delete(`receipt:${receipt_id}`).catch(() => {});
  
  const receipt = await getReceipt(env, receipt_id);
  if (!receipt) return null;
  
  // Re-store acknowledged receipt on Walrus (fail open)
  const blobId = await storeOnWalrus(receipt);
  if (blobId) {
    await env.DB.prepare('UPDATE receipts SET walrus_blob_id = ? WHERE receipt_id = ?')
      .bind(blobId, receipt_id).run().catch(() => {});
    receipt.walrus_blob_id = blobId;
  }
  
  return receipt;
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
  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }
  query += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(Math.min(limit, 100));

  const result = await env.DB.prepare(query).bind(...params).all<ReceiptRow>().catch(() => ({ results: [] }));
  return result.results.map(rowToReceipt);
}
