const fetch = require('node-fetch');

async function testNewAPI() {
  try {
    console.log('🧪 测试新的API数据密度...\n');
    
    // 先启动服务器（如果还没启动）
    const { spawn } = require('child_process');
    const server = spawn('node', ['server.js'], { 
      stdio: 'pipe',
      detached: false
    });
    
    // 等待服务器启动
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 测试各个端点
    const endpoints = ['7d', '1m', '6m'];
    
    for (const range of endpoints) {
      try {
        const response = await fetch(`http://localhost:3000/api/performance/${range}`);
        const data = await response.json();
        
        console.log(`📊 ${range.toUpperCase()} 数据:`);
        console.log(`   数据点数量: ${data.length}`);
        
        if (data.length > 0) {
          console.log(`   时间范围: ${data[0].date} 到 ${data[data.length-1].date}`);
          console.log(`   价值范围: $${data[0].value} 到 $${data[data.length-1].value}`);
        }
        console.log('');
        
      } catch (error) {
        console.log(`❌ ${range} 请求失败:`, error.message);
      }
    }
    
    // 关闭服务器
    server.kill();
    console.log('✅ 测试完成！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

testNewAPI();
