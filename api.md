# API Contracts

This document outlines the API contracts for the Indie Predict Market backend.

## 1. User Routes (`/api/users`)

### `POST /api/users/auth`
- **Description:** Authenticate an existing user or create a new user by their wallet address.
- **Parameters:**
  - **Body:**
    - `walletAddress` (string, required): The user's Web3 wallet address.
- **Expected Response:**
  - **200 OK:** Returns the user object.
    ```json
    {
      "user": {
        "id": "uuid",
        "walletAddress": "0x...",
        "balance": 0,
        "createdAt": "iso-date",
        "updatedAt": "iso-date"
      }
    }
    ```
  - **400 Bad Request:** `{ "error": "validation error message" }`

---

## 2. Market Routes (`/api/markets`)

### `GET /api/markets`
- **Description:** List all markets ordered by end time ascending.
- **Parameters:** None.
- **Expected Response:**
  - **200 OK:**
    ```json
    {
      "markets": [
        {
          "id": "uuid",
          "title": "Market Title",
          "endTime": "iso-date",
          "resolved": false,
          "outcome": null,
          "createdAt": "iso-date",
          "updatedAt": "iso-date"
        }
      ]
    }
    ```

### `POST /api/markets` (Admin Only)
- **Description:** Create a new market.
- **Parameters:**
  - **Headers:** `x-admin-secret` (required)
  - **Body:**
    - `title` (string, required): Title of the market.
    - `endTime` (string/date, required): The closing time for betting.
- **Expected Response:**
  - **200 OK:** `{ "market": { ... } }`
  - **401 Unauthorized:** `{ "error": "Unauthorized" }`
  - **400 Bad Request:** `{ "error": "validation error message" }`

---

## 3. Bet Routes (`/api/bets`)

### `POST /api/bets`
- **Description:** Place a bet on a specific market.
- **Parameters:**
  - **Body:**
    - `userId` (string, required): ID of the user placing the bet.
    - `marketId` (string, required): ID of the market.
    - `amount` (number, required): Amount to bet.
    - `side` (string, required): Outcome to bet on ("YES" or "NO").
- **Expected Response:**
  - **200 OK:** Returns the created bet and the user's updated balance.
    ```json
    {
      "bet": { ... },
      "newBalance": 100
    }
    ```
  - **400 Bad Request:** E.g., `{ "error": "Insufficient balance" }`
  - **500 Internal Server Error:** Standard error response.

### `GET /api/bets/user/:userId`
- **Description:** Get all bets placed by a specific user.
- **Parameters:**
  - **URL Params:**
    - `userId` (string, required): The ID of the user.
- **Expected Response:**
  - **200 OK:**
    ```json
    {
      "bets": [ ... ]
    }
    ```

---

## 4. Withdraw Routes (`/api/withdraw`)

### `POST /api/withdraw`
- **Description:** Initiate a withdrawal of native MATIC to the user's wallet address. Rate limited to 1 request per minute per IP.
- **Parameters:**
  - **Body:**
    - `userId` (string, required): ID of the user requesting withdrawal.
    - `amount` (number, required): Amount to withdraw (must be <= balance).
- **Expected Response:**
  - **200 OK:**
    ```json
    {
      "message": "Withdrawal successful",
      "txHash": "0x...",
      "amount": 50
    }
    ```
  - **400 Bad Request:** E.g., `{ "error": "Minimum balance of 10 required to withdraw" }`
  - **500 Internal Server Error:** E.g., `{ "error": "On-chain transfer failed. Balance has been refunded." }`
  - **429 Too Many Requests:** Extract rate limit hit message.

---

## 5. Admin Routes (`/api/admin`)

*All admin routes require the `x-admin-secret` header.*

### `GET /api/admin/overview`
- **Description:** Get high-level statistics for the dashboard.
- **Parameters:** None (requires admin header).
- **Expected Response:**
  - **200 OK:**
    ```json
    {
      "users": 100,
      "markets": {
        "total": 50,
        "open": 20,
        "resolved": 30
      },
      "bets": 500,
      "funds": {
        "totalDeposited": 10000,
        "totalWithdrawn": 2000,
        "currentlyHeld": 8000
      }
    }
    ```

### `GET /api/admin/users`
- **Description:** Get an ordered, paginated list of users by their balance.
- **Parameters:**
  - **Query (optional):** `page` (number, default: 1), `limit` (number, default: 20)
- **Expected Response:**
  - **200 OK:** `{ "users": [...], "total": 100, "page": 1, "limit": 20 }`

### `GET /api/admin/transactions`
- **Description:** Get paginated history of platform transactions.
- **Parameters:**
  - **Query (optional):** `page` (number, default: 1), `limit` (number, default: 20), `type` (string, "DEPOSIT" | "WITHDRAW")
- **Expected Response:**
  - **200 OK:** `{ "transactions": [...], "total": 50, "page": 1, "limit": 20 }`

### `GET /api/admin/markets`
- **Description:** Get all markets detailed with respective betting pool sizes.
- **Parameters:** None (requires admin header).
- **Expected Response:**
  - **200 OK:**
    ```json
    {
      "markets": [
        {
          "id": "uuid",
          "title": "Market title",
          "pool": {
            "YES": { "total": 500, "count": 10 },
            "NO": { "total": 200, "count": 5 }
          }
        }
      ]
    }
    ```

### `POST /api/admin/markets/:id/resolve`
- **Description:** Resolve a market to a winning outcome and automatically distribute payouts.
- **Parameters:**
  - **URL Params:** `id` (string, required): The ID of the market to resolve.
  - **Body:**
    - `outcome` (boolean, required): `true` if YES wins, `false` if NO wins.
- **Expected Response:**
  - **200 OK:**
    ```json
    {
      "message": "Market resolved. YES wins.",
      "marketId": "uuid",
      "outcome": true,
      "winnersCount": 10,
      "totalWinPool": 500,
      "totalLosePool": 200
    }
    ```
  - **400 Bad Request:** E.g., `{ "error": "Market already resolved" }`
  - **404 Not Found:** `{ "error": "Market not found" }`

### `POST /api/admin/markets/seed`
- **Description:** Seed the platform with 5 initial IPL test markets.
- **Parameters:** None (requires admin header).
- **Expected Response:**
  - **200 OK:** `{ "message": "5 IPL markets created", "markets": [...] }`
