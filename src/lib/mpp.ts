/**
 * MPP (Machine Payment Protocol) x402 payment gate for receipt-layer
 *
 * Flow:
 *   1. Agent calls POST /v1/receipt/commit
 *   2. No x-payment header → 402 with payment-request JSON
 *   3. Agent pays via MPP (Base or Tempo), gets a payment receipt token
 *   4. Agent retries with x-payment: <base64 receipt>
 *   5. Worker verifies receipt → creates commitment
 *
 * Free tier: FREE_COMMITS_PER_DAY per IP (no payment needed)
 * Paid tier: unlimited, 0.001 USDC per commit
 *
 * Supported chains:
 *   Base mainnet: chainId 8453
 *   Tempo mainnet: chainId 4217
 *
 * Reference: https://mpp.dev/overview
 */

import type { Env } from '../types';

export const FREE_COMMITS_PER_DAY = 100;
export const PRICE_USDC = '0.001';
export const PRICE_WEI = '1000'; // 0.001 USDC in 6-decimal

const PAYMENT_ADDRESS = '0xB1e55EdD3176Ce9C9aF28F15b79e0c0eb8Fe51AA';
const SERVICE_URL = 'https://receipt-layer.p-u-c.workers.dev/v1/receipt/commit';

const SUPPORTED_CHAINS = [
  { name: 'base',  chainId: 8453, rpc: 'https://base-rpc.publicnode.com', network: 'base' },
  { name: 'tempo', chainId: 4217, rpc: 'https://rpc.tempo.xyz',           network: 'tempo' },
] as const;

/**
 * Check free tier usage for an IP.
 */
export async function checkFreeTier(
  env: Env,
  ip: string
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const key = `freetier:${today}:${ip}`;
    const raw = await env.KV.get(key);
    const used = raw ? parseInt(raw, 10) : 0;
    if (used < FREE_COMMITS_PER_DAY) {
      const ttl = 86400 - (Math.floor(Date.now() / 1000) % 86400);
      await env.KV.put(key, String(used + 1), { expirationTtl: Math.max(ttl, 3600) });
      return { allowed: true, remaining: FREE_COMMITS_PER_DAY - used - 1 };
    }
    return { allowed: false, remaining: 0 };
  } catch {
    return { allowed: true, remaining: FREE_COMMITS_PER_DAY }; // fail open
  }
}

/**
 * Build x402 payment-request response body.
 */
export function buildPaymentRequest(capability: string): object {
  return {
    version: '1.0',
    error: 'Payment required',
    accepts: SUPPORTED_CHAINS.map((c) => ({
      scheme: 'exact',
      network: c.network,
      chainId: c.chainId,
      maxAmountRequired: PRICE_WEI,
      resource: SERVICE_URL,
      description: `Agent receipt commitment for capability: ${capability}`,
      mimeType: 'application/json',
      payTo: PAYMENT_ADDRESS,
      maxTimeoutSeconds: 60,
      asset: 'USDC',
      outputSchema: null,
      extra: {
        name: 'Agent Receipt Layer',
        version: '0.1.0',
        capability,
      },
    })),
  };
}

/**
 * Verify an MPP payment receipt token from the x-payment header.
 * Fails open if Tempo/Base RPC unreachable.
 */
export async function verifyPayment(
  env: Env,
  xPayment: string
): Promise<{ valid: boolean; reason?: string }> {
  try {
    const decoded = atob(xPayment);
    const receipt = JSON.parse(decoded) as {
      txHash?: string;
      to?: string;
      amount?: string;
      chainId?: number;
    };

    if (!receipt.txHash) return { valid: false, reason: 'missing txHash' };
    if (!receipt.to) return { valid: false, reason: 'missing to' };
    if (receipt.to.toLowerCase() !== PAYMENT_ADDRESS.toLowerCase())
      return { valid: false, reason: 'wrong recipient' };

    if (receipt.amount !== undefined && BigInt(receipt.amount) < BigInt(PRICE_WEI))
      return { valid: false, reason: `underpayment: got ${receipt.amount}, need ${PRICE_WEI}` };

    // Replay protection
    const usedKey = `payment:used:${receipt.txHash}`;
    if (await env.KV.get(usedKey).catch(() => null))
      return { valid: false, reason: 'receipt already used' };
    await env.KV.put(usedKey, '1', { expirationTtl: 86400 }).catch(() => {});

    // On-chain verify (fail open)
    try {
      for (const c of SUPPORTED_CHAINS) {
        const result = await verifyOnChain(receipt.txHash, receipt.to, c.rpc);
        if (result === true) break;
        if (result === false) return { valid: false, reason: 'on-chain verification failed' };
      }
    } catch { /* fail open */ }

    return { valid: true };
  } catch {
    return { valid: false, reason: 'invalid receipt format' };
  }
}

async function verifyOnChain(txHash: string, expectedTo: string, rpc: string): Promise<boolean | null> {
  try {
    const resp = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'receipt-layer/0.1' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getTransactionReceipt', params: [txHash] }),
      signal: AbortSignal.timeout(3000),
    });
    if (!resp.ok) return null;
    const json = await resp.json() as { result?: { status?: string; to?: string } | null };
    if (!json.result) return null;
    if (json.result.status !== '0x1') return false;
    if (json.result.to && json.result.to.toLowerCase() !== expectedTo.toLowerCase()) return false;
    return true;
  } catch {
    return null;
  }
}
