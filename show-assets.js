// 展示 current_assets 和 asset_history 表内容
const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '20001003',
    database: process.env.DB_NAME || 'finsight_db',
    port: process.env.DB_PORT || 3306
  };
  try {
    const db = await mysql.createConnection(dbConfig);
    // 查询 current_assets 所有行
    const [assets] = await db.execute('SELECT * FROM current_assets ORDER BY id');
    console.log('current_assets 表内容:');
    console.log('ID\t类型\t\t代码\t\t数量');
    console.log('----------------------------------------');
    if (assets.length === 0) {
      console.log('表为空');
    } else {
      assets.forEach(row => {
        console.log(`${row.id}\t${row.type}\t\t${row.symbol}\t\t${row.amount}`);
      });
    }
    // 查询 asset_history 前十行
    const [history] = await db.execute('SELECT * FROM asset_history ORDER BY date DESC LIMIT 10');
    console.log('\nasset_history 前十行:');
    console.log('日期\t\t\t现金\t\t股票\t\t债券\t\t其他');
    console.log('----------------------------------------------------------------');
    if (history.length === 0) {
      console.log('表为空');
    } else {
      history.forEach(row => {
        const dateStr = row.date.toISOString().split('T')[0];
        console.log(`${dateStr}\t${row.cash_value}\t\t${row.stock_value}\t\t${row.bond_value}\t\t${row.other_value}`);
      });
    }
    await db.end();
  } catch (err) {
    console.error('查询失败:', err.message);
  }
})();
