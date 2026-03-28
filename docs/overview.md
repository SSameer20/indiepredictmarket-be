# IPL Prediction Market — Architecture Overview

> **Type:** Web2 app with Web3 payments (custodial model)
> **Stack:** Node.js + TypeScript · Prisma · PostgreSQL · ethers.js (Polygon)

---

## System Flow

```
User (MetaMask)
  │
  │  sends USDC/MATIC on-chain
  ▼
Admin Wallet (Polygon)
  │
  │  ethers.js block listener detects tx
  ▼
Backend (Node.js + Express)
  │
  │  credits off-chain balance in DB
  ▼
PostgreSQL (balance ledger)
  │
  │  user places / wins bets
  ▼
Backend pays out → User Wallet (on-chain withdrawal)
```

---

## Database Schema

```prisma
model User {
  id            String   @id @default(uuid())
  walletAddress String   @unique
  balance       Float    @default(0)   // stored in USDC units (e.g. 10.5)
  bets          Bet[]
  transactions  Transaction[]
}

model Market {
  id       String   @id @default(uuid())
  title    String                        // e.g. "CSK vs MI — Match Winner"
  endTime  DateTime
  resolved Boolean  @default(false)
  outcome  Boolean?                      // true = YES wins, false = NO wins
  bets     Bet[]
}

model Bet {
  id       String  @id @default(uuid())
  userId   String
  marketId String
  amount   Float
  side     String  // "YES" | "NO"
  user     User    @relation(fields: [userId], references: [id])
  market   Market  @relation(fields: [marketId], references: [id])
}

// ⚠️  Missing from current schema — must be added
model Transaction {
  id        String   @id @default(uuid())
  userId    String
  txHash    String   @unique
  type      String   // "DEPOSIT" | "WITHDRAW"
  amount    Float
  status    String   // "CONFIRMED" | "PENDING" | "FAILED"
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])
}
```

---

## Core Flows

### 1. Deposit (Web3 → Web2 balance)

1. User sends USDC to admin wallet via MetaMask.
2. Backend listens for new blocks with `ethers.js`.
3. On match: check `Transaction` table for duplicate `txHash`.
4. Credit `user.balance` and record the transaction.

```
POST  — (internal, triggered by listener)
Guard — skip if txHash already exists
Action — user.balance += amount  |  Transaction.create(DEPOSIT, CONFIRMED)
```

### 2. Place Bet (Web2 only)

```
POST /bets
Guard  — user.balance >= amount  &&  market.resolved === false
Action — user.balance -= amount  |  Bet.create(userId, marketId, amount, side)
```

### 3. Resolve Market (admin only)

```
POST /markets/:id/resolve
Body   — { outcome: true | false }
Action — market.resolved = true, market.outcome = outcome
         payout all winning bets proportionally to their DB balance
```

### 4. Withdraw (Web2 balance → Web3)

```
POST /withdraw
Guard  — user.balance >= 10  &&  amount <= user.balance
Action — send on-chain tx via admin wallet
         user.balance -= amount
         Transaction.create(WITHDRAW, PENDING → CONFIRMED/FAILED)
```

---

## Security Checklist

| Rule | Detail |
|---|---|
| Block confirmations | Credit deposit only after ≥ 2 confirmations |
| Token whitelist | Accept only the USDC contract address |
| Duplicate guard | Unique `txHash` in `Transaction` table |
| Withdrawal rate limit | Max 1 withdrawal per minute per user |
| Private key | Store in `.env`, never log, never expose in API |
| Admin-only routes | Market creation & resolution require auth middleware |

---

## IPL Market Examples

- "CSK vs MI — Match Winner" (YES = CSK, NO = MI)
- "Top scorer in RCB vs PBKS" (YES = Kohli, NO = other)
- "Total sixes in SRH vs GT > 20" (YES / NO)

---

## Build Order

1. Add `Transaction` model to Prisma schema → run migration
2. Deposit listener (`ethers.js` block watcher)
3. `POST /bets` — place bet with balance guard
4. `POST /markets/:id/resolve` — resolve + payout
5. `POST /withdraw` — on-chain payout + balance debit
6. Auth middleware for admin routes

---

## Known Issues in Current Code

| Issue | Fix |
|---|---|
| `Transaction` model missing from Prisma schema | Add it (see schema above) |
| `balance` is `Float` but docs said `DECIMAL(18,6)` | Keep `Float` for simplicity; ensure rounding at service layer |
| Withdrawal references `user.wallet_address` | Use `user.walletAddress` (Prisma camelCase) |
| Security numbering in old doc was wrong (all `1.`) | Fixed above |
