// 新建表结构 SQL（可在数据库初始化时执行）
// CREATE TABLE IF NOT EXISTS stock_prices (
//   id INT PRIMARY KEY AUTO_INCREMENT,
//   symbol VARCHAR(16) UNIQUE,
//   price DECIMAL(12,4),
//   updated_at DATETIME
// );
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path'); // 添加 path 模块
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.')); // Serve static files from current directory
app.use(express.static(path.join(__dirname, '../frontend')));

// Database connection
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT
};

let db;

// Initialize database connection
async function initDatabase() {
  try {
    // First connect without database to create it if needed
    const connectionWithoutDB = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      port: dbConfig.port
    });

    // Create database if it doesn't exist
    await connectionWithoutDB.execute(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`);
    await connectionWithoutDB.end();

    // Now connect to the database
    db = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to MySQL database');

    // Create tables if they don't exist
    await createTables();
    await seedInitialData();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.log('📝 Please check MySQL service and credentials in .env file');
    console.log('💡 Make sure MySQL service is running: net start mysql80');
  }
}

// Create necessary tables
async function createTables() {
  // 新建 asset_history 表
  const createAssetHistoryTable = `
    CREATE TABLE IF NOT EXISTS asset_history (
      date DATE PRIMARY KEY,
      cash_value DECIMAL(12,2),
      stock_value DECIMAL(12,2),
      bond_value DECIMAL(12,2),
      other_value DECIMAL(12,2)
    )
  `;
  await db.execute(createAssetHistoryTable);
  const createPortfolioTable = `
    CREATE TABLE IF NOT EXISTS portfolio (
      id INT AUTO_INCREMENT PRIMARY KEY,
      total_value DECIMAL(12,2) NOT NULL,
      gain_loss DECIMAL(12,2) NOT NULL,
      gain_loss_percent DECIMAL(8,2) NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `;

  // 废弃 assets 表，因为它与 current_assets 功能重叠且导致数据不一致
  // const createAssetsTable = `
  //   CREATE TABLE IF NOT EXISTS assets (
  //     id INT AUTO_INCREMENT PRIMARY KEY,
  //     asset_type ENUM('Cash', 'Stock', 'Bond', 'Other') NOT NULL,
  //     value DECIMAL(12,2) NOT NULL,
  //     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  //   )
  // `;

  const createPerformanceTable = `
    CREATE TABLE IF NOT EXISTS performance_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      date DATE NOT NULL,
      value DECIMAL(12,2) NOT NULL,
      range_type ENUM('7d', '1m', '6m', 'all') NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_date_range (date, range_type)
    )
  `;

  // 新建 featured_stocks 表
  // const createFeaturedStocksTable = `
  //   CREATE TABLE IF NOT EXISTS featured_stocks (
  //     id INT AUTO_INCREMENT PRIMARY KEY,
  //     symbol VARCHAR(16) UNIQUE,
  //     price DECIMAL(12,4),
  //     updated_at DATETIME
  //   )
  // `;
  const createFeaturedStocksTable = `
  CREATE TABLE IF NOT EXISTS featured_stocks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(16) UNIQUE,  -- 股票代码（唯一，避免重复添加）
    price DECIMAL(12,4),        -- 股票价格（保留4位小数）
    change_percent DECIMAL(5,2), -- 增减率（保留2位小数，范围支持 -999.99% 到 999.99%）
    updated_at DATETIME         -- 数据更新时间
  )
`;

  const createCurrentAssetsTable = `
    CREATE TABLE IF NOT EXISTS current_assets (
      id int NOT NULL AUTO_INCREMENT PRIMARY KEY,
      type varchar(20) DEFAULT NULL,
      symbol varchar(20) DEFAULT NULL,
      amount decimal(18,2) DEFAULT NULL
    )
  `;

  await db.execute(createPortfolioTable);
  // await db.execute(createAssetsTable); // 移除 assets 表的创建
  await db.execute(createPerformanceTable);
  await db.execute(createFeaturedStocksTable);
  await db.execute(createCurrentAssetsTable);

  console.log('✅ Database tables created successfully');
}

// 封装一个函数来计算当前总资产价值
async function calculateCurrentTotalValue() {
  const [currentAssetRows] = await db.execute('SELECT * FROM current_assets');
  let calculatedTotal = 0;
  let stockValue = 0;

  const stockRows = currentAssetRows.filter(r => r.type === 'stock');
  if (stockRows.length > 0) {
    const symbols = stockRows.map(r => r.symbol);
    if (symbols.length > 0) {
      // 从 featured_stocks 获取最新股价
      const placeholders = symbols.map(() => '?').join(',');
      const [prices] = await db.execute(`SELECT symbol, price FROM featured_stocks WHERE symbol IN (${placeholders})`, symbols);
      const priceMap = {};
      prices.forEach(p => { priceMap[p.symbol] = Number(p.price); });
      stockValue = stockRows.reduce((sum, r) => {
        const price = priceMap[r.symbol] || 0;
        return sum + Number(r.amount) * price;
      }, 0);
    }
  }

  // 计算现金、债券、其他（非股票部分）
  const nonStockValue = currentAssetRows.filter(r => r.type !== 'stock').reduce((sum, r) => sum + Number(r.amount), 0);

  calculatedTotal = nonStockValue + stockValue;
  return parseFloat(calculatedTotal.toFixed(2)); // 精确到两位小数
}


// Seed initial data
async function seedInitialData() {
  // 检查 asset_history 表是否存在且为空，若为空则生成180天历史数据
  try {
    const [hisRows] = await db.execute('SELECT COUNT(*) as count FROM asset_history');
    if (hisRows[0].count === 0) {
      // 生成180天历史数据
      const today = new Date();
      for (let i = 0; i < 180; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        // 生成示例数据（可根据实际需求调整生成逻辑）
        const cash = 120000 - i * 100;
        const stock = 41000 + (i % 10) * 1000 + Math.round(Math.random() * 1000);
        const bond = 20000 + (i % 2) * 15000;
        const other = 350000 - i * 500 + Math.round(Math.random() * 1000);
        await db.execute(
          'INSERT INTO asset_history (date, cash_value, stock_value, bond_value, other_value) VALUES (?, ?, ?, ?, ?)',
          [dateStr, cash, stock, bond, other]
        );
      }
      console.log('✅ asset_history 180天历史数据已生成');
    }
  } catch (e) {
    // 表不存在则跳过
    console.warn('asset_history table might not exist or is not empty, skipping initial data seeding for it.');
  }

  // 检查 current_assets 表是否存在且为空
  try {
    const [curRows] = await db.execute('SELECT COUNT(*) as count FROM current_assets');
    if (curRows[0].count === 0) {
      // 自动生成 current_assets 示例数据
      await db.execute("INSERT INTO current_assets (type, symbol, amount) VALUES ('cash', NULL, 5000), ('stock', 'AAPL', 10), ('stock', 'NVDA', 5), ('bond', NULL, 2000), ('other', NULL, 1000)");
      console.log('✅ current_assets 示例数据已生成');
    }
  } catch (e) {
    // 表不存在则跳过
    console.warn('current_assets table might not exist or is not empty, skipping initial data seeding for it.');
  }

  // 检查 portfolio 表是否存在且为空，若为空则根据 current_assets 计算并生成
  const [portfolioRows] = await db.execute('SELECT COUNT(*) as count FROM portfolio');

  if (portfolioRows[0].count === 0) {
    console.log('✨ Initializing portfolio data based on current_assets...');

    const initialTotalValue = await calculateCurrentTotalValue(); // 计算今天的总价值

    // 初始投资额，可以设为今天的总价值，或者一个固定的基准值
    // 如果是第一次初始化，没有历史数据，gain/loss 可以设为 0
    const initialGainLoss = 0.00;
    const initialGainLossPercent = 0.00;

    await db.execute(
      'INSERT INTO portfolio (total_value, gain_loss, gain_loss_percent) VALUES (?, ?, ?)',
      [initialTotalValue, initialGainLoss, initialGainLossPercent]
    );
    console.log(`✅ Portfolio initialized with total_value: $${initialTotalValue.toFixed(2)}`);

    // 移除 assets 表的插入逻辑，因为它不再是主要数据源
    // const initialAssets = [ ... ];
    // for (const [type, value] of initialAssets) { ... }

    // 生成完整的180天历史数据（统一数据源）
    // 这里的逻辑需要调整，让今天的历史数据点是 initialTotalValue
    const baseValue = 10000; // 180天前的起始值，可以根据需要调整
    const portfolioTotal = initialTotalValue; // 使用计算出的今天总价值
    // 确保 baseValue 不为 0，避免除以 0
    const dailyGrowthRate = baseValue === 0 ? 0 : (Math.pow(portfolioTotal / baseValue, 1 / 179) - 1);

    console.log('📊 生成180天完整历史数据...');

    for (let i = 179; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      let value;
      if (i === 0) {
        value = portfolioTotal; // 今天的值就是计算出的 initialTotalValue
      } else {
        // 添加一些随机波动使数据更真实
        const baseGrowth = baseValue * Math.pow(1 + dailyGrowthRate, 179 - i);
        const randomFactor = 1 + (Math.random() - 0.5) * 0.02; // ±1%的随机波动
        value = baseGrowth * randomFactor;
        value = Math.round(value * 100) / 100;
      }

      await db.execute(
        'INSERT IGNORE INTO performance_history (date, value, range_type) VALUES (?, ?, ?)',
        [dateStr, value, 'all'] // 使用统一的标识
      );
    }

    console.log('✅ Initial data seeded successfully');
  }
  // 移除对 assets 表的检查，因为它已被废弃
  // const [assetRows] = await db.execute('SELECT COUNT(*) as count FROM assets');
}

// API Routes
// 删除 featured 栏目股票
app.post('/api/featured-stocks/remove', async (req, res) => {
  const { symbol } = req.body;
  if (!symbol) return res.status(400).json({ error: '缺少股票代码' });
  try {
    await db.execute('DELETE FROM featured_stocks WHERE symbol = ?', [symbol]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '删除失败' });
  }
});
// 获取 featured 栏目股票列表
// app.get('/api/featured-stocks', async (req, res) => {
//   try {
//     const [rows] = await db.execute('SELECT symbol, price, updated_at FROM featured_stocks ORDER BY updated_at DESC');
//     // 获取每只股票的涨跌幅（change百分比）
//     const yahooFinance = require('yahoo-finance2').default;
//     const result = await Promise.all(rows.map(async row => {
//       try {
//         const quote = await yahooFinance.quote(row.symbol);
//         let change = null;
//         if (quote && typeof quote.regularMarketChangePercent === 'number') {
//           change = quote.regularMarketChangePercent;
//         }
//         return { ...row, change };
//       } catch (err) {
//           console.error(`Error fetching quote for ${row.symbol}:`, err.message);
//         return { ...row, change: null };
//       }
//     }));
//     res.json(result);
//   } catch (err) {
//     console.error('Error fetching featured stocks:', err);
//     res.status(500).json({ error: '获取栏目股票列表失败' });
//   }
// });

