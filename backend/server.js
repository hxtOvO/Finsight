const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path'); // 添加 path 模块
require('dotenv').config();
const swagger = require('../swagger');
const router = express.Router(); // 创建Router实例
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.')); // Serve static files from current directory
app.use(express.static(path.join(__dirname, '../frontend')));
// 注册Swagger UI
app.use('/api-docs', swagger.serve, swagger.setup);

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
  const createAssetActivityHistoryTable = `
    CREATE TABLE IF NOT EXISTS asset_activity_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      operation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      operation_type ENUM('add', 'reduce') NOT NULL,
      amount DECIMAL(12, 2) NOT NULL,
      description TEXT,
      asset_type VARCHAR(20) NOT NULL
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

  const createBondTable = `
    CREATE TABLE IF NOT EXISTS bond (
      asset_id INTEGER PRIMARY KEY REFERENCES current_assets(id) ON DELETE CASCADE,
      period INTEGER NOT NULL CHECK (period > 0),
      coupon_rate DECIMAL(5, 2),
      amount INTEGER
  );
  `;

  const createCurrentAssetsTable = `
    CREATE TABLE IF NOT EXISTS current_assets (
      id int NOT NULL AUTO_INCREMENT PRIMARY KEY,
      type varchar(20) DEFAULT NULL,
      symbol varchar(20) DEFAULT NULL,
      amount decimal(18,2) DEFAULT NULL
    )
  `;
  const createRecommendTable = `
  CREATE TABLE IF NOT EXISTS Recommend (
      id INT AUTO_INCREMENT PRIMARY KEY,
      symbol VARCHAR(10) NOT NULL UNIQUE,
      period VARCHAR(20),
      strong_buy INT,
      buy INT,
      hold INT,
      sell INT,
      strong_sell INT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `;

  const createMarketTable = `
  CREATE TABLE IF NOT EXISTS Market (
    id INT AUTO_INCREMENT PRIMARY KEY,
    list_type VARCHAR(32) NOT NULL,
    symbol VARCHAR(12) NOT NULL,
    name VARCHAR(255),
    price DECIMAL(12, 2),
    \`change\` DECIMAL(12, 2),
    change_percent DECIMAL(7, 4),
    volume BIGINT,
    market_cap BIGINT,
    fifty_two_week_range VARCHAR(64),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_list_symbol (list_type, symbol)
  );
  `;




  await db.execute(createPortfolioTable);
  // await db.execute(createAssetsTable); // 移除 assets 表的创建
  await db.execute(createPerformanceTable);
  await db.execute(createFeaturedStocksTable);
  await db.execute(createCurrentAssetsTable);
  await db.execute(createBondTable);
  await db.execute(createAssetActivityHistoryTable);
  await db.execute(createRecommendTable);
  await db.execute(createMarketTable);



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

/**
 * @swagger
 * components:
 *   schemas:
 *     Stock:
 *       type: object
 *       properties:
 *         symbol:
 *           type: string
 *         price:
 *           type: number
 *           format: float
 *         change:
 *           type: number
 *           format: float
 *         updated_at:
 *           type: string
 *           format: date-time
 *     Asset:
 *       type: object
 *       properties:
 *         asset_type:
 *           type: string
 *           enum: [Cash, Stock, Bond, Other]
 *         value:
 *           type: number
 *           format: float
 *     Portfolio:
 *       type: object
 *       properties:
 *         total_value:
 *           type: number
 *           format: float
 *         gain_loss:
 *           type: number
 *           format: float
 *         gain_loss_percent:
 *           type: number
 *           format: float
 */

/**
 * @swagger
 * /api/featured-stocks/remove:
 *   post:
 *     summary: 删除Featured栏目股票
 *     description: 根据股票代码删除Featured栏目中的股票
 *     tags: [Featured Stocks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - symbol
 *             properties:
 *               symbol:
 *                 type: string
 *                 example: "AAPL"
 *                 description: 股票代码（如AAPL、MSFT）
 *     responses:
 *       200:
 *         description: 删除成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: 缺少股票代码
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "缺少股票代码"
 *       500:
 *         description: 服务器错误
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "删除失败"
 */
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

const axios = require('axios');

// 配置信息
const RAPIDAPI_KEY = '2eca160c32msh506e802cbfdce0bp1cc81ejsn3b0970b7d7cb'; // 替换为你的实际API密钥
const RAPIDAPI_HOST = 'yahoo-finance15.p.rapidapi.com';

//获取featured栏目股票列表（查）
/**
 * @swagger
 * /api/featured-stocks:
 *   get:
 *     summary: 获取Featured栏目股票列表
 *     description: 返回所有Featured栏目中的股票，包含价格和涨跌幅信息
 *     tags: [Featured Stocks]
 *     responses:
 *       200:
 *         description: 成功返回股票列表
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   symbol:
 *                     type: string
 *                     example: "AAPL"
 *                   price:
 *                     type: number
 *                     format: float
 *                     example: 189.56
 *                   change:
 *                     type: number
 *                     format: float
 *                     example: 1.23
 *                     description: 涨跌幅（百分比）
 *                   updated_at:
 *                     type: string
 *                     format: date-time
 *                     example: "2024-07-29T10:30:00.000Z"
 *       500:
 *         description: 服务器错误
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "获取栏目股票列表失败"
 */
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
/**
 * @swagger
 * /api/featured-stocks/add:
 *   post:
 *     summary: 添加股票到Featured栏目
 *     description: 根据股票代码添加股票到Featured栏目（自动获取实时价格和涨跌幅）
 *     tags: [Featured Stocks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - symbol
 *             properties:
 *               symbol:
 *                 type: string
 *                 example: "NVDA"
 *                 description: 股票代码（如AAPL、MSFT）
 *     responses:
 *       200:
 *         description: 添加成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 symbol:
 *                   type: string
 *                   example: "NVDA"
 *                 price:
 *                   type: number
 *                   format: float
 *                   example: 420.50
 *                 change:
 *                   type: number
 *                   format: float
 *                   example: 2.35
 *                 updated_at:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: 参数错误（如缺少股票代码或代码无效）
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "缺少股票代码"
 *       429:
 *         description: 请求过于频繁
 *       500:
 *         description: 服务器错误
 */
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

//判断是否需要重新拉取
function isStale(updatedAt) {
  if (!updatedAt) return true; // 没有时间视为已过期

  const updated = new Date(updatedAt);
  const now = new Date();

  const diffMs = now - updated;
  const diffHours = diffMs / (1000 * 60 * 60);

  return diffHours >= 24;
}
//缓存判断 + 拉新逻辑
async function fetchRecommendationWithCache(symbol) {
  const [rows] = await db.execute('SELECT * FROM Recommend WHERE symbol = ?', [symbol]);

  if (rows.length > 0 && !isStale(rows[0].updated_at)) {
    console.log(`Using cached recommendation for ${symbol}`);
    return getProcessedRecommendation(symbol);
  }

  console.log(`🔄 [${symbol}] Cache missing or stale, fetching fresh data from API...`);

  await fetchRecommendationTrend(symbol); // 会写入数据库

  return getProcessedRecommendation(symbol);
}


//  固定的10个 symbol
let SYMBOL_LIST = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA',
  'TSLA', 'META', 'NFLX', 'AMD', 'INTC'
];
//调用接口后存数据库
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

    if (!latest) throw new Error('No recommendation data');

    const { period, strongBuy, buy, hold, sell, strongSell } = latest;

    // 插入或更新 MySQL
    await db.execute(`
      INSERT INTO recommend (symbol, period, strong_buy, buy, hold, sell, strong_sell)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        period = VALUES(period),
        strong_buy = VALUES(strong_buy),
        buy = VALUES(buy),
        hold = VALUES(hold),
        sell = VALUES(sell),
        strong_sell = VALUES(strong_sell),
        updated_at = CURRENT_TIMESTAMP
    `, [symbol, period, strongBuy, buy, hold, sell, strongSell]);
    console.log(`💾 [${symbol}] Data saved to database`);


    return {
      symbol,
      period,
      strongBuy,
      buy,
      hold,
      sell,
      strongSell
    };
  } catch (err) {
    console.error(`Error fetching recommendation trend for ${symbol}:`, err.message);
    return {
      symbol,
      error: err.message
    };
  }
}
// 启动时预加载 SYMBOL_LIST
async function preloadRecommendationCache() {
  console.log('🔄 Preloading recommendation data...');
  for (const symbol of SYMBOL_LIST) {
    try {
      await fetchRecommendationWithCache(symbol);
    } catch (err) {
      console.error(`❌ Failed to preload ${symbol}:`, err.message);
    }
  }
}

