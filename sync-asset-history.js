// 用 current_assets 最新数据更新 asset_history 表今天的数据
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
    // 汇总 current_assets
    const [cashRows] = await db.execute("SELECT amount FROM current_assets WHERE type='cash'");
    const cash = cashRows.reduce((sum, r) => sum + Number(r.amount), 0);
    const [stockRows] = await db.execute("SELECT symbol, amount FROM current_assets WHERE type='stock'");
    let stock = 0;
    for (const row of stockRows) {
      const [priceRows] = await db.execute("SELECT price FROM featured_stocks WHERE symbol=?", [row.symbol]);
      const price = priceRows[0] ? Number(priceRows[0].price) : 0;
      stock += price * Number(row.amount);
    }
    const [bondRows] = await db.execute("SELECT amount FROM current_assets WHERE type='bond'");
    const bond = bondRows.reduce((sum, r) => sum + Number(r.amount), 0);
    const [otherRows] = await db.execute("SELECT amount FROM current_assets WHERE type='other'");
    const other = otherRows.reduce((sum, r) => sum + Number(r.amount), 0);
    // 更新 asset_history 表今天的数据
    const today = new Date().toISOString().slice(0, 10);
    await db.execute(
      'UPDATE asset_history SET cash_value=?, stock_value=?, bond_value=?, other_value=? WHERE date=?',
      [cash, stock, bond, other, today]
    );
    console.log('asset_history 今日数据已同步 current_assets');
    await db.end();
  } catch (err) {
    console.error('同步失败:', err.message);
  }
})();
