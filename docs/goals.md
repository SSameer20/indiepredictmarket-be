# IPL Prediction Market — Goals

---

## Phase 0 — Foundation Setup

### Setup Project Structure

- description: Initialize Node.js + TypeScript project with Express, Prisma, PostgreSQL, and modular folder structure (auth, markets, bets, transactions, wallet)
- status: completed

### Setup Database & Prisma

- description: Configure PostgreSQL, define schema (User, Market, Bet, Transaction), run migrations, verify DB connection
- status: completed

### Environment & Secrets

- description: Setup environment variables (DATABASE_URL, PRIVATE_KEY, POLYGON_RPC_URL, USDC_CONTRACT_ADDRESS)
- status: todocompleted

---

## Phase 1 — Core Wallet System

### Implement User Wallet Auth

- description: Create or fetch user using wallet address as unique identity (no password system)
- status: completed

### Add Transaction Model

- description: Implement Transaction table with txHash uniqueness, type (DEPOSIT/WITHDRAW), and relation to user
- status: completed

### Build Deposit Listener

- description: Use ethers.js to listen to Polygon blocks and detect incoming USDC transfers to admin wallet
- status: completed

### Deposit Processing

- description: Validate token address, wait for ≥2 confirmations, prevent duplicate txHash, credit user balance, store transaction
- status: completed

### Balance Update Atomicity

- description: Ensure all balance updates use DB transactions to prevent race conditions
- status: completed

---

## Phase 2 — Betting Engine

### Create Market (Admin)

- description: API to create prediction markets with title and endTime, protected by admin auth
- status: completed

### Place Bet API

- description: Deduct user balance, validate market state, create bet entry with YES/NO side
- status: completed

### Bet Validation Guards

- description: Prevent betting on resolved markets, after endTime, or with insufficient balance
- status: completed

---

## Phase 3 — Market Resolution

### Resolve Market

- description: Admin sets outcome (YES/NO) and marks market as resolved
- status: todo

### Payout Engine

- description: Distribute winnings proportionally to users based on total pool and winning side
- status: todo

### Idempotent Resolution

- description: Ensure market resolution runs only once (no double payouts)
- status: todo

---

## Phase 4 — Withdrawal System

### Withdraw API

- description: Allow withdrawal only if user balance ≥ 10 and requested amount ≤ balance
- status: completed

### On-chain Transfer

- description: Send USDC from admin wallet to user wallet using ethers.js
- status: completed

### Withdrawal Lifecycle

- description: Track transaction states (PENDING → CONFIRMED → FAILED)
- status: completed

### Failure Recovery

- description: Refund balance if withdrawal transaction fails
- status: completed

---

## Phase 5 — Security & Reliability

### Duplicate Transaction Protection

- description: Enforce unique txHash constraint and pre-check before processing deposits
- status: completed

### Rate Limiting

- description: Limit withdrawal requests (e.g., 1 per minute per user)
- status: completed

### Input Validation

- description: Validate all API payloads using schema validation (Zod or equivalent)
- status: completed

### Logging System

- description: Implement structured logging for deposits, bets, withdrawals, and errors
- status: completed

---

## Phase 6 — Production Readiness

### Global Error Handling

- description: Implement centralized error handling middleware with proper responses
- status: todo

### API Documentation

- description: Document APIs using Swagger or Postman
- status: todo

### Deployment

- description: Deploy backend and database, configure environment variables securely
- status: todo

---

## Phase 7 — Traction & MVP Polish

### Basic Frontend

- description: Build minimal UI for wallet connect, balance display, betting, and withdrawal
- status: todo

### Seed IPL Markets

- description: Create initial IPL prediction markets manually for early usage
- status: todo

### Initial Liquidity

- description: Seed markets with sample bets to avoid empty pools
- status: todo

### Admin Dashboard

- description: View users, balances, transactions, and market performance
- status: todo

---

## Phase 8 — Future Improvements

### Decimal Precision Migration

- description: Replace Float with Decimal for accurate financial calculations
- status: pending

### Multi-token Support

- description: Extend system to support multiple ERC20 tokens
- status: pending

### Non-Custodial Architecture

- description: Move betting and payout logic to smart contracts for trustless execution
- status: pending

---