// ✅ 立即执行预加载（可放到你 server 启动后执行的位置）



//不存数据库每次调接口
// async function fetchRecommendationTrend(symbol) {
//   try {
//     const res = await axios.get('https://yahoo-finance15.p.rapidapi.com/api/v1/markets/stock/modules', {
//       params: {
//         ticker: symbol,
//         module: 'recommendation-trend'
//       },
//       headers: {
//         'x-rapidapi-key': RAPIDAPI_KEY,
//         'x-rapidapi-host': RAPIDAPI_HOST
//       }
//     });

//     const trendList = res.data?.body?.trend || [];
//     const latest = trendList.length > 0 ? trendList[0] : null;

//     return {
//       symbol,
//       recommendation: latest
//     };
//   } catch (err) {
//     console.error(`Error fetching recommendation trend for ${symbol}:`, err.message);
//     return {
//       symbol,
//       recommendation: null,
//       error: err.message
//     };
//   }
// }

//从数据库查并格式化后处理
async function getProcessedRecommendation(symbol) {
  const [rows] = await db.execute('SELECT * FROM recommend WHERE symbol = ?', [symbol]);

  if (rows.length === 0) return null;

  const formatted = {
    symbol: rows[0].symbol,
    recommendation: {
      period: rows[0].period,
      strongBuy: rows[0].strong_buy,
      buy: rows[0].buy,
      hold: rows[0].hold,
      sell: rows[0].sell,
      strongSell: rows[0].strong_sell
    }
  };

  return processRecommendationData([formatted])[0];
}

