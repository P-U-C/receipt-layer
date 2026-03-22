# Walrus Storage Roadmap

## Current (v0.1.0)

**Storage:** Cloudflare D1 + Walrus Testnet  
**Status:** Live

- D1 as query index (fast lookups)
- Walrus testnet as immutable source of truth
- `walrus_url` returned in all verify responses
- Permissionless retrieval from Walrus

**Why Walrus now:**
- Decentralized storage from day 1
- Receipts survive API outages
- No dependency on centralized storage
- Testnet is stable enough for MVP

**Limitations:**
- Testnet may reset (unlikely but possible)
- 5 epoch storage (auto-renewed)
- Not production-grade yet

---

## Next (v0.2.0) — Q2 2026

**Storage:** Cloudflare D1 + Walrus Mainnet  
**On-Chain:** Base mainnet anchoring

### Changes
- Migrate to Walrus mainnet when available
- Add Base mainnet anchoring (commitment hash)
- On-chain anchor = hash of receipt
- Walrus blob reference stored on Sui

### Why Base
- Low gas costs (~$0.001 per anchor)
- EVM compatibility
- Agent ecosystem presence

### Migration
- Testnet receipts remain on testnet
- New receipts go to mainnet
- No breaking API changes

---

## Future (v1.0.0) — Q3-Q4 2026

**Storage:** Walrus Mainnet only (D1 optional)  
**On-Chain:** Sui + Base dual anchoring

### Changes
- Walrus as primary storage
- D1 becomes optional cache
- Sui anchoring for Walrus blobId
- Base anchoring for EVM compatibility
- Cross-chain verification

### Why Sui
- Native Walrus integration
- Low cost storage proofs
- Fast finality

### API Changes (non-breaking)
- New endpoint: `/v1/verify/:id/proof` (cryptographic proof)
- New endpoint: `/v1/verify/:id/onchain` (Base + Sui tx links)
- Existing endpoints unchanged

---

## Storage Economics

| Phase | D1 Cost | Walrus Cost | On-Chain Cost | Total/Receipt |
|-------|---------|-------------|---------------|---------------|
| v0.1 | $0.000001 | Free (testnet) | $0 | ~$0.000001 |
| v0.2 | $0.000001 | $0.003 | $0.001 | ~$0.004 |
| v1.0 | $0 (optional) | $0.003 | $0.002 | ~$0.005 |

**Revenue model:**
- Charge $0.01 per receipt
- 50% margin at v1.0
- Volume discounts for high-throughput agents

---

## Why Not IPFS / Arweave?

**IPFS:**
- Content-addressed but not incentivized
- Pinning services centralized
- No native blockchain integration

**Arweave:**
- Permanent storage (good)
- Expensive (~$0.01/KB, $10/MB)
- No native updates (receipts evolve: commit → deliver → ack)

**Walrus:**
- Cheap (~$0.003 per receipt)
- Sui-native (on-chain proof)
- Epoch-based storage (right for receipts)
- Built for agent economy use cases

---

## D1 vs Walrus

| Dimension | D1 | Walrus |
|-----------|-----|--------|
| Speed | <10ms | ~500ms |
| Cost | $0.000001 | $0.003 |
| Query | SQL | None |
| Immutability | No | Yes |
| Decentralization | No | Yes |

**Strategy:**
- D1 = query index (fast lookups, filtering, aggregation)
- Walrus = source of truth (immutable, permissionless)

If D1 and Walrus disagree → Walrus wins.

---

## Timeline

| Date | Milestone |
|------|-----------|
| Mar 2026 | v0.1.0 — D1 + Walrus testnet |
| May 2026 | Walrus mainnet launch |
| Jun 2026 | v0.2.0 — Mainnet migration + Base anchoring |
| Sep 2026 | v1.0.0 — Sui anchoring + D1 optional |

---

## Risk Mitigation

**Walrus testnet reset:**
- D1 retains all data
- Receipts remain queryable
- `walrus_verified = false` for lost blobs

**Walrus mainnet delay:**
- Stay on testnet longer
- Base anchoring independent of Walrus

**Cost blowup:**
- Cap storage epochs at 5
- Expire old receipts (archive to cold storage)
- Tiered pricing for large users