// // 添加新 featured 栏目股票(雅虎接口)
// app.post('/api/featured-stocks/add', async (req, res) => {
//   const { symbol } = req.body;
//   if (!symbol) return res.status(400).json({ error: '缺少股票代码' });
//   try {
//     const yahooFinance = require('yahoo-finance2').default;
//     const quote = await yahooFinance.quote(symbol);
//     const price = quote && quote.regularMarketPrice ? quote.regularMarketPrice : null;
//     if (price === null) {
//         return res.status(400).json({ error: '无法获取该股票的实时价格，请检查股票代码是否正确' });
//     }
//     const now = new Date();
//     await db.execute(
//       'INSERT INTO featured_stocks (symbol, price, updated_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE price = ?, updated_at = ?',
//       [symbol, price, now, price, now]
//     );
//     res.json({ symbol, price, updated_at: now });
//   } catch (err) {
//     console.error('Error adding featured stock:', err);
//     res.status(500).json({ error: '添加或获取股价失败' });
//   }
// });
const axios = require('axios');

// 配置信息
const RAPIDAPI_KEY = '2c6d74fbcfmsh9522f8acde520d3p1293fejsnfb84420a97bd';
const RAPIDAPI_HOST = 'yahoo-finance15.p.rapidapi.com';

//获取featured栏目股票列表（查）
app.get('/api/featured-stocks', async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT symbol, price, change_percent, updated_at FROM featured_stocks ORDER BY updated_at DESC'
    );

    const result = rows.map(row => {
      // 1. 转换为数字
      const num = Number(row.change_percent);
      // 2. 只保留两位小数的数字（不转为字符串）
      const change = !isNaN(num) ? Math.round(num * 100) / 100 : null;

      return {
        symbol: row.symbol,
        price: row.price,
        change: change, // 此时是数字类型（如 0.54 而非 "0.54"）
        updated_at: row.updated_at
      };
    });

    res.json(result);
  } catch (err) {
    console.error('获取列表失败:', err);
    res.status(500).json({ error: '获取栏目股票列表失败' });
  }
});

