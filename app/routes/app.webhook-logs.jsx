/**
 * Admin Route: Webhook Logs Viewer
 *
 * Displays recent inventory webhook events and PIM/ERP notifications.
 */

import { useState, useEffect } from "react";
import { useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getRecentWebhookEvents, createWebhookSummary } from "../services/webhook-logger.service";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  // Get recent webhook events
  const recentEvents = await getRecentWebhookEvents(50);

  // Get summary for last 24 hours
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
  const summary = await createWebhookSummary(startDate, endDate);

  return {
    events: recentEvents,
    summary,
  };
};

export default function WebhookLogs() {
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  useEffect(() => {
    if (fetcher.state === "idle" && !fetcher.data) {
      fetcher.load("/app/webhook-logs");
    }
  }, [fetcher]);

  const events = fetcher.data?.events || [];
  const summary = fetcher.data?.summary || { totalEvents: 0, uniqueShops: 0, uniqueItems: 0 };

  // Helper to extract ID from GID or return as-is
  const extractId = (value) => {
    if (!value) return 'N/A';
    if (typeof value === 'string' && value.includes('/')) {
      return value.split('/').pop();
    }
    return String(value);
  };

  return (
    <s-page>
      <s-section-header>
        <s-heading level="1">Webhook Event Logs</s-heading>
        <s-text subdued>
          Inventory change events from Shopify and PIM/ERP notifications
        </s-text>
      </s-section-header>

      {/* Summary Statistics */}
      <s-section>
        <s-heading level="2">Last 24 Hours Summary</s-heading>
        <s-grid columns="3" gap="4">
          <s-card>
            <s-card-section>
              <s-display-text size="large">{summary.totalEvents}</s-display-text>
              <s-text subdued>Total Events</s-text>
            </s-card-section>
          </s-card>
          <s-card>
            <s-card-section>
              <s-display-text size="large">{summary.uniqueShops}</s-display-text>
              <s-text subdued>Unique Shops</s-text>
            </s-card-section>
          </s-card>
          <s-card>
            <s-card-section>
              <s-display-text size="large">{summary.uniqueItems}</s-display-text>
              <s-text subdued>Unique Items</s-text>
            </s-card-section>
          </s-card>
        </s-grid>
      </s-section>

      {/* Recent Events Table */}
      <s-section>
        <s-heading level="2">Recent Events (Last 50)</s-heading>

        {events.length === 0 ? (
          <s-empty-state
            heading="No webhook events yet"
            content="Inventory webhooks will appear here when inventory levels change in Shopify."
          >
            <s-text subdued>
              Try updating product inventory to trigger a webhook event.
            </s-text>
          </s-empty-state>
        ) : (
          <s-data-table>
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Shop</th>
                  <th>Inventory Item ID</th>
                  <th>Location</th>
                  <th>Available Qty</th>
                  <th>PIM Status</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event, idx) => (
                  <tr key={idx}>
                    <td>
                      <s-text>
                        {new Date(event.timestamp).toLocaleString()}
                      </s-text>
                    </td>
                    <td>
                      <s-text>{event.shop}</s-text>
                    </td>
                    <td>
                      <s-text variant="bodyMd" as="span" fontWeight="semibold">
                        {extractId(event.inventoryChange.inventoryItemId)}
                      </s-text>
                    </td>
                    <td>
                      <s-text>
                        {extractId(event.inventoryChange.locationId)}
                      </s-text>
                    </td>
                    <td>
                      <s-badge tone="info">
                        {event.inventoryChange.available}
                      </s-badge>
                    </td>
                    <td>
                      <s-badge tone="success">
                        {event.pimNotification?.status || 'pending'}
                      </s-badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </s-data-table>
        )}
      </s-section>

      {/* Instructions */}
      <s-section>
        <s-heading level="2">About This Page</s-heading>
        <s-unordered-list>
          <s-list-item>
            Webhook events are stored in PostgreSQL database
          </s-list-item>
          <s-list-item>
            Each event includes a simulated PIM/ERP notification
          </s-list-item>
          <s-list-item>
            In production, replace the logger with actual HTTP requests to your PIM/ERP system
          </s-list-item>
          <s-list-item>
            Events are triggered automatically when inventory changes in Shopify
          </s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}
