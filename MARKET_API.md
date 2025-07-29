# Market Tab API Documentation

## Overview
This document outlines the backend API endpoints required for the Market tab functionality in the FinSight application.

## Base URL
```
http://localhost:3000/api/market
```

## Endpoints

### 1. Top Gainers

#### GET /api/market/top-gainers
Retrieve the top performing stocks with highest gains.

**Query Parameters:**
- `timeRange` (optional): Time period for analysis
  - `1d` - Today (default)
  - `3d` - Last 3 days
  - `7d` - Last 7 days
- `limit` (optional): Number of stocks to return (default: 10, max: 50)

**Response:**
```json
{
  "success": true,
  "timeRange": "1d",
  "stocks": [
    {
      "symbol": "NVDA",
      "company_name": "NVIDIA Corporation",
      "price": 485.23,
      "change": 8.45,
      "change_amount": 37.84,
      "volume": 45234567,
      "market_cap": 1234567890000
    },
    {
      "symbol": "TSLA",
      "company_name": "Tesla Inc",
      "price": 248.50,
      "change": 6.23,
      "change_amount": 14.58,
      "volume": 78234567,
      "market_cap": 987654321000
    }
  ]
}
```

### 2. Top Losers

#### GET /api/market/top-losers
Retrieve the worst performing stocks with highest losses.

**Query Parameters:**
- `timeRange` (optional): Same as top-gainers
- `limit` (optional): Same as top-gainers

**Response:**
```json
{
  "success": true,
  "timeRange": "1d",
  "stocks": [
    {
      "symbol": "UBER",
      "company_name": "Uber Technologies Inc",
      "price": 52.34,
      "change": -4.67,
      "change_amount": -2.56,
      "volume": 23456789,
      "market_cap": 123456789000
    },
    {
      "symbol": "SNAP",
      "company_name": "Snap Inc",
      "price": 18.92,
      "change": -3.21,
      "change_amount": -0.63,
      "volume": 34567890,
      "market_cap": 45678901234
    }
  ]
}
```

### 3. Trading Recommendations

#### GET /api/market/recommendations
Retrieve analyst recommendations for stocks.

**Query Parameters:**
- `limit` (optional): Number of recommendations to return (default: 10, max: 20)
- `action` (optional): Filter by recommendation type (`BUY`, `SELL`, `HOLD`)

**Response:**
```json
{
  "success": true,
  "recommendations": [
    {
      "symbol": "AAPL",
      "company_name": "Apple Inc",
      "action": "BUY",
      "recommendation_count": 15,
      "total_analysts": 20,
      "confidence": 0.75,
      "reason": "Strong iPhone sales and expanding services revenue",
      "target_price": 195.00,
      "current_price": 175.23,
      "updated_at": "2025-07-29T10:30:00Z"
    },
    {
      "symbol": "TSLA",
      "company_name": "Tesla Inc",
      "action": "HOLD",
      "recommendation_count": 8,
      "total_analysts": 15,
      "confidence": 0.53,
      "reason": "Waiting for Q4 delivery numbers and FSD updates",
      "target_price": 260.00,
      "current_price": 248.50,
      "updated_at": "2025-07-29T09:15:00Z"
    }
  ]
}
```

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "success": false,
  "error_code": "INVALID_TIME_RANGE",
  "message": "Invalid time range specified",
  "details": {
    "valid_ranges": ["1d", "3d", "7d"]
  }
}
```

### Common Error Codes:
- `INVALID_TIME_RANGE`: Invalid timeRange parameter
- `INVALID_LIMIT`: Limit parameter out of bounds
- `DATA_UNAVAILABLE`: Market data temporarily unavailable
- `SERVER_ERROR`: Internal server error

## Data Sources and Requirements

### Stock Data Sources
- Real-time or near real-time stock price data
- Historical price data for calculating percentage changes
- Trading volume information
- Market capitalization data

### Recommendation Data Sources
- Analyst recommendations from financial institutions
- Aggregated buy/sell/hold ratings
- Target price estimates
- Recommendation reasoning/analysis

## Implementation Guidelines

### 1. Caching Strategy
- Cache top gainers/losers data for 5-10 minutes during market hours
- Cache recommendations for 1 hour
- Use Redis or similar for caching layer

### 2. Rate Limiting
- Implement rate limiting to prevent API abuse
- Suggested: 100 requests per minute per IP

### 3. Market Hours
- Consider market hours (9:30 AM - 4:00 PM ET)
- Provide appropriate messaging for after-hours requests
- Cache last market close data for off-hours

### 4. Data Validation
- Validate stock symbols against known exchanges
- Ensure price data is reasonable (no negative prices, etc.)
- Validate percentage changes are within reasonable bounds

### 5. Performance Considerations
- Pre-calculate rankings during market hours
- Use database indexing on symbol, timestamp columns
- Consider pagination for large result sets

## Database Schema Suggestions

### Stock Prices Table
```sql
CREATE TABLE stock_prices (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  symbol VARCHAR(10) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  volume BIGINT,
  market_cap BIGINT,
  timestamp DATETIME NOT NULL,
  INDEX idx_symbol_timestamp (symbol, timestamp),
  INDEX idx_timestamp (timestamp)
);
```

### Stock Recommendations Table
```sql
CREATE TABLE stock_recommendations (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  symbol VARCHAR(10) NOT NULL,
  action ENUM('BUY', 'SELL', 'HOLD') NOT NULL,
  analyst_firm VARCHAR(100),
  recommendation_count INT DEFAULT 1,
  total_analysts INT,
  target_price DECIMAL(10,2),
  reason TEXT,
  confidence DECIMAL(3,2),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_symbol (symbol),
  INDEX idx_action (action),
  INDEX idx_updated_at (updated_at)
);
```

## Security Considerations

1. **API Authentication**: Implement proper authentication if required
2. **Input Validation**: Validate all query parameters
3. **SQL Injection Prevention**: Use parameterized queries
4. **CORS**: Configure CORS appropriately for frontend access
5. **Monitoring**: Log API usage and errors for monitoring

## Sample Implementation Notes

1. **Market Data Integration**: Consider using APIs like Alpha Vantage, IEX Cloud, or Yahoo Finance
2. **Real-time Updates**: Implement WebSocket connections for real-time price updates if needed
3. **Error Handling**: Implement graceful degradation when external APIs are unavailable
4. **Testing**: Create mock data endpoints for development and testing
5. **Documentation**: Maintain API documentation with examples and response schemas
