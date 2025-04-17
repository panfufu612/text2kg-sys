// 知识图谱统计数据处理
// 注意：此文件依赖 Chart.js，请确保在使用此文件前引入 Chart.js
// <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

document.addEventListener('DOMContentLoaded', () => {
    // 检查是否已加载 Chart.js
    if (typeof Chart === 'undefined') {
        console.error('Chart.js 未加载，统计图表将无法显示');
        showErrorMessage('无法加载统计图表: Chart.js 库未加载');
        return;
    }

    // 加载数据
    loadGraphStats();
    loadNodeTypes();
    loadRelationTypes();
});

/**
 * 加载图谱统计数据
 */
function loadGraphStats() {
    fetchData('/api/stats', data => {
        // 更新数量统计
        updateStatValues(data);
        
        // 创建节点类型分布图表
        createNodeTypeChart(data.node_types);
        
        // 创建关系类型分布图表
        createRelationTypeChart(data.relation_types);
    });
}

/**
 * 更新统计数字
 */
function updateStatValues(data) {
    // 添加错误检查和日志
    if (!data) {
        console.error('获取统计数据失败：数据为空');
        return;
    }
    console.log('统计数据:', data);
    
    // 更明确地设置节点计数
    const nodeCount = data.node_count !== undefined ? data.node_count : 
                      (data.nodeCount !== undefined ? data.nodeCount : 0);
    
    // 更明确地设置关系计数
    const relationCount = data.relation_count !== undefined ? data.relation_count : 
                         (data.relationCount !== undefined ? data.relationCount : 0);
    
    const nodeCountEl = document.getElementById('node-count');
    if (nodeCountEl) {
        nodeCountEl.textContent = nodeCount.toLocaleString();
    } else {
        console.warn('未找到node-count元素');
    }
    
    const relationCountEl = document.getElementById('relation-count');
    if (relationCountEl) {
        relationCountEl.textContent = relationCount.toLocaleString();
    } else {
        console.warn('未找到relation-count元素');
    }
    
    const nodeTypesCountEl = document.getElementById('node-types-count');
    if (nodeTypesCountEl) {
        const nodeTypesCount = data.node_types ? data.node_types.length : 
            (data.nodeTypeCount !== undefined ? data.nodeTypeCount : 0);
        nodeTypesCountEl.textContent = nodeTypesCount.toLocaleString();
    } else {
        console.warn('未找到node-types-count元素');
    }
    
    const relationTypesCountEl = document.getElementById('relation-types-count');
    if (relationTypesCountEl) {
        const relationTypesCount = data.relation_types ? data.relation_types.length : 
            (data.relationTypeCount !== undefined ? data.relationTypeCount : 0);
        relationTypesCountEl.textContent = relationTypesCount.toLocaleString();
    } else {
        console.warn('未找到relation-types-count元素');
    }
}

/**
 * 创建节点类型分布图表
 */
function createNodeTypeChart(nodeTypes) {
    const chartContainer = document.getElementById('node-types-chart');
    if (!chartContainer) return;
    
    // 数据验证
    if (!nodeTypes || !Array.isArray(nodeTypes) || nodeTypes.length === 0) {
        console.warn('节点类型数据无效或为空');
        showEmptyChart(chartContainer, '暂无节点类型数据');
        return;
    }
    
    // 准备图表数据
    const labels = nodeTypes.map(item => item.type);
    const counts = nodeTypes.map(item => item.count);
    
    // 创建图表
    new Chart(chartContainer, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: counts,
                backgroundColor: getNodeTypeColors(labels),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        font: { size: 12 },
                        boxWidth: 15
                    }
                },
                title: {
                    display: true,
                    text: '节点类型分布',
                    font: { size: 16 }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

/**
 * 创建关系类型分布图表
 */
function createRelationTypeChart(relationTypes) {
    const chartContainer = document.getElementById('relation-types-chart');
    if (!chartContainer) return;
    
    // 数据验证
    if (!relationTypes || !Array.isArray(relationTypes) || relationTypes.length === 0) {
        console.warn('关系类型数据无效或为空');
        showEmptyChart(chartContainer, '暂无关系类型数据');
        return;
    }
    
    // 截取前10种关系类型
    const topRelations = relationTypes.slice(0, 10);
    
    // 准备图表数据
    const labels = topRelations.map(item => item.type);
    const counts = topRelations.map(item => item.count);
    
    // 创建图表
    new Chart(chartContainer, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '关系数量',
                data: counts,
                backgroundColor: 'rgba(54, 162, 235, 0.7)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true } },
            plugins: {
                title: {
                    display: true,
                    text: '常见关系类型分布 (Top 10)',
                    font: { size: 16 }
                },
                legend: { display: false }
            }
        }
    });
}

