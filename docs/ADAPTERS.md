# Writing Protocol Adapters

An adapter translates a protocol-specific transaction into Receipt Layer calls.

## Adapter Template (50 lines)

```typescript
import { ReceiptLayer } from './receipt-layer-client';

class MyProtocolAdapter {
  constructor(private receipts: ReceiptLayer) {}

  async handleTransaction(tx: MyProtocolTx) {
    // 1. Commit on payment
    if (tx.type === 'payment') {
      await this.receipts.commit({
        capability: tx.service,
        provider: { address: tx.seller, protocol: 'my-protocol' },
        consumer: { address: tx.buyer, protocol: 'my-protocol' },
        payment: {
          amount: tx.amount,
          asset: tx.asset,
          rail: 'my-protocol',
          chain: tx.chain,
          tx_hash: tx.hash,
        },
      });
    }

    // 2. Deliver on response
    if (tx.type === 'response') {
      await this.receipts.deliver(tx.receipt_id, {
        output_hash: sha256(tx.output),
        execution_metadata: { model: tx.model, tokens: tx.tokens },
      });
    }

    // 3. Acknowledge on confirmation
    if (tx.type === 'confirm') {
      await this.receipts.acknowledge(tx.receipt_id, {
        consumer_signature: tx.signature,
      });
    }
  }
}
```

## Example: MPP Adapter

```typescript
import { MPP } from 'mpp-client';
import { ReceiptLayer } from 'receipt-layer-client';

const mpp = new MPP();
const receipts = new ReceiptLayer('https://receipt-layer.p-u-c.workers.dev');

mpp.on('payment', async (payment) => {
  const receipt = await receipts.commit({
    capability: payment.capability,
    provider: { address: payment.provider, protocol: 'mpp' },
    consumer: { address: payment.consumer, protocol: 'mpp' },
    payment: {
      amount: payment.amount,
      asset: payment.asset,
      rail: 'mpp',
      chain: payment.chain,
      tx_hash: payment.tx_hash,
    },
  });

  // Execute service
  const output = await executeService(payment.capability, payment.params);

  // Record delivery
  await receipts.deliver(receipt.receipt_id, {
    output_hash: sha256(output),
    execution_metadata: { model: 'gpt-4', tokens: 1500 },
    provider_signature: await signOutput(output),
  });
});

// Consumer acknowledges
mpp.on('response', async (response) => {
  await receipts.acknowledge(response.receipt_id, {
    consumer_signature: await signReceipt(response.receipt_id),
  });
});
```

## Example: x402 Adapter

```typescript
import express from 'express';
import { ReceiptLayer } from 'receipt-layer-client';

const app = express();
const receipts = new ReceiptLayer('https://receipt-layer.p-u-c.workers.dev');

app.get('/api/resource', async (req, res) => {
  // x402 handshake
  if (!req.headers['x-payment']) {
    return res.status(402).json({ payment_required: true });
  }

  const payment = verifyPayment(req.headers['x-payment']);

  // Commit receipt
  const receipt = await receipts.commit({
    capability: 'resource-access',
    provider: { address: process.env.PROVIDER_ADDRESS, protocol: 'x402' },
    consumer: { address: payment.consumer, protocol: 'x402' },
    payment: {
      amount: payment.amount,
      asset: 'USDC',
      rail: 'x402',
      chain: 8453,
      tx_hash: payment.tx_hash,
    },
  });

  // Serve resource
  const resource = await getResource();

  // Record delivery
  await receipts.deliver(receipt.receipt_id, {
    output_hash: sha256(resource),
  });

  res.json({ resource, receipt_id: receipt.receipt_id });
});
```

## Adapter Checklist

- [ ] Map protocol payment event to `commit`
- [ ] Map protocol response to `deliver`
- [ ] Map protocol confirmation to `acknowledge`
- [ ] Handle errors gracefully (return null, don't throw)
- [ ] Store receipt_id with transaction
- [ ] Expose receipt_id to consumer
- [ ] Optional: background sync for missed receipts
