const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixTableStructure() {
  let db;
  try {
    db = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT
    });

    console.log('✅ 连接成功');

    // 查看当前表结构
    const [currentStructure] = await db.execute('DESCRIBE performance_history');
    console.log('📋 当前表结构:');
    currentStructure.forEach(row => {
      if (row.Field === 'range_type') {
        console.log(`  ${row.Field}: ${row.Type}`);
      }
    });

    // 修改ENUM类型，添加'all'
    console.log('🔧 正在修改表结构...');
    await db.execute(`
      ALTER TABLE performance_history 
      MODIFY COLUMN range_type ENUM('7d', '1m', '6m', 'all') NOT NULL
    `);
    
    console.log('✅ 表结构修改成功！');

    // 验证修改结果
    const [newStructure] = await db.execute('DESCRIBE performance_history');
    newStructure.forEach(row => {
      if (row.Field === 'range_type') {
        console.log(`📋 新结构 - ${row.Field}: ${row.Type}`);
      }
    });

  } catch (error) {
    console.error('❌ 错误:', error);
  } finally {
    if (db) {
      await db.end();
    }
  }
}

fixTableStructure();
