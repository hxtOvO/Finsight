// check-db.js - 检查数据库数据
const mysql = require('mysql2/promise');

async function checkDatabase() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '20001003',
      database: 'finsight_db'
    });

    console.log('✅ 数据库连接成功');

    // 检查所有表
    const [tables] = await connection.execute('SHOW TABLES');
    console.log('📋 数据库表:', tables);

    // 检查performance_history表的数据
    const [performanceData] = await connection.execute('SELECT * FROM performance_history');
    console.log('📈 Performance History 数据:', performanceData);

    // 检查portfolio表的数据
    const [portfolioData] = await connection.execute('SELECT * FROM portfolio');
    console.log('💰 Portfolio 数据:', portfolioData);

    // 检查assets表的数据
    const [assetsData] = await connection.execute('SELECT * FROM assets');
    console.log('📊 Assets 数据:', assetsData);

    await connection.end();
  } catch (error) {
    console.error('❌ 数据库错误:', error);
  }
}

checkDatabase();
