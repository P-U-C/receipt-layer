import { describe, it, expect } from 'vitest';
import { generateReceiptId, canTransition, validateAddress } from '../src/lib/receipt';

describe('generateReceiptId', () => {
  it('starts with rcpt_', () => expect(generateReceiptId('0xabc', '0xdef', 'cap', new Date().toISOString())).toMatch(/^rcpt_/));
  it('is deterministic', () => {
    const ts = '2026-03-22T00:00:00.000Z';
    expect(generateReceiptId('0xabc', '0xdef', 'cap', ts)).toBe(generateReceiptId('0xabc', '0xdef', 'cap', ts));
  });
  it('differs for different capabilities', () => {
    const ts = '2026-03-22T00:00:00.000Z';
    expect(generateReceiptId('0xabc', '0xdef', 'cap-a', ts)).not.toBe(generateReceiptId('0xabc', '0xdef', 'cap-b', ts));
  });
});

describe('canTransition', () => {
  it('committed → delivered', () => expect(canTransition('committed', 'delivered')).toBe(true));
  it('delivered → acknowledged', () => expect(canTransition('delivered', 'acknowledged')).toBe(true));
  it('committed → disputed', () => expect(canTransition('committed', 'disputed')).toBe(true));
  it('rejects acknowledged → delivered', () => expect(canTransition('acknowledged', 'delivered')).toBe(false));
  it('rejects acknowledged → committed', () => expect(canTransition('acknowledged', 'committed')).toBe(false));
  it('rejects unknown state', () => expect(canTransition('unknown', 'delivered')).toBe(false));
});

describe('validateAddress', () => {
  it('accepts checksummed', () => expect(validateAddress('0xB1e55EdD3176Ce9C9aF28F15b79e0c0eb8Fe51AA')).toBe(true));
  it('accepts lowercase', () => expect(validateAddress('0xb1e55edd3176ce9c9af28f15b79e0c0eb8fe51aa')).toBe(true));
  it('rejects short', () => expect(validateAddress('0xabc123')).toBe(false));
  it('rejects no prefix', () => expect(validateAddress('b1e55edd3176ce9c9af28f15b79e0c0eb8fe51aa')).toBe(false));
});
