/**
 * Webhook Logger Service
 *
 * Logs webhook events to PostgreSQL database to emulate PIM/ERP system notifications.
 * In production, this would be replaced with actual API calls to external systems.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Log inventory webhook event to database
 * Emulates sending notification to PIM/ERP system
 *
 * @param {Object} event - Webhook event data
 * @param {string} event.shop - Shop domain
 * @param {string} event.topic - Webhook topic
 * @param {Object} event.payload - Webhook payload
 * @param {string} event.receivedAt - ISO timestamp
 */
export async function logInventoryWebhook(event) {
  const timestamp = new Date();

  try {
    const webhookEvent = await prisma.webhookEvent.create({
      data: {
        timestamp,
        topic: event.topic,
        shop: event.shop,
        inventoryItemId: String(event.payload.inventory_item_id || ''),
        locationId: String(event.payload.location_id || ''),
        available: event.payload.available || 0,
        pimStatus: 'sent',
        payload: event.payload,
      },
    });

    console.log(`✅ Logged inventory webhook to database: ${webhookEvent.id}`);
    return { success: true, eventId: webhookEvent.id };
  } catch (error) {
    console.error('❌ Failed to write webhook log:', error);
    throw error;
  }
}

/**
 * Get recent webhook events from database
 *
 * @param {number} limit - Number of recent events to retrieve
 * @returns {Promise<Array>} Recent webhook events
 */
export async function getRecentWebhookEvents(limit = 50) {
  try {
    const events = await prisma.webhookEvent.findMany({
      take: limit,
      orderBy: {
        timestamp: 'desc',
      },
    });

    // Transform to match the old format for backward compatibility
    return events.map(event => ({
      timestamp: event.timestamp.toISOString(),
      shop: event.shop,
      topic: event.topic,
      receivedAt: event.timestamp.toISOString(),
      inventoryChange: {
        inventoryItemId: event.inventoryItemId,
        locationId: event.locationId,
        available: event.available,
        updatedAt: event.createdAt.toISOString(),
      },
      pimNotification: {
        status: event.pimStatus,
        endpoint: 'https://pim.example.com/api/inventory/sync',
        method: 'POST',
        sentAt: event.timestamp.toISOString(),
      },
    }));
  } catch (error) {
    console.error('Error reading webhook logs:', error);
    return [];
  }
}

/**
 * Create summary report of webhook events
 *
 * @param {Date} startDate - Start date for report
 * @param {Date} endDate - End date for report
 * @returns {Promise<Object>} Summary statistics
 */
export async function createWebhookSummary(startDate, endDate) {
  try {
    const events = await prisma.webhookEvent.findMany({
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        shop: true,
        inventoryItemId: true,
        locationId: true,
      },
    });

    const summary = {
      totalEvents: events.length,
      uniqueShops: new Set(events.map(e => e.shop)).size,
      uniqueItems: new Set(events.map(e => e.inventoryItemId)).size,
      byShop: {},
      byLocation: {},
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    };

    // Count by shop
    events.forEach(e => {
      summary.byShop[e.shop] = (summary.byShop[e.shop] || 0) + 1;
    });

    // Count by location
    events.forEach(e => {
      const locId = e.locationId;
      summary.byLocation[locId] = (summary.byLocation[locId] || 0) + 1;
    });

    return summary;
  } catch (error) {
    console.error('Error creating webhook summary:', error);
    return {
      totalEvents: 0,
      uniqueShops: 0,
      uniqueItems: 0,
      byShop: {},
      byLocation: {},
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    };
  }
}

/**
 * Emulate sending webhook data to external PIM/ERP system
 *
 * @param {Object} inventoryData - Inventory change data
 * @returns {Promise<Object>} Mock response from PIM/ERP
 */
export async function notifyExternalPIM(inventoryData) {
  await new Promise(resolve => setTimeout(resolve, 100));

  // Log the notification
  console.log('Sending to PIM/ERP:', {
    endpoint: 'https://pim.example.com/api/inventory/sync',
    method: 'POST',
    data: inventoryData,
  });

  return {
    success: true,
    pimResponse: {
      id: `pim-${Date.now()}`,
      status: 'received',
      message: 'Inventory sync queued in PIM',
      timestamp: new Date().toISOString(),
    },
  };
}
