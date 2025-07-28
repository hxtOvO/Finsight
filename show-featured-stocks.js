// 展示 featured_stocks 表内容
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
    const [rows] = await db.execute('SELECT symbol, price, updated_at FROM featured_stocks ORDER BY updated_at DESC');
    if (rows.length === 0) {
      console.log('featured_stocks 表为空');
    } else {
      console.log('当前 featured_stocks 表内容:');
      rows.forEach(row => {
        console.log(`${row.symbol}\t${row.price}\t${row.updated_at}`);
      });
    }
    await db.end();
  } catch (err) {
    console.error('查询失败:', err.message);
  }
})();
