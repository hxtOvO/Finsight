// script-api.js - Portfolio dashboard logic with backend integration

// API configuration
const API_BASE = 'http://localhost:3000/api';

// Range configurations
const ranges = {
  '7d': { label: '7 Days', days: 7 },
  '1m': { label: '1 Month', days: 30 },
  '6m': { label: '6 Months', days: 180 }
};

// Global variables
let chart;
let allocationChart;
let currentRange = '7d';
let allocationDataCache = null;
let performanceDataCache = {}; // 缓存性能数据
let isPrivacyMode = true; // 默认开启隐私模式

// Privacy mode functions
function togglePrivacyMode() {
  isPrivacyMode = !isPrivacyMode;
  const privacyToggle = document.getElementById('privacyToggle');
  
  if (isPrivacyMode) {
    // 隐私模式：隐藏敏感信息
    privacyToggle.classList.remove('active');
    privacyToggle.innerHTML = '<span class="privacy-icon">👁️‍🗨️</span>';
    privacyToggle.title = 'Show Financial Data';
  } else {
    // 显示模式：显示所有信息
    privacyToggle.classList.add('active');
    privacyToggle.innerHTML = '<span class="privacy-icon">👁️</span>';
    privacyToggle.title = 'Hide Financial Data';
  }
  
  // 重新更新头部信息和图表以应用隐私设置（保持当前区间）
  const range = typeof currentRange === 'string' ? currentRange : (window.currentRange || '7d');
  updatePortfolioHeader(range);
  updateChart(range);
}

// 清除缓存函数
function clearPerformanceCache() {
  performanceDataCache = {};
  console.log('🗑️ 性能数据缓存已清除');
}

// API functions
async function fetchPortfolioData() {
  try {
    const response = await fetch(`${API_BASE}/portfolio`);
    if (!response.ok) throw new Error('Failed to fetch portfolio data');
    return await response.json();
  } catch (error) {
    console.error('Error fetching portfolio data:', error);
    // Fallback to mock data
    return {
      total_value: 0,
      gain_loss: 0,
      gain_loss_percent: 0
    };
  }
}

async function fetchAssetData() {
  try {
    const response = await fetch(`${API_BASE}/assets`);
    if (!response.ok) throw new Error('Failed to fetch asset data');
    return await response.json();
  } catch (error) {
    console.error('Error fetching asset data:', error);
    return [];
  }
}

async function fetchPerformanceData(range) {
  // 如果已有缓存数据，直接返回
  if (performanceDataCache[range]) {
    console.log(`📦 使用缓存数据 ${range}:`, performanceDataCache[range].length, '个数据点');
    // 更新最后一个数据点为当前总值，但保持历史数据不变
    const portfolioData = await fetchPortfolioData();
    const currentTotal = portfolioData.total_value;
    const cachedData = [...performanceDataCache[range]]; // 复制数组避免修改原缓存
    if (cachedData.length > 0) {
      cachedData[cachedData.length - 1].value = currentTotal;
    }
    return cachedData;
  }

  try {
    console.log(`🌐 API请求 ${range} 数据...`);
    const response = await fetch(`${API_BASE}/performance/${range}`);
    if (!response.ok) throw new Error('Failed to fetch performance data');
    const data = await response.json();
    
    console.log(`📊 API返回 ${range} 数据:`, data.length, '个数据点');
    
    if (data.length === 0) {
      console.log(`🔄 生成fallback数据 ${range}...`);
      // Generate fallback data if no historical data exists
      const fallbackData = await generateFallbackPerformanceData(range);
      performanceDataCache[range] = fallbackData; // 缓存fallback数据
      return fallbackData;
    }
    
    // Ensure the last data point uses current portfolio value
    const portfolioData = await fetchPortfolioData();
    const currentTotal = portfolioData.total_value;
    
    // Update the last data point to current total
    if (data.length > 0) {
      data[data.length - 1].value = currentTotal;
    }
    
    performanceDataCache[range] = data; // 缓存真实数据
    return data;
  } catch (error) {
    console.error('Error fetching performance data:', error);
    console.log(`🔄 API失败，生成fallback数据 ${range}...`);
    const fallbackData = await generateFallbackPerformanceData(range);
    performanceDataCache[range] = fallbackData; // 缓存fallback数据
    return fallbackData;
  }
}

