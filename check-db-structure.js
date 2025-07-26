// check-db-structure.js
// 用于检查finsight.db的结构和数据，输出到终端

const sqlite3 = require('sqlite3').verbose();
const dbPath = './finsight.db';

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('无法打开数据库:', err.message);
    process.exit(1);
  }
});

function printDivider() {
  console.log('='.repeat(60));
}

// 获取所有表名
function getTables() {
  return new Promise((resolve, reject) => {
    db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", (err, rows) => {
      if (err) reject(err);
      else resolve(rows.map(r => r.name));
    });
  });
}

// 获取表结构
function getTableSchema(table) {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${table})`, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// 获取表数据统计
function getTableStats(table) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT COUNT(*) as count FROM ${table}`, (err, row) => {
      if (err) reject(err);
      else resolve(row.count);
    });
  });
}

// 获取部分数据预览
function getTablePreview(table, limit=5) {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM ${table} LIMIT ${limit}`, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function inspectDatabase() {
  try {
    const tables = await getTables();
    if (tables.length === 0) {
      console.log('数据库无表。');
      return;
    }
    for (const table of tables) {
      printDivider();
      console.log(`表名: ${table}`);
      const schema = await getTableSchema(table);
      console.log('结构:');
      schema.forEach(col => {
        console.log(`  ${col.name} (${col.type})${col.pk ? ' [PK]' : ''}`);
      });
      const count = await getTableStats(table);
      console.log(`数据行数: ${count}`);
      const preview = await getTablePreview(table);
      if (preview.length > 0) {
        console.log('部分数据:');
        preview.forEach((row, idx) => {
          console.log(`  [${idx+1}]`, row);
        });
      } else {
        console.log('无数据预览');
      }
    }
    printDivider();
    db.close();
  } catch (err) {
    console.error('检查数据库时出错:', err);
    db.close();
  }
}

inspectDatabase();
