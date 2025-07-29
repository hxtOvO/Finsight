const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

// 数据库连接配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '20001003',
  database: process.env.DB_NAME || 'finsight_db',
  port: process.env.DB_PORT || 3306
};

console.log('🔍 Stock Value 计算过程详细追踪');
console.log('='.repeat(70));

async function traceStockValueCalculation() {
  let db;
  
  try {
    // 连接数据库
    console.log('\n🔌 连接数据库...');
    db = await mysql.createConnection(dbConfig);
    console.log('✅ 连接成功');

    // 1. 查看所有相关表的数据
    console.log('\n📊 第一步：检查所有相关表的原始数据');
    console.log('='.repeat(50));

    // 检查 assets 表中的 Stock 数据
    console.log('\n🏦 ASSETS 表中的 Stock 相关数据:');
    const [stockAssets] = await db.execute(
      "SELECT * FROM assets WHERE asset_type = 'Stock' ORDER BY id"
    );
    
    if (stockAssets.length > 0) {
      console.log(`找到 ${stockAssets.length} 条 Stock 记录:`);
      stockAssets.forEach(asset => {
        console.log(`  ID: ${asset.id}`);
        console.log(`  类型: ${asset.asset_type}`);
        console.log(`  价值: $${asset.value}`);
        console.log(`  更新时间: ${asset.updated_at}`);
        console.log('  ---');
      });
      
      // 计算 assets 表中的 Stock 总价值
      const assetsStockTotal = stockAssets.reduce((sum, asset) => sum + parseFloat(asset.value), 0);
      console.log(`📈 Assets 表中 Stock 总价值: $${assetsStockTotal.toFixed(2)}`);
    } else {
      console.log('❌ Assets 表中没有找到 Stock 类型的记录');
    }

    // 检查 asset_history 表的最新数据
    console.log('\n📈 ASSET_HISTORY 表中的最新数据:');
    const [latestHistory] = await db.execute(`
      SELECT * FROM asset_history 
      WHERE date = (SELECT MAX(date) FROM asset_history) 
      ORDER BY id DESC
      LIMIT 5
    `);

    if (latestHistory.length > 0) {
      console.log(`找到 ${latestHistory.length} 条最新历史记录:`);
      latestHistory.forEach(record => {
        console.log(`  记录ID: ${record.id}`);
        console.log(`  日期: ${record.date}`);
        console.log(`  现金价值: $${record.cash_value || 0}`);
        console.log(`  股票价值: $${record.stock_value || 0} ← 这是我们关注的值`);
        console.log(`  债券价值: $${record.bond_value || 0}`);
        console.log(`  其他价值: $${record.other_value || 0}`);
        console.log('  ---');
      });

      const latestRecord = latestHistory[0];
      const historyStockValue = parseFloat(latestRecord.stock_value) || 0;
      console.log(`📊 历史记录中的 Stock 价值: $${historyStockValue.toFixed(2)}`);
      
      // 这就是我们在饼图中看到的值！
      console.log(`\n🎯 这个值 $${historyStockValue.toFixed(2)} 就是饼图中显示的 Stock value!`);
    }

    // 2. 查看可能影响 Stock 计算的其他表
    console.log('\n🔍 第二步：检查其他可能相关的表');
    console.log('='.repeat(50));

    // 检查是否有单独的股票表
    try {
      const [tables] = await db.execute("SHOW TABLES");
      console.log('\n📋 数据库中的所有表:');
      tables.forEach(table => {
        const tableName = Object.values(table)[0];
        console.log(`  - ${tableName}`);
      });

      // 检查是否有 stocks 或 featured_stocks 表
      const tableNames = tables.map(table => Object.values(table)[0]);
      
      if (tableNames.includes('featured_stocks')) {
        console.log('\n📊 检查 FEATURED_STOCKS 表:');
        const [featuredStocks] = await db.execute('SELECT * FROM featured_stocks LIMIT 10');
        if (featuredStocks.length > 0) {
          console.log(`找到 ${featuredStocks.length} 条记录:`);
          featuredStocks.forEach(stock => {
            console.log(`  符号: ${stock.symbol}`);
            console.log(`  价格: $${stock.price || 0}`);
            console.log(`  更新时间: ${stock.updated_at}`);
            console.log('  ---');
          });
        }
      }

      if (tableNames.includes('stocks')) {
        console.log('\n📊 检查 STOCKS 表:');
        const [stocks] = await db.execute('SELECT * FROM stocks LIMIT 10');
        if (stocks.length > 0) {
          console.log(`找到 ${stocks.length} 条记录:`);
          stocks.forEach(stock => {
            console.log(`  ${JSON.stringify(stock)}`);
          });
        }
      }

    } catch (error) {
      console.log('获取表信息时出错:', error.message);
    }

    // 3. 分析计算逻辑
    console.log('\n🧮 第三步：分析计算逻辑');
    console.log('='.repeat(50));

    console.log('\n根据代码分析，Stock value 的计算过程是:');
    console.log('1. 首先检查 assets 表中 asset_type = "Stock" 的记录');
    console.log('2. 然后检查 asset_history 表中的最新 stock_value');
    console.log('3. 如果历史数据的总价值更大，就使用历史数据');

    // 模拟实际的计算逻辑
    let finalStockValue = 0;
    let dataSource = '';

    if (stockAssets.length > 0) {
      const assetsStockTotal = stockAssets.reduce((sum, asset) => sum + parseFloat(asset.value), 0);
      finalStockValue = assetsStockTotal;
      dataSource = 'assets表';
    }

    if (latestHistory.length > 0) {
      const historyStockValue = parseFloat(latestHistory[0].stock_value) || 0;
      const historyTotal = (parseFloat(latestHistory[0].cash_value) || 0) + 
                          (parseFloat(latestHistory[0].stock_value) || 0) + 
                          (parseFloat(latestHistory[0].bond_value) || 0) + 
                          (parseFloat(latestHistory[0].other_value) || 0);
      
      const assetsTotal = stockAssets.reduce((sum, asset) => sum + parseFloat(asset.value), 0) + 12040; // 假设其他资产总值
      
      console.log(`\n📊 数据源比较:`);
      console.log(`  历史数据总价值: $${historyTotal.toFixed(2)}`);
      console.log(`  资产表总价值: $${assetsTotal.toFixed(2)}`);
      
      if (historyTotal > assetsTotal) {
        finalStockValue = historyStockValue;
        dataSource = 'asset_history表';
        console.log(`  ✅ 使用历史数据 (更大的总价值)`);
      } else {
        console.log(`  ✅ 使用资产表数据`);
      }
    }

    console.log(`\n🎯 最终结果:`);
    console.log(`  Stock Value: $${finalStockValue.toFixed(2)}`);
    console.log(`  数据来源: ${dataSource}`);
    console.log(`  这个值将出现在饼图的 "Stock" 部分`);

    // 4. 检查历史数据是如何生成的
    console.log('\n🕐 第四步：检查历史数据生成过程');
    console.log('='.repeat(50));

    console.log('\n查看 asset_history 表的所有记录以了解数据变化:');
    const [allHistory] = await db.execute(`
      SELECT date, stock_value, cash_value, bond_value, other_value 
      FROM asset_history 
      ORDER BY date DESC 
      LIMIT 10
    `);

    if (allHistory.length > 0) {
      console.log('最近的历史记录:');
      allHistory.forEach((record, index) => {
        console.log(`  ${index + 1}. 日期: ${record.date}`);
        console.log(`     股票: $${record.stock_value || 0}`);
        console.log(`     现金: $${record.cash_value || 0}`);
        console.log(`     债券: $${record.bond_value || 0}`);
        console.log(`     其他: $${record.other_value || 0}`);
        console.log('     ---');
      });
    }

    // 5. 验证前端接收的数据格式
    console.log('\n📱 第五步：验证前端数据格式');
    console.log('='.repeat(50));

    const mockPiechartData = {
      name: "Stock",
      value: finalStockValue,
      percentage: 7.53, // 这个是根据总价值计算的
      count: 1
    };

    console.log('\n前端将接收到的 Stock 数据:');
    console.log(JSON.stringify(mockPiechartData, null, 2));

    console.log('\n📊 计算验证:');
    const totalPortfolio = 546101.50; // 从之前的输出中得到
    const calculatedPercentage = (finalStockValue / totalPortfolio) * 100;
    console.log(`  Stock 价值: $${finalStockValue.toFixed(2)}`);
    console.log(`  总投资组合: $${totalPortfolio.toFixed(2)}`);
    console.log(`  计算的百分比: ${calculatedPercentage.toFixed(2)}%`);
    console.log(`  显示的百分比: 7.53%`);
    console.log(`  匹配度: ${Math.abs(calculatedPercentage - 7.53) < 0.01 ? '✅ 完全匹配' : '⚠️ 有差异'}`);

  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    console.error('详细错误:', error);
  } finally {
    if (db) {
      await db.end();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

// 执行追踪
traceStockValueCalculation().then(() => {
  console.log('\n' + '='.repeat(70));
  console.log('🔍 Stock Value 计算追踪完成');
  console.log('='.repeat(70));
}).catch(error => {
  console.error('追踪过程中发生错误:', error);
});
