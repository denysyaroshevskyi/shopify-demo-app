import { describe, it, expect } from 'vitest';
import { cartPaymentMethodsTransformRun } from './cart_payment_methods_transform_run';

/**
 * @typedef {import("../generated/api").CartPaymentMethodsTransformRunResult} CartPaymentMethodsTransformRunResult
 */

describe('payment customization function', () => {
  it('returns no operations without configuration', () => {
    const result = cartPaymentMethodsTransformRun({
      paymentCustomization: {
        metafield: null
      }
    });
    const expected = /** @type {CartPaymentMethodsTransformRunResult} */ ({ operations: [] });

    expect(result).toEqual(expected);
  });
});