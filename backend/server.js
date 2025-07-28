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
      gain_loss_percent DECIMAL(5,2) NOT NULL,
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
  const createFeaturedStocksTable = `
    CREATE TABLE IF NOT EXISTS featured_stocks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      symbol VARCHAR(16) UNIQUE,
      price DECIMAL(12,4),
      updated_at DATETIME
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
    const dailyGrowthRate = baseValue === 0 ? 0 : (Math.pow(portfolioTotal / baseValue, 1/179) - 1);

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
app.get('/api/featured-stocks', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT symbol, price, updated_at FROM featured_stocks ORDER BY updated_at DESC');
    // 获取每只股票的涨跌幅（change百分比）
    const yahooFinance = require('yahoo-finance2').default;
    const result = await Promise.all(rows.map(async row => {
      try {
        const quote = await yahooFinance.quote(row.symbol);
        let change = null;
        if (quote && typeof quote.regularMarketChangePercent === 'number') {
          change = quote.regularMarketChangePercent;
        }
        return { ...row, change };
      } catch (err) {
          console.error(`Error fetching quote for ${row.symbol}:`, err.message);
        return { ...row, change: null };
      }
    }));
    res.json(result);
  } catch (err) {
    console.error('Error fetching featured stocks:', err);
    res.status(500).json({ error: '获取栏目股票列表失败' });
  }
});

// 添加新 featured 栏目股票
app.post('/api/featured-stocks/add', async (req, res) => {
  const { symbol } = req.body;
  if (!symbol) return res.status(400).json({ error: '缺少股票代码' });
  try {
    const yahooFinance = require('yahoo-finance2').default;
    const quote = await yahooFinance.quote(symbol);
    const price = quote && quote.regularMarketPrice ? quote.regularMarketPrice : null;
    if (price === null) {
        return res.status(400).json({ error: '无法获取该股票的实时价格，请检查股票代码是否正确' });
    }
    const now = new Date();
    await db.execute(
      'INSERT INTO featured_stocks (symbol, price, updated_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE price = ?, updated_at = ?',
      [symbol, price, now, price, now]
    );
    res.json({ symbol, price, updated_at: now });
  } catch (err) {
    console.error('Error adding featured stock:', err);
    res.status(500).json({ error: '添加或获取股价失败' });
  }
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

// Get performance history - 保持不变
app.get('/api/performance/:range', async (req, res) => {
  const { range } = req.params;

  try {
    // 获取完整的180天数据
    const [allRows] = await db.execute(
      'SELECT date, value FROM performance_history WHERE range_type = ? ORDER BY date',
      ['all']
    );

    if (allRows.length === 0) {
      return res.json([]);
    }

    let resultData = [];

    if (range === '7d') {
      // 7天：返回最近7天的数据
      resultData = allRows.slice(-7);
    } else if (range === '1m') {
      // 1个月：返回最近30天的完整数据
      resultData = allRows.slice(-30);
    } else if (range === '6m') {
      // 6个月：返回完整180天数据
      resultData = allRows;
    }

    res.json(resultData);
  } catch (error) {
    console.error('Error fetching performance history:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'FinSight Backend is running (MySQL)' });
});

// Serve the frontend (保持不变)

// 获取AAPL股价API (保持不变)
const yahooFinance = require('yahoo-finance2').default;
app.get('/api/stock/aapl', async (req, res) => {
  try {
    const quote = await yahooFinance.quote('AAPL');
    const price = quote && quote.regularMarketPrice ? quote.regularMarketPrice : null;
    res.json({ price });
  } catch (err) {
    console.error('Error fetching AAPL stock price:', err);
    res.status(500).json({ error: '获取股价失败' });
  }
});

// app.get('/', (req, res) => {
//   res.sendFile(__dirname + '/index.html');
// });

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