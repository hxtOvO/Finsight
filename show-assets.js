// 展示 current_assets 和 asset_history 表内容
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
    // 查询 current_assets 所有行
    const [assets] = await db.execute('SELECT * FROM current_assets ORDER BY id');
    console.log('current_assets 表内容:');
    if (assets.length === 0) {
      console.log('表为空');
    } else {
      assets.forEach(row => {
        console.log(`${row.id}\t${row.type}\t${row.symbol}\t${row.amount}`);
      });
    }
    // 查询 asset_history 前十行
    const [history] = await db.execute('SELECT * FROM asset_history ORDER BY date DESC LIMIT 10');
    console.log('\nasset_history 前十行:');
    if (history.length === 0) {
      console.log('表为空');
    } else {
      history.forEach(row => {
        console.log(`${row.date}\t${row.cash_value}\t${row.stock_value}\t${row.bond_value}\t${row.other_value}`);
      });
    }
    await db.end();
  } catch (err) {
    console.error('查询失败:', err.message);
  }
})();
