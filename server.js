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
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.')); // Serve static files from current directory

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
  const createPortfolioTable = `
    CREATE TABLE IF NOT EXISTS portfolio (
      id INT AUTO_INCREMENT PRIMARY KEY,
      total_value DECIMAL(12,2) NOT NULL,
      gain_loss DECIMAL(12,2) NOT NULL,
      gain_loss_percent DECIMAL(5,2) NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `;

  const createAssetsTable = `
    CREATE TABLE IF NOT EXISTS assets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      asset_type ENUM('Cash', 'Stock', 'Bond', 'Other') NOT NULL,
      value DECIMAL(12,2) NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `;

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

  await db.execute(createPortfolioTable);
  await db.execute(createAssetsTable);
  await db.execute(createPerformanceTable);
  // 新建 featured_stocks 表
  const createFeaturedStocksTable = `
    CREATE TABLE IF NOT EXISTS featured_stocks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      symbol VARCHAR(16) UNIQUE,
      price DECIMAL(12,4),
      updated_at DATETIME
    )
  `;
  await db.execute(createFeaturedStocksTable);
  
  console.log('✅ Database tables created successfully');
}

// Seed initial data
async function seedInitialData() {
  // portfolio
  const [portfolioRows] = await db.execute('SELECT COUNT(*) as count FROM portfolio');
  if (portfolioRows[0].count === 0) {
    await db.execute(
      'INSERT INTO portfolio (total_value, gain_loss, gain_loss_percent) VALUES (?, ?, ?)',
      [12540.00, 230.00, 1.87]
    );
  }

  // assets
  const [assetRows] = await db.execute('SELECT COUNT(*) as count FROM assets');
  if (assetRows[0].count === 0) {
    const initialAssets = [
      ['Cash', 3000.00],
      ['Stock', 5500.00],
      ['Bond', 3200.00],
      ['Other', 840.00]
    ];
    for (const [type, value] of initialAssets) {
      await db.execute(
        'INSERT INTO assets (asset_type, value) VALUES (?, ?)',
        [type, value]
      );
    }
  }

  // asset_history
  try {
    const [hisRows] = await db.execute('SELECT COUNT(*) as count FROM asset_history');
    if (hisRows[0].count === 0) {
      // 生成180天历史数据
      const today = new Date();
      for (let i = 0; i < 180; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        // 生成示例数据
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
  }

  // current_assets
  try {
    const [curRows] = await db.execute('SELECT COUNT(*) as count FROM current_assets');
    if (curRows[0].count === 0) {
      await db.execute("INSERT INTO current_assets (type, symbol, amount) VALUES ('cash', NULL, 5000), ('stock', 'AAPL', 10), ('stock', 'NVDA', 5), ('bond', NULL, 2000), ('other', NULL, 1000)");
    }
  } catch (e) {
    // 表不存在则跳过
  }

  // featured_stocks
  try {
    const [fsRows] = await db.execute('SELECT COUNT(*) as count FROM featured_stocks');
    if (fsRows[0].count === 0) {
      await db.execute("INSERT INTO featured_stocks (symbol, price, updated_at) VALUES ('AAPL', 180.00, NOW()), ('NVDA', 120.00, NOW()), ('TSLA', 250.00, NOW())");
    }
  } catch (e) {
    // 表不存在则跳过
  }

  // performance_history
  const [perfRows] = await db.execute('SELECT COUNT(*) as count FROM performance_history');
  if (perfRows[0].count === 0) {
    const baseValue = 10000;
    const portfolioTotal = 12540.00;
    const dailyGrowthRate = Math.pow(portfolioTotal / baseValue, 1/179) - 1;
    console.log('📊 生成180天完整历史数据...');
    for (let i = 179; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      let value;
      if (i === 0) {
        value = portfolioTotal;
      } else {
        const baseGrowth = baseValue * Math.pow(1 + dailyGrowthRate, 179 - i);
        const randomFactor = 1 + (Math.random() - 0.5) * 0.02;
        value = baseGrowth * randomFactor;
        value = Math.round(value * 100) / 100;
      }
      await db.execute(
        'INSERT IGNORE INTO performance_history (date, value, range_type) VALUES (?, ?, ?)',
        [dateStr, value, 'all']
      );
    }
    console.log('✅ Initial data seeded successfully');
  }
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
      } catch {
        return { ...row, change: null };
      }
    }));
    res.json(result);
  } catch (err) {
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
    const now = new Date();
    await db.execute(
      'INSERT INTO featured_stocks (symbol, price, updated_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE price = ?, updated_at = ?',
      [symbol, price, now, price, now]
    );
    res.json({ symbol, price, updated_at: now });
  } catch (err) {
    res.status(500).json({ error: '添加或获取股价失败' });
  }
});

// Get portfolio summary
app.get('/api/portfolio', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM portfolio ORDER BY updated_at DESC LIMIT 1');
    if (rows.length > 0) {
      res.json(rows[0]);
    } else {
      res.status(404).json({ error: 'Portfolio data not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get asset allocation
app.get('/api/assets', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM assets ORDER BY asset_type');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update asset value
app.put('/api/assets/:type', async (req, res) => {
  const { type } = req.params;
  const { change } = req.body;
  
  try {
    // Get current asset value
    const [currentAsset] = await db.execute(
      'SELECT value FROM assets WHERE asset_type = ?',
      [type]
    );
    
    if (currentAsset.length === 0) {
      return res.status(404).json({ error: 'Asset type not found' });
    }
    
    const newValue = parseFloat(currentAsset[0].value) + parseFloat(change);
    
    if (newValue < 0) {
      return res.status(400).json({ error: 'Asset value cannot be negative' });
    }
    
    // Update asset value
    await db.execute(
      'UPDATE assets SET value = ? WHERE asset_type = ?',
      [newValue, type]
    );
    
    // Recalculate total portfolio value
    const [allAssets] = await db.execute('SELECT SUM(value) as total FROM assets');
    const newTotal = allAssets[0].total;
    
    // Update portfolio total (simplified gain/loss calculation)
    const gainLoss = newTotal - 12310; // Base value for calculation
    const gainLossPercent = (gainLoss / 12310) * 100;
    
    await db.execute(
      'UPDATE portfolio SET total_value = ?, gain_loss = ?, gain_loss_percent = ? WHERE id = 1',
      [newTotal, gainLoss, gainLossPercent]
    );
    
    // Add new performance data point for today in the unified dataset
    const today = new Date().toISOString().split('T')[0];
    
    await db.execute(
      'INSERT INTO performance_history (date, value, range_type) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value = ?',
      [today, newTotal, 'all', newTotal]
    );
    
    res.json({ 
      success: true, 
      newValue, 
      totalPortfolio: newTotal,
      gainLoss,
      gainLossPercent: gainLossPercent.toFixed(2)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get performance history
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
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'FinSight Backend is running (MySQL)' });
});

// Serve the frontend

// 获取AAPL股价API
const yahooFinance = require('yahoo-finance2').default;
app.get('/api/stock/aapl', async (req, res) => {
  try {
    const quote = await yahooFinance.quote('AAPL');
    const price = quote && quote.regularMarketPrice ? quote.regularMarketPrice : null;
    res.json({ price });
  } catch (err) {
    res.status(500).json({ error: '获取股价失败' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
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
  }
  process.exit(0);
});
