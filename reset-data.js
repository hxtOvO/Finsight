// reset-data.js - Reset and reinitialize database with consistent end points
const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT
};

async function resetData() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to MySQL database');
    
    // Clear existing performance data
    await db.execute('DELETE FROM performance_history');
    console.log('🗑️ Cleared existing performance history');
    
    // Get current total value
    const [portfolioData] = await db.execute('SELECT total_value FROM portfolio LIMIT 1');
    const currentTotal = portfolioData[0] ? portfolioData[0].total_value : 12540.00;
    
    console.log(`📊 Current total value: $${currentTotal}`);
    
    const today = new Date().toISOString().split('T')[0];
    
    // Insert 7 days data
    const values7d = [currentTotal - 540, currentTotal - 440, currentTotal - 490, currentTotal - 340, currentTotal - 390, currentTotal - 240, currentTotal];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      await db.execute(
        'INSERT INTO performance_history (date, value, range_type) VALUES (?, ?, ?)',
        [dateStr, values7d[6-i], '7d']
      );
    }
    console.log('✅ Inserted 7 days data (ending with current total)');
    
    // Insert 1 month data (8 sample points)
    const values1m = [
      currentTotal - 740, 
      currentTotal - 640, 
      currentTotal - 540, 
      currentTotal - 440, 
      currentTotal - 340, 
      currentTotal - 240, 
      currentTotal - 140, 
      currentTotal
    ];
    for (let i = 0; i < values1m.length; i++) {
      const date = new Date();
      const daysBack = Math.floor((30 * (values1m.length - 1 - i)) / (values1m.length - 1));
      date.setDate(date.getDate() - daysBack);
      const dateStr = date.toISOString().split('T')[0];
      
      await db.execute(
        'INSERT INTO performance_history (date, value, range_type) VALUES (?, ?, ?)',
        [dateStr, values1m[i], '1m']
      );
    }
    console.log('✅ Inserted 1 month data (ending with current total)');
    
    // Insert 6 months data (6 sample points)
    const values6m = [
      currentTotal - 2040, 
      currentTotal - 1540, 
      currentTotal - 1040, 
      currentTotal - 540, 
      currentTotal - 240, 
      currentTotal
    ];
    for (let i = 0; i < values6m.length; i++) {
      const date = new Date();
      const monthsBack = Math.floor((6 * (values6m.length - 1 - i)) / (values6m.length - 1));
      date.setMonth(date.getMonth() - monthsBack);
      const dateStr = date.toISOString().split('T')[0];
      
      await db.execute(
        'INSERT INTO performance_history (date, value, range_type) VALUES (?, ?, ?)',
        [dateStr, values6m[i], '6m']
      );
    }
    console.log('✅ Inserted 6 months data (ending with current total)');
    
    // Verify the data
    console.log('\n📈 Verification - Last data points for each range:');
    const ranges = ['7d', '1m', '6m'];
    for (const range of ranges) {
      const [lastPoint] = await db.execute(
        'SELECT date, value FROM performance_history WHERE range_type = ? ORDER BY date DESC LIMIT 1',
        [range]
      );
      if (lastPoint[0]) {
        console.log(`${range}: ${lastPoint[0].date} = $${lastPoint[0].value}`);
      }
    }
    
    console.log('\n🎉 Data reset completed! All ranges now end with the same total value.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (db) {
      await db.end();
    }
  }
}

resetData();
