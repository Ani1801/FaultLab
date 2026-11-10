-- CreateEnum
CREATE TYPE "FailureMode" AS ENUM ('NONE', 'ALWAYS', 'RANDOM');

-- AlterTable
ALTER TABLE "mock_endpoints" ADD COLUMN     "additionalDelay" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "failureMode" "FailureMode" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "failureRate" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "failureResponseBody" JSONB DEFAULT '{"error": "Internal Server Error", "message": "Simulated fault injection"}',
ADD COLUMN     "failureStatusCode" INTEGER NOT NULL DEFAULT 500,
ADD COLUMN     "faultEnabled" BOOLEAN NOT NULL DEFAULT false;