async function updateAssetValue(assetType, change) {
  try {
    const response = await fetch(`${API_BASE}/assets/${assetType}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ change: parseFloat(change) })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update asset');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error updating asset:', error);
    throw error;
  }
}

// Fallback data generation - 使用固定逻辑而非随机数
async function generateFallbackPerformanceData(range) {
  const days = ranges[range].days;
  const data = [];
  
  // 获取当前投资组合总值作为最后一个数据点
  const portfolioData = await fetchPortfolioData();
  const currentTotal = portfolioData.total_value;
  
  // 使用固定的基准值作为起始点
  const baseValues = {
    '7d': 12000,   // 7天前的固定起始值
    '1m': 11500,   // 1个月前的固定起始值  
    '6m': 10000    // 6个月前的固定起始值
  };
  
  const baseValue = baseValues[range] || 12000;
  
  // 计算从起始值到当前值的增长
  const totalGrowth = (currentTotal - baseValue) / baseValue;
  const dailyGrowthRate = Math.pow(1 + totalGrowth, 1 / (days - 1)) - 1;
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    if (i === 0) {
      // 最后一个数据点使用当前总值
      data.push({
        date: date.toISOString().split('T')[0],
        value: currentTotal
      });
    } else {
      // 使用指数增长模式生成历史数据
      const value = baseValue * Math.pow(1 + dailyGrowthRate, days - 1 - i);
      data.push({
        date: date.toISOString().split('T')[0],
        value: Math.round(value * 100) / 100
      });
    }
  }
  
  return data;
}

function getLabelsFromData(data, range) {
    if (range === '6m') {
        return data.map(item => {
            const date = new Date(item.date);
            // 手动构建 UTC 格式的日期字符串
            return `${date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })} ${date.getUTCFullYear()}`;
        });
    } else {
        return data.map(item => {
            const date = new Date(item.date);
            // 手动构建 UTC 格式的日期字符串
            return `${date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })} ${date.getUTCDate()}`;
        });
    }
}

function getValuesFromData(data, range) {
  // 直接返回所有数据，后端已经做了抽样
  return data.map(item => item.value);
}

function formatMoney(val) {
  return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Chart creation functions
async function updateChart(range = '7d') {
  currentRange = range;
  const performanceData = await fetchPerformanceData(range);
  const labels = getLabelsFromData(performanceData, range);
  const values = getValuesFromData(performanceData, range);
    
  // 确保数据长度一致
  if (labels.length !== values.length) {
      console.error('警告：labels 和 values 长度不一致！', labels.length, values.length);
  }

  if (!chart) {
    const ctx = document.getElementById('portfolioChart').getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 320);
    gradient.addColorStop(0, 'rgba(219,0,17,0.32)');
    gradient.addColorStop(0.5, 'rgba(219,0,17,0.12)');
    gradient.addColorStop(1, 'rgba(219,0,17,0.01)');

    chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Selected Asset Value',
                    data: values,
                    borderColor: '#db0011',
                    backgroundColor: gradient,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#db0011',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.38
                }]
            },
            options: {
                responsive: true,
                animation: {
                    duration: 1600,
                    easing: 'easeOutQuart',
                    animateScale: true,
                    animateRotate: true,
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: 'nearest',
                        intersect: false,
                        backgroundColor: '#fff',
                        titleColor: '#db0011',
                        bodyColor: '#222',
                        borderColor: '#db0011',
                        borderWidth: 1,
                        padding: 12,
                        titleFont: { weight: 'bold', size: 16 },
                        bodyFont: { size: 15 },
                        callbacks: {
                            title: function(tooltipItems) {
                                return tooltipItems[0].label;
                            },
                            label: function(context) {
                                return formatMoney(context.parsed.y);
                            }
                        }
                    }
                }
            }
        });
  } else {
    // 隐私模式下所有区间y轴刻度为白色，否则为深色
    chart.options.scales.y.ticks.color = isPrivacyMode ? '#fff' : '#222';
    chart.data.labels = labels;
    chart.data.datasets[0].data = values;
    chart.update();
  }
}

async function updatePortfolioHeader(range = '7d') {
  const portfolioData = await fetchPortfolioData();
  const performanceData = await fetchPerformanceData(range);

  const portfolioValueElement = document.getElementById('portfolioValue');
  const portfolioGainElement = document.getElementById('portfolioGain');
  

  // 根据隐私模式决定显示内容
  if (isPrivacyMode) {
    portfolioValueElement.style.visibility = 'visible';
    portfolioValueElement.textContent = 'Total: ****';
    portfolioValueElement.style.color = '#fff';
    portfolioGainElement.textContent = '+ $**** (+*.**%)';
    portfolioGainElement.style.visibility = 'visible';
    portfolioGainElement.style.color = '#fff';
    portfolioGainElement.style.height = 'auto';
    portfolioGainElement.className = 'portfolio-gain';
  } else {
    portfolioValueElement.style.visibility = 'visible';
    portfolioValueElement.textContent = `Total: ${formatMoney(portfolioData.total_value)}`;
    portfolioValueElement.style.color = '';
    portfolioGainElement.style.visibility = 'visible';
    // 计算基于时间范围的涨跌幅
    let gainLoss = 0;
    let gainLossPercent = 0;
    if (performanceData && performanceData.length >= 2) {
      const currentValue = performanceData[performanceData.length - 1].value;
      const startValue = performanceData[0].value;
      gainLoss = currentValue - startValue;
      gainLossPercent = ((gainLoss / startValue) * 100);
    }
    const isPositive = gainLoss >= 0;
    portfolioGainElement.textContent = `${isPositive ? '+' : '-'} ${formatMoney(Math.abs(gainLoss))} (${isPositive ? '+' : '-'}${Math.abs(gainLossPercent).toFixed(2)}%)`;
    portfolioGainElement.className = `portfolio-gain ${isPositive ? 'positive' : 'negative'}`;
    portfolioGainElement.style.color = '';
  }
}

async function createAllocationChart() {
  if (allocationDataCache) {
    const assetData = allocationDataCache;
    const ctx = document.getElementById('allocationChart').getContext('2d');

    if (allocationChart) {
      allocationChart.destroy();
    }

    const labels = assetData.map(item => item.asset_type);
    const values = assetData.map(item => Number(item.value));
    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b'];

    allocationChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderColor: '#fff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 1,
        layout: {
          padding: {
            top: 40,
            bottom: 40,
            left: 40,
            right: 40
          }
        },
        plugins: {
          legend: {
            display: false // 隐藏默认图例
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.parsed;
                const total = context.dataset.data.reduce((a, b) => Number(a) + Number(b), 0);
                const percentage = Math.round((value / total) * 100);
                return `${label}: ${formatMoney(value)} (${percentage}%)`;
              }
            }
          },
          // 自定义标签插件
          datalabels: false // 如果使用了 chartjs-plugin-datalabels，先禁用
        },
        elements: {
          arc: {
            // 添加引线样式配置
            borderAlign: 'center'
          }
        }
      },
      plugins: [{
        id: 'customLabels',
        afterDraw: function(chart) {
          const ctx = chart.ctx;
          const chartArea = chart.chartArea;
          const centerX = (chartArea.left + chartArea.right) / 2;
          const centerY = (chartArea.top + chartArea.bottom) / 2;

          chart.data.datasets.forEach((dataset, datasetIndex) => {
            const meta = chart.getDatasetMeta(datasetIndex);
            const total = dataset.data.reduce((a, b) => a + b, 0);

            meta.data.forEach((arc, index) => {
              const angle = (arc.startAngle + arc.endAngle) / 2;
              const radius = arc.outerRadius;
              const labelRadius = radius + 25; // 减少标签距离

              // 计算百分比
              const value = dataset.data[index];
              const percentage = Math.round((value / total) * 100);

              // 在饼图扇形上显示百分比（如果扇形足够大）
              if (percentage >= 5) { // 只有大于等于30%才显示
                const percentageRadius = radius * 0.7; // 百分比显示在扇形的70%位置
                const percentageX = centerX + Math.cos(angle) * percentageRadius;
                const percentageY = centerY + Math.sin(angle) * percentageRadius;

                ctx.save();
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 14px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`${percentage}%`, percentageX, percentageY);
                ctx.restore();
              }

              // 计算标签位置
              const labelX = centerX + Math.cos(angle) * labelRadius;
              const labelY = centerY + Math.sin(angle) * labelRadius;

              // 绘制标签（不绘制引线）
              const label = chart.data.labels[index];

              ctx.save();
              ctx.fillStyle = '#222';
              ctx.font = 'bold 12px Arial';
              ctx.textAlign = 'center'; // 居中对齐，更简洁
              ctx.textBaseline = 'middle';

              // 绘制资产类型标签
              ctx.fillText(label, labelX, labelY - 6);

              // 绘制金额
              ctx.font = '11px Arial';
              ctx.fillStyle = '#666';
              ctx.fillText(`${formatMoney(value)}`, labelX, labelY + 6);

              ctx.restore();
            });
          });
        }
      }]
    });
  }
}

// Navigation functions
function showPerformanceSection() {
  document.getElementById('allocationSection').style.display = 'none';
  document.getElementById('portfolioChart').style.display = 'block';
  
  // Show/hide range toggle and gain/loss
  document.querySelector('.range-toggle').style.visibility = 'visible';
  document.getElementById('portfolioGain').style.visibility = 'visible';
  
  // Update nav buttons
  document.querySelector('.nav-performance').classList.add('active');
  document.querySelector('.nav-allocation').classList.remove('active');
  
  // 强制重置到7天，确保状态一致
  currentRange = '7d';
  
  // 重置所有按钮状态
  document.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector('[data-range="7d"]').classList.add('active');
  
  console.log('📊 强制重置到7天视图，确保状态一致');
  
  updateChart(currentRange);
  updatePortfolioHeader(currentRange);
}

async function showAllocationSection() {
  document.getElementById('portfolioChart').style.display = 'none';
  document.getElementById('allocationSection').style.display = 'block';
  
  // Hide range toggle and gain/loss
  document.querySelector('.range-toggle').style.visibility = 'hidden';
  document.getElementById('portfolioGain').style.visibility = 'hidden';
  
  // Update nav buttons
  document.querySelector('.nav-allocation').classList.add('active');
  document.querySelector('.nav-performance').classList.remove('active');
  
  // Load allocation data if not cached
  if (!allocationDataCache) {
    allocationDataCache = await fetchAssetData();
  }
  
  createAllocationChart();
}

// Event listeners
document.addEventListener('DOMContentLoaded', async function() {
  // 初始化隐私模式为开启状态
  isPrivacyMode = true;
  
  // 添加隐私切换按钮事件监听器
  const privacyToggle = document.getElementById('privacyToggle');
  if (privacyToggle) {
    privacyToggle.addEventListener('click', togglePrivacyMode);
  }
  
  // 清除缓存确保获取新数据
  clearPerformanceCache();
  
  // Initialize portfolio header with 7d range
  await updatePortfolioHeader('7d');
  
  // Initialize chart with 7d data
  await updateChart('7d');
  
  // Range toggle buttons
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', async function() {
      document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      const range = this.getAttribute('data-range');
      await updateChart(range);
      await updatePortfolioHeader(range); // 同时更新头部信息
    });
  });
  
  // Navigation buttons
  document.querySelector('.nav-performance').addEventListener('click', showPerformanceSection);
  document.querySelector('.nav-allocation').addEventListener('click', showAllocationSection);
  
  // Asset allocation form
  document.getElementById('allocationForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const selectedAsset = document.querySelector('input[name="assetType"]:checked').value;
    const changeValue = document.getElementById('assetChange').value;
    
    if (!changeValue) {
      alert('Please enter a change amount');
      return;
    }
    
    try {
      const result = await updateAssetValue(selectedAsset, changeValue);
      
      // Update cached allocation data
      allocationDataCache = await fetchAssetData();
      
      // Clear performance data cache to force refresh
      performanceDataCache = {};
      console.log('🗑️ 清除performance缓存，强制重新获取数据');
      
      // Update portfolio header
      await updatePortfolioHeader();
      
      // Recreate allocation chart
      await createAllocationChart();
      
      // Update performance chart with new data point
      await updateChart(currentRange);
      
      // Clear form
      document.getElementById('assetChange').value = '';
      
      alert(`${selectedAsset} updated successfully! New total: ${formatMoney(result.totalPortfolio)}`);
    } catch (error) {
      alert(`Error updating ${selectedAsset}: ${error.message}`);
    }
  });
});

let selectedAssetChart;

async function fetchSelectedAssetData(range) {
    try {
        const response = await fetch(`/api/selected-asset/${range}`);
        if (!response.ok) {
            throw new Error('Failed to fetch selected asset data');
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching selected asset data:', error);
        return [];
    }
}

// 在页面加载时初始化 selectedAssetChart
document.addEventListener('DOMContentLoaded', function() {
    // 初始化 selectedAssetChart
    updateSelectedAssetChart('7d');

    // 为左下角的切换按钮添加事件监听器
    document.querySelectorAll('.range-toggle button[data-chart="selectedAsset"]').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.range-toggle button[data-chart="selectedAsset"]').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const range = this.dataset.range;
            updateSelectedAssetChart(range);
        });
    });
});

// 新增函数，用于获取数据并更新 selectedAssetChart
async function updateSelectedAssetChart(range = '7d') {
    const performanceData = await fetchPerformanceData(range);
    const labels = getLabelsFromData(performanceData, range);
    const values = getValuesFromData(performanceData, range);

    // 添加日志，检查处理后的数据
    console.log('处理后的 selectedAssetChart labels:', labels);
    console.log('处理后的 selectedAssetChart values:', values);

    // 确保数据长度一致
    if (labels.length !== values.length) {
        console.error('警告：selectedAssetChart 的 labels 和 values 长度不一致！', labels.length, values.length);
    }

    if (!selectedAssetChart) {
        const ctx = document.getElementById('selectedAssetChart').getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 320);
        // 修改颜色停止点为新的颜色
        gradient.addColorStop(0, 'rgba(252, 125, 51, 0.9)'); 
        gradient.addColorStop(0.5, 'rgba(255, 112, 29, 0.12)');
        gradient.addColorStop(1, 'rgba(255, 112, 29, 0.01)');

        selectedAssetChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Selected Asset Value',
                    data: values,
                    borderColor: '#ff701dff',
                    backgroundColor: gradient,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#ff701dff',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.38
                }]
            },
            options: {
                responsive: true,
                animation: {
                    duration: 0,
                    easing: 'easeOutQuart',
                    animateScale: true,
                    animateRotate: true,
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: 'nearest',
                        intersect: false,
                        backgroundColor: '#fff',
                        titleColor: '#ff701dff',
                        bodyColor: '#222',
                        borderColor: '#ff701dff',
                        borderWidth: 1,
                        padding: 12,
                        titleFont: { weight: 'bold', size: 16 },
                        bodyFont: { size: 15 },
                        callbacks: {
                            title: function(tooltipItems) {
                                return tooltipItems[0].label;
                            },
                            label: function(context) {
                                return formatMoney(context.parsed.y);
                            }
                        }
                    }
                }
            }
        });
    } else {
        selectedAssetChart.data.labels = labels;
        selectedAssetChart.data.datasets[0].data = values;
        selectedAssetChart.update();
    }
}

async function fetchSelectedAssetPerformanceData(assetType, range) {
  try {
    //let assetType = 'stock';
    //let range = '1m';
    console.log(`🌐 API请求 ${assetType} 资产 ${range} 数据...`);
    const response = await fetch(`api/assets/${assetType}/performance/${range}`);
    if (!response.ok) throw new Error('Failed to fetch selected asset performance data');
    const data = await response.json();
    
    console.log(`📊 API返回 ${assetType} 资产 ${range} 数据:`, data.length, '个数据点');
    
    return data;
  } catch (error) {
    console.error('Error fetching selected asset performance data:', error);
    // 可以添加生成 fallback 数据的逻辑
    return [];
  }
}

async function updateSelectedAssetChart(assetType, range = '7d') {
  const performanceData = await fetchSelectedAssetPerformanceData(assetType, range);
  const labels = getLabelsFromData(performanceData, range);
  const values = getValuesFromData(performanceData, range);
    
  // 确保数据长度一致
  if (labels.length !== values.length) {
      console.error('警告：labels 和 values 长度不一致！', labels.length, values.length);
  }

  if (!selectedAssetChart) {
    const ctx = document.getElementById('selectedAssetChart').getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 320);
    // 修改颜色停止点为新的颜色
    gradient.addColorStop(0, 'rgba(252, 125, 51, 0.32)'); 
    gradient.addColorStop(0.5, 'rgba(255, 112, 29, 0.12)');
    gradient.addColorStop(1, 'rgba(255, 112, 29, 0.01)');

    selectedAssetChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: `${assetType} Asset Value`,
          data: values,
          borderColor: '#ff701dff',
          backgroundColor: gradient,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointBackgroundColor: '#fff',
          pointBorderColor: '#ff701dff',
          borderWidth: 2,
          fill: true,
          tension: 0.38
        }]
      },
      options: {
        responsive: true,
        animation: {
          duration: 1600,
          easing: 'easeOutQuart',
          animateScale: false,
          animateRotate: false,
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'nearest',
            intersect: false,
            backgroundColor: '#fff',
            titleColor: '#ff701dff',
            bodyColor: '#222',
            borderColor: '#ff701dff',
            borderWidth: 1,
            padding: 12,
            titleFont: { weight: 'bold', size: 16 },
            bodyFont: { size: 15 },
            callbacks: {
              title: function(tooltipItems) {
                return tooltipItems[0].label;
              },
              label: function(context) {
                return formatMoney(context.parsed.y);
              }
            }
          }
        }
      }
    });
  } else {
    selectedAssetChart.data.labels = labels;
    selectedAssetChart.data.datasets[0].data = values;
    selectedAssetChart.update();
  }
}