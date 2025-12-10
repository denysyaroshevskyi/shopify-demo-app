// @ts-check

/**
 * @typedef {import("../generated/api").CartPaymentMethodsTransformRunInput} CartPaymentMethodsTransformRunInput
 * @typedef {import("../generated/api").CartPaymentMethodsTransformRunResult} CartPaymentMethodsTransformRunResult
 */

/**
 * @type {CartPaymentMethodsTransformRunResult}
 */
const NO_CHANGES = {
  operations: [],
};

// Hardcoded threshold for MVP: products over 150 lbs are considered non-parcel
const PARCEL_WEIGHT_THRESHOLD_LBS = 150;

/**
 * Find the Credit Card payment method from the available payment methods
 * @param {Array} paymentMethods
 * @returns {object|null}
 */
function findCreditCardPaymentMethod(paymentMethods) {
  if (!paymentMethods) return null;

  return paymentMethods.find(method =>
    method.name && (
      method.name.toLowerCase().includes("credit") ||
      method.name.toLowerCase().includes("card") ||
      method.name.toLowerCase().includes("visa") ||
      method.name.toLowerCase().includes("mastercard")
    )
  );
}

/**
 * Check if a customer is eligible for credit card payment
 * @param {object|null} customer
 * @returns {boolean}
 */
function isCustomerEligible(customer) {
  if (!customer) {
    console.log("No customer found - hiding CC");
    return false;
  }

  const ccPilotEligible = customer.ccPilotEligible?.value;

  // Check pilot eligibility (must be explicitly set to "true")
  if (ccPilotEligible !== "true") {
    console.log(`Customer not pilot eligible: ${ccPilotEligible}`);
    return false;
  }

  return true;
}

/**
 * Check if all cart items are parcel-eligible
 * @param {Array} cartLines
 * @returns {boolean}
 */
function isCartParcelEligible(cartLines) {
  if (!cartLines || cartLines.length === 0) {
    console.log("Empty cart - allowing CC");
    return true;
  }

  for (const line of cartLines) {
    // Skip non-product variants (e.g., custom products)
    if (line.merchandise.__typename !== "ProductVariant") {
      console.log(`Non-product variant found: ${line.merchandise.__typename} - hiding CC`);
      return false;
    }

    const product = line.merchandise.product;

    // Check if product requires LTL shipping
    const requiresLtl = product.requiresLtl?.value;
    if (requiresLtl === "true") {
      console.log(`Product ${product.id} requires LTL - hiding CC`);
      return false;
    }

    // Check explicit parcel eligibility flag
    const isParcelEligible = product.isParcelEligible?.value;
    if (isParcelEligible === "false") {
      console.log(`Product ${product.id} is not parcel eligible - hiding CC`);
      return false;
    }

    // Check weight threshold (hardcoded for MVP)
    const weight = line.merchandise.weight;
    if (weight && weight > PARCEL_WEIGHT_THRESHOLD_LBS) {
      console.log(`Product ${product.id} exceeds weight limit: ${weight} lbs - hiding CC`);
      return false;
    }
  }

  return true;
}

/**
 * Main function to determine payment method eligibility
 * @param {CartPaymentMethodsTransformRunInput} input
 * @returns {CartPaymentMethodsTransformRunResult}
 */
export function cartPaymentMethodsTransformRun(input) {
  console.log("=== CC Payment Eligibility Function Started ===");
  console.log("Full input:", JSON.stringify(input, null, 2));

  // Find the credit card payment method
  const ccPaymentMethod = findCreditCardPaymentMethod(input.paymentMethods);
  console.log("Found CC payment method:", JSON.stringify(ccPaymentMethod, null, 2));

  if (!ccPaymentMethod) {
    console.log("No credit card payment method found");
    return NO_CHANGES;
  }

  // STEP 1: Check customer eligibility (AC2 from US1 - pilot eligibility)
  const customer = input.cart?.buyerIdentity?.customer;
  console.log("Customer data:", JSON.stringify(customer, null, 2));

  if (!isCustomerEligible(customer)) {
    console.log("Customer not eligible - hiding CC payment method");
    const result = {
      operations: [{
        paymentMethodHide: {
          paymentMethodId: ccPaymentMethod.id
        }
      }]
    };
    console.log("Returning hide result:", JSON.stringify(result, null, 2));
    return result;
  }

  // STEP 2: Check cart is parcel-only (AC3, AC4 from US1)
  const cartLines = input.cart?.lines || [];
  console.log("Cart lines count:", cartLines.length);

  if (!isCartParcelEligible(cartLines)) {
    console.log("Cart contains non-parcel items - hiding CC payment method");
    const result = {
      operations: [{
        paymentMethodHide: {
          paymentMethodId: ccPaymentMethod.id
        }
      }]
    };
    console.log("Returning hide result:", JSON.stringify(result, null, 2));
    return result;
  }

  // All checks passed - show CC payment method
  console.log("All eligibility checks passed - showing CC payment method");
  console.log("=== CC Payment Eligibility Function Completed ===");
  return NO_CHANGES;
}
