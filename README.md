# rcpt/

**The accountability primitive the agent economy is missing.**

[![Deploy](https://img.shields.io/badge/deployed-live-brightgreen)](https://rcpt.p-u-c.workers.dev)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-47%20passing-brightgreen)]()
[![CI](https://github.com/P-U-C/rcpt/actions/workflows/ci.yml/badge.svg)](https://github.com/P-U-C/rcpt/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-0.1.0-blue)]()

Agents can pay each other. They cannot prove to each other that a service was delivered as promised.

> The payment layer is solved. Identity is solved. The receipt layer is missing.

---

## The Problem

Agent A pays Agent B 0.001 USDC for sentiment analysis on 500 tweets.

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
Provider                        rcpt/                    Consumer
   │                              │                          │
   │── POST /v1/receipt/commit ──>│ rcpt_0x4b83e78b created  │
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

**committed** — provider has committed to delivery  
**delivered** — provider has recorded output hash + execution metadata  
**acknowledged** — consumer has counter-signed; receipt is complete

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
curl -X POST https://rcpt.p-u-c.workers.dev/v1/receipt/commit \
  -H "Content-Type: application/json" \
  -d '{
    "capability": "sentiment-analysis",
    "provider": { "address": "0xPROVIDER", "protocol": "mpp" },
    "consumer": { "address": "0xCONSUMER", "protocol": "http" },
    "payment": { "amount": "1000", "asset": "USDC", "rail": "mpp", "chain": 8453 },
    "provider_signature": "0x..."
  }'
```

### Deliver (provider records output)
```bash
curl -X POST https://rcpt.p-u-c.workers.dev/v1/receipt/RECEIPT_ID/deliver \
  -H "Content-Type: application/json" \
  -d '{
    "output_hash": "0xSHA256_OF_OUTPUT",
    "execution_metadata": { "model": "gpt-4", "tokens": 1200 },
    "provider_signature": "0x..."
  }'
```

### Acknowledge (consumer counter-signs)
```bash
curl -X POST https://rcpt.p-u-c.workers.dev/v1/receipt/RECEIPT_ID/ack \
  -H "Content-Type: application/json" \
  -d '{ "consumer_signature": "0x..." }'
```

### Verify (permissionless)
```bash
curl https://rcpt.p-u-c.workers.dev/v1/verify/RECEIPT_ID
# Returns: walrus_verified, walrus_url, provider_verified, consumer_verified
```

---

## Private Receipts

Commercial transactions stay confidential. Add `visibility: "private"` with pubkeys on commit:

```bash
curl -X POST https://rcpt.p-u-c.workers.dev/v1/receipt/commit \
  -H "Content-Type: application/json" \
  -d '{
    "capability": "proprietary-model-inference",
    "visibility": "private",
    "provider_pubkey": "04abc...",
    "consumer_pubkey": "04def...",
    "provider": { "address": "0xPROVIDER", "protocol": "mpp" },
    "consumer": { "address": "0xCONSUMER", "protocol": "http" }
  }'
```

On deliver: `output_hash` and `execution_metadata` are encrypted with the consumer's public key using **ECDH + AES-256-GCM** (Web Crypto, zero deps). The Walrus blob stores ciphertext — unreadable without the consumer's private key.

**Mainnet upgrade path:** Sui Seal replaces ECDH when Seal launches on mainnet. Same API — swap `encryption_method` and decrypt client-side with `@mysten/seal`. No migration needed.

> ⚠️ Sui Seal is testnet-only as of March 2026. Track: https://github.com/MystenLabs/seal

---

## Payment Gate (MPP x402)

```
Free tier: 100 commits/day per IP
Paid:      0.001 USDC per commit (Base or Tempo mainnet)
```

Free requests return `x-free-commits-remaining` header. When exhausted, `/commit` returns a `402` with a full x402 payment-request body — agents pay and retry.

---

## TypeScript (15 lines)

```typescript
const BASE = 'https://rcpt.p-u-c.workers.dev';

const { receipt_id } = await fetch(`${BASE}/v1/receipt/commit`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ capability, provider, consumer, payment })
}).then(r => r.json());

await fetch(`${BASE}/v1/receipt/${receipt_id}/deliver`, {
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

| | rcpt/ | ERC-8183 | Nothing |
|---|---|---|---|
| Escrow | ❌ No | ✅ Yes | — |
| Third-party evaluators | ❌ No | ✅ Yes | — |
| Binary consensus | ✅ Yes | ❌ No | — |
| Decentralized storage | ✅ Walrus | ❌ No | — |
| Private receipts | ✅ ECDH | ❌ No | — |
| Protocol-agnostic | ✅ Yes | ❌ EVM only | — |
| Production-deployed | ✅ Yes | ❌ Spec only | — |

ERC-8183 is an escrow system. rcpt/ is a receipt layer. They're composable — ERC-8183 can use our receipts as settlement triggers.

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

1. `GET /v1/verify/:receipt_id` — returns `walrus_url`
2. Fetch raw receipt from Walrus directly
3. Verify signatures against provider/consumer addresses
4. No dependency on rcpt/ API

---

## API Reference

| Method | Path | Description |
|---|---|---|
| POST | /v1/receipt/commit | Create a receipt commitment |
| POST | /v1/receipt/:id/deliver | Record delivery + output hash |
| POST | /v1/receipt/:id/ack | Consumer acknowledgment |
| GET | /v1/receipt/:id | Get receipt |
| GET | /v1/verify/:id | Verify (with Walrus URL) |
| GET | /v1/agent/:address/receipts | All receipts for an address |
| GET | /v1/health | Health check |

Full spec: [docs/openapi.yaml](docs/openapi.yaml)

---

## The Agent Economy Stack

```
┌─────────────────────────────────────────┐
│  rcpt/          accountability layer    │
├─────────────────────────────────────────┤
│  safetymd       trust layer             │
├─────────────────────────────────────────┤
│  ERC-8004       identity layer          │
├─────────────────────────────────────────┤
│  MPP / x402     payment layer           │
└─────────────────────────────────────────┘
```

---

## Roadmap

| Phase | Storage | Encryption | Anchoring |
|---|---|---|---|
| v0.1 (now) | Cloudflare D1 | ECDH + AES-256-GCM | Walrus testnet |
| v0.2 | Walrus mainnet | Sui Seal | Base mainnet |
| v1.0 | Walrus mainnet | Sui Seal | Sui + Base |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). PRs welcome.

---

## License

MIT — see [LICENSE](LICENSE)
