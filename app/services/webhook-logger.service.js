/**
 * Webhook Logger Service
 *
 * Logs webhook events to files to emulate PIM/ERP system notifications.
 * In production, this would be replaced with actual API calls to external systems.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create logs directory if it doesn't exist
const LOGS_DIR = path.join(__dirname, '../../logs/webhooks');
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

/**
 * Log inventory webhook event to file
 * Emulates sending notification to PIM/ERP system
 *
 * @param {Object} event - Webhook event data
 * @param {string} event.shop - Shop domain
 * @param {string} event.topic - Webhook topic
 * @param {Object} event.payload - Webhook payload
 * @param {string} event.receivedAt - ISO timestamp
 */
export async function logInventoryWebhook(event) {
  const timestamp = new Date().toISOString();
  const dateStr = timestamp.split('T')[0]; // YYYY-MM-DD

  // Create daily log file
  const logFile = path.join(LOGS_DIR, `inventory-events-${dateStr}.log`);

  // Format log entry
  const logEntry = {
    timestamp,
    shop: event.shop,
    topic: event.topic,
    receivedAt: event.receivedAt,
    inventoryChange: {
      inventoryItemId: event.payload.inventory_item_id,
      locationId: event.payload.location_id,
      available: event.payload.available,
      updatedAt: event.payload.updated_at,
    },
    // Emulate PIM/ERP notification
    pimNotification: {
      status: 'sent',
      endpoint: 'https://pim.example.com/api/inventory/sync',
      method: 'POST',
      sentAt: timestamp,
    },
  };

  // Append to log file
  const logLine = JSON.stringify(logEntry) + '\n';

  try {
    fs.appendFileSync(logFile, logLine, 'utf8');
    console.log(`✅ Logged inventory webhook to ${logFile}`);
    return { success: true, logFile };
  } catch (error) {
    console.error('❌ Failed to write webhook log:', error);
    throw error;
  }
}

/**
 * Get recent webhook events from logs
 *
 * @param {number} limit - Number of recent events to retrieve
 * @returns {Array} Recent webhook events
 */
export function getRecentWebhookEvents(limit = 50) {
  try {
    const files = fs.readdirSync(LOGS_DIR)
      .filter(f => f.startsWith('inventory-events-'))
      .sort()
      .reverse();

    const events = [];

    for (const file of files) {
      if (events.length >= limit) break;

      const filePath = path.join(LOGS_DIR, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.trim().split('\n');

      for (const line of lines.reverse()) {
        if (events.length >= limit) break;
        try {
          events.push(JSON.parse(line));
        } catch (e) {
          // Skip malformed lines
        }
      }
    }

    return events;
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
 * @returns {Object} Summary statistics
 */
export function createWebhookSummary(startDate, endDate) {
  const events = getRecentWebhookEvents(1000);

  const filtered = events.filter(e => {
    const eventDate = new Date(e.timestamp);
    return eventDate >= startDate && eventDate <= endDate;
  });

  const summary = {
    totalEvents: filtered.length,
    uniqueShops: new Set(filtered.map(e => e.shop)).size,
    uniqueItems: new Set(filtered.map(e => e.inventoryChange.inventoryItemId)).size,
    byShop: {},
    byLocation: {},
    dateRange: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    },
  };

  // Count by shop
  filtered.forEach(e => {
    summary.byShop[e.shop] = (summary.byShop[e.shop] || 0) + 1;
  });

  // Count by location
  filtered.forEach(e => {
    const locId = e.inventoryChange.locationId;
    summary.byLocation[locId] = (summary.byLocation[locId] || 0) + 1;
  });

  return summary;
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
