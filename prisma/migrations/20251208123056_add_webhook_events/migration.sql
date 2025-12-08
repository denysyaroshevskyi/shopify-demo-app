-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "topic" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "inventoryItemId" TEXT,
    "locationId" TEXT,
    "available" INTEGER,
    "pimStatus" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebhookEvent_shop_idx" ON "WebhookEvent"("shop");

-- CreateIndex
CREATE INDEX "WebhookEvent_timestamp_idx" ON "WebhookEvent"("timestamp");

-- CreateIndex
CREATE INDEX "WebhookEvent_topic_idx" ON "WebhookEvent"("topic");
