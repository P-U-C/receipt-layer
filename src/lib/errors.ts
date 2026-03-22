export class ReceiptNotFoundError extends Error {
  constructor(receipt_id: string) {
    super(`Receipt not found: ${receipt_id}`);
    this.name = 'ReceiptNotFoundError';
  }
}

export class InvalidTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Cannot transition from '${from}' to '${to}'`);
    this.name = 'InvalidTransitionError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