//添加新featured栏目股票（增）
app.post('/api/featured-stocks/add', async (req, res) => {
  const { symbol } = req.body;
  if (!symbol) {
    console.warn('缺少股票代码，请求体:', req.body);
    return res.status(400).json({ error: '缺少股票代码' });
  }

  const normalizedSymbol = symbol.trim().toUpperCase();
  try {
    // 1. 定义两个接口的URL
    const QUOTES_API_URL = 'https://yahoo-finance15.p.rapidapi.com/api/v1/markets/stock/quotes'; // 拿增减率
    const PRICE_API_URL = 'https://yahoo-finance15.p.rapidapi.com/api/v1/markets/stock/modules'; // 拿价格

    // 2. 通用请求头
    const headers = {
      'x-rapidapi-host': RAPIDAPI_HOST,
      'x-rapidapi-key': RAPIDAPI_KEY
    };

    // 3. 并行调用两个接口（提高效率）
    // console.log(`同时获取 ${normalizedSymbol} 的价格和增减率...`);
    const [priceResponse, quotesResponse] = await Promise.all([
      // 调用modules接口获取价格（带financial-data模块）
      axios.get(PRICE_API_URL, {
        params: { ticker: normalizedSymbol, module: 'financial-data' },
        headers
      }),
      // 调用quotes接口获取增减率
      axios.get(QUOTES_API_URL, {
        params: { ticker: normalizedSymbol },
        headers
      })
    ]);

    // 4. 解析价格（从modules接口的financialData中提取）
    // 修复：将response改为priceResponse（正确引用价格接口的响应）
    const financialData = priceResponse.data.body;
    // console.log(`financialData:`, priceResponse.data.body);
    if (!financialData) {
      console.error(`接口未返回 financialData 字段，响应数据:`, priceResponse.data);
      return res.status(400).json({ error: '未找到股票财务数据' });
    }

    // 提取当前价格（raw 字段为数值型价格）
    const currentPrice = financialData.currentPrice;
    if (!currentPrice || currentPrice.raw === undefined || currentPrice.raw === null) {
      console.error(`当前价格字段缺失，currentPrice 数据:`, currentPrice);
      return res.status(400).json({ error: '无法获取股票当前价格' });
    }
    // 修复：定义price变量并赋值
    const price = currentPrice.raw;

    // 5. 解析增减率（从quotes接口的quotes数组中提取）
    const quotes = quotesResponse.data.body;
    // console.log(`quotesResponse-------------:`, quotes);

    if (!quotes || !quotes[0]) {
      console.error(`${normalizedSymbol} 报价数据缺失（quotes）:`, quotesResponse.data);
      return res.status(400).json({ error: '无法获取股票增减率数据' });
    }
    const regularMarketChangePercent = quotes[0].regularMarketChangePercent;
    let change = null;
    if (typeof regularMarketChangePercent === 'number') {
      change = regularMarketChangePercent.toFixed(2); // 保留两位小数
    } else {
      console.warn(`${normalizedSymbol} 增减率格式异常:`, regularMarketChangePercent);
    }

    // 6. 存入数据库
    const now = new Date();
    // 格式化日期为MySQL兼容格式（避免数据包错误）
    const mysqlDateTime = now.toISOString().slice(0, 19).replace('T', ' ');
    await db.execute(
      // 新增change_percent字段的插入和更新逻辑
      'INSERT INTO featured_stocks (symbol, price, change_percent, updated_at) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE price = ?, change_percent = ?, updated_at = ?',
      [normalizedSymbol, price, change, now, price, change, now]
    );


    // 7. 返回结果
    // 6. 返回结果（前端展示时格式化）
    res.json({
      symbol: normalizedSymbol,
      price,
      change: typeof change === 'number' ? change.toFixed(2) : null,
      updated_at: now.toISOString(),
      message: '添加股票成功'
    });

  } catch (err) {
    console.error(`处理 ${normalizedSymbol} 失败:`, {
      message: err.message,
      status: err.response?.status,
      data: err.response?.data,
      stack: err.stack // 增加堆栈信息，便于定位错误
    });

    // 错误分类处理
    if (err.response?.status === 429) {
      return res.status(429).json({ error: '请求过于频繁，请稍后再试' });
    } else if (err.response?.status === 404) {
      return res.status(404).json({ error: '股票代码不存在' });
    } else if (err.code === 'ECONNABORTED') {
      return res.status(504).json({ error: '接口请求超时' });
    } else {
      return res.status(500).json({ error: '添加股票失败，请检查接口配置' });
    }
  }
});

