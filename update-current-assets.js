// 批量插入 current_assets 至少4行股票、2行bond、1行other
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
    // 清空表
    await db.execute('DELETE FROM current_assets');
    // 插入股票类（将 '00700' 换成 'NVDA'）
    await db.execute(`INSERT INTO current_assets (type, symbol, amount) VALUES
      ('stock', 'NVDA', 50.00),
      ('stock', 'AAPL', 50.00),
      ('stock', 'MSFT', 30.00),
      ('stock', 'TSLA', 20.00)
    `);
    // 插入债券类
    await db.execute(`INSERT INTO current_assets (type, symbol, amount) VALUES
      ('bond', 'SH2025', 20000.00),
      ('bond', 'US2030', 15000.00)
    `);
    // 插入其他类（模糊化为 'OTHER'，数额 450000）
    await db.execute(`INSERT INTO current_assets (type, symbol, amount) VALUES
      ('other', 'OTHER', 350000.00)
    `);
    // 插入现金类（单位美元）
    await db.execute(`INSERT INTO current_assets (type, symbol, amount) VALUES
      ('cash', 'USD', 120000.00)
    `);
    console.log('current_assets 已更新');
    await db.end();
  } catch (err) {
    console.error('更新失败:', err.message);
  }
})();
