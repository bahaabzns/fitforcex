-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "attachment_duration" INTEGER,
ADD COLUMN     "attachment_mime" TEXT,
ADD COLUMN     "attachment_name" TEXT,
ADD COLUMN     "attachment_size" INTEGER,
ADD COLUMN     "attachment_url" TEXT,
ADD COLUMN     "deleted_at" TIMESTAMPTZ(6),
ADD COLUMN     "edited_at" TIMESTAMPTZ(6),
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'text',
ALTER COLUMN "body" DROP NOT NULL;
