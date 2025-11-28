/*
  Warnings:

  - You are about to drop the column `email` on the `Manager` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[username]` on the table `Manager` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `username` to the `Manager` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."Manager_email_key";

-- AlterTable
ALTER TABLE "public"."Manager" DROP COLUMN "email",
ADD COLUMN     "username" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Manager_username_key" ON "public"."Manager"("username");
