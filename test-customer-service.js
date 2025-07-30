// 测试人工客服API调用
const axios = require('axios');

async function testCustomerServiceAPI() {
    console.log('=== 测试人工客服API调用 ===');
    
    try {
        console.log('发送测试消息到 http://localhost:3000/api/chat');
        
        const response = await axios.post('http://localhost:3000/api/chat', {
            message: '你好，这是人工客服测试消息'
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('API响应状态:', response.status);
        console.log('API响应数据:', JSON.stringify(response.data, null, 2));
        
        if (response.data.success) {
            console.log('✅ API调用成功！');
            console.log('Qwen回复:', response.data.response);
        } else {
            console.log('❌ API调用失败:', response.data);
        }
        
    } catch (error) {
        console.error('❌ 请求失败:', error.message);
        if (error.response) {
            console.error('错误状态:', error.response.status);
            console.error('错误数据:', error.response.data);
        }
    }
}

// 运行测试
testCustomerServiceAPI();
