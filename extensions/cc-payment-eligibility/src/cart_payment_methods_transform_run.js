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

  return paymentMethods.find(method => {
    if (!method.name) return false;

    const nameLower = method.name.toLowerCase();

    // Match credit card gateways but exclude gift cards
    if (nameLower.includes("gift")) {
      return false;
    }

    return (
      nameLower.includes("credit") ||
      nameLower.includes("bogus") ||
      nameLower.includes("stripe")
    );
  });
}

/**
 * Check if a customer is eligible for credit card payment
 * Based on US-1 AC2 and FR-1 1.2.2:
 * - Customer must be in CC pilot (cc_pilot_eligible = true)
 *
 * @param {object|null} customer
 * @returns {boolean}
 */
function isCustomerEligible(customer) {
  if (!customer) {
    console.log("No customer found - hiding CC");
    return false;
  }

  const ccPilotEligible = customer.ccPilotEligible?.value;

  // FR-1 1.2.2: Check pilot eligibility (must be explicitly set to "true")
  if (ccPilotEligible !== "true") {
    console.log(`Customer not pilot eligible: ${ccPilotEligible}`);
    return false;
  }

  return true;
}

/**
 * Check if the B2B company location is eligible for credit card payment
 * Based on US-1 AC2 and FR-1 1.2.3:
 * - Location must be flagged as CC eligible (cc_location_eligible = true)
 * - This check only applies to B2B customers with purchasingCompany
 * - B2C customers (no purchasingCompany) pass this check automatically
 *
 * @param {object|null} purchasingCompany
 * @returns {boolean}
 */
function isLocationEligible(purchasingCompany) {
  // B2C customers (no purchasingCompany) are eligible - this check only applies to B2B
  if (!purchasingCompany) {
    console.log("No purchasing company - B2C customer - skipping location check");
    return true;
  }

  const location = purchasingCompany.location;
  if (!location) {
    console.log("No location found for B2B customer - hiding CC");
    return false;
  }

  const ccLocationEligible = location.ccLocationEligible?.value;

  // FR-1 1.2.3: Check location eligibility (must be explicitly set to "true")
  if (ccLocationEligible !== "true") {
    console.log(`Location ${location.name} (${location.id}) not eligible: ${ccLocationEligible}`);
    return false;
  }

  console.log(`Location ${location.name} is eligible for CC`);
  return true;
}

/**
 * Check if selected shipping method allows credit card payment
 * Based on US-1 AC5:
 * - Allow CC only for: "FedEx Home Delivery®" and "FedEx Express Saver®"
 * - Hide CC for all other shipping methods
 *
 * @param {Array} deliveryGroups
 * @returns {boolean}
 */
function isShippingMethodEligible(deliveryGroups) {
  if (!deliveryGroups || deliveryGroups.length === 0) {
    console.log("No delivery groups - allowing CC by default");
    return true;
  }

  // Allowed shipping methods for CC payment (US-1 AC5)
  const allowedMethods = [
    "home delivery",
    "express saver"
  ];

  for (const group of deliveryGroups) {
    const selectedOption = group.selectedDeliveryOption;

    if (!selectedOption) {
      console.log("No shipping method selected yet - allowing CC");
      continue;
    }

    const title = selectedOption.title?.toLowerCase() || "";
    const handle = selectedOption.handle?.toLowerCase() || "";

    console.log(`Selected shipping: "${selectedOption.title}" (handle: ${selectedOption.handle})`);

    // Check if it's an allowed method by checking title
    const isAllowed = allowedMethods.some(method => title.includes(method));

    if (!isAllowed) {
      console.log(`Shipping method "${selectedOption.title}" not eligible for CC - hiding CC`);
      return false;
    }

    console.log(`Shipping method "${selectedOption.title}" is eligible for CC`);
  }

  return true;
}

/**
 * Check if all cart items are parcel-eligible
 * Based on US-1 and FR-1:
 * - If product has NO weight set → non-parcel → hide CC
 * - If product weight > 150 lbs → non-parcel → hide CC
 *
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
    const weight = line.merchandise.weight;

    // US-1 AC3: If product has no weight, it's non-parcel
    if (weight === null || weight === undefined || weight === 0) {
      console.log(`Product ${product.id} has no weight - non-parcel - hiding CC`);
      return false;
    }

    // Check weight threshold (hardcoded for MVP: 150 lbs)
    if (weight > PARCEL_WEIGHT_THRESHOLD_LBS) {
      console.log(`Product ${product.id} exceeds weight limit: ${weight} lbs - non-parcel - hiding CC`);
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

  // STEP 1: Check customer eligibility (US-1 AC2, FR-1 1.2.2 - pilot eligibility)
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

  // STEP 2: Check location eligibility (US-1 AC2, FR-1 1.2.3 - selected locations)
  const purchasingCompany = input.cart?.buyerIdentity?.purchasingCompany;
  console.log("Purchasing company:", JSON.stringify(purchasingCompany, null, 2));

  if (!isLocationEligible(purchasingCompany)) {
    console.log("Location not eligible - hiding CC payment method");
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

  // STEP 3: Check cart is parcel-only (US-1 AC3, AC4 - parcel eligibility)
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

  // STEP 4: Check selected shipping method (US-1 AC5 - shipping method eligibility)
  const deliveryGroups = input.cart?.deliveryGroups || [];
  console.log("Delivery groups count:", deliveryGroups.length);

  if (!isShippingMethodEligible(deliveryGroups)) {
    console.log("Selected shipping method not eligible - hiding CC payment method");
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