/**
 * 显示空图表提示
 */
function showEmptyChart(container, message) {
    // 创建空图表
    new Chart(container, {
        type: 'bar',
        data: {
            labels: ['暂无数据'],
            datasets: [{
                data: [0],
                backgroundColor: '#e9ecef'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: message,
                    font: { size: 16 }
                }
            },
            scales: {
                y: { display: false },
                x: { ticks: { color: '#6c757d' } }
            }
        }
    });
}

/**
 * 加载节点类型数据
 */
function loadNodeTypes() {
    fetchData('/api/node_types', data => {
        const nodeTypesContainer = document.getElementById('node-types-list');
        if (!nodeTypesContainer) return;
        
        // 清空容器
        nodeTypesContainer.innerHTML = '';
        
        // 添加节点类型列表
        data.types.forEach(type => {
            const color = getNodeTypeColor(type);
            
            const typeItem = document.createElement('div');
            typeItem.className = 'badge me-2 mb-2';
            typeItem.style.backgroundColor = color;
            typeItem.textContent = type;
            
            nodeTypesContainer.appendChild(typeItem);
        });
    });
}

/**
 * 加载关系类型数据
 */
function loadRelationTypes() {
    fetchData('/api/relation-types', data => {
        const relationTypesContainer = document.getElementById('relation-types-list');
        if (!relationTypesContainer) return;
        
        // 清空容器
        relationTypesContainer.innerHTML = '';
        
        // 添加关系类型列表
        const types = Array.isArray(data) ? data : (data.types || []);
        
        types.forEach(type => {
            const typeItem = document.createElement('div');
            typeItem.className = 'badge bg-secondary me-2 mb-2';
            typeItem.textContent = type;
            
            relationTypesContainer.appendChild(typeItem);
        });
    });
}

/**
 * 获取节点类型颜色
 */
function getNodeTypeColor(type) {
    // 节点类型颜色映射 - 与 graph.js 保持一致
    const colors = {
        'Professor': '#e41a1c',
        'Research': '#4daf4a',
        'ResearchField': '#2ecc71',
        'Publication': '#377eb8',
        'Paper': '#f1c40f',
        'Work': '#3498db',
        'Institution': '#9b59b6',
        'Topic': '#ff7f00',
        'Conference': '#984ea3',
        'Journal': '#a65628',
        'default': '#999999'
    };
    
    return colors[type] || colors.default;
}

/**
 * 获取节点类型颜色数组
 */
function getNodeTypeColors(types) {
    return types.map(type => getNodeTypeColor(type));
}

/**
 * 通用数据获取函数，包含重试逻辑
 */
function fetchData(url, callback) {
    const maxRetries = 3;
    let retryCount = 0;
    const retryDelay = 1000; // 1秒
    
    function doFetch() {
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    if (response.status === 500 && retryCount < maxRetries) {
                        retryCount++;
                        console.warn(`服务器响应错误，正在重试 (${retryCount}/${maxRetries})...`);
                        setTimeout(doFetch, retryDelay);
                        return null;
                    }
                    throw new Error(`服务器响应错误: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (!data) return; // 重试请求，直接返回
                callback(data);
            })
            .catch(error => {
                console.error(`获取数据失败 (${url}):`, error);
                
                if (error.message.includes('Failed to fetch') && retryCount < maxRetries) {
                    retryCount++;
                    console.warn(`网络错误，正在重试 (${retryCount}/${maxRetries})...`);
                    setTimeout(doFetch, retryDelay);
                } else {
                    showErrorMessage(`获取数据失败: ${error.message}`);
                }
            });
    }
    
    doFetch();
}

/**
 * 显示错误消息
 */
function showErrorMessage(message) {
    console.error(message);
    
    // 尝试使用全局 toast
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = message;
        toast.className = 'toast error';
        toast.style.display = 'block';
        
        setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
        return;
    }
    
    // 回退到 alert-container
    const alertContainer = document.getElementById('alert-container');
    if (!alertContainer) return;
    
    const alert = document.createElement('div');
    alert.className = 'alert alert-danger alert-dismissible fade show';
    alert.setAttribute('role', 'alert');
    
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    alertContainer.appendChild(alert);
    
    // 5秒后自动消失
    setTimeout(() => {
        alert.classList.remove('show');
        setTimeout(() => alert.remove(), 500);
    }, 5000);
} 