/*
  Warnings:

  - You are about to alter the column `amount` on the `Bet` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,6)`.
  - You are about to alter the column `amount` on the `Transaction` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,6)`.
  - You are about to alter the column `balance` on the `User` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,6)`.

*/
-- AlterTable
ALTER TABLE "Bet" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(18,6);

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "token" TEXT NOT NULL DEFAULT 'MATIC',
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(18,6);

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "balance" SET DATA TYPE DECIMAL(18,6);
