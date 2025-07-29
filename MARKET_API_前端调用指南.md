# Market API 前端调用指南

## 📋 API 接口解读和前端调用方法

### 1. Top Gainers API - 涨幅榜
**接口地址**: `GET /api/market/top-gainers`

#### 🔧 前端需要发送的参数:
```javascript
// 基础调用 - 使用默认参数
fetch('http://localhost:3000/api/market/top-gainers')

// 带参数调用
const params = new URLSearchParams({
  timeRange: '1d',  // 可选: '1d'(今天), '3d'(3天), '7d'(7天)
  limit: '10'       // 可选: 返回股票数量，最大50
});
fetch(`http://localhost:3000/api/market/top-gainers?${params}`)
```

#### 📊 前端会收到的数据:
```javascript
{
  "success": true,
  "timeRange": "1d",
  "stocks": [
    {
      "symbol": "NVDA",           // 股票代码
      "company_name": "NVIDIA",   // 公司名称  
      "price": 485.23,           // 当前价格
      "change": 8.45,            // 涨跌百分比
      "change_amount": 37.84,    // 涨跌金额
      "volume": 45234567,        // 交易量
      "market_cap": 1234567890000 // 市值
    }
  ]
}
```

---

### 2. Top Losers API - 跌幅榜  
**接口地址**: `GET /api/market/top-losers`

#### 🔧 前端需要发送的参数:
```javascript
// 参数与Top Gainers完全相同
const params = new URLSearchParams({
  timeRange: '7d',  // 查看7天内的跌幅榜
  limit: '15'       // 返回15支股票
});
fetch(`http://localhost:3000/api/market/top-losers?${params}`)
```

#### 📊 前端会收到的数据:
```javascript
{
  "success": true,
  "timeRange": "7d", 
  "stocks": [
    {
      "symbol": "UBER",
      "company_name": "Uber Technologies Inc",
      "price": 52.34,
      "change": -4.67,          // 注意：这里是负数
      "change_amount": -2.56,   // 注意：这里是负数
      "volume": 23456789,
      "market_cap": 123456789000
    }
  ]
}
```

---

### 3. Trading Recommendations API - 交易推荐
**接口地址**: `GET /api/market/recommendations`

#### 🔧 前端需要发送的参数:
```javascript
// 基础调用
fetch('http://localhost:3000/api/market/recommendations')

// 筛选特定推荐类型
const params = new URLSearchParams({
  limit: '15',      // 可选: 返回推荐数量，最大20
  action: 'BUY'     // 可选: 'BUY', 'SELL', 'HOLD'
});
fetch(`http://localhost:3000/api/market/recommendations?${params}`)
```

#### 📊 前端会收到的数据:
```javascript
{
  "success": true,
  "recommendations": [
    {
      "symbol": "AAPL",
      "company_name": "Apple Inc",
      "action": "BUY",                    // 推荐动作
      "recommendation_count": 15,         // 推荐该动作的分析师数量
      "total_analysts": 20,               // 总分析师数量
      "confidence": 0.75,                 // 信心度 (0-1)
      "reason": "Strong iPhone sales...", // 推荐理由
      "target_price": 195.00,            // 目标价格
      "current_price": 175.23,           // 当前价格
      "updated_at": "2025-07-29T10:30:00Z" // 更新时间
    }
  ]
}
```

---

## 🚀 前端实际调用示例

### JavaScript/Fetch 示例:
```javascript
// 1. 获取今日涨幅榜前10名
async function getTopGainers() {
  try {
    const response = await fetch('http://localhost:3000/api/market/top-gainers?timeRange=1d&limit=10');
    const data = await response.json();
    
    if (data.success) {
      console.log('涨幅榜:', data.stocks);
      return data.stocks;
    } else {
      console.error('获取失败:', data.message);
    }
  } catch (error) {
    console.error('网络错误:', error);
  }
}

// 2. 获取买入推荐
async function getBuyRecommendations() {
  try {
    const response = await fetch('http://localhost:3000/api/market/recommendations?action=BUY&limit=5');
    const data = await response.json();
    
    if (data.success) {
      console.log('买入推荐:', data.recommendations);
      return data.recommendations;
    }
  } catch (error) {
    console.error('获取推荐失败:', error);
  }
}

// 3. 获取7天跌幅榜
async function getWeeklyLosers() {
  try {
    const response = await fetch('http://localhost:3000/api/market/top-losers?timeRange=7d&limit=20');
    const data = await response.json();
    
    if (data.success) {
      console.log('7天跌幅榜:', data.stocks);
      return data.stocks;
    }
  } catch (error) {
    console.error('获取跌幅榜失败:', error);
  }
}
```

### Axios 示例:
```javascript
import axios from 'axios';

const API_BASE = 'http://localhost:3000/api/market';

// 获取涨幅榜
const getGainers = async (timeRange = '1d', limit = 10) => {
  try {
    const response = await axios.get(`${API_BASE}/top-gainers`, {
      params: { timeRange, limit }
    });
    return response.data;
  } catch (error) {
    console.error('API调用失败:', error.response?.data || error.message);
    throw error;
  }
};

// 获取推荐
const getRecommendations = async (action = null, limit = 10) => {
  try {
    const params = { limit };
    if (action) params.action = action;
    
    const response = await axios.get(`${API_BASE}/recommendations`, { params });
    return response.data;
  } catch (error) {
    console.error('获取推荐失败:', error.response?.data || error.message);
    throw error;
  }
};
```

---

## ⚠️ 错误处理

所有API都可能返回错误，格式如下:
```javascript
{
  "success": false,
  "error_code": "INVALID_TIME_RANGE",
  "message": "Invalid time range specified",
  "details": {
    "valid_ranges": ["1d", "3d", "7d"]
  }
}
```

### 前端错误处理示例:
```javascript
async function handleAPICall(apiCall) {
  try {
    const response = await fetch(apiCall);
    const data = await response.json();
    
    if (!data.success) {
      // 处理API返回的业务错误
      switch(data.error_code) {
        case 'INVALID_TIME_RANGE':
          console.error('时间范围无效:', data.details.valid_ranges);
          break;
        case 'DATA_UNAVAILABLE':
          console.error('数据暂时不可用，请稍后重试');
          break;
        default:
          console.error('API错误:', data.message);
      }
      return null;
    }
    
    return data;
  } catch (error) {
    // 处理网络错误
    console.error('网络请求失败:', error);
    return null;
  }
}
```

---

## 📝 总结

### 前端需要发送的参数类型:
1. **查询参数 (Query Parameters)** - 通过URL传递
2. **所有参数都是可选的** - 有默认值
3. **参数类型**:
   - `timeRange`: 字符串 ('1d', '3d', '7d')
   - `limit`: 数字 (1-50 for gainers/losers, 1-20 for recommendations)  
   - `action`: 字符串 ('BUY', 'SELL', 'HOLD')

### 前端会收到的数据特点:
1. **统一格式** - 都有 `success` 字段表示是否成功
2. **数组数据** - stocks/recommendations 都是数组
3. **丰富信息** - 包含价格、涨跌、交易量、推荐理由等
4. **实时性** - 数据带有更新时间戳
