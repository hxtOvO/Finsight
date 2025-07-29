const axios = require('axios');

// 测试recommendation-trend API接口
async function testRecommendationAPI() {
  const BASE_URL = 'http://localhost:3000';
  
  console.log('🧪 开始测试 Recommendation Trend API 接口...\n');

  try {
    // 1. 测试 GET /api/recommendation-trend - 获取所有推荐趋势
    console.log('📊 测试 GET /api/recommendation-trend');
    console.log('=' * 50);
    
    const getResponse = await axios.get(`${BASE_URL}/api/recommendation-trend`);
    console.log('✅ GET 请求成功!');
    console.log('📈 返回数据结构:');
    console.log('数据数量:', getResponse.data.length);
    
    // 显示前3个结果的详细信息
    if (getResponse.data.length > 0) {
      console.log('\n🔍 前3个股票的推荐数据示例:');
      getResponse.data.slice(0, 3).forEach((item, index) => {
        console.log(`\n${index + 1}. ${item.symbol}:`);
        if (item.recommendation) {
          console.log('   📊 推荐数据存在:');
          console.log('   - strongBuy:', item.recommendation.strongBuy || 0);
          console.log('   - buy:', item.recommendation.buy || 0);
          console.log('   - hold:', item.recommendation.hold || 0);
          console.log('   - sell:', item.recommendation.sell || 0);
          console.log('   - strongSell:', item.recommendation.strongSell || 0);
          console.log('   - period:', item.recommendation.period || 'N/A');
        } else {
          console.log('   ❌ 推荐数据为空');
          if (item.error) {
            console.log('   🚨 错误信息:', item.error);
          }
        }
      });
    }
    
    console.log('\n' + '=' * 60);

    // 2. 测试 POST /api/recommendation-trend/add - 添加新股票
    console.log('\n📝 测试 POST /api/recommendation-trend/add');
    console.log('=' * 50);
    
    const testSymbol = 'AAPL'; // 测试添加苹果股票
    console.log(`🎯 添加股票: ${testSymbol}`);
    
    const postResponse = await axios.post(`${BASE_URL}/api/recommendation-trend/add`, {
      symbol: testSymbol
    });
    
    console.log('✅ POST 请求成功!');
    console.log('📊 返回的单个股票数据:');
    console.log('股票代码:', postResponse.data.symbol);
    
    if (postResponse.data.recommendation) {
      console.log('✅ 推荐数据获取成功:');
      const rec = postResponse.data.recommendation;
      console.log(`   - 强力买入 (strongBuy): ${rec.strongBuy || 0}`);
      console.log(`   - 买入 (buy): ${rec.buy || 0}`);
      console.log(`   - 持有 (hold): ${rec.hold || 0}`);
      console.log(`   - 卖出 (sell): ${rec.sell || 0}`);
      console.log(`   - 强力卖出 (strongSell): ${rec.strongSell || 0}`);
      console.log(`   - 周期 (period): ${rec.period || 'N/A'}`);
      
      // 计算总推荐数和各类型占比
      const total = (rec.strongBuy || 0) + (rec.buy || 0) + (rec.hold || 0) + (rec.sell || 0) + (rec.strongSell || 0);
      if (total > 0) {
        console.log(`\n📈 推荐分析 (总数: ${total}):`);
        console.log(`   - 强力买入: ${((rec.strongBuy || 0) / total * 100).toFixed(1)}%`);
        console.log(`   - 买入: ${((rec.buy || 0) / total * 100).toFixed(1)}%`);
        console.log(`   - 持有: ${((rec.hold || 0) / total * 100).toFixed(1)}%`);
        console.log(`   - 卖出: ${((rec.sell || 0) / total * 100).toFixed(1)}%`);
        console.log(`   - 强力卖出: ${((rec.strongSell || 0) / total * 100).toFixed(1)}%`);
      }
    } else {
      console.log('❌ 推荐数据为空');
      if (postResponse.data.error) {
        console.log('🚨 错误信息:', postResponse.data.error);
      }
    }

  } catch (error) {
    console.error('❌ API 测试失败:');
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('错误信息:', error.response.data);
    } else if (error.request) {
      console.error('🔌 无法连接到服务器，请确保后端服务正在运行 (npm start)');
    } else {
      console.error('请求配置错误:', error.message);
    }
  }
}

// 测试 Portfolio API
async function testPortfolioAPI() {
  const BASE_URL = 'http://localhost:3000';
  
  console.log('\n\n💼 测试 Portfolio API 接口...');
  console.log('=' * 50);

  try {
    const response = await axios.get(`${BASE_URL}/api/portfolio`);
    console.log('✅ Portfolio API 请求成功!');
    console.log('💰 投资组合数据:');
    console.log(`   - 总价值: $${response.data.total_value?.toLocaleString() || 'N/A'}`);
    console.log(`   - 盈亏金额: $${response.data.gain_loss?.toLocaleString() || 'N/A'}`);
    console.log(`   - 盈亏百分比: ${response.data.gain_loss_percent?.toFixed(2) || 'N/A'}%`);
    
    // 判断盈亏状态
    if (response.data.gain_loss > 0) {
      console.log('📈 投资状态: 盈利');
    } else if (response.data.gain_loss < 0) {
      console.log('📉 投资状态: 亏损');
    } else {
      console.log('➖ 投资状态: 持平');
    }

  } catch (error) {
    console.error('❌ Portfolio API 测试失败:');
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('错误信息:', error.response.data);
    } else {
      console.error('🔌 连接错误:', error.message);
    }
  }
}

// 主测试函数
async function runTests() {
  console.log('🚀 FinSight API 测试脚本启动');
  console.log('时间:', new Date().toLocaleString());
  console.log('目标服务器: http://localhost:3000');
  console.log('\n');

  // 测试recommendation API
  await testRecommendationAPI();
  
  // 测试portfolio API
  await testPortfolioAPI();

  console.log('\n✨ 测试完成!');
  console.log('=' * 60);
}

// 运行测试
runTests().catch(console.error);
