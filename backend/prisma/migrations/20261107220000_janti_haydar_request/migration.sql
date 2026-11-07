-- Janti Haydar reklam teklif talepleri
CREATE TABLE "JantiHaydarRequest" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "adTypes" TEXT[],
    "storyOwner" TEXT NOT NULL,
    "websiteOrSocial" TEXT,
    "message" TEXT NOT NULL,
    "files" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JantiHaydarRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JantiHaydarRequest_createdAt_idx" ON "JantiHaydarRequest"("createdAt");
CREATE INDEX "JantiHaydarRequest_phone_idx" ON "JantiHaydarRequest"("phone");