//  固定的10个 symbol
let SYMBOL_LIST = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA',
  'TSLA', 'META', 'NFLX', 'AMD', 'INTC'
];
async function fetchRecommendationTrend(symbol) {
  try {
    const res = await axios.get('https://yahoo-finance15.p.rapidapi.com/api/v1/markets/stock/modules', {
      params: {
        ticker: symbol,
        module: 'recommendation-trend'
      },
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': RAPIDAPI_HOST
      }
    });

    const trendList = res.data?.body?.trend || [];
    const latest = trendList.length > 0 ? trendList[0] : null;

    return {
      symbol,
      recommendation: latest
    };
  } catch (err) {
    console.error(`Error fetching recommendation trend for ${symbol}:`, err.message);
    return {
      symbol,
      recommendation: null,
      error: err.message
    };
  }
};

const market_API = 'https://yahoo-finance15.p.rapidapi.com/api/v1/markets/screener';


async function fetchMarketList(listType) {
  const url = `${market_API}?list=${listType}`;
  const response = await axios.get(url, {
    headers: {
      'x-rapidapi-key': RAPIDAPI_KEY,
      'x-rapidapi-host': RAPIDAPI_HOST
    }
  });
  return response.data;
}

function extractTop10Quotes(quotes) {
  return quotes.slice(0, 10).map(item => ({
    symbol: item.symbol,
    name: item.shortName || item.longName,
    price: item.regularMarketPrice,
    change: item.regularMarketChange,
    changePercent: item.regularMarketChangePercent,
    volume: item.regularMarketVolume,
    marketCap: item.marketCap,
    fiftyTwoWeekRange: item.fiftyTwoWeekRange
  }));
}
// ✅ 涨幅榜（day_gainers）
app.get('/api/market/gainers', async (req, res) => {
  try {
    const data = await fetchMarketList('day_gainers');
    const top10 = extractTop10Quotes(data.body || []);
    res.json(top10);
  } catch (error) {
    console.error('Error fetching gainers:', error.message);
    res.status(500).json({ error: 'Failed to fetch gainers' });
  }
});



