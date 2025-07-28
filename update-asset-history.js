// 批量更新 asset_history 数据，让资产变化更逼真
const mysql = require('mysql2/promise');
require('dotenv').config();

function randomFloat(base, range) {
  return +(base + (Math.random() - 0.5) * range).toFixed(2);
}

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
    // 生成180天更逼真的资产历史
    const today = new Date();
    await db.execute('DELETE FROM asset_history');
    let cash = 120000, stock = 500000, bond = 20000, other = 5000;
    for (let i = 0; i < 180; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      // 模拟现金每日小幅减少（消费），偶尔有收入
      cash = randomFloat(cash - 100, 300);
      if (Math.random() < 0.05) cash += 5000; // 偶尔有大额入账
      // 股票每日波动，涨跌幅在-2%~+2%
      stock = +(stock * (1 + (Math.random() - 0.5) * 0.04)).toFixed(2);
      // 债券稳定增长，偶尔有利息
      bond = +(bond * 1.0002 + (Math.random() < 0.02 ? 100 : 0)).toFixed(2);
      // 其他资产小幅波动
      other = randomFloat(other, 100);
      await db.execute(
        'INSERT INTO asset_history (date, cash_value, stock_value, bond_value, other_value) VALUES (?, ?, ?, ?, ?)',
        [dateStr, cash, stock, bond, other]
      );
    }
    console.log('asset_history 数据已更新为更逼真模拟');
    await db.end();
  } catch (err) {
    console.error('更新失败:', err.message);
  }
})();
