import { useState, useEffect } from "react";
import { useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import {
  getProductInventoryData,
  updateInventory,
  validateInventoryInput
} from "../services/inventory.service";

/**
 * Admin Route: Inventory Manager
 *
 * Accessible at: /app/inventory
 *
 * This route provides a simple UI in the Shopify Admin to update product inventory.
 * Users can enter a product ID and quantity change (+/-) to update stock levels.
 */

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  try {
    const formData = await request.formData();
    const productId = formData.get("productId");
    const quantityChange = formData.get("quantityChange");

    // Validate input using service
    const validation = validateInventoryInput(productId, quantityChange);
    if (!validation.isValid) {
      return { error: validation.error };
    }

    const quantityDelta = validation.quantityDelta;

    // Step 1: Get product variant and inventory data
    const productData = await getProductInventoryData(admin, productId);

    if (!productData) {
      return { error: "Product not found or has no variants" };
    }

    if (!productData.inventoryItemId) {
      return { error: "Product inventory is not tracked" };
    }

    const { inventoryItemId, locationId, currentQuantity, productTitle } = productData;

    // Step 2: Calculate new quantity (prevent negative inventory)
    const newQuantity = Math.max(0, currentQuantity + quantityDelta);

    // Step 3: Update inventory via GraphQL mutation
    const result = await updateInventory(admin, {
      inventoryItemId,
      locationId,
      newQuantity,
      currentQuantity,
    });

    return {
      success: true,
      productTitle,
      productId,
      oldQuantity: currentQuantity,
      newQuantity: result.newQuantity,
      delta: result.delta,
    };

  } catch (error) {
    console.error("Inventory update error:", error);
    return { error: error.message || "Failed to update inventory" };
  }
};

export default function InventoryManager() {
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const [productId, setProductId] = useState("");
  const [quantityChange, setQuantityChange] = useState("");

  const isLoading =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  // Show toast on success
  useEffect(() => {
    if (fetcher.data?.success) {
      shopify.toast.show(
        `Updated ${fetcher.data.productTitle}: ${fetcher.data.oldQuantity} → ${fetcher.data.newQuantity}`
      );
      // Clear form on success
      setQuantityChange("");
    }
  }, [fetcher.data?.success, shopify, fetcher.data?.productTitle, fetcher.data?.oldQuantity, fetcher.data?.newQuantity]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!productId || !quantityChange) return;

    const formData = new FormData();
    formData.append("productId", productId);
    formData.append("quantityChange", quantityChange);

    fetcher.submit(formData, { method: "POST" });
  };

  return (
    <s-page heading="Inventory Manager">
      <s-section heading="Update Product Inventory">
        <s-paragraph>
          Enter a Product ID and the quantity change (positive to add, negative to subtract).
          The inventory will be updated at the first available location.
        </s-paragraph>

        <form onSubmit={handleSubmit}>
          <s-stack direction="block" gap="base">
            {/* Product ID Input */}
            <s-text-field
              label="Product ID"
              value={productId}
              onInput={(e) => setProductId(e.target.value)}
              placeholder="e.g., 1234567890"
              helpText="Find this in the product URL: /admin/products/[ID]"
              required
            />

            {/* Quantity Change Input */}
            <s-text-field
              label="Quantity Change"
              type="number"
              value={quantityChange}
              onInput={(e) => setQuantityChange(e.target.value)}
              placeholder="e.g., +10 or -5"
              helpText="Positive numbers add stock, negative numbers subtract"
              required
            />

            {/* Submit Button */}
            <s-button
              type="submit"
              variant="primary"
              {...(isLoading ? { loading: true } : {})}
              disabled={!productId || !quantityChange}
            >
              Update Inventory
            </s-button>

            {/* Error Message */}
            {fetcher.data?.error && (
              <s-banner tone="critical">
                <s-text>{fetcher.data.error}</s-text>
              </s-banner>
            )}

            {/* Success Message */}
            {fetcher.data?.success && (
              <s-banner tone="success">
                <s-stack direction="block" gap="tight">
                  <s-text fontWeight="bold">{fetcher.data.productTitle}</s-text>
                  <s-text>
                    Inventory updated: {fetcher.data.oldQuantity} → {fetcher.data.newQuantity}
                    {" "}({fetcher.data.delta > 0 ? "+" : ""}{fetcher.data.delta})
                  </s-text>
                </s-stack>
              </s-banner>
            )}
          </s-stack>
        </form>
      </s-section>

      {/* Instructions Section */}
      <s-section slot="aside" heading="How to use">
        <s-stack direction="block" gap="base">
          <s-paragraph>
             Enter product id and qty to change stock
          </s-paragraph>
        </s-stack>
      </s-section>

      {/* Example Section */}
      <s-section slot="aside" heading="Examples">
        <s-unordered-list>
          <s-list-item>
            <s-text>+10 = Add 10 units to stock</s-text>
          </s-list-item>
          <s-list-item>
            <s-text>-5 = Remove 5 units from stock</s-text>
          </s-list-item>
          <s-list-item>
            <s-text>Inventory cannot go below 0</s-text>
          </s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}
