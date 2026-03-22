import type { ReceiptRow, Receipt, ExecutionMetadata, PaymentDetails, AgentProtocol, PaymentRail } from '../types';

export function generateReceiptId(
  providerAddress: string,
  consumerAddress: string,
  capability: string,
  timestamp: string
): string {
  const input = `${providerAddress.toLowerCase()}:${consumerAddress.toLowerCase()}:${capability}:${timestamp}`;
  // Simple deterministic hash using Web Crypto-compatible approach
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const hex = Math.abs(hash).toString(16).padStart(20, '0');
  return `rcpt_${hex}`;
}

export const VALID_TRANSITIONS: Record<string, string[]> = {
  committed: ['delivered', 'disputed'],
  delivered: ['acknowledged', 'disputed'],
  acknowledged: [],
  disputed: [],
};

export function canTransition(from: string, to: string): boolean {
  return (VALID_TRANSITIONS[from] ?? []).includes(to);
}

export function rowToReceipt(row: ReceiptRow): Receipt {
  let execMeta: ExecutionMetadata | null = null;
  if (row.execution_metadata) {
    try {
      execMeta = JSON.parse(row.execution_metadata) as ExecutionMetadata;
    } catch {
      execMeta = null;
    }
  }

  const payment: PaymentDetails | null = row.payment_amount ? {
    amount: row.payment_amount,
    asset: row.payment_asset ?? 'USDC',
    rail: (row.payment_rail ?? 'other') as PaymentRail,
    chain: row.payment_chain ?? 0,
    tx_hash: row.payment_tx_hash ?? null,
  } : null;

  const walrus_url = row.walrus_blob_id
    ? `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${row.walrus_blob_id}`
    : null;

  return {
    receipt_id: row.receipt_id,
    version: row.version,
    capability: row.capability,
    provider: {
      agent_id: row.provider_agent_id,
      address: row.provider_address,
      protocol: row.provider_protocol as AgentProtocol,
      endpoint: row.provider_endpoint,
    },
    consumer: {
      agent_id: row.consumer_agent_id,
      address: row.consumer_address,
      protocol: row.consumer_protocol as AgentProtocol,
    },
    spec_hash: row.spec_hash,
    payment,
    provider_signature: row.provider_signature,
    consumer_signature: row.consumer_signature,
    output_hash: row.output_hash,
    execution_metadata: execMeta,
    status: row.status,
    chain_anchor: row.chain_anchor_tx_hash ? {
      chain: row.chain_anchor_chain ?? 'base',
      tx_hash: row.chain_anchor_tx_hash,
    } : null,
    walrus_blob_id: row.walrus_blob_id,
    walrus_url,
    created_at: row.created_at,
    delivered_at: row.delivered_at,
    acknowledged_at: row.acknowledged_at,
  };
}

export function validateAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}
