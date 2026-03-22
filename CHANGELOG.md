# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-03-22

### Added
- Initial release
- Receipt lifecycle: commit → deliver → ack
- Three-state state machine with validation
- Cloudflare D1 storage (query index)
- Walrus testnet anchoring (immutable source of truth)
- Seven REST endpoints:
  - `POST /v1/receipt/commit` — Create receipt commitment
  - `POST /v1/receipt/:id/deliver` — Record delivery
  - `POST /v1/receipt/:id/ack` — Consumer acknowledgment
  - `GET /v1/receipt/:id` — Get receipt by ID
  - `GET /v1/verify/:id` — Verify receipt
  - `GET /v1/agent/:address/receipts` — Get receipts by address
  - `GET /v1/health` — Health check
- Rate limiting (100 req/min per IP)
- CORS middleware
- Request ID tracking
- Walrus URL in all verify responses
- 28 unit tests
- Full TypeScript types
- OpenAPI 3.0 specification
- Protocol adapter documentation
- Walrus roadmap

### Technical Details
- Built on Hono framework
- Deployed to Cloudflare Workers
- AbortSignal.timeout for Walrus requests (8s timeout)
- Deterministic receipt ID generation
- Support for 6 agent protocols: A2A, MCP, ACP, HTTP, MPP, custom
- Support for 5 payment rails: MPP, x402, AP2, direct, other

### Infrastructure
- Cloudflare D1 database: `receipt-layer` (e1bdb996-5305-4a51-947f-c15d23310253)
- Cloudflare KV namespace: `receipt-layer` (d9bf117e14544bb3a3feb4e9fc563d8e)
- Walrus testnet: publisher.walrus-testnet.walrus.space
- Deployed: https://receipt-layer.p-u-c.workers.dev

### Known Limitations
- Walrus testnet may reset (receipts persist in D1)
- No on-chain anchoring yet (planned for v0.2)
- 5 epoch Walrus storage
- Single-region deployment (WNAM)

[0.1.0]: https://github.com/P-U-C/receipt-layer/releases/tag/v0.1.0

## [0.1.1] — 2026-03-22

### Added
- Private receipts: `visibility: "private"` with ECDH + AES-256-GCM encryption
- MPP x402 payment gate: 100 free commits/day, 0.001 USDC paid tier
- Sui Seal mainnet upgrade path documented in `src/lib/encryption.ts`
- D1 migration 0002: visibility, encryption_method, pubkey columns
- `rcpt/` rebrand: new URL `rcpt.p-u-c.workers.dev`, GitHub `P-U-C/rcpt`
- ERC-8004 track added (verify route checks agent identity via Base mainnet RPC)

### Fixed
- D1 read-after-write lag: build response in memory, not from DB re-read
- `AbortSignal.timeout()` for CF Workers (setTimeout ignored)
- ECDH `public` key field: runtime needs `public`, not `$public` (TS type lies)
- Walrus re-stored on every state transition (commit → deliver → ack)

### Tests
- 47 tests passing, zero TypeScript errors
