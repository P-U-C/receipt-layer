# Contributing to Agent Receipt Layer

We welcome contributions! This is a small, focused project — keep changes surgical.

## Quick Start

```bash
git clone https://github.com/P-U-C/receipt-layer.git
cd receipt-layer
npm install
npm test
```

## Development

```bash
# Run tests
npm test

# Type check
npm run build

# Local dev server
npx wrangler dev

# Deploy to Cloudflare
npx wrangler deploy
```

## Pull Request Process

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-change`)
3. Make your changes
4. Add tests if applicable
5. Run `npm test` — all tests must pass
6. Commit with clear message
7. Push and open PR

## What We're Looking For

- **Bug fixes** — always welcome
- **Protocol adapters** — see `docs/ADAPTERS.md`
- **Test coverage** — more is better
- **Documentation** — typos, clarity, examples
- **Performance** — faster queries, smaller payloads

## What We're NOT Looking For

- Large rewrites without discussion
- New dependencies without justification
- Breaking API changes
- Features without clear use cases

## Code Style

- TypeScript strict mode
- Prefer explicit over clever
- Comments for "why", not "what"
- Test names are sentences

## Testing

- Unit tests for pure functions
- Integration tests for routes (future)
- No mocking unless necessary

## Commit Messages

```
feat: add walrus blob verification
fix: handle null consumer_signature
docs: update adapter examples
test: add canTransition edge cases
```

## Questions?

Open an issue or PR. We respond within 24 hours.

## License

By contributing, you agree your contributions will be licensed under MIT.
