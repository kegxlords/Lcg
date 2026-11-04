const knownErrors = [
  ['PRODUCT_NOT_FOUND', 404, 'Product not found.'],
  ['PRODUCT_NOT_AVAILABLE', 400, 'This product is not available.'],
  ['PRODUCT_COMING_SOON', 400, 'This product is coming soon.'],
  ['PRODUCT_SOLD_OUT', 400, 'This product has reached its capacity.'],
  ['INVALID_PRODUCT', 400, 'The product data is invalid.'],
  ['INSUFFICIENT_BALANCE', 400, 'Insufficient balance.'],
  ['WALLET_NOT_FOUND', 404, 'Wallet not found.'],
  ['INVALID_WITHDRAWAL', 400, 'Enter a valid amount and complete all bank details.'],
  ['MINIMUM_WITHDRAWAL', 400, 'The amount is below the minimum withdrawal.'],
  ['NO_AVAILABLE_SPIN', 400, 'No available spins. Deposit or invest to earn more.'],
  ['INVALID_REWARD', 503, 'The wheel reward is not valid.'],
  ['INVALID_REQUEST', 400, 'Invalid request.']
];

export function sendAtomicRpcError(res, error, operation) {
  const message = String(error?.message || '');
  const match = knownErrors.find(([code]) => message.includes(code));
  if (!match) console.error(`[Atomic ${operation} RPC failed]:`, error);
  return res.status(match?.[1] || 500).json({
    error: match?.[2] || `Could not complete ${operation}.`
  });
}
