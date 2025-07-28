// 批量更新 asset_history 表的 stock_value 到 20000-50000 区间
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
    // 查询所有 asset_history 行
    const [rows] = await db.execute('SELECT id FROM asset_history');
    for (const row of rows) {
      // 随机生成 20000-50000 区间的值
      const stockValue = Math.floor(Math.random() * (50000 - 20000 + 1)) + 20000;
      await db.execute('UPDATE asset_history SET stock_value = ? WHERE id = ?', [stockValue, row.id]);
    }
    console.log('所有 asset_history 的 stock_value 已更新到 20000-50000 区间');
    await db.end();
  } catch (err) {
    console.error('更新失败:', err.message);
  }
})();
