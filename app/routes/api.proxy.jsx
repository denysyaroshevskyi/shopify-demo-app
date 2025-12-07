import { authenticate } from "../shopify.server";
import {
  getProductInventoryData,
  updateInventory,
  validateInventoryInput
} from "../services/inventory.service";

export async function action({ request }) {
  try {
    // Authenticate the app proxy request
    const { admin } = await authenticate.public.appProxy(request);

    const body = await request.json();
    const { productId, quantityChange } = body;

    // Validate input using service
    const validation = validateInventoryInput(productId, quantityChange);
    if (!validation.isValid) {
      return { error: validation.error };
    }

    const quantityDelta = validation.quantityDelta;

    const productData = await getProductInventoryData(admin, productId);

    if (!productData) {
      return { error: "Product not found" };
    }

    if (!productData.inventoryItemId) {
      return { error: "Product inventory is not tracked" };
    }

    const { inventoryItemId, locationId, currentQuantity } = productData;

    const newQuantity = Math.max(0, currentQuantity + quantityDelta);

    const result = await updateInventory(admin, {
      inventoryItemId,
      locationId,
      newQuantity,
      currentQuantity,
    });

    return {
      success: true,
      productId,
      oldQuantity: currentQuantity,
      newQuantity: result.newQuantity,
      delta: result.delta,
    };

  } catch (error) {
    console.error("Inventory update error:", error);
    return { error: error.message || "Failed to update inventory" };
  }
}

export async function loader({ request }) {
  try {
    await authenticate.public.appProxy(request);
    return {
      status: "ok",
      message: "Inventory Manager App Proxy is running"
    };
  } catch (error) {
    return { error: "Authentication failed" };
  }
}