// 🤖 加权推荐算法
function calculateWeightedRecommendation(recommendation) {
  if (!recommendation) {
    return {
      action: 'HOLD',
      score: 0,
      confidence: 0,
      reason: 'No recommendation data available'
    };
  }

  const { strongBuy, buy, hold, sell, strongSell } = recommendation;
  const totalAnalysts = strongBuy + buy + hold + sell + strongSell;

  if (totalAnalysts === 0) {
    return {
      action: 'HOLD',
      score: 0,
      confidence: 0,
      reason: 'No analyst data available'
    };
  }

  // 计算加权分数 (strongBuy=3, buy=1, hold=0, sell=-1, strongSell=-3)
  const score = (strongBuy * 3 + buy * 1 + hold * 0 + sell * (-1) + strongSell * (-3)) / totalAnalysts;

  // 确定推荐行动 (只有BUY/HOLD/SELL三种)
  let action = 'HOLD';
  if (score >= 0.5) action = 'BUY';
  else if (score <= -0.5) action = 'SELL';

  // 计算置信度 (0-1)
  const confidence = Math.min(Math.abs(score) / 3, 1);

  // 生成推荐理由
  const reason = `Based on comprehensive analysis of ${totalAnalysts} analysts, our system algorithm recommends ${action} with ${(confidence * 100).toFixed(0)}% confidence.`;

  return {
    action,
    score: parseFloat(score.toFixed(2)),
    confidence: parseFloat(confidence.toFixed(2)),
    total_analysts: totalAnalysts,
    reason
  };
}

// 处理推荐数据的函数
function processRecommendationData(rawData) {
  return rawData.map(item => {
    if (!item.recommendation) {
      return {
        symbol: item.symbol,
        action: 'HOLD',
        score: 0,
        confidence: 0,
        total_analysts: 0,
        breakdown: {},
        reason: item.error || 'No recommendation data available',
        error: item.error
      };
    }

    const weighted = calculateWeightedRecommendation(item.recommendation);

    return {
      symbol: item.symbol,
      action: weighted.action,
      score: weighted.score,
      confidence: weighted.confidence,
      total_analysts: weighted.total_analysts,
      breakdown: item.recommendation,
      reason: weighted.reason
    };
  });
}


//*------------------------------Market Screener API----------------------------------------------------------*//
function isWithin24Hours(updatedAt) {
  const updatedTime = new Date(updatedAt).getTime();
  const now = Date.now();
  return now - updatedTime < 24 * 60 * 60 * 1000; // 小于 24 小时
}