// ✅ 跌幅榜（day_losers）
app.get('/api/market/losers', async (req, res) => {
  try {
    const data = await fetchMarketList('day_losers');
    const top10 = extractTop10Quotes(data.body || []);
    res.json(top10);
  } catch (error) {
    console.error('Error fetching losers:', error.message);
    res.status(500).json({ error: 'Failed to fetch losers' });
  }
});

// ✅ 最活跃榜（most_actives）
app.get('/api/market/most-active', async (req, res) => {
  try {
    const data = await fetchMarketList('most_actives');
    const top10 = extractTop10Quotes(data.body || []);
    res.json(top10);
  } catch (error) {
    console.error('Error fetching most actives:', error.message);
    res.status(500).json({ error: 'Failed to fetch most actives' });
  }
});



















// Get接口：返回所有 symbol 的推荐趋势
app.get('/api/recommendation-trend', async (req, res) => {

  const promises = SYMBOL_LIST.map(symbol => fetchRecommendationTrend(symbol));
  const results = await Promise.all(promises);
  res.json(results);
});
//Post 接口
app.post('/api/recommendation-trend/add', async (req, res) => {
  const { symbol } = req.body;
  if (!symbol) return res.status(400).json({ error: 'Missing symbol in body' });

  const cleanSymbol = symbol.trim().toUpperCase();

  if (!SYMBOL_LIST.includes(cleanSymbol)) {
    SYMBOL_LIST.push(cleanSymbol);
  }

  const result = await fetchRecommendationTrend(cleanSymbol);
  res.json(result);
});



