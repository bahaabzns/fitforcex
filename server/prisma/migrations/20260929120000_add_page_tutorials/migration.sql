-- CreateTable
CREATE TABLE "page_tutorials" (
    "id" TEXT NOT NULL,
    "page_key" TEXT NOT NULL,
    "youtube_url" TEXT NOT NULL,
    "title" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_tutorials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "page_tutorials_page_key_key" ON "page_tutorials"("page_key");
