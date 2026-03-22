# Agent Receipt Layer

**The accountability primitive the agent economy is missing.**

[![Deploy](https://img.shields.io/badge/deployed-live-brightgreen)](https://receipt-layer.p-u-c.workers.dev)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen)]()
[![Version](https://img.shields.io/badge/version-0.1.0-blue)]()

Agents can pay each other. They cannot prove to each other that a service was delivered as promised.

> The payment layer is solved. Identity is solved. The receipt layer is missing.

---

## The Problem

Agent A pays Agent B 0.01 USDC for sentiment analysis on 500 tweets.

Agent B could:
- Return cached results from yesterday
- Process 50 tweets instead of 500
- Use a cheaper model than advertised
- Return garbage and keep the money

Agent A has no recourse. The payment is final. The trust is blind.

---

## How It Works

Three states. One lifecycle. Binary consensus.

```
Provider                    Receipt Layer                Consumer
   │                              │                          │
   │── POST /commit ─────────────>│ receipt_id created       │
   │                              │ stored in D1             │
   │                              │ anchored on Walrus       │
   │                              │                          │
   │ (execute service)            │                          │
   │                              │                          │
   │── POST /:id/deliver ────────>│ output_hash recorded     │
   │                              │ status: delivered        │
   │                              │ Walrus blob updated      │
   │                              │                          │
   │                              │<── POST /:id/ack ────────│
   │                              │ status: acknowledged     │
   │                              │ consumer_signature stored│
   │                              │                          │
```

**Committed** — provider has committed to delivery  
**Delivered** — provider has recorded output hash + execution metadata  
**Acknowledged** — consumer has counter-signed; receipt is fulfilled

Unacknowledged receipts are not failures — they are data. An agent with 10,000 acknowledged receipts and zero unacknowledged is more trustworthy than one with no history.

---

## Storage Architecture

- **D1** — Query index. Fast lookups by receipt ID, address, status.
- **Walrus** — Immutable source of truth. Decentralized storage on Sui. Receipts survive our API going offline.
- Every receipt has a `walrus_url` in the verify response — direct retrieval without our API.

---

## Quick Start

### Commit (provider registers intent)
```bash
curl -X POST https://receipt-layer.p-u-c.workers.dev/v1/receipt/commit \
  -H "Content-Type: application/json" \
  -d '{
    "capability": "sentiment-analysis",
    "provider": { "address": "0xPROVIDER", "protocol": "mpp" },
    "consumer": { "address": "0xCONSUMER", "protocol": "http" },
    "payment": { "amount": "10000", "asset": "USDC", "rail": "mpp", "chain": 8453 },
    "provider_signature": "0x..."
  }'
```

### Deliver (provider records output)
```bash
curl -X POST https://receipt-layer.p-u-c.workers.dev/v1/receipt/RECEIPT_ID/deliver \
  -H "Content-Type: application/json" \
  -d '{
    "output_hash": "0xSHA256_OF_OUTPUT",
    "execution_metadata": { "model": "gpt-4", "tokens": 1200 },
    "provider_signature": "0x..."
  }'
```

### Acknowledge (consumer counter-signs)
```bash
curl -X POST https://receipt-layer.p-u-c.workers.dev/v1/receipt/RECEIPT_ID/ack \
  -H "Content-Type: application/json" \
  -d '{ "consumer_signature": "0x..." }'
```

### Verify (permissionless)
```bash
curl https://receipt-layer.p-u-c.workers.dev/v1/verify/RECEIPT_ID
# Returns: walrus_verified, walrus_url, provider_verified, consumer_verified
```

---

## TypeScript SDK (10 lines)

```typescript
const BASE = 'https://receipt-layer.p-u-c.workers.dev';

const commit = await fetch(`${BASE}/v1/receipt/commit`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ capability, provider, consumer, payment })
}).then(r => r.json());

await fetch(`${BASE}/v1/receipt/${commit.receipt_id}/deliver`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ output_hash, execution_metadata })
});

// Consumer side:
await fetch(`${BASE}/v1/receipt/${receipt_id}/ack`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ consumer_signature })
});
```

---

## Comparison

| | Agent Receipt Layer | ERC-8183 | Nothing |
|---|---|---|---|
| Escrow | ❌ No | ✅ Yes | — |
| Third-party evaluators | ❌ No | ✅ Yes | — |
| Binary consensus | ✅ Yes | ❌ No | — |
| Decentralized storage | ✅ Walrus | ❌ No | — |
| Protocol-agnostic | ✅ Yes | ❌ EVM only | — |
| Production-deployed | ✅ Yes | ❌ Spec only | — |

ERC-8183 is an escrow system. This is a receipt layer. They're composable — ERC-8183 can use our receipts as settlement triggers.

---

## Protocol Adapters

| Protocol | Commit Trigger | Deliver Trigger | Ack Trigger |
|---|---|---|---|
| MPP | Payment event | API response | Consumer confirms |
| x402 | 402 handshake | Resource returned | HTTP callback |
| A2A | Task submitted | Task completed | Client confirms |
| MCP | Tool invoked | Tool response | Client confirms |
| HTTP | REST call | REST call | REST call |

---

## Permissionless Verification

1. GET `/v1/verify/:receipt_id` — returns `walrus_url`
2. Fetch raw receipt from Walrus directly using `walrus_url`
3. Verify signatures against provider/consumer on-chain identities
4. No dependency on our API

---

## API Reference

| Method | Path | Description |
|---|---|---|
| POST | /v1/receipt/commit | Create a receipt commitment |
| POST | /v1/receipt/:id/deliver | Record delivery |
| POST | /v1/receipt/:id/ack | Consumer acknowledgment |
| GET | /v1/receipt/:id | Get receipt |
| GET | /v1/verify/:id | Verify receipt (with Walrus URL) |
| GET | /v1/agent/:address/receipts | All receipts for an address |
| GET | /v1/health | Health check |

Full OpenAPI spec: [docs/openapi.yaml](docs/openapi.yaml)

---

## Ecosystem

- **[safetymd](https://safetymd.p-u-c.workers.dev)** — Trust layer: verify payment addresses before committing
- **[ERC-8004](https://github.com/P-U-C/b1e55ed)** — Identity layer: on-chain agent registration
- **MPP** — Payment layer: x402 machine payments

---

## Roadmap

| Phase | Storage | Anchoring |
|---|---|---|
| MVP (now) | Cloudflare D1 | Pending |
| v0.2 | Walrus testnet | Base mainnet |
| v1.0 | Walrus mainnet | Sui + Base |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). PRs welcome. Issues open.

---

## License

MIT — see [LICENSE](LICENSE)
