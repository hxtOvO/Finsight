// 自动创建 current_assets 和 asset_history 表，并插入 mock 数据
const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
  };
  try {
    const db = await mysql.createConnection(dbConfig);
    // 创建 current_assets 表
    await db.execute(`CREATE TABLE IF NOT EXISTS current_assets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      type VARCHAR(20),
      symbol VARCHAR(20),
      amount DECIMAL(18,2)
    )`);
    // 创建 asset_history 表
    await db.execute(`CREATE TABLE IF NOT EXISTS asset_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      date DATE,
      cash_value DECIMAL(18,2),
      stock_value DECIMAL(18,2),
      bond_value DECIMAL(18,2),
      other_value DECIMAL(18,2)
    )`);
    // 插入 current_assets mock 数据
    await db.execute('DELETE FROM current_assets');
    await db.execute(`INSERT INTO current_assets (type, symbol, amount) VALUES
      ('cash', 'CNY', 120000.00),
      ('stock', '00700', 100.00),
      ('stock', 'AAPL', 50.00),
      ('bond', 'SH2025', 20000.00),
      ('other', 'Gold', 10.00)
    `);
    // 插入 asset_history mock 数据（近10天）
    await db.execute('DELETE FROM asset_history');
    const today = new Date();
    for (let i = 0; i < 180; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      // 随机生成 other_value 300000-400000 区间
      const otherValue = Math.floor(Math.random() * (400000 - 300000 + 1)) + 300000;
      await db.execute(
        'INSERT INTO asset_history (date, cash_value, stock_value, bond_value, other_value) VALUES (?, ?, ?, ?, ?)',
        [dateStr, 120000 - i * 100, 500000 + i * 2000, 20000, otherValue]
      );
    }
    console.log('数据初始化完成');
    await db.end();
  } catch (err) {
    console.error('初始化失败:', err.message);
  }
})();
