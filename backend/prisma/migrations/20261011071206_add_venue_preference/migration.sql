-- CreateEnum
CREATE TYPE "VenuePreference" AS ENUM ('ALCOHOLIC', 'NON_ALCOHOLIC', 'NO_PREFERENCE');

-- CreateEnum
CREATE TYPE "VenueType" AS ENUM ('ALCOHOLIC', 'NON_ALCOHOLIC');

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "venuePreference" "VenuePreference" NOT NULL DEFAULT 'NO_PREFERENCE';

-- AlterTable
ALTER TABLE "Venue" ADD COLUMN     "venueType" "VenueType" NOT NULL DEFAULT 'NON_ALCOHOLIC';