async function getMarketListWithCache(listType) {
  // 1. 查缓存
  const [rows] = await db.execute(
    `SELECT * FROM Market WHERE list_type = ? ORDER BY updated_at DESC`,
    [listType]
  );

  const isValid = rows.length >= 10 && rows.every(row => isWithin24Hours(row.updated_at));

  if (isValid) {
    console.log(`[${listType}] Using cached market data from DB`);

    return rows.map(row => ({
      symbol: row.symbol,
      name: row.name,
      price: row.price,
      change: row.change,
      changePercent: row.change_percent,
      volume: row.volume,
      marketCap: row.market_cap,
      fiftyTwoWeekRange: row.fifty_two_week_range
    }));
  }
  console.log(`[${listType}] Cache missing or stale, fetching fresh data from API...`);

  // 2. 否则拉新数据
  const data = await fetchMarketList(listType);
  const top10 = extractTop10Quotes(data.body || []);

  // 3. 写入缓存（REPLACE 覆盖旧数据）
  for (const item of top10) {
    await db.execute(`
      REPLACE INTO Market
      (list_type, symbol, name, price,\`change\`, change_percent, volume, market_cap, fifty_two_week_range, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      listType,
      item.symbol,
      item.name,
      item.price,
      item.change,
      item.changePercent,
      item.volume,
      item.marketCap,
      item.fiftyTwoWeekRange
    ]);
  }

  return top10;
}




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
// 涨幅榜（day_gainers）-调用接口
// app.get('/api/market/gainers', async (req, res) => {
//   try {
//     const data = await fetchMarketList('day_gainers');
//     const top10 = extractTop10Quotes(data.body || []);
//     res.json(top10);
//   } catch (error) {
//     console.error('Error fetching gainers:', error.message);
//     res.status(500).json({ error: 'Failed to fetch gainers' });
//   }
// });


// 涨幅榜（day_gainers）-使用缓存
app.get('/api/market/gainers', async (req, res) => {
  try {
    const result = await getMarketListWithCache('day_gainers');
    res.json(result);
  } catch (error) {
    console.error('Error fetching gainers:', error.message);
    res.status(500).json({ error: 'Failed to fetch gainers' });
  }
});

//  跌幅榜（day_losers）--调用接口
// app.get('/api/market/losers', async (req, res) => {
//   try {
//     const data = await fetchMarketList('day_losers');
//     const top10 = extractTop10Quotes(data.body || []);
//     res.json(top10);
//   } catch (error) {
//     console.error('Error fetching losers:', error.message);
//     res.status(500).json({ error: 'Failed to fetch losers' });
//   }
// });

// 跌幅榜（day_losers）--使用缓存
app.get('/api/market/losers', async (req, res) => {
  try {
    const result = await getMarketListWithCache('day_losers');
    res.json(result);
  } catch (error) {
    console.error('Error fetching losers:', error.message);
    res.status(500).json({ error: 'Failed to fetch losers' });
  }
});

// 最活跃榜（most_actives）-调用接口
// app.get('/api/market/most-active', async (req, res) => {
//   try {
//     const data = await fetchMarketList('most_actives');
//     const top10 = extractTop10Quotes(data.body || []);
//     res.json(top10);
//   } catch (error) {
//     console.error('Error fetching most actives:', error.message);
//     res.status(500).json({ error: 'Failed to fetch most actives' });
//   }
// });

// 最活跃榜（most_actives）-使用缓存
app.get('/api/market/most-active', async (req, res) => {
  try {
    const result = await getMarketListWithCache('most_actives');
    res.json(result);
  } catch (error) {
    console.error('Error fetching most actives:', error.message);
    res.status(500).json({ error: 'Failed to fetch most actives' });
  }
});


//*------------------------------Market Screener API----------------------------------------------------------*//


















//Get接口，从API查询数据再返回
// app.get('/api/recommendation-trend', async (req, res) => {
//   const promises = SYMBOL_LIST.map(symbol => fetchRecommendationTrend(symbol));
//   const results = await Promise.all(promises);

//   // 使用加权算法处理数据
//   const processedResults = processRecommendationData(results);

//   res.json(processedResults);
// });

//Get接口：返回所有 symbol 的推荐趋势（使用数据库存储）
app.get('/api/recommendation-trend', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM Recommend ORDER BY symbol');

    // 构建推荐数据结构（不含 updated_at）
    const formatted = rows.map(row => ({
      symbol: row.symbol,
      recommendation: {
        period: row.period,
        strongBuy: row.strong_buy,
        buy: row.buy,
        hold: row.hold,
        sell: row.sell,
        strongSell: row.strong_sell
      }
    }));

    const processed = processRecommendationData(formatted);

    res.json(processed);
  } catch (err) {
    console.error('DB error:', err.message);
    res.status(500).json({ error: 'Database query failed' });
  }
});



//Post接口
/**
 * @swagger
 * /api/recommendation-trend/add:
 *   post:
 *     summary: 添加股票到推荐趋势列表
 *     description: 将新股票添加到推荐趋势监控列表并返回其趋势数据
 *     tags: [Recommendation Trends]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - symbol
 *             properties:
 *               symbol:
 *                 type: string
 *                 example: "TSLA"
 *     responses:
 *       200:
 *         description: 添加成功并返回趋势数据
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 symbol:
 *                   type: string
 *                   example: "TSLA"
 *                 recommendation:
 *                   type: object
 *       400:
 *         description: 缺少股票代码
 */
// app.post('/api/recommendation-trend/add', async (req, res) => {
//   const { symbol } = req.body;
//   if (!symbol) return res.status(400).json({ error: 'Missing symbol in body' });

//   const cleanSymbol = symbol.trim().toUpperCase();

//   if (!SYMBOL_LIST.includes(cleanSymbol)) {
//     SYMBOL_LIST.push(cleanSymbol);
//   }

//   const result = await fetchRecommendationTrend(cleanSymbol);
//   const processedResult = processRecommendationData([result])[0];

//   res.json(processedResult);
// });
app.post('/api/recommendation-trend/add', async (req, res) => {
  const { symbol } = req.body;
  if (!symbol) return res.status(400).json({ error: 'Missing symbol in body' });

  const cleanSymbol = symbol.trim().toUpperCase();

  if (!SYMBOL_LIST.includes(cleanSymbol)) {
    SYMBOL_LIST.push(cleanSymbol);
  }

  try {
    const result = await fetchRecommendationWithCache(cleanSymbol);

    if (!result) {
      return res.status(404).json({ error: 'Failed to get recommendation data' });
    }

    res.json(result);
  } catch (err) {
    console.error('POST /api/recommendation-trend/add error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// Get portfolio summary - 实时计算总价值
/**
 * @swagger
 * /api/portfolio:
 *   get:
 *     summary: 获取投资组合摘要
 *     description: 实时计算并返回投资组合总价值、盈亏及盈亏百分比
 *     tags: [Portfolio]
 *     responses:
 *       200:
 *         description: 成功返回投资组合数据
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total_value:
 *                   type: number
 *                   format: float
 *                   example: 56890.25
 *                 gain_loss:
 *                   type: number
 *                   format: float
 *                   example: 3450.75
 *                 gain_loss_percent:
 *                   type: number
 *                   format: float
 *                   example: 6.45
 *       500:
 *         description: 服务器错误
 */
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
/**
 * @swagger
 * /api/assets:
 *   get:
 *     summary: 获取资产分配情况
 *     description: 返回现金、股票、债券、其他资产的分配比例及价值
 *     tags: [Assets]
 *     responses:
 *       200:
 *         description: 成功返回资产分配数据
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   asset_type:
 *                     type: string
 *                     enum: [Cash, Stock, Bond, Other]
 *                   value:
 *                     type: number
 *                     format: float
 *                     example: 25000.00
 *       500:
 *         description: 服务器错误
 */
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
/**
 * @swagger
 * /api/assets/{type}:
 *   put:
 *     summary: 更新资产价值
 *     description: 调整指定类型资产的价值（支持现金、股票、债券、其他资产）
 *     tags: [Assets]
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [cash, stock, bond, other]
 *         description: 资产类型
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - change
 *             properties:
 *               change:
 *                 type: number
 *                 format: float
 *                 example: 1000.50
 *                 description: 价值变化量（正数增加，负数减少）
 *               symbol:
 *                 type: string
 *                 example: "AAPL"
 *                 description: 股票代码（仅type=stock时需要）
 *     responses:
 *       200:
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 totalPortfolio:
 *                   type: number
 *                   format: float
 *       400:
 *         description: 参数错误（如价值为负或缺少股票代码）
 *       500:
 *         description: 服务器错误
 */
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

    // ====================================================================
    // *** 新增/更新的逻辑：将扇形图数据（current_assets的各项明细）更新到 asset_history 表中今天的记录 ***
    // 重新计算并获取所有资产类型的当前总值（明细）
    const [allCurrentAssets] = await db.execute('SELECT * FROM current_assets');
    const todayCashValue = allCurrentAssets.filter(r => r.type === 'cash').reduce((sum, r) => sum + Number(r.amount), 0);
    const todayBondValue = allCurrentAssets.filter(r => r.type === 'bond').reduce((sum, r) => sum + Number(r.amount), 0);
    const todayOtherValue = allCurrentAssets.filter(r => r.type === 'other').reduce((sum, r) => sum + Number(r.amount), 0);

    let todayStockValue = 0;
    const todayStockRows = allCurrentAssets.filter(r => r.type === 'stock');
    if (todayStockRows.length > 0) {
      const symbols = todayStockRows.map(r => r.symbol);
      if (symbols.length > 0) {
        const placeholders = symbols.map(() => '?').join(',');
        const [prices] = await db.execute(`SELECT symbol, price FROM featured_stocks WHERE symbol IN (${placeholders})`, symbols);
        const priceMap = {};
        prices.forEach(p => { priceMap[p.symbol] = Number(p.price); });
        todayStockValue = todayStockRows.reduce((sum, r) => {
          const price = priceMap[r.symbol] || 0;
          return sum + Number(r.amount) * price;
        }, 0);
      }
    }

    // 使用 ON DUPLICATE KEY UPDATE 确保：
    // 如果今天的数据已存在，则更新它；如果不存在，则插入新记录。
    await db.execute(
      'INSERT INTO asset_history (date, cash_value, stock_value, bond_value, other_value) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE cash_value = ?, stock_value = ?, bond_value = ?, other_value = ?',
      [
        today,
        parseFloat(todayCashValue.toFixed(2)),
        parseFloat(todayStockValue.toFixed(2)),
        parseFloat(todayBondValue.toFixed(2)),
        parseFloat(todayOtherValue.toFixed(2)),
        parseFloat(todayCashValue.toFixed(2)), // ON DUPLICATE KEY UPDATE 的值
        parseFloat(todayStockValue.toFixed(2)),
        parseFloat(todayBondValue.toFixed(2)),
        parseFloat(todayOtherValue.toFixed(2))
      ]
    );
    console.log(`✅ ${today} 的 asset_history 记录已更新/插入，反映最新资产分配。`);
    // ====================================================================

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
/**
 * @swagger
 * /api/performance/{range}:
 *   get:
 *     summary: 获取绩效历史数据
 *     description: 返回指定时间范围内的资产总价值历史趋势
 *     tags: [Performance]
 *     parameters:
 *       - in: path
 *         name: range
 *         required: true
 *         schema:
 *           type: string
 *           enum: [7d, 1m, 6m]
 *         description: 时间范围（7d=7天，1m=1个月，6m=6个月）
 *     responses:
 *       200:
 *         description: 成功返回绩效数据
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   date:
 *                     type: string
 *                     format: date
 *                     example: "2024-07-01"
 *                   value:
 *                     type: number
 *                     format: float
 *                     example: 52000.00
 *       400:
 *         description: 无效的时间范围
 *       500:
 *         description: 服务器错误
 */
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

// 增加资产接口
/**
 * @swagger
 * /api/assets/{type}/add:
 *   post:
 *     summary: 增加指定类型的资产数量
 *     description: 根据资产类型（如股票、债券等）增加对应资产的持有数量，不同类型资产需提供不同的补充参数
 *     tags:
 *       - 资产管理
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         description: 资产类型，支持现金、债券、股票、其他资产
 *         schema:
 *           type: string
 *           enum: [cash, bond, stock, other]
 *       - in: body
 *         name: assetAdd
 *         required: true
 *         description: 增加资产的详细信息，不同类型资产需提供不同参数
 *         schema:
 *           type: object
 *           required:
 *             - amount
 *           properties:
 *             amount:
 *               type: number
 *               description: 需增加的资产数量，必须为正数（整数或小数，根据资产类型而定）
 *               example: 5000.25
 *             symbol:
 *               type: string
 *               description: 资产标识（股票代码/债券代码），股票类型必填，债券类型可选（未提供时自动生成）
 *               example: "STOCK001"
 *             period:
 *               type: integer
 *               description: 债券期限（仅债券类型必填），需为正整数
 *               example: 5
 *             couponRate:
 *               type: number
 *               description: 债券票面利率（仅债券类型必填），需为非负数（百分比形式，如3.5表示3.5%）
 *               example: 3.5
 *     responses:
 *       200:
 *         description: 资产增加成功
 *         schema:
 *           type: object
 *           properties:
 *             success:
 *               type: boolean
 *               description: 操作结果状态
 *               example: true
 *             totalPortfolio:
 *               type: number
 *               description: 操作后的投资组合总价值
 *               example: 85000.50
 *       400:
 *         description: 缺少必要参数或参数格式不正确
 *         schema:
 *           type: object
 *           properties:
 *             error:
 *               type: string
 *               description: 错误信息
 *               examples:
 *                 missingAmount:
 *                   value: "缺少增加的资产数量 (amount)"
 *                 invalidAmount:
 *                   value: "增加的资产数量 (amount) 必须是正数"
 *                 bondParamsMissing:
 *                   value: "债券类型需要提供期限 (period) 和票面利率 (couponRate)"
 *       500:
 *         description: 服务器内部错误（如数据库操作失败）
 *         schema:
 *           type: object
 *           properties:
 *             error:
 *               type: string
 *               description: 错误详情
 *               example: "数据库操作失败：连接超时"
 */
app.post('/api/assets/:type/add', async (req, res) => {
  const { type } = req.params;
  const { amount, symbol, period, couponRate,description } = req.body;

  try {
    // 基础参数验证：确保amount有效
    if (amount === undefined || amount === null) {
      return res.status(400).json({ error: '缺少增加的资产数量 (amount)' });
    }
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: '增加的资产数量 (amount) 必须是正数' });
    }
    // 转换为整数（匹配bond表的INTEGER类型）
    const bondAmount = Math.round(numericAmount); // 或根据业务需求使用parseInt()

    // 债券类型特有参数验证
    if (type === 'bond') {
      if (!period || !couponRate) {
        return res.status(400).json({
          error: '债券类型需要提供期限 (period) 和票面利率 (couponRate)'
        });
      }
      // 验证period为正整数（匹配bond表的CHECK约束）
      const numericPeriod = parseInt(period);
      if (isNaN(numericPeriod) || numericPeriod <= 0) {
        return res.status(400).json({ error: '债券期限 (period) 必须是正整数' });
      }
      // 验证coupon_rate为有效数值
      const numericCouponRate = parseFloat(couponRate);
      if (isNaN(numericCouponRate) || numericCouponRate < 0) {
        return res.status(400).json({ error: '票面利率 (couponRate) 必须是非负数' });
      }
    }

    // 开始数据库事务（确保current_assets和bond表操作原子性）
    await db.beginTransaction();

    try {
      let assetId;
      if (type === 'stock') {
        // 股票类型处理（保持不变）
        if (!symbol) {
          return res.status(400).json({ error: '股票类型需要提供股票代码 (symbol)' });
        }
        const [stockAsset] = await db.execute(
          'SELECT id, amount FROM current_assets WHERE type = ? AND symbol = ?',
          [type, symbol]
        );
        if (stockAsset.length === 0) {
          const [result] = await db.execute(
            'INSERT INTO current_assets (type, symbol, amount) VALUES (?, ?, ?)',
            [type, symbol, numericAmount]
          );
          assetId = result.insertId;
        } else {
          const newAmount = Number(stockAsset[0].amount) + numericAmount;
          await db.execute(
            'UPDATE current_assets SET amount = ? WHERE id = ?',
            [newAmount, stockAsset[0].id]
          );
          assetId = stockAsset[0].id;
        }
      } else if (type === 'bond') {
        // 债券类型处理（新增bond表的amount字段插入）
        // 1. 插入基础资产记录到current_assets
        const [result] = await db.execute(
          'INSERT INTO current_assets (type, symbol, amount) VALUES (?, ?, ?)',
          [type, symbol || `BOND_${Date.now()}`, numericAmount] // symbol可选，自动生成默认值
        );
        assetId = result.insertId;

        // 2. 插入债券特有信息到bond表（包含amount字段）
        await db.execute(
          'INSERT INTO bond (asset_id, period, coupon_rate, amount) VALUES (?, ?, ?, ?)',
          [
            assetId,
            parseInt(period), // 转换为整数（匹配表结构）
            parseFloat(couponRate), // 保持小数（匹配DECIMAL类型）
            bondAmount // 债券金额（转换为整数）
          ]
        );
      } else {
        // 其他资产类型处理（保持不变）
        const [asset] = await db.execute(
          'SELECT id, amount FROM current_assets WHERE type = ?',
          [type]
        );
        if (asset.length === 0) {
          const [result] = await db.execute(
            'INSERT INTO current_assets (type, amount) VALUES (?, ?)',
            [type, numericAmount]
          );
          assetId = result.insertId;
        } else {
          const newAmount = Number(asset[0].amount) + numericAmount;
          await db.execute(
            'UPDATE current_assets SET amount = ? WHERE id = ?',
            [newAmount, asset[0].id]
          );
          assetId = asset[0].id;
        }
      }

      // 提交事务
      await db.commit();

      // 记录操作历史
      await db.execute(
          'INSERT INTO asset_activity_history (operation_type, amount, description, asset_type) VALUES (?, ?, ?, ?)',
          ['add', amount, description, type]
      );
      
      // 计算并返回总资产
      const totalPortfolio = await calculateCurrentTotalValue();
      res.json({ success: true, totalPortfolio });
    } catch (error) {
      // 事务回滚
      await db.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error in /api/assets/:type/add:', error);
    res.status(500).json({ error: error.message });
  }
});

// 减少资产接口
/**
 * @swagger
 * /api/assets/{type}/reduce:
 *   post:
 *     summary: 减少指定类型的资产数量
 *     description: 根据资产类型减少对应资产的持有数量。支持现金、债券、股票等多种资产类型。
 *     tags:
 *       - 资产管理
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         description: 资产类型，可选值为 cash、bond、stock、other
 *         schema:
 *           type: string
 *           enum: [cash, bond, stock, other]
 *       - in: body
 *         name: assetReduce
 *         required: true
 *         description: 需要减少的资产数量和相关参数
 *         schema:
 *           type: object
 *           required:
 *             - amount
 *           properties:
 *             amount:
 *               type: number
 *               description: 需要减少的资产数量，必须为正数
 *               example: 100.50
 *             symbol:
 *               type: string
 *               description: 当资产类型为 bond 时，必须提供债券代码
 *               example: "BOND001"
 *     responses:
 *       200:
 *         description: 资产减少成功
 *         schema:
 *           type: object
 *           properties:
 *             success:
 *               type: boolean
 *               description: 操作结果状态
 *               example: true
 *             totalPortfolio:
 *               type: number
 *               description: 操作后的投资组合总价值
 *               example: 50000.75
 *       400:
 *         description: 缺少必要参数或参数格式不正确
 *         schema:
 *           type: object
 *           properties:
 *             error:
 *               type: string
 *               description: 错误信息
 *               example: "缺少减少的资产数量 (amount)"
 *       403:
 *         description: 资产数量不足或记录不存在
 *         schema:
 *           type: object
 *           properties:
 *             error:
 *               type: string
 *               description: 错误信息
 *               example: "持有的 BOND001 债券数量不足（当前: 50，请求减少: 100）"
 *       500:
 *         description: 服务器内部错误
 *         schema:
 *           type: object
 *           properties:
 *             error:
 *               type: string
 *               description: 错误信息
 *               example: "系统错误：债券数据不一致，请联系管理员"
 */
app.post('/api/assets/:type/reduce', async (req, res) => {
  const { type } = req.params;
  const { amount, symbol,description } = req.body;

  try {
    if (amount === undefined || amount === null) {
      return res.status(400).json({ error: '缺少减少的资产数量 (amount)' });
    }

    // 关键修改：将金额转换为整数（与数据库类型匹配）
    const numericAmount = Math.floor(parseFloat(amount));
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: '减少的资产数量 (amount) 必须是正数' });
    }

    // 开始数据库事务
    await db.beginTransaction();

    try {
      let assetId;
      if (type === 'bond') {
        if (!symbol) {
          return res.status(400).json({ error: '债券类型需要提供债券代码 (symbol)' });
        }

        // 修改查询：同时获取两个表的amount进行验证
        const [bondAsset] = await db.execute(
          'SELECT a.id, a.amount AS current_assets_amount, b.amount AS bond_amount ' +
          'FROM current_assets a ' +
          'JOIN bond b ON a.id = b.asset_id ' +
          'WHERE a.type = ? AND a.symbol = ?',
          [type, symbol]
        );

        if (bondAsset.length === 0) {
          return res.status(403).json({ error: `没有 ${symbol} 债券记录，无法减少` });
        }

        // 获取两个表的amount并验证一致性
        const currentAssetsAmount = Number(bondAsset[0].current_assets_amount);
        const bondAmount = Number(bondAsset[0].bond_amount);

        // 新增：验证两个表的amount是否一致
        if (currentAssetsAmount !== bondAmount) {
          console.error(`数据不一致：current_assets.amount=${currentAssetsAmount}, bond.amount=${bondAmount}`);
          return res.status(500).json({ error: '系统错误：债券数据不一致，请联系管理员' });
        }

        // 使用current_assets的amount进行比较（与前端类型一致）
        if (currentAssetsAmount < numericAmount) {
          return res.status(403).json({
            error: `持有的 ${symbol} 债券数量不足（当前: ${currentAssetsAmount}，请求减少: ${numericAmount}）`
          });
        }

        const newAmount = currentAssetsAmount - numericAmount;
        assetId = bondAsset[0].id;

        if (newAmount === 0) {
          await db.execute('DELETE FROM bond WHERE asset_id = ?', [assetId]);
          await db.execute('DELETE FROM current_assets WHERE id = ?', [assetId]);
        } else {
          // 同步更新两个表（保持一致）
          await db.execute('UPDATE current_assets SET amount = ? WHERE id = ?', [newAmount, assetId]);
          await db.execute('UPDATE bond SET amount = ? WHERE asset_id = ?', [newAmount, assetId]);
        }
      } else {
        // 其他资产类型处理（保持不变）
        const [asset] = await db.execute('SELECT id, amount FROM current_assets WHERE type = ?', [type]);
        if (asset.length === 0) {
          return res.status(403).json({ error: `没有 ${type} 资产记录，无法减少` });
        }
        const currentAmount = Number(asset[0].amount);
        if (currentAmount < numericAmount) {
          return res.status(403).json({ error: `${type} 资产数量不足，无法减少` });
        }
        const newAmount = currentAmount - numericAmount;
        assetId = asset[0].id;
        if (newAmount === 0) {
          await db.execute('DELETE FROM current_assets WHERE id = ?', [assetId]);
        } else {
          await db.execute('UPDATE current_assets SET amount = ? WHERE id = ?', [newAmount, assetId]);
        }
      }

      await db.commit();
      // 记录操作历史
      await db.execute(
          'INSERT INTO asset_activity_history (operation_type, amount, description, asset_type) VALUES (?, ?, ?, ?)',
          ['reduce', amount, description, type]
      );
      const totalPortfolio = await calculateCurrentTotalValue();
      res.json({ success: true, totalPortfolio });
    } catch (error) {
      await db.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error in /api/assets/:type/reduce:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: 服务健康检查
 *     description: 验证后端服务是否正常运行
 *     tags: [System]
 *     responses:
 *       200:
 *         description: 服务正常运行
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "OK"
 *                 message:
 *                   type: string
 *                   example: "FinSight Backend is running (MySQL)"
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'FinSight Backend is running (MySQL)' });
});






// Start server
app.listen(PORT, async () => {
  console.log(`🚀 FinSight Backend running on http://localhost:${PORT}`);

  try {
    await initDatabase(); // 确保数据库表建好
    await preloadRecommendationCache(); // 预加载推荐数据
    console.log('✅ Recommendation cache preloaded');
  } catch (err) {
    console.error('❌ Failed to preload recommendation data:', err.message);
  }
});


// Graceful shutdown
process.on('SIGINT', async () => {
  if (db) {
    await db.end();
    console.log('🔌 MySQL connection closed.');
  }
  process.exit(0);
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

/**
 * @swagger
 * /api/assets/{assetType}/performance/{range}:
 *   get:
 *     summary: 获取特定资产类型的绩效历史
 *     description: 返回指定资产类型在指定时间范围内的价值趋势
 *     tags: [Performance]
 *     parameters:
 *       - in: path
 *         name: assetType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [cash, stock, bond, other]
 *         description: 资产类型
 *       - in: path
 *         name: range
 *         required: true
 *         schema:
 *           type: string
 *           enum: [7d, 1m, 6m]
 *         description: 时间范围
 *     responses:
 *       200:
 *         description: 成功返回绩效数据
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   date:
 *                     type: string
 *                     format: date
 *                   value:
 *                     type: number
 *                     format: float
 *       400:
 *         description: 无效的资产类型或时间范围
 *       500:
 *         description: 服务器错误
 */
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


// Graceful shutdown
process.on('SIGINT', async () => {
  if (db) {
    await db.end();
    console.log('🔌 MySQL connection closed.');
  }
  process.exit(0);
});