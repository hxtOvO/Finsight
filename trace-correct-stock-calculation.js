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

console.log('🔍 正确的 Stock Value 计算逻辑追踪');
console.log('📊 current_assets (持股数量) × featured_stocks (股价) = 总价值');
console.log('='.repeat(80));

async function traceCorrectStockCalculation() {
  let db;
  
  try {
    // 连接数据库
    console.log('\n🔌 连接数据库...');
    db = await mysql.createConnection(dbConfig);
    console.log('✅ 连接成功');

    // 1. 检查表结构
    console.log('\n📋 第一步：检查相关表结构');
    console.log('='.repeat(60));

    // 检查 current_assets 表结构
    console.log('\n🏦 CURRENT_ASSETS 表结构:');
    const [currentAssetsStructure] = await db.execute('DESCRIBE current_assets');
    currentAssetsStructure.forEach(column => {
      console.log(`  ${column.Field.padEnd(20)} | ${column.Type.padEnd(15)} | ${column.Null} | ${column.Key} | ${column.Default || 'NULL'}`);
    });

    // 检查 featured_stocks 表结构
    console.log('\n📊 FEATURED_STOCKS 表结构:');
    const [featuredStocksStructure] = await db.execute('DESCRIBE featured_stocks');
    featuredStocksStructure.forEach(column => {
      console.log(`  ${column.Field.padEnd(20)} | ${column.Type.padEnd(15)} | ${column.Null} | ${column.Key} | ${column.Default || 'NULL'}`);
    });

    // 2. 获取原始数据
    console.log('\n📊 第二步：获取原始数据');
    console.log('='.repeat(60));

    // 获取所有持股数据
    console.log('\n🏦 CURRENT_ASSETS 表中的所有数据:');
    const [currentAssets] = await db.execute('SELECT * FROM current_assets ORDER BY id');
    console.log(`找到 ${currentAssets.length} 条持股记录:`);
    
    let totalStockAssets = 0;
    currentAssets.forEach(asset => {
      console.log(`  ID: ${asset.id}`);
      console.log(`  符号: ${asset.symbol || 'N/A'}`);
      console.log(`  类型: ${asset.type || 'N/A'}`);
      console.log(`  数量: ${asset.amount || 'N/A'} ${asset.type === 'stock' ? '股' : ''}`);
      console.log('  ---');
      
      // 统计股票类型的资产
      const assetType = asset.type || '';
      if (assetType.toLowerCase().includes('stock') || assetType === 'stock') {
        totalStockAssets++;
      }
    });
    
    console.log(`📈 股票类型资产数量: ${totalStockAssets}`);

    // 获取股价数据
    console.log('\n📊 FEATURED_STOCKS 表中的所有数据:');
    const [featuredStocks] = await db.execute('SELECT * FROM featured_stocks ORDER BY symbol');
    console.log(`找到 ${featuredStocks.length} 条股价记录:`);
    
    featuredStocks.forEach(stock => {
      console.log(`  符号: ${stock.symbol}`);
      console.log(`  价格: $${stock.price}`);
      console.log(`  涨跌幅: ${stock.change_percent || 'N/A'}%`);
      console.log(`  更新时间: ${stock.updated_at}`);
      console.log('  ---');
    });

    // 3. 执行正确的计算逻辑
    console.log('\n🧮 第三步：执行正确的计算逻辑');
    console.log('='.repeat(60));

    let totalStockValue = 0;
    const stockCalculations = [];
    
    console.log('\n💰 逐一计算每支股票的价值:');
    console.log('持股数量 × 当前股价 = 股票价值\n');

    // 筛选出股票类型的资产
    const stockAssets = currentAssets.filter(asset => {
      const assetType = asset.type || '';
      return assetType.toLowerCase() === 'stock';
    });

    console.log(`🔍 找到 ${stockAssets.length} 条股票持仓记录:`);

    for (const asset of stockAssets) {
      const symbol = asset.symbol;
      const quantity = parseFloat(asset.amount || 0);
      
      console.log(`\n📊 处理股票: ${symbol}`);
      console.log(`  持有数量: ${quantity} 股`);
      
      // 在 featured_stocks 表中查找对应的股价
      const matchingStock = featuredStocks.find(stock => stock.symbol === symbol);
      
      if (matchingStock) {
        const price = parseFloat(matchingStock.price || 0);
        const stockValue = quantity * price;
        
        console.log(`  当前股价: $${price}`);
        console.log(`  计算: ${quantity} × $${price} = $${stockValue.toFixed(2)}`);
        
        totalStockValue += stockValue;
        stockCalculations.push({
          symbol,
          quantity,
          price,
          value: stockValue
        });
      } else {
        console.log(`  ❌ 在 featured_stocks 表中未找到 ${symbol} 的股价信息`);
        stockCalculations.push({
          symbol,
          quantity,
          price: 0,
          value: 0,
          error: 'Price not found'
        });
      }
    }

    // 4. 显示计算结果
    console.log('\n📊 第四步：计算结果汇总');
    console.log('='.repeat(60));

    console.log('\n💼 所有股票计算详情:');
    stockCalculations.forEach(calc => {
      if (calc.error) {
        console.log(`  ${calc.symbol}: ${calc.quantity} 股 × $0.00 = $0.00 (${calc.error})`);
      } else {
        console.log(`  ${calc.symbol}: ${calc.quantity} 股 × $${calc.price.toFixed(2)} = $${calc.value.toFixed(2)}`);
      }
    });

    console.log(`\n🎯 股票投资组合总价值: $${totalStockValue.toFixed(2)}`);

    // 5. 对比之前看到的值
    console.log('\n🔄 第五步：与之前的数据对比');
    console.log('='.repeat(60));

    console.log(`📊 计算结果对比:`);
    console.log(`  通过 current_assets × featured_stocks 计算: $${totalStockValue.toFixed(2)}`);
    console.log(`  之前从 asset_history 看到的值: $41,101.50`);
    
    const difference = Math.abs(totalStockValue - 41101.50);
    console.log(`  差异: $${difference.toFixed(2)}`);
    
    if (difference < 0.01) {
      console.log(`  ✅ 数值匹配！这证实了计算逻辑是正确的`);
    } else if (totalStockValue === 0) {
      console.log(`  ⚠️  计算结果为0，可能的原因:`);
      console.log(`     1. current_assets 表中没有股票类型的记录`);
      console.log(`     2. 股票符号在两个表中不匹配`);
      console.log(`     3. featured_stocks 表中缺少股价数据`);
    } else {
      console.log(`  ⚠️  数值不匹配，需要进一步检查数据一致性`);
    }

    // 6. 检查数据一致性问题
    console.log('\n🔍 第六步：数据一致性检查');
    console.log('='.repeat(60));

    // 检查是否存在符号不匹配的问题
    const currentSymbols = stockAssets.map(asset => asset.symbol).filter(Boolean);
    const featuredSymbols = featuredStocks.map(stock => stock.symbol);
    
    console.log(`\n📊 符号匹配检查:`);
    console.log(`  current_assets 中的股票符号: [${currentSymbols.join(', ')}]`);
    console.log(`  featured_stocks 中的符号: [${featuredSymbols.join(', ')}]`);
    
    const unmatchedInCurrent = currentSymbols.filter(symbol => !featuredSymbols.includes(symbol));
    const unmatchedInFeatured = featuredSymbols.filter(symbol => !currentSymbols.includes(symbol));
    
    if (unmatchedInCurrent.length > 0) {
      console.log(`  ❌ current_assets 中有但 featured_stocks 中没有: [${unmatchedInCurrent.join(', ')}]`);
    }
    if (unmatchedInFeatured.length > 0) {
      console.log(`  ⚠️  featured_stocks 中有但 current_assets 中没有: [${unmatchedInFeatured.join(', ')}]`);
    }
    if (unmatchedInCurrent.length === 0 && unmatchedInFeatured.length === 0) {
      console.log(`  ✅ 所有符号都能正确匹配`);
    }

    // 7. 生成前端数据格式
    console.log('\n📱 第七步：生成前端数据格式');
    console.log('='.repeat(60));

    const frontendStockData = {
      name: "Stock",
      value: parseFloat(totalStockValue.toFixed(2)),
      percentage: 0, // 这个需要在获取所有资产类型后计算
      count: stockCalculations.filter(calc => !calc.error).length,
      details: stockCalculations
    };

    console.log('\n📊 前端将接收到的 Stock 数据结构:');
    console.log(JSON.stringify(frontendStockData, null, 2));

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
traceCorrectStockCalculation().then(() => {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 正确的 Stock Value 计算逻辑追踪完成');
  console.log('='.repeat(80));
}).catch(error => {
  console.error('追踪过程中发生错误:', error);
});
