-- CreateTable
CREATE TABLE "DomainStat" (
    "id" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "windowSize" INTEGER NOT NULL DEFAULT 10,
    "samples" JSONB NOT NULL,
    "avgLatencyMs" INTEGER NOT NULL DEFAULT 0,
    "failRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DomainStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DomainStat_hostname_key" ON "DomainStat"("hostname");
