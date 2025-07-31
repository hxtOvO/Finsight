const axios = require('axios');

// 测试 /api/market/losers 接口
async function testMarketLosersAPI() {
  const baseURL = 'http://localhost:3000';
  
  console.log('🔍 Testing /api/market/losers API...');
  console.log('=' .repeat(50));
  
  try {
    const startTime = Date.now();
    const response = await axios.get(`${baseURL}/api/market/losers`);
    const endTime = Date.now();
    
    console.log('✅ API Response Status:', response.status);
    console.log('⏱️  Response Time:', `${endTime - startTime}ms`);
    console.log('📊 Data Length:', response.data.length);
    console.log('');
    
    if (response.data && response.data.length > 0) {
      console.log('📋 Sample Data Structure:');
      console.log('Keys:', Object.keys(response.data[0]));
      console.log('');
      
      console.log('🔽 Top 10 Losers:');
      console.log('-'.repeat(100));
      console.log('Symbol'.padEnd(10) + 'Name'.padEnd(25) + 'Price'.padEnd(12) + 'Change'.padEnd(12) + 'Change%'.padEnd(12) + 'Volume');
      console.log('-'.repeat(100));
      
      response.data.forEach((stock, index) => {
        const symbol = (stock.symbol || 'N/A').padEnd(10);
        const name = (stock.name || 'N/A').substring(0, 24).padEnd(25);
        const price = (stock.price ? '$' + Number(stock.price).toFixed(2) : 'N/A').padEnd(12);
        const change = (stock.change ? Number(stock.change).toFixed(2) : 'N/A').padEnd(12);
        const changePercent = (stock.changePercent ? Number(stock.changePercent).toFixed(2) + '%' : 'N/A').padEnd(12);
        const volume = stock.volume ? Number(stock.volume).toLocaleString() : 'N/A';
        
        console.log(`${symbol}${name}${price}${change}${changePercent}${volume}`);
      });
      
      console.log('');
      console.log('📄 Full Data (JSON format):');
      console.log(JSON.stringify(response.data, null, 2));
      
    } else {
      console.log('⚠️  No data returned');
    }
    
  } catch (error) {
    console.error('❌ Error testing API:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else if (error.request) {
      console.error('No response received. Is the server running?');
      console.error('Make sure to start the server with: node backend/server.js');
    } else {
      console.error('Error:', error.message);
    }
  }
}

// 同时测试其他两个市场接口进行比较
async function testAllMarketAPIs() {
  const apis = [
    { name: 'Gainers', endpoint: '/api/market/gainers' },
    { name: 'Losers', endpoint: '/api/market/losers' },
    { name: 'Most Active', endpoint: '/api/market/most-active' }
  ];
  
  console.log('🚀 Testing All Market APIs...');
  console.log('=' .repeat(60));
  
  for (const api of apis) {
    console.log(`\n📊 Testing ${api.name} (${api.endpoint}):`);
    console.log('-'.repeat(40));
    
    try {
      const startTime = Date.now();
      const response = await axios.get(`http://localhost:3000${api.endpoint}`);
      const endTime = Date.now();
      
      console.log(`✅ Status: ${response.status} | Time: ${endTime - startTime}ms | Count: ${response.data.length}`);
      
      if (response.data.length > 0) {
        const first = response.data[0];
        console.log(`📈 Top item: ${first.symbol} - ${first.name} | $${first.price} (${first.changePercent}%)`);
      }
      
    } catch (error) {
      console.error(`❌ ${api.name} failed:`, error.response?.status || error.message);
    }
  }
}

// 运行测试
async function main() {
  console.log('🧪 Market API Test Script');
  console.log('⏰ Started at:', new Date().toLocaleString());
  console.log('');
  
  // 先测试单个接口详细信息
  await testMarketLosersAPI();
  
  console.log('\n' + '='.repeat(60));
  
  // 再测试所有接口概览
  await testAllMarketAPIs();
  
  console.log('\n✨ Test completed!');
}

main();
