/**
 * Inventory Service
 *
 * Centralized business logic for inventory management operations.
 * This service is used by both admin routes and app proxy endpoints.
 */

/**
 * Fetch product inventory data via GraphQL
 *
 * @param {Object} admin - Shopify Admin API client
 * @param {string} productId - Product ID (numeric or GID format)
 * @returns {Promise<Object|null>} Product inventory data or null if not found
 */
export async function getProductInventoryData(admin, productId) {
  const query = `#graphql
    query GetProductInventory($productId: ID!) {
      product(id: $productId) {
        id
        title
        variants(first: 1) {
          edges {
            node {
              id
              inventoryItem {
                id
                inventoryLevels(first: 1) {
                  edges {
                    node {
                      location {
                        id
                        name
                      }
                      quantities(names: "available") {
                        name
                        quantity
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  // Ensure product ID is in GraphQL format
  const gid = productId.startsWith("gid://")
    ? productId
    : `gid://shopify/Product/${productId}`;

  const response = await admin.graphql(query, {
    variables: { productId: gid },
  });

  const data = await response.json();

  // Handle GraphQL errors
  if (data.errors) {
    throw new Error(data.errors[0].message);
  }

  const product = data.data?.product;
  if (!product) {
    return null;
  }

  const variant = product.variants.edges[0]?.node;
  if (!variant || !variant.inventoryItem) {
    return null;
  }

  const inventoryLevel = variant.inventoryItem.inventoryLevels.edges[0]?.node;
  if (!inventoryLevel) {
    return {
      productTitle: product.title,
      inventoryItemId: variant.inventoryItem.id,
      locationId: null,
      currentQuantity: 0,
    };
  }

  const availableQty = inventoryLevel.quantities.find(q => q.name === "available");

  return {
    productTitle: product.title,
    inventoryItemId: variant.inventoryItem.id,
    locationId: inventoryLevel.location.id,
    currentQuantity: availableQty?.quantity || 0,
    locationName: inventoryLevel.location.name,
  };
}

/**
 * Update inventory using GraphQL inventorySetQuantities mutation
 *
 * @param {Object} admin - Shopify Admin API client
 * @param {Object} params - Inventory update parameters
 * @param {string} params.inventoryItemId - Inventory item GID
 * @param {string} params.locationId - Location GID
 * @param {number} params.newQuantity - New quantity to set
 * @param {number} params.currentQuantity - Current quantity for compare-and-set
 * @returns {Promise<Object>} Updated inventory data with newQuantity and delta
 */
export async function updateInventory(admin, { inventoryItemId, locationId, newQuantity, currentQuantity }) {
  const mutation = `#graphql
    mutation InventorySetQuantities($input: InventorySetQuantitiesInput!) {
      inventorySetQuantities(input: $input) {
        inventoryAdjustmentGroup {
          id
          createdAt
          reason
          changes {
            name
            delta
            quantityAfterChange
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    input: {
      name: "available",
      reason: "correction",
      quantities: [{
        inventoryItemId,
        locationId,
        quantity: newQuantity,
        compareQuantity: currentQuantity, // Prevents race conditions
      }],
    },
  };

  const response = await admin.graphql(mutation, { variables });
  const result = await response.json();

  // Check for user errors
  if (result.data?.inventorySetQuantities?.userErrors?.length > 0) {
    const error = result.data.inventorySetQuantities.userErrors[0];
    throw new Error(`${error.field}: ${error.message}`);
  }

  // Check for GraphQL errors
  if (result.errors) {
    throw new Error(result.errors[0].message);
  }

  const change = result.data.inventorySetQuantities.inventoryAdjustmentGroup.changes.find(
    c => c.name === "available"
  );

  // Calculate the new quantity from the old quantity and delta
  const calculatedNewQuantity = currentQuantity + (change?.delta || 0);

  return {
    newQuantity: change?.quantityAfterChange || calculatedNewQuantity,
    delta: change?.delta || 0,
  };
}

/**
 * Validate inventory update input
 *
 * @param {string} productId - Product ID
 * @param {string} quantityChange - Quantity change value
 * @returns {Object} Validation result with isValid and error
 */
export function validateInventoryInput(productId, quantityChange) {
  if (!productId) {
    return { isValid: false, error: "Product ID is required" };
  }

  if (!quantityChange || isNaN(parseInt(quantityChange))) {
    return { isValid: false, error: "Valid quantity change is required" };
  }

  return { isValid: true, quantityDelta: parseInt(quantityChange) };
}
