const axios = require('axios');

// 测试配置
const BASE_URL = 'http://localhost:3000';
const API_ENDPOINT = '/api/recommendation-trend';

async function testTradingRecommendationsAPI() {
  console.log('🧪 Testing Trading Recommendations API Connection...\n');
  
  try {
    // 1. 测试服务器健康状态
    console.log('1️⃣ Testing server health...');
    const healthResponse = await axios.get(`${BASE_URL}/api/health`);
    console.log('✅ Server is running:', healthResponse.data);
    console.log('');

    // 2. 测试获取推荐趋势数据
    console.log('2️⃣ Testing GET /api/recommendation-trend...');
    const startTime = Date.now();
    const recommendationsResponse = await axios.get(`${BASE_URL}${API_ENDPOINT}`);
    const responseTime = Date.now() - startTime;
    
    console.log(`✅ API Response received in ${responseTime}ms`);
    console.log(`📊 Total recommendations: ${recommendationsResponse.data.length}`);
    
    // 3. 分析返回的数据结构
    console.log('\n3️⃣ Analyzing data structure...');
    if (recommendationsResponse.data.length > 0) {
      const sample = recommendationsResponse.data[0];
      console.log('📋 Sample recommendation data:');
      console.log(JSON.stringify(sample, null, 2));
      
      // 检查数据完整性
      console.log('\n🔍 Data integrity check:');
      let validCount = 0;
      let errorCount = 0;
      
      recommendationsResponse.data.forEach((rec, index) => {
        if (rec.recommendation && rec.recommendation.strongBuy !== undefined) {
          validCount++;
        } else {
          errorCount++;
          console.log(`❌ Invalid data for ${rec.symbol}: ${rec.error || 'Missing recommendation data'}`);
        }
      });
      
      console.log(`✅ Valid recommendations: ${validCount}`);
      console.log(`❌ Invalid/Error recommendations: ${errorCount}`);
      
      // 4. 计算加权推荐算法示例
      console.log('\n4️⃣ Testing weighted algorithm calculation...');
      const validRecs = recommendationsResponse.data.filter(rec => 
        rec.recommendation && rec.recommendation.strongBuy !== undefined
      );
      
      if (validRecs.length > 0) {
        console.log('🧮 Sample weighted algorithm calculations:');
        validRecs.slice(0, 3).forEach(rec => {
          const { strongBuy, buy, hold, sell, strongSell } = rec.recommendation;
          const totalAnalysts = strongBuy + buy + hold + sell + strongSell;
          
          if (totalAnalysts > 0) {
            // 计算加权分数 (strongBuy=3, buy=1, hold=0, sell=-1, strongSell=-3)
            const score = (strongBuy * 3 + buy * 1 + hold * 0 + sell * (-1) + strongSell * (-3)) / totalAnalysts;
            
            // 确定推荐行动
            let action = 'HOLD';
            if (score >= 1.5) action = 'STRONG BUY';
            else if (score >= 0.5) action = 'BUY';
            else if (score <= -1.5) action = 'STRONG SELL';
            else if (score <= -0.5) action = 'SELL';
            
            // 计算置信度
            const confidence = Math.min(Math.abs(score) / 3, 1);
            
            console.log(`📈 ${rec.symbol}:`);
            console.log(`   Score: ${score.toFixed(2)} | Action: ${action} | Confidence: ${(confidence * 100).toFixed(0)}%`);
            console.log(`   Breakdown: SB:${strongBuy} B:${buy} H:${hold} S:${sell} SS:${strongSell} (Total: ${totalAnalysts})`);
          }
        });
      }
      
    } else {
      console.log('❌ No recommendation data received');
    }
    
    // 5. 测试添加新股票推荐
    console.log('\n5️⃣ Testing POST /api/recommendation-trend/add...');
    try {
      const addResponse = await axios.post(`${BASE_URL}${API_ENDPOINT}/add`, {
        symbol: 'TSLA'
      });
      console.log('✅ Add new symbol test successful:');
      console.log(JSON.stringify(addResponse.data, null, 2));
    } catch (addError) {
      console.log('❌ Add new symbol test failed:', addError.response?.data || addError.message);
    }
    
    // 6. 前端数据格式检查
    console.log('\n6️⃣ Frontend compatibility check...');
    const frontendReadyData = recommendationsResponse.data.map((rec, index) => {
      if (!rec.recommendation) {
        return {
          symbol: rec.symbol,
          error: rec.error || 'No recommendation data',
          isValid: false
        };
      }
      
      const { strongBuy, buy, hold, sell, strongSell } = rec.recommendation;
      const totalAnalysts = strongBuy + buy + hold + sell + strongSell;
      
      if (totalAnalysts === 0) {
        return {
          symbol: rec.symbol,
          error: 'No analyst data available',
          isValid: false
        };
      }
      
      const score = (strongBuy * 3 + buy * 1 + hold * 0 + sell * (-1) + strongSell * (-3)) / totalAnalysts;
      let action = 'HOLD';
      if (score >= 1.5) action = 'STRONG BUY';
      else if (score >= 0.5) action = 'BUY';
      else if (score <= -1.5) action = 'STRONG SELL';
      else if (score <= -0.5) action = 'SELL';
      
      const confidence = Math.min(Math.abs(score) / 3, 1);
      
      return {
        symbol: rec.symbol,
        action: action,
        score: parseFloat(score.toFixed(2)),
        confidence: parseFloat(confidence.toFixed(2)),
        total_analysts: totalAnalysts,
        breakdown: {
          strongBuy,
          buy,
          hold,
          sell,
          strongSell
        },
        reason: `Our weighted algorithm calculated a score of ${score.toFixed(2)} from ${totalAnalysts} analysts, triggering ${action} signal with ${(confidence * 100).toFixed(0)}% confidence.`,
        isValid: true
      };
    });
    
    const validFrontendData = frontendReadyData.filter(item => item.isValid);
    console.log(`✅ Frontend-ready data count: ${validFrontendData.length}/${frontendReadyData.length}`);
    
    if (validFrontendData.length > 0) {
      console.log('📋 Sample frontend-ready data:');
      console.log(JSON.stringify(validFrontendData[0], null, 2));
    }
    
    console.log('\n🎉 Trading Recommendations API test completed!');
    console.log('\n📝 Summary:');
    console.log(`- Server Status: ✅ Running`);
    console.log(`- API Endpoint: ✅ Accessible`);
    console.log(`- Data Quality: ${validCount}/${recommendationsResponse.data.length} valid`);
    console.log(`- Frontend Ready: ${validFrontendData.length} recommendations`);
    console.log(`- Response Time: ${responseTime}ms`);
    
  } catch (error) {
    console.error('❌ API Test Failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Troubleshooting:');
      console.log('1. Make sure the backend server is running on port 3000');
      console.log('2. Run: cd backend && node server.js');
      console.log('3. Check if MySQL database is connected');
    } else if (error.response) {
      console.log('\n📄 Error Response:', error.response.status, error.response.data);
    }
  }
}

// 运行测试
testTradingRecommendationsAPI();
