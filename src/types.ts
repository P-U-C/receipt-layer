export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  ENVIRONMENT?: string;
}

export type ReceiptStatus = 'committed' | 'delivered' | 'acknowledged' | 'disputed';
export type PaymentRail = 'mpp' | 'x402' | 'ap2' | 'direct' | 'other';
export type AgentProtocol = 'a2a' | 'mcp' | 'acp' | 'http' | 'mpp' | 'custom';

export interface AgentIdentity {
  agent_id?: string | null;
  address: string;
  protocol: AgentProtocol;
  endpoint?: string | null;
}

export interface PaymentDetails {
  amount: string;
  asset: string;
  rail: PaymentRail;
  chain: number;
  tx_hash?: string | null;
}

export interface ExecutionMetadata {
  model?: string;
  tokens?: number;
  duration_ms?: number;
  [key: string]: unknown;
}

export interface CommitBody {
  capability: string;
  provider: AgentIdentity;
  consumer: AgentIdentity;
  spec_hash?: string;
  payment?: PaymentDetails;
  provider_signature?: string;
}

export interface DeliverBody {
  output_hash: string;
  execution_metadata?: ExecutionMetadata;
  provider_signature?: string;
}

export interface AckBody {
  consumer_signature: string;
}

export interface ReceiptRow {
  receipt_id: string;
  version: string;
  capability: string;
  provider_agent_id: string | null;
  provider_address: string;
  provider_protocol: string;
  provider_endpoint: string | null;
  consumer_agent_id: string | null;
  consumer_address: string;
  consumer_protocol: string;
  spec_hash: string | null;
  payment_amount: string | null;
  payment_asset: string | null;
  payment_rail: string | null;
  payment_chain: number | null;
  payment_tx_hash: string | null;
  provider_signature: string | null;
  consumer_signature: string | null;
  output_hash: string | null;
  execution_metadata: string | null;
  status: ReceiptStatus;
  chain_anchor_chain: string | null;
  chain_anchor_tx_hash: string | null;
  walrus_blob_id: string | null;
  created_at: string;
  delivered_at: string | null;
  acknowledged_at: string | null;
}

export interface Receipt {
  receipt_id: string;
  version: string;
  capability: string;
  provider: AgentIdentity;
  consumer: AgentIdentity;
  spec_hash: string | null;
  payment: PaymentDetails | null;
  provider_signature: string | null;
  consumer_signature: string | null;
  output_hash: string | null;
  execution_metadata: ExecutionMetadata | null;
  status: ReceiptStatus;
  chain_anchor: { chain: string; tx_hash: string } | null;
  walrus_blob_id: string | null;
  walrus_url: string | null;
  created_at: string;
  delivered_at: string | null;
  acknowledged_at: string | null;
}

export interface VerifyResult {
  receipt_id: string;
  status: ReceiptStatus;
  provider_verified: boolean;
  consumer_verified: boolean;
  chain_anchor: { chain: string; tx_hash: string } | null;
  walrus_verified: boolean;
  walrus_url: string | null;
  receipt: Receipt;
}
