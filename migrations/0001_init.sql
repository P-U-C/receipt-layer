CREATE TABLE IF NOT EXISTS receipts (
  receipt_id TEXT PRIMARY KEY,
  version TEXT NOT NULL DEFAULT '0.1.0',
  capability TEXT NOT NULL,
  
  -- Provider identity
  provider_agent_id TEXT,
  provider_address TEXT NOT NULL,
  provider_protocol TEXT NOT NULL,
  provider_endpoint TEXT,
  
  -- Consumer identity
  consumer_agent_id TEXT,
  consumer_address TEXT NOT NULL,
  consumer_protocol TEXT NOT NULL,
  
  -- Specification & payment
  spec_hash TEXT,
  payment_amount TEXT,
  payment_asset TEXT,
  payment_rail TEXT,
  payment_chain INTEGER,
  payment_tx_hash TEXT,
  
  -- Signatures
  provider_signature TEXT,
  consumer_signature TEXT,
  
  -- Execution details
  output_hash TEXT,
  execution_metadata TEXT,
  
  -- Status tracking
  status TEXT NOT NULL CHECK(status IN ('committed', 'delivered', 'acknowledged', 'disputed')),
  
  -- Anchoring
  chain_anchor_chain TEXT,
  chain_anchor_tx_hash TEXT,
  walrus_blob_id TEXT,
  
  -- Timestamps
  created_at TEXT NOT NULL,
  delivered_at TEXT,
  acknowledged_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_receipts_provider ON receipts(provider_address);
CREATE INDEX IF NOT EXISTS idx_receipts_consumer ON receipts(consumer_address);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts(status);
CREATE INDEX IF NOT EXISTS idx_receipts_created ON receipts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_receipts_capability ON receipts(capability);
