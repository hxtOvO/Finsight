// 汇总 current_assets 表数据，实时查股票价格，输出 pie chart 所需结构
const mysql = require('mysql2/promise');
require('dotenv').config();

// 股票价格查询函数（Yahoo Finance 简单接口，symbol为美股代码）
// 不再需要外部API，直接查 featured_stocks 表

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
    // cash
    const [cashRows] = await db.execute("SELECT amount FROM current_assets WHERE type='cash'");
    const cash = cashRows.reduce((sum, r) => sum + Number(r.amount), 0);
    // stock
    const [stockRows] = await db.execute("SELECT symbol, amount FROM current_assets WHERE type='stock'");
    let stock = 0;
    for (const row of stockRows) {
      // 查找 featured_stocks 表中的价格
      const [priceRows] = await db.execute("SELECT price FROM featured_stocks WHERE symbol=?", [row.symbol]);
      const price = priceRows[0] ? Number(priceRows[0].price) : 0;
      stock += price * Number(row.amount);
    }
    // bond
    const [bondRows] = await db.execute("SELECT amount FROM current_assets WHERE type='bond'");
    const bond = bondRows.reduce((sum, r) => sum + Number(r.amount), 0);
    // other
    const [otherRows] = await db.execute("SELECT amount FROM current_assets WHERE type='other'");
    const other = otherRows.reduce((sum, r) => sum + Number(r.amount), 0);
    // 输出结果
    const result = { cash, stock, bond, other };
    console.log(result);
    await db.end();
  } catch (err) {
    console.error('查询失败:', err.message);
  }
})();
