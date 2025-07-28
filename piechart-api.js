// Express API，返回 pie chart 数据
const express = require('express');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

app.get('/api/piechart', async (req, res) => {
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
    await db.end();
    res.json({ cash, stock, bond, other });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Piechart API server running at http://localhost:${port}/api/piechart`);
});
