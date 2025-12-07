/**
 * Webhook Handler: inventory_levels/update
 *
 * Triggered when inventory levels change in Shopify.
 * Logs events and notifies external PIM/ERP systems.
 */

import { authenticate } from "../shopify.server";
import { logInventoryWebhook, notifyExternalPIM } from "../services/webhook-logger.service";

export const action = async ({ request }) => {
  try {
    // Authenticate and parse webhook
    const { topic, shop, payload } = await authenticate.webhook(request);

    console.log(`📥 Received ${topic} webhook for ${shop}`);
    console.log('Payload:', JSON.stringify(payload, null, 2));

    // CRITICAL: Respond immediately (within 5 seconds)
    // Process webhook asynchronously after response
    const receivedAt = new Date().toISOString();

    // Process webhook in background (non-blocking)
    processWebhookAsync(topic, shop, payload, receivedAt)
      .catch(error => {
        console.error('❌ Webhook processing error:', error);
      });

    // Respond to Shopify immediately
    return new Response('OK', { status: 200 });

  } catch (error) {
    console.error('❌ Webhook authentication failed:', error);
    // Still return 200 to prevent retries for auth failures
    return new Response('OK', { status: 200 });
  }
};

/**
 * Process webhook asynchronously after responding to Shopify
 */
async function processWebhookAsync(topic, shop, payload, receivedAt) {
  try {
    // 1. Extract inventory change details
    const inventoryChange = {
      inventoryItemId: payload.inventory_item_id,
      locationId: payload.location_id,
      available: payload.available,
      updatedAt: payload.updated_at,
    };

    console.log('📦 Inventory Change:', inventoryChange);

    // 2. Log webhook event to file (emulates audit trail)
    await logInventoryWebhook({
      shop,
      topic,
      payload,
      receivedAt,
    });

    // 3. Notify external PIM/ERP system (emulated)
    const pimResponse = await notifyExternalPIM({
      shop,
      inventoryItemId: inventoryChange.inventoryItemId,
      locationId: inventoryChange.locationId,
      newQuantity: inventoryChange.available,
      updatedAt: inventoryChange.updatedAt,
      source: 'shopify_webhook',
    });

    console.log('✅ PIM/ERP notified:', pimResponse);

    // 4. Optional: Store in database for historical tracking
    // await storeWebhookEvent(shop, topic, payload, pimResponse);

  } catch (error) {
    console.error('❌ Failed to process webhook:', error);
    // In production, you might want to:
    // - Queue for retry
    // - Send alert to monitoring system
    // - Log to error tracking service
  }
}
