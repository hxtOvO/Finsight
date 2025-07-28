// 列出 finsight_db 所有表及每个表的行数
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
    // 查询所有表名
    const [tables] = await db.execute("SHOW TABLES");
    const tableKey = Object.keys(tables[0])[0];
    console.log('数据库 finsight_db 的所有表及行数:');
    for (const t of tables) {
      const tableName = t[tableKey];
      const [rows] = await db.execute(`SELECT COUNT(*) AS count FROM \`${tableName}\``);
      console.log(`${tableName}: ${rows[0].count} 行`);
      if (tableName === 'asset_history') {
        const [lastRow] = await db.execute("SELECT * FROM asset_history ORDER BY date DESC LIMIT 1");
        if (lastRow.length > 0) {
          console.log('asset_history 最后一行:', lastRow[0]);
        } else {
          console.log('asset_history 表为空');
        }
      }
    }
    await db.end();
    // 额外输出 asset_history 表最新一行
    try {
      const [lastRow] = await db.execute("SELECT * FROM asset_history ORDER BY date DESC LIMIT 1");
      if (lastRow.length > 0) {
        console.log('asset_history 最后一行:', lastRow[0]);
      } else {
        console.log('asset_history 表为空');
      }
    } catch (err) {
      console.error('查询 asset_history 最后一行失败:', err.message);
    }
  } catch (err) {
    console.error('查询失败:', err.message);
  }
})();

