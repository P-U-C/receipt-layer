# Protocol Specification

## Receipt Schema

```typescript
{
  receipt_id: string;        // rcpt_{deterministic_hash}
  version: string;           // 0.1.0
  capability: string;        // service identifier
  provider: AgentIdentity;
  consumer: AgentIdentity;
  spec_hash: string | null;  // hash of service spec
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
```

## State Machine

```
committed ──> delivered ──> acknowledged
    │
    └──> disputed
```

### Valid Transitions

| From | To | Trigger |
|------|-----|---------|
| committed | delivered | POST /:id/deliver |
| committed | disputed | POST /:id/dispute |
| delivered | acknowledged | POST /:id/ack |
| delivered | disputed | POST /:id/dispute |

### Terminal States

- **acknowledged** — success
- **disputed** — failure

## Verification Algorithm

```
1. Fetch receipt from D1
2. provider_verified = !!receipt.provider_signature
3. consumer_verified = !!receipt.consumer_signature
4. walrus_verified = !!receipt.walrus_blob_id
5. If walrus_blob_id exists:
   - Fetch from Walrus using walrus_url
   - Compare D1 data with Walrus data
   - If mismatch: D1 data is stale, Walrus is source of truth
6. If chain_anchor exists:
   - Verify on-chain transaction
```

## Signature Scheme

Signatures are over:
```
keccak256(
  receipt_id ||
  capability ||
  provider_address ||
  consumer_address ||
  output_hash ||
  timestamp
)
```

Sign with Ethereum private key. Standard ECDSA signature format.

## Anchoring

### Walrus (v0.1)
- Store full receipt JSON on Walrus testnet
- 5 epochs storage
- Returns blobId
- Immutable, decentralized

### On-Chain (v0.2+)
- Base mainnet: commitment hash only
- Sui: Walrus blobId reference
- No full data on-chain (gas efficiency)

## Incentive Alignment

**Seller-pays model:**
- Provider pays for receipt creation (~$0.001)
- Provider pays for Walrus anchoring (~$0.01)
- Consumer verifies for free

**Why:**
- Good providers want receipts → reputation
- Bad providers avoid receipts → self-selection
- Consumers bear no cost to verify trust

## Rate Limits

- 100 requests/minute per IP
- 1000 receipts/day per address
- No limit on verification

## Idempotency

- Commit requests: deterministic receipt_id
- Same commit twice → same receipt_id
- Deliver/ack: idempotent (same result if repeated)
