// 知识图谱可视化主文件
// 使用D3.js进行图谱渲染

// 图谱配置参数
const config = {
    nodeRadius: 15,            // 节点半径
    nodeTypes: {               // 节点类型颜色映射
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
    },
    linkDistance: 150,         // 连线长度
    chargeStrength: -400,      // 节点排斥力
    centerForce: 0.1,          // 中心引力
    alphaDecay: 0.02,          // 模拟衰减率
    tooltipDelay: 300,         // 提示框延迟显示时间
    zoomExtent: [0.2, 5]       // 缩放范围
};

// 主图谱类
class KnowledgeGraph {
    constructor(container) {
        this.container = container;
        this.width = container.clientWidth;
        this.height = container.clientHeight;
        this.nodes = [];
        this.links = [];
        this.nodeById = new Map();
        this.selectedNode = null;
        this.searchTerm = '';
        this.relationFilter = '';
        this.nodeLimit = 100;
        this.showRelationLabels = true; // 默认显示关系标签
        
        this.initSvg();
        this.initSimulation();
        this.initEvents();
    }
    
    // 初始化SVG容器
    initSvg() {
        this.svg = d3.select(this.container).append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', [0, 0, this.width, this.height])
            .attr('class', 'graph-svg');
            
        // 添加缩放功能
        this.svg.call(d3.zoom()
            .extent([[0, 0], [this.width, this.height]])
            .scaleExtent(config.zoomExtent)
            .on('zoom', event => this.handleZoom(event)))
            .on('dblclick.zoom', null);
            
        // 创建箭头标记
        const defs = this.svg.append('defs');
        
        // 添加文本背景定义
        defs.append('filter')
            .attr('id', 'label-background')
            .append('feFlood')
            .attr('flood-color', 'white')
            .attr('flood-opacity', '0.75')
            .append('feComposite')
            .attr('in', 'SourceGraphic');
        
        defs.append('marker')
            .attr('id', 'arrowhead')
            .attr('viewBox', '-0 -5 10 10')
            .attr('refX', 23) // 增加偏移，防止箭头重叠到节点
            .attr('refY', 0)
            .attr('orient', 'auto')
            .attr('markerWidth', 8)
            .attr('markerHeight', 8)
            .attr('xoverflow', 'visible')
            .append('svg:path')
            .attr('d', 'M 0,-5 L 10,0 L 0,5')
            .attr('fill', '#999')
            .style('stroke', 'none');
            
        // 创建主容器组
        this.g = this.svg.append('g');
        
        // 创建连线、节点和标签的层次 - 确保连线在节点下方
        this.linksGroup = this.g.append('g').attr('class', 'links');
        this.linkLabelsGroup = this.g.append('g').attr('class', 'link-labels'); // 新增关系标签层
        this.nodesGroup = this.g.append('g').attr('class', 'nodes');
        this.labelsGroup = this.g.append('g').attr('class', 'labels');
    }
    
    // 初始化物理模拟
    initSimulation() {
        this.simulation = d3.forceSimulation()
            .force('link', d3.forceLink().id(d => d.id).distance(config.linkDistance))
            .force('charge', d3.forceManyBody().strength(config.chargeStrength))
            .force('center', d3.forceCenter(this.width / 2, this.height / 2).strength(config.centerForce))
            .force('collision', d3.forceCollide().radius(config.nodeRadius * 1.5))
            .alphaDecay(config.alphaDecay)
            .on('tick', () => this.tick());
    }
    
    // 初始化事件监听
    initEvents() {
        // 搜索输入框事件
        const searchInput = document.getElementById('node-search');
        if (searchInput) {
            searchInput.addEventListener('keyup', event => {
                if (event.key === 'Enter') {
                    this.searchTerm = event.target.value;
                    this.loadData();
                }
            });
        }
        
        // 关系类型筛选事件
        const relationFilter = document.getElementById('relation-filter');
        if (relationFilter) {
            relationFilter.addEventListener('change', event => {
                this.relationFilter = event.target.value;
                this.loadData();
            });
        }
        
        // 节点数量限制事件
        const nodeLimit = document.getElementById('node-limit');
        if (nodeLimit) {
            nodeLimit.addEventListener('change', event => {
                this.nodeLimit = event.target.value;
            });
        }
        
        // 更新图谱按钮事件
        const updateButton = document.querySelector('button[onclick="updateGraph()"]');
        if (updateButton) {
            updateButton.onclick = () => this.loadData();
        }
        
        // 初始化面板状态
        this.initSearchPanel();
        
        // 监听窗口大小变化
        window.addEventListener('resize', () => this.handleResize());
    }
    
