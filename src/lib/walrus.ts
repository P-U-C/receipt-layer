import type { Receipt } from '../types';

const PUBLISHER_URL = 'https://publisher.walrus-testnet.walrus.space';
const AGGREGATOR_URL = 'https://aggregator.walrus-testnet.walrus.space';

export async function storeOnWalrus(receipt: Receipt): Promise<string | null> {
  try {
    const bytes = new TextEncoder().encode(JSON.stringify(receipt));
    const resp = await fetch(`${PUBLISHER_URL}/v1/blobs?epochs=5`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: bytes,
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return null;
    const data = await resp.json() as {
      newlyCreated?: { blobObject: { blobId: string } };
      alreadyCertified?: { blobId: string };
    };
    return data.newlyCreated?.blobObject?.blobId ?? data.alreadyCertified?.blobId ?? null;
  } catch {
    return null;
  }
}

export async function fetchFromWalrus(blobId: string): Promise<Receipt | null> {
  try {
    const resp = await fetch(`${AGGREGATOR_URL}/v1/blobs/${blobId}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return null;
    const text = await resp.text();
    return JSON.parse(text) as Receipt;
  } catch {
    return null;
  }
}
