# Manage Tab API Documentation

## Overview
This document outlines the backend API endpoints required for the Manage tab functionality in the FinSight application.

## Base URL
```
http://localhost:3000/api
```

## Authentication
All requests should include appropriate authentication headers if implemented.

## Endpoints

### 1. Cash Transactions

#### POST /api/transactions/cash
Create a new cash transaction (cash in/out).

**Request Body:**
```json
{
  "type": "cash",
  "operation": "in" | "out",
  "amount": 1000.50,
  "notes": "Monthly salary deposit",
  "timestamp": "2025-07-29T10:30:00.000Z"
}
```

**Response:**
```json
{
  "success": true,
  "transaction_id": "txn_cash_123456",
  "message": "Cash transaction completed successfully",
  "balance": 15000.00
}
```

### 2. Stock Transactions

#### POST /api/transactions/stock
Create a new stock transaction (buy/sell).

**Request Body:**
```json
{
  "type": "stock",
  "operation": "buy" | "sell",
  "symbol": "AAPL",
  "quantity": 10,
  "notes": "Long-term investment",
  "timestamp": "2025-07-29T10:30:00.000Z"
}
```

**Response:**
```json
{
  "success": true,
  "transaction_id": "txn_stock_123456",
  "message": "Stock transaction completed successfully",
  "current_price": 175.50,
  "total_cost": 1755.00
}
```

### 3. Bond Transactions

#### POST /api/transactions/bond
Create a new bond transaction (buy/sell).

**Request Body:**
```json
{
  "type": "bond",
  "operation": "buy" | "sell",
  "bondCode": "US912828XG55",
  "amount": 10000.00,
  "maturity": "10 years",
  "notes": "Government bond investment",
  "timestamp": "2025-07-29T10:30:00.000Z"
}
```

**Response:**
```json
{
  "success": true,
  "transaction_id": "txn_bond_123456",
  "message": "Bond transaction completed successfully",
  "yield": 3.25,
  "maturity_date": "2035-07-29"
}
```

### 4. Other Asset Transactions

#### POST /api/transactions/other
Create a new other asset transaction (add/remove).

**Request Body:**
```json
{
  "type": "other",
  "operation": "add" | "remove",
  "amount": 50000.00,
  "description": "Real Estate",
  "notes": "Property investment in downtown",
  "timestamp": "2025-07-29T10:30:00.000Z"
}
```

**Response:**
```json
{
  "success": true,
  "transaction_id": "txn_other_123456",
  "message": "Other asset transaction completed successfully",
  "asset_category": "Real Estate"
}
```

### 5. Transaction History

#### GET /api/transactions/history
Retrieve recent transaction history.

**Query Parameters:**
- `limit` (optional): Number of transactions to return (default: 50)
- `offset` (optional): Number of transactions to skip (default: 0)
- `type` (optional): Filter by transaction type (cash, stock, bond, other)

**Response:**
```json
{
  "success": true,
  "transactions": [
    {
      "transaction_id": "txn_cash_123456",
      "type": "cash",
      "operation": "in",
      "amount": 5000.00,
      "notes": "Monthly salary deposit",
      "timestamp": "2025-07-29T10:30:00.000Z"
    },
    {
      "transaction_id": "txn_stock_123455",
      "type": "stock",
      "operation": "buy",
      "symbol": "AAPL",
      "quantity": 10,
      "amount": 1755.00,
      "notes": "Long-term investment",
      "timestamp": "2025-07-28T14:20:00.000Z"
    }
  ],
  "total_count": 150
}
```

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "success": false,
  "error_code": "INVALID_AMOUNT",
  "message": "Amount must be greater than 0",
  "details": {}
}
```

### Common Error Codes:
- `INVALID_AMOUNT`: Amount validation failed
- `INVALID_SYMBOL`: Stock symbol not found
- `INSUFFICIENT_FUNDS`: Not enough balance for the transaction
- `INVALID_BOND`: Bond details validation failed
- `SERVER_ERROR`: Internal server error

## Database Schema Recommendations

### Transactions Table
```sql
CREATE TABLE transactions (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  type ENUM('cash', 'stock', 'bond', 'other') NOT NULL,
  operation VARCHAR(20) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  symbol VARCHAR(10) NULL,
  quantity INT NULL,
  bond_code VARCHAR(50) NULL,
  maturity VARCHAR(20) NULL,
  description VARCHAR(100) NULL,
  notes TEXT NULL,
  timestamp DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### User Balances Table
```sql
CREATE TABLE user_balances (
  user_id VARCHAR(50) PRIMARY KEY,
  cash_balance DECIMAL(15,2) DEFAULT 0.00,
  total_stock_value DECIMAL(15,2) DEFAULT 0.00,
  total_bond_value DECIMAL(15,2) DEFAULT 0.00,
  total_other_value DECIMAL(15,2) DEFAULT 0.00,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## Security Considerations

1. **Input Validation**: Validate all input parameters
2. **Rate Limiting**: Implement rate limiting to prevent abuse
3. **Authentication**: Ensure proper user authentication
4. **Authorization**: Verify user permissions for transactions
5. **Audit Trail**: Log all transaction attempts for security monitoring

## Implementation Notes

1. All monetary amounts should be handled with proper decimal precision
2. Stock prices should be fetched from real-time market data APIs
3. Transaction IDs should be unique and follow a consistent format
4. Implement proper error handling and rollback mechanisms
5. Consider implementing transaction confirmations for large amounts