    // 处理窗口大小变化
    handleResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        this.width = width;
        this.height = height;
        
        // 更新SVG视图框
        this.svg.attr("width", width).attr("height", height);
        
        // 更新中心力
        this.simulation.force("center", d3.forceCenter(width / 2, height / 2));
        
        // 如果图谱已经加载，避免重新请求数据
        if (this.simulation.nodes().length > 0) {
            this.simulation.alpha(0.3).restart();
        }
    }
    
    // 初始化搜索面板状态
    initSearchPanel() {
        const togglePanelBtn = document.getElementById('toggle-panel-btn');
        const searchPanel = document.getElementById('search-panel');
        
        if (togglePanelBtn && searchPanel) {
            // 更新图标状态
            const icon = togglePanelBtn.querySelector('i');
            if (icon) {
                icon.className = searchPanel.classList.contains('collapsed') ? 
                    'fas fa-chevron-right' : 'fas fa-chevron-left';
            }
            
            // 添加点击事件
            togglePanelBtn.addEventListener('click', () => {
                searchPanel.classList.toggle('collapsed');
                
                // 更新图标
                if (icon) {
                    icon.className = searchPanel.classList.contains('collapsed') ? 
                        'fas fa-chevron-right' : 'fas fa-chevron-left';
                }
            });
        }
    }
    
    // 处理缩放事件
    handleZoom(event) {
        if (this.g) {
            this.g.attr('transform', event.transform);
        }
    }
    
    // 加载图谱数据
    loadData() {
        // 显示加载动画
        this.showLoading(true);
        
        // 获取搜索参数
        const searchInput = document.getElementById('node-search');
        const relationFilter = document.getElementById('relation-filter');
        const nodeLimitInput = document.getElementById('node-limit');
        
        // 更新搜索条件
        this.searchTerm = searchInput ? searchInput.value : '';
        this.relationFilter = relationFilter ? relationFilter.value : '';
        this.nodeLimit = nodeLimitInput ? parseInt(nodeLimitInput.value) : 100;
        
        // 构建查询参数
        const params = new URLSearchParams();
        params.append('limit', this.nodeLimit);
        
        if (this.searchTerm) {
            params.append('search', this.searchTerm);
        }
        
        if (this.relationFilter) {
            params.append('relation', this.relationFilter);
        }
        
        const apiUrl = `/api/graph?${params.toString()}`;
        console.log(`请求图谱数据: ${apiUrl}`);
        
        // 获取图谱数据
        fetch(apiUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`服务器响应错误: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                // 隐藏加载动画
                this.showLoading(false);
                
                // 检查返回的数据是否有效
                if (!data || !data.nodes || !data.links) {
                    throw new Error('服务器返回的数据格式不正确');
                }
                
                console.log(`成功加载图谱: ${data.nodes.length}个节点, ${data.links.length}个关系`);
                
                // 如果没有数据，显示提示
                if (data.nodes.length === 0) {
                    this.showToast('未找到符合条件的数据', 'warning');
                    // 如果是搜索导致没有结果，显示提示
                    if (this.searchTerm || this.relationFilter) {
                        this.showToast(`未找到与"${this.searchTerm || this.relationFilter}"相关的节点`, 'info');
                    } else {
                        // 如果是初始加载没有数据，尝试加载默认节点
                        this.loadDefaultGraph();
                        return;
                    }
                }
                
                // 更新图谱
                this.updateGraph(data);
                
                // 显示结果数量
                this.updateCountDisplay(data.nodes.length, data.links.length);
                
                // 如果有搜索词，设置面包屑
                const breadcrumb = document.getElementById('search-breadcrumb');
                if (breadcrumb) {
                    if (this.searchTerm || this.relationFilter) {
                        breadcrumb.innerHTML = `
                            <div class="d-flex align-items-center">
                                <i class="fas fa-search me-2"></i>
                                <span>搜索: "${this.searchTerm || this.relationFilter}"</span>
                                <button class="btn btn-sm btn-link" onclick="clearSearch()">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        `;
                        breadcrumb.style.display = 'block';
                    } else {
                        breadcrumb.style.display = 'none';
                    }
                }
            })
            .catch(error => {
                console.error('加载图谱数据失败:', error);
                this.showLoading(false);
                this.showToast('加载图谱数据失败: ' + error.message, 'error');
                
                // 如果加载失败，显示错误信息在图谱中心
                this.displayErrorMessage('图谱数据加载失败，请检查网络连接或刷新页面重试');
            });
    }
    
    // 加载默认图谱或示例数据
    loadDefaultGraph() {
        console.log("尝试加载默认图谱数据");
        
        // 这里可以实现选择一个有代表性的节点作为入口
        // 或者使用一些预定义的示例数据
        
        // 方法1: 尝试获取一个代表性节点
        fetch('/api/admin/nodes?limit=1')
            .then(response => response.json())
            .then(data => {
                if (data.nodes && data.nodes.length > 0) {
                    const firstNode = data.nodes[0];
                    console.log(`找到默认节点: ID=${firstNode.id}, 名称=${firstNode.name}`);
                    this.loadSubgraph(firstNode.id);
                } else {
                    this.displayErrorMessage('数据库中无可用节点');
                }
            })
            .catch(error => {
                console.error('加载默认节点失败:', error);
                this.displayErrorMessage('无法加载默认数据，请确认数据库中已有节点');
            });
    }
    
    // 显示错误消息
    displayErrorMessage(message) {
        // 在图谱中心显示错误信息
        this.svg.selectAll('.error-message').remove();
        
        this.svg.append('text')
            .attr('class', 'error-message')
            .attr('x', this.width / 2)
            .attr('y', this.height / 2)
            .attr('text-anchor', 'middle')
            .attr('fill', '#d9534f')
            .attr('font-size', '16px')
            .attr('font-weight', 'bold')
            .text(message);
    }
    
    // 显示/隐藏加载动画
    showLoading(show) {
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.style.display = show ? 'block' : 'none';
        }
    }
    
    // 更新计数显示
    updateCountDisplay(nodeCount, linkCount) {
        const nodeCountElement = document.getElementById('nodes-count');
        const linkCountElement = document.getElementById('links-count');
        
        if (nodeCountElement) {
            nodeCountElement.textContent = nodeCount;
        }
        
        if (linkCountElement) {
            linkCountElement.textContent = linkCount;
        }
    }
    
    // 显示提示消息
    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        if (!toast) return;
        
        toast.textContent = message;
        toast.className = `toast ${type}`;
        toast.style.display = 'block';
        
        setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
    }
    
    // 更新图谱可视化
    updateGraph(data) {
        if (!data || !data.nodes || !data.links) {
            console.error('更新图谱的数据无效', data);
            return;
        }
        
        this.nodes = data.nodes;
        this.links = data.links;
        
        // 创建节点索引
        this.nodeById = new Map(this.nodes.map(d => [d.id, d]));
        
        // 确保连线的source和target为对象引用
        this.links.forEach(link => {
            // 检查source和target是否已经是对象
            if (typeof link.source !== 'object' || link.source === null) {
                const sourceId = link.source;
                link.source = this.nodeById.get(sourceId);
                if (!link.source) {
                    console.warn(`找不到ID为${sourceId}的源节点`);
                    link.source = { id: sourceId, x: 0, y: 0 }; // 创建一个占位符对象
                }
            }
            
            if (typeof link.target !== 'object' || link.target === null) {
                const targetId = link.target;
                link.target = this.nodeById.get(targetId);
                if (!link.target) {
                    console.warn(`找不到ID为${targetId}的目标节点`);
                    link.target = { id: targetId, x: 0, y: 0 }; // 创建一个占位符对象
                }
            }
        });
        
        // 过滤掉无效的链接
        this.links = this.links.filter(link => 
            link.source && link.target && link.source !== link.target);
        
        console.log('处理后的关系数据:', this.links);
        
        // 更新模拟
        this.simulation.nodes(this.nodes);
        this.simulation.force('link').links(this.links);
        this.simulation.alpha(1).restart();
        
        // 更新连线
        this.updateLinks();
        
        // 更新节点
        this.updateNodes();
        
        // 更新标签
        this.updateLabels();
    }
    
    // 更新连线可视化
    updateLinks() {
        // 数据绑定
        const link = this.linksGroup.selectAll('.link')
            .data(this.links, d => `${d.source.id || d.source}-${d.target.id || d.target}`);
        
        // 移除旧连线
        link.exit().remove();
        
        // 添加新连线
        const linkEnter = link.enter().append('line')
            .attr('class', 'link')
            .attr('stroke', '#999')
            .attr('stroke-opacity', 0.6)
            .attr('stroke-width', d => d.value ? Math.sqrt(d.value) : 1.5)
            .attr('marker-end', 'url(#arrowhead)');
            
        // 添加连线提示框
        linkEnter.append('title')
            .text(d => d.label || d.type || '');
            
        // 合并新旧连线
        this.link = linkEnter.merge(link);
        
        // 移除旧关系标签
        this.linkLabelsGroup.selectAll('.link-label').remove();
        
        // 添加关系标签文本
        this.linkLabels = this.linkLabelsGroup.selectAll('.link-label')
            .data(this.links)
            .enter()
            .append('text')
            .attr('class', 'link-label')
            .attr('text-anchor', 'middle')
            .attr('dy', -5)
            .text(d => d.label || d.type || '')
            .style('display', this.showRelationLabels ? 'block' : 'none');
        
        console.log('关系数据:', this.links);
        console.log('关系标签:', this.links.map(l => l.label || l.type || 'unknown'));
    }
    
    // 更新节点可视化
    updateNodes() {
        // 数据绑定
        const node = this.nodesGroup.selectAll('.node')
            .data(this.nodes, d => d.id);
        
        // 移除旧节点
        node.exit().remove();
        
        // 添加新节点
        const nodeEnter = node.enter().append('g')
            .attr('class', 'node')
            .attr('data-node-id', d => d.id)
            .attr('class', d => `node ${d.properties?.url ? 'has-link' : ''}`)
            .call(d3.drag()
                .on('start', event => this.dragStarted(event))
                .on('drag', event => this.dragged(event))
                .on('end', event => this.dragEnded(event)))
            .on('click', (event, d) => this.nodeClicked(event, d))
            .on('dblclick', (event, d) => this.nodeDblClicked(event, d));
            
        // 添加节点圆形
        nodeEnter.append('circle')
            .attr('r', d => this.getNodeRadius(d.type))
            .attr('fill', d => this.getNodeColor(d.type))
            .attr('stroke', '#fff')
            .attr('stroke-width', 1.5);
            
        // 添加节点提示框
        nodeEnter.append('title')
            .text(d => d.name);
            
        // 合并新旧节点
        this.node = nodeEnter.merge(node);
    }
    
    // 获取节点颜色
    getNodeColor(type) {
        return config.nodeTypes[type] || config.nodeTypes.default;
    }
    
    // 获取节点半径
    getNodeRadius(type) {
        const radiusConfig = {
            'Professor': 20,
            'default': 15
        };
        return radiusConfig[type] || radiusConfig.default;
    }
    
    // 更新标签可视化
    updateLabels() {
        // 数据绑定
        const label = this.labelsGroup.selectAll('.label')
            .data(this.nodes, d => d.id);
        
        // 移除旧标签
        label.exit().remove();
        
        // 添加新标签
        const labelEnter = label.enter().append('text')
            .attr('class', 'label')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'central')
            .attr('font-size', '10px')
            .attr('dy', d => this.getNodeRadius(d.type) * 1.7)
            .attr('pointer-events', 'none')
            .text(d => {
                if (!d.name) return '';
                return d.name.length > 12 ? d.name.substring(0, 10) + '...' : d.name;
            })
            .style('display', this.showRelationLabels ? 'block' : 'none');
            
        // 合并新旧标签
        this.label = labelEnter.merge(label);
    }
    
    // 物理模拟每帧计算回调
    tick() {
        if (this.link) {
            this.link
                .attr('x1', d => d.source.x || 0)
                .attr('y1', d => d.source.y || 0)
                .attr('x2', d => d.target.x || 0)
                .attr('y2', d => d.target.y || 0);
        }
        
        if (this.node) {
            this.node.attr('transform', d => `translate(${d.x || 0},${d.y || 0})`);
        }
        
        if (this.label) {
            this.label
                .attr('x', d => d.x || 0)
                .attr('y', d => d.y || 0);
        }
        
        // 更新关系标签位置
        if (this.linkLabels) {
            this.linkLabels
                .attr('x', d => {
                    // 计算线的中点
                    return (d.source.x + d.target.x) / 2;
                })
                .attr('y', d => {
                    // 计算线的中点
                    return (d.source.y + d.target.y) / 2;
                });
        }
    }
    
    // 拖拽开始
    dragStarted(event) {
        if (!event.active) this.simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
    }
    
    // 拖拽中
    dragged(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
    }
    
    // 拖拽结束
    dragEnded(event) {
        if (!event.active) this.simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
    }
    
    // 节点点击
    nodeClicked(event, d) {
        // 取消上一个选中节点
        if (this.selectedNode) {
            const safeNodeId = this.formatNodeIdForSelector(this.selectedNode.id);
            this.nodesGroup.select(`g[data-node-id="${safeNodeId}"]`)
                .select('circle')
                .transition()
                .duration(300)
                .attr('r', this.getNodeRadius(this.selectedNode.type))
                .attr('stroke', '#fff');
                
            // 如果点击的是同一个节点，取消选择
            if (this.selectedNode.id === d.id) {
                this.selectedNode = null;
                this.hideNodeInfo();
                return;
            }
        }
        
        // 设置新的选中节点
        this.selectedNode = d;
        
        // 高亮选中节点
        const safeNodeId = this.formatNodeIdForSelector(d.id);
        this.nodesGroup.select(`g[data-node-id="${safeNodeId}"]`)
            .select('circle')
            .transition()
            .duration(300)
            .attr('r', this.getNodeRadius(d.type) * 1.2)
            .attr('stroke', '#ff4500');
            
        // 显示节点详细信息
        this.showNodeInfo(d);
    }
    
    // 节点双击
    nodeDblClicked(event, d) {
        // 如果有 URL 属性则打开链接
        if (d?.properties?.url && d.properties.url.startsWith('http')) {
            window.open(d.properties.url, '_blank');
            return;
        }
        
        // 加载以当前节点为中心的子图
        this.loadSubgraph(d.id);
    }
    
    // 加载子图
    loadSubgraph(nodeId) {
        // 显示加载动画
        this.showLoading(true);
        
        // 修复URL格式，使用绝对路径并确保nodeId是有效的整数
        const safeNodeId = parseInt(nodeId, 10);
        
        if (isNaN(safeNodeId)) {
            console.error(`无效的节点ID: ${nodeId}`);
            this.showLoading(false);
            this.showToast('无效的节点ID', 'error');
            return;
        }
        
        const apiUrl = `/api/graph/subgraph/${safeNodeId}?depth=1&limit=${this.nodeLimit}`;
        console.log(`请求子图数据: ${apiUrl}`);
        
        fetch(apiUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`服务器响应错误: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                // 隐藏加载动画
                this.showLoading(false);
                
                // 检查返回的数据是否有效
                if (!data || !data.nodes || !data.links) {
                    throw new Error('服务器返回的数据格式不正确');
                }
                
                console.log(`成功加载子图: ${data.nodes.length}个节点, ${data.links.length}个关系`);
                
                // 更新图谱数据
                this.updateGraph(data);
                
                // 显示结果数量
                this.updateCountDisplay(data.nodes.length, data.links.length);
                
                // 中心定位到选择的节点
                const centerNode = this.nodeById.get(safeNodeId);
                if (centerNode) {
                    centerNode.fx = this.width / 2;
                    centerNode.fy = this.height / 2;
                    
                    // 固定中心节点一段时间后释放
                    setTimeout(() => {
                        centerNode.fx = null;
                        centerNode.fy = null;
                    }, 2000);
                }
            })
            .catch(error => {
                console.error('加载子图失败:', error);
                this.showLoading(false);
                this.showToast('加载子图失败: ' + error.message, 'error');
            });
    }
    
    // 显示节点详细信息
    showNodeInfo(node) {
        if (!node) return;
        
        const infoPanel = document.getElementById('node-info');
        const nodeDetailsContainer = document.getElementById('node-details-container');
        const nodeDetails = document.getElementById('node-details');
        
        if (!infoPanel || !nodeDetails) return;
        
        // 显示面板
        infoPanel.style.display = 'flex';
        
        // 设置节点信息
        nodeDetails.innerHTML = '';
        
        // 添加类型标识
        const typeDiv = document.createElement('div');
        typeDiv.className = 'mb-3';
        typeDiv.innerHTML = `<strong>类型:</strong> <span class="badge" style="background-color: ${this.getNodeColor(node.type)}">${node.type || '未知'}</span>`;
        nodeDetails.appendChild(typeDiv);
        
        // 添加名称
        const nameDiv = document.createElement('div');
        nameDiv.className = 'mb-3';
        nameDiv.innerHTML = `<strong>名称:</strong> ${node.name || '未命名'}`;
        nodeDetails.appendChild(nameDiv);
        
        // 创建属性列表
        const propsList = document.createElement('div');
        propsList.className = 'list-group mb-3';
        propsList.id = 'node-props-list';
        
        // 添加属性
        if (node.properties) {
            Object.entries(node.properties)
                .filter(([key]) => key !== 'name' && key !== 'type')
                .forEach(([key, value]) => {
                    if (value === null || value === undefined || value === '') return;
                    
                    const item = document.createElement('div');
                    item.className = 'list-group-item d-flex justify-content-between align-items-center';
                    
                    const keySpan = document.createElement('span');
                    keySpan.className = 'fw-bold text-muted';
                    keySpan.textContent = key;
                    
                    const valueSpan = document.createElement('span');
                    valueSpan.className = 'text-break';
                    
                    // 检查值是否是URL或Email
                    if (typeof value === 'string' && this.isUrl(key, value)) {
                        // 创建链接元素
                        const link = document.createElement('a');
                        link.href = value.startsWith('www.') ? 'http://' + value : value;
                        link.textContent = value;
                        link.target = '_blank';
                        link.className = 'text-primary';
                        valueSpan.appendChild(link);
                    } else if (typeof value === 'string' && key.toLowerCase().includes('email')) {
                        // 处理邮箱地址
                        const link = document.createElement('a');
                        link.href = 'mailto:' + value;
                        link.textContent = value;
                        link.className = 'text-primary';
                        valueSpan.appendChild(link);
                    } else {
                        // 普通文本
                        valueSpan.textContent = String(value);
                    }
                    
                    item.appendChild(keySpan);
                    item.appendChild(valueSpan);
                    propsList.appendChild(item);
                });
        }
        
        // 添加属性列表到节点详情
        nodeDetails.appendChild(propsList);
    }
    
    // 判断是否为URL
    isUrl(key, value) {
        if (typeof value !== 'string') return false;
        
        return value.startsWith('http://') || 
               value.startsWith('https://') || 
               value.startsWith('www.') ||
               key.toLowerCase().includes('url') || 
               key.toLowerCase().includes('link') ||
               key.toLowerCase().includes('website') ||
               key.toLowerCase().includes('homepage');
    }
    
    // 隐藏节点详细信息
    hideNodeInfo() {
        const infoPanel = document.getElementById('node-info');
        if (infoPanel) {
            infoPanel.style.display = 'none';
        }
    }
    
    // 修正节点ID处理函数：将特殊字符转义或替换，确保生成有效的CSS选择器
    formatNodeIdForSelector(id) {
        // 将冒号和其他可能导致CSS选择器无效的字符替换为下划线或其他安全字符
        if (typeof id === 'string') {
            return id.replace(/[:.]/g, '_');
        }
        return id;
    }
    
    // 添加切换关系标签的方法
    toggleRelationLabels() {
        this.showRelationLabels = !this.showRelationLabels;
        
        if (this.linkLabels) {
            this.linkLabels.style('display', this.showRelationLabels ? 'block' : 'none');
        }
        
        // 更新UI状态
        const toggleBtn = document.getElementById('toggle-labels');
        if (toggleBtn) {
            toggleBtn.title = this.showRelationLabels ? "隐藏关系标签" : "显示关系标签";
            toggleBtn.classList.toggle('active', this.showRelationLabels);
            if (this.showRelationLabels) {
                toggleBtn.style.backgroundColor = '#4caf50';
                toggleBtn.style.color = 'white';
            } else {
                toggleBtn.style.backgroundColor = '#f8f9fa';
                toggleBtn.style.color = '#333';
            }
        }
        
        console.log('切换关系标签显示:', this.showRelationLabels);
    }
}

