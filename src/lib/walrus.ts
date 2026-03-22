import type { Receipt } from '../types';

const PUBLISHER_URL = 'https://publisher.walrus-testnet.walrus.space';
const AGGREGATOR_URL = 'https://aggregator.walrus-testnet.walrus.space';

export async function storeOnWalrus(receipt: Receipt): Promise<string | null> {
  try {
    const body = JSON.stringify(receipt);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(`${PUBLISHER_URL}/v1/blobs?epochs=5`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const result = await response.json() as {
      newlyCreated?: { blobObject: { blobId: string } };
      alreadyCertified?: { blobId: string };
    };

    return result.newlyCreated?.blobObject?.blobId ?? result.alreadyCertified?.blobId ?? null;
  } catch {
    return null;
  }
}

export async function fetchFromWalrus(blobId: string): Promise<Receipt | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(`${AGGREGATOR_URL}/v1/blobs/${blobId}`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    return await response.json() as Receipt;
  } catch {
    return null;
  }
}