// Get portfolio summary - 实时计算总价值
app.get('/api/portfolio', async (req, res) => {
  try {
    const calculatedTotal = await calculateCurrentTotalValue(); // 实时计算总价值

    // 获取基准值（用于计算 gain/loss）
    let baseValueForGainLoss = 0;
    const [firstDayPerformance] = await db.execute(
      'SELECT value FROM performance_history WHERE range_type = ? ORDER BY date ASC LIMIT 1',
      ['all']
    );
    if (firstDayPerformance.length > 0) {
      baseValueForGainLoss = parseFloat(firstDayPerformance[0].value);
    } else {
      // 如果没有历史数据，可以设置一个默认的初始投资额
      baseValueForGainLoss = 12310; // 或者其他你认为的初始值
    }

    const gainLoss = calculatedTotal - baseValueForGainLoss;
    const gainLossPercent = baseValueForGainLoss === 0 ? 0 : (gainLoss / baseValueForGainLoss) * 100;

    // 更新 portfolio 表 (可选，如果 portfolio 表只用于存储当前总览)
    // 这一步是确保 portfolio 表中的数据是最新的，如果前端直接从这个API获取，可以省略对 portfolio 表的查询
    const [existingPortfolio] = await db.execute('SELECT id FROM portfolio LIMIT 1');
    if (existingPortfolio.length === 0) {
      await db.execute(
        'INSERT INTO portfolio (total_value, gain_loss, gain_loss_percent) VALUES (?, ?, ?)',
        [calculatedTotal, gainLoss, gainLossPercent]
      );
    } else {
      await db.execute(
        'UPDATE portfolio SET total_value = ?, gain_loss = ?, gain_loss_percent = ? WHERE id = 1',
        [calculatedTotal, gainLoss, gainLossPercent]
      );
    }

    res.json({
      total_value: calculatedTotal,
      gain_loss: parseFloat(gainLoss.toFixed(2)),
      gain_loss_percent: parseFloat(gainLossPercent.toFixed(2))
    });

  } catch (error) {
    console.error('Error in /api/portfolio:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get asset allocation - 已经从 current_assets 获取，保持不变
app.get('/api/assets', async (req, res) => {
  try {
    // 查询 current_assets 表
    const [rows] = await db.execute('SELECT * FROM current_assets');

    // cash
    const cashTotal = rows.filter(r => r.type === 'cash').reduce((sum, r) => sum + Number(r.amount), 0);

    // bond
    const bondTotal = rows.filter(r => r.type === 'bond').reduce((sum, r) => sum + Number(r.amount), 0);

    // other
    const otherTotal = rows.filter(r => r.type === 'other').reduce((sum, r) => sum + Number(r.amount), 0);

    // stock：每行 amount * symbol 对应股价
    const stockRows = rows.filter(r => r.type === 'stock');
    let stockTotal = 0;
    if (stockRows.length > 0) {
      const symbols = stockRows.map(r => r.symbol);
      if (symbols.length > 0) {
        const placeholders = symbols.map(() => '?').join(',');
        const [prices] = await db.execute(`SELECT symbol, price FROM featured_stocks WHERE symbol IN (${placeholders})`, symbols);
        const priceMap = {};
        prices.forEach(p => { priceMap[p.symbol] = Number(p.price); });
        stockTotal = stockRows.reduce((sum, r) => {
          const price = priceMap[r.symbol] || 0;
          return sum + Number(r.amount) * price;
        }, 0);
      }
    }

    // 返回聚合结果
    res.json([
      { asset_type: 'Cash', value: cashTotal },
      { asset_type: 'Stock', value: stockTotal },
      { asset_type: 'Bond', value: bondTotal },
      { asset_type: 'Other', value: otherTotal }
    ]);
  } catch (error) {
    console.error('Error in /api/assets:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update asset value - 修改为更新 current_assets 表
app.put('/api/assets/:type', async (req, res) => {
  const { type } = req.params; // 例如 'cash', 'stock'
  const { change, symbol } = req.body; // change 是金额变化，symbol 用于股票数量变化

  try {
    if (change === undefined || change === null) {
      return res.status(400).json({ error: '缺少变化金额 (change)' });
    }
    const numericChange = parseFloat(change);
    if (isNaN(numericChange)) {
      return res.status(400).json({ error: '变化金额 (change) 必须是数字' });
    }

    if (type === 'cash' || type === 'bond' || type === 'other') {
      // 针对非股票资产（通常只有一条记录）
      const [asset] = await db.execute('SELECT id, amount FROM current_assets WHERE type = ?', [type]);
      if (asset.length === 0) {
        // 如果没有该类型资产记录，则插入新记录
        if (numericChange < 0) return res.status(400).json({ error: `不能减少不存在的 ${type} 资产` });
        await db.execute('INSERT INTO current_assets (type, amount) VALUES (?, ?)', [type, numericChange]);
      } else {
        // 更新现有记录
        const newAmount = Number(asset[0].amount) + numericChange;
        if (newAmount < 0) {
          return res.status(400).json({ error: `${type} 价值不能为负` });
        }
        await db.execute('UPDATE current_assets SET amount = ? WHERE id = ?', [newAmount, asset[0].id]);
      }
    } else if (type === 'stock') {
      if (!symbol) {
        return res.status(400).json({ error: '更新股票需要提供股票代码 (symbol)' });
      }
      // 更新股票数量
      const [stockAsset] = await db.execute('SELECT id, amount FROM current_assets WHERE type = ? AND symbol = ?', ['stock', symbol]);
      if (stockAsset.length === 0) {
        // 如果没有这只股票，则插入
        if (numericChange < 0) return res.status(400).json({ error: '不能卖空不存在的股票' });
        await db.execute('INSERT INTO current_assets (type, symbol, amount) VALUES (?, ?, ?)', ['stock', symbol, numericChange]);
      } else {
        const newStockAmount = Number(stockAsset[0].amount) + numericChange;
        if (newStockAmount < 0) {
          return res.status(400).json({ error: '股票数量不能为负' });
        }
        await db.execute('UPDATE current_assets SET amount = ? WHERE id = ?', [newStockAmount, stockAsset[0].id]);
      }
    } else {
      return res.status(400).json({ error: '不支持的资产类型' });
    }

    // 重新计算总价值并更新 portfolio 和 performance_history
    const newTotal = await calculateCurrentTotalValue();

    // 获取基准值
    let baseValueForGainLoss = 0;
    const [firstDayPerformance] = await db.execute(
      'SELECT value FROM performance_history WHERE range_type = ? ORDER BY date ASC LIMIT 1',
      ['all']
    );
    if (firstDayPerformance.length > 0) {
      baseValueForGainLoss = parseFloat(firstDayPerformance[0].value);
    } else {
      baseValueForGainLoss = 12310; // 如果没有历史数据，可以设置一个默认值
    }

    const gainLoss = newTotal - baseValueForGainLoss;
    const gainLossPercent = baseValueForGainLoss === 0 ? 0 : (gainLoss / baseValueForGainLoss) * 100;

    // 更新 portfolio 表
    const [existingPortfolio] = await db.execute('SELECT id FROM portfolio LIMIT 1');
    if (existingPortfolio.length === 0) {
      await db.execute(
        'INSERT INTO portfolio (total_value, gain_loss, gain_loss_percent) VALUES (?, ?, ?)',
        [newTotal, gainLoss, gainLossPercent]
      );
    } else {
      await db.execute(
        'UPDATE portfolio SET total_value = ?, gain_loss = ?, gain_loss_percent = ? WHERE id = 1',
        [newTotal, gainLoss, gainLossPercent]
      );
    }

    // Add new performance data point for today in the unified dataset
    const today = new Date().toISOString().split('T')[0];
    await db.execute(
      'INSERT INTO performance_history (date, value, range_type) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value = ?',
      [today, newTotal, 'all', newTotal]
    );

    res.json({
      success: true,
      updatedAssetType: type,
      totalPortfolio: newTotal,
      gainLoss: parseFloat(gainLoss.toFixed(2)),
      gainLossPercent: parseFloat(gainLossPercent.toFixed(2))
    });
  } catch (error) {
    console.error('Error updating asset:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get performance history (updated to use asset_history)
app.get('/api/performance/:range', async (req, res) => {
  const { range } = req.params;

  try {
    // 从 asset_history 表获取数据（包含日期和四个资产列）
    const [allRows] = await db.execute(
      'SELECT date, cash_value, stock_value, bond_value, other_value FROM asset_history ORDER BY date'
    );

    if (allRows.length === 0) {
      return res.json([]);
    }

    // 对每条记录计算四列总和，格式化为 { date, value }
    const summedData = allRows.map(row => {
      // 确保数值为数字（处理可能的NULL或非数值）
      const cash = Number(row.cash_value) || 0;
      const stock = Number(row.stock_value) || 0;
      const bond = Number(row.bond_value) || 0;
      const other = Number(row.other_value) || 0;
      return {
        date: row.date,
        value: Math.round((cash + stock + bond + other) * 100) / 100 // 保留两位小数
      };
    });

    // 根据时间范围筛选数据（逻辑与原逻辑一致）
    let resultData = [];
    if (range === '7d') {
      // 7天：返回最近7天的数据
      resultData = summedData.slice(-7);
    } else if (range === '1m') {
      // 1个月：返回最近30天的数据
      resultData = summedData.slice(-30);
    } else if (range === '6m') {
      // 6个月：返回全部数据（假设asset_history存储6个月数据）
      resultData = summedData;
    }

    res.json(resultData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'FinSight Backend is running (MySQL)' });
});


// 涨幅榜
app.get('/api/top-gainers', async (req, res) => {
  try {
    const result = await getSortedQuotes('gain');
    res.json(result);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to fetch top gainers.' });
  }
});

// 跌幅榜
app.get('/api/top-losers', async (req, res) => {
  try {
    const result = await getSortedQuotes('loss');
    res.json(result);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to fetch top losers.' });
  }
});

// 最活跃
app.get('/api/most-active', async (req, res) => {
  try {
    const result = await getSortedQuotes('volume');
    res.json(result);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to fetch most active stocks.' });
  }
});



// Start server
app.listen(PORT, async () => {
  console.log(`🚀 FinSight Backend running on http://localhost:${PORT}`);
  await initDatabase();
});

// Graceful shutdown
process.on('SIGINT', async () => {
  if (db) {
    await db.end();
    console.log('🔌 MySQL connection closed.');
  }
  process.exit(0);
});

app.get('/api/assets/:assetType/performance/:range', async (req, res) => {
  const { assetType, range } = req.params;
  let query = '';
  let values = [];

  // 根据不同的资产类型和时间范围构建 SQL 查询语句
  let assetColumn = '';
  switch (assetType) {
    case 'cash':
      assetColumn = 'cash_value';
      break;
    case 'bond':
      assetColumn = 'bond_value';
      break;
    case 'stock':
      assetColumn = 'stock_value';
      break;
    case 'other':
      assetColumn = 'other_value';
      break;
    default:
      return res.status(400).json({ error: 'Invalid asset type' });
  }

  switch (range) {
    case '7d':
      query = `
        SELECT date, ${assetColumn} as value
        FROM asset_history
        WHERE date >= CURDATE() - INTERVAL 7 DAY
        ORDER BY date ASC
      `;
      break;
    case '1m':
      query = `
        SELECT date, ${assetColumn} as value
        FROM asset_history
        WHERE date >= CURDATE() - INTERVAL 1 MONTH
        ORDER BY date ASC
      `;
      break;
    case '6m':
      query = `
        SELECT date, ${assetColumn} as value
        FROM asset_history
        WHERE date >= CURDATE() - INTERVAL 6 MONTH
        ORDER BY date ASC
      `;
      break;
    default:
      return res.status(400).json({ error: 'Invalid range' });
  }

  try {
    // 执行 SQL 查询
    const [rows] = await db.execute(query, values);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching asset performance data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});