// 页面加载完成后初始化图谱
document.addEventListener('DOMContentLoaded', () => {
    // 获取图谱容器
    const container = document.getElementById('graph-container');
    if (!container) {
        console.error('找不到图谱容器元素');
        return;
    }
    
    // 创建图谱实例
    const graph = new KnowledgeGraph(container);
    
    // 注册全局函数，供HTML元素调用
    window.updateGraph = () => graph.loadData();
    window.clearSearch = () => {
        const searchInput = document.getElementById('node-search');
        if (searchInput) searchInput.value = '';
        graph.loadData();
    };
    window.closeNodeInfo = () => graph.hideNodeInfo();
    window.zoomIn = () => {
        const zoom = d3.zoom().on('zoom', event => graph.handleZoom(event));
        graph.svg.transition().duration(500).call(zoom.scaleBy, 1.5);
    };
    window.zoomOut = () => {
        const zoom = d3.zoom().on('zoom', event => graph.handleZoom(event));
        graph.svg.transition().duration(500).call(zoom.scaleBy, 0.67);
    };
    window.resetZoom = () => {
        const bounds = graph.g.node().getBBox();
        const parent = graph.svg.node().getBoundingClientRect();
        const fullWidth = parent.width;
        const fullHeight = parent.height;
        const width = bounds.width;
        const height = bounds.height;
        
        if (width === 0 || height === 0) return; // 防止空图错误
        
        const scale = 0.9 / Math.max(width / fullWidth, height / fullHeight);
        const midX = bounds.x + width / 2;
        const midY = bounds.y + height / 2;
        const translate = [fullWidth / 2 - scale * midX, fullHeight / 2 - scale * midY];

        const zoom = d3.zoom().on('zoom', event => graph.handleZoom(event));
        graph.svg.transition()
            .duration(750)
            .call(zoom.transform, d3.zoomIdentity
                .translate(translate[0], translate[1])
                .scale(scale));
    };
    
    // 添加关系标签切换函数
    window.toggleRelationLabels = () => graph.toggleRelationLabels();
    
    // 加载关系类型
    fetch('/api/relation-types')
        .then(response => {
            if (!response.ok) {
                throw new Error(`服务器响应错误: ${response.status}`);
            }
            return response.json();
        })
        .then(relationTypes => {
            const select = document.getElementById('relation-filter');
            if (!select) return;
            
            select.innerHTML = '<option value="">全部关系</option>';
            
            // 处理关系类型数据
            const types = Array.isArray(relationTypes) 
                ? relationTypes
                : (relationTypes.types || []);
            
            // 添加选项
            types.forEach(type => {
                select.innerHTML += `<option value="${type}">${type}</option>`;
            });
        })
        .catch(error => {
            console.error('加载关系类型出错:', error);
            graph.showToast('加载关系类型失败: ' + error.message, 'error');
        });
    
    // 加载初始图谱
    graph.loadData();
    
    // 设置初始状态 - 如果需要默认显示关系标签
    const toggleBtn = document.getElementById('toggle-labels');
    if (toggleBtn && graph.showRelationLabels) {
        toggleBtn.style.backgroundColor = '#4caf50';
        toggleBtn.style.color = 'white';
    }
}); 