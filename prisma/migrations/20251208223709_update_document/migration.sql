/*
  Warnings:

  - You are about to drop the column `cnpj_ien` on the `users` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[cnpj_ein]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `cnpj_ein` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "users_cnpj_ien_key";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "cnpj_ien",
ADD COLUMN     "cnpj_ein" VARCHAR(20) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_cnpj_ein_key" ON "users"("cnpj_ein");
