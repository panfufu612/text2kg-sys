document.addEventListener('DOMContentLoaded', function() {
    // 获取DOM元素
    const uploadForm = document.getElementById('upload-form');
    const textForm = document.getElementById('text-form');
    const fileInput = document.getElementById('file-input');
    const textInput = document.getElementById('text-content');
    const statusBar = document.getElementById('status-bar');
    const graphContainer = document.getElementById('graph-container');
    const entityDetails = document.getElementById('entity-details');
    const fileName = document.getElementById('file-name');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const zoomIn = document.getElementById('zoom-in');
    const zoomOut = document.getElementById('zoom-out');
    const resetView = document.getElementById('reset-view');
    const toggleLegend = document.getElementById('toggle-legend');
    const toggleSearch = document.getElementById('toggle-search');
    const saveToNeo4j = document.getElementById('save-to-neo4j');
    
    // 缩放比例
    let scale = 1;
    let currentGraph = null;
    let selectedNode = null;
    let currentData = null; // 存储当前图谱数据
    let legendVisible = true; // 图例是否可见
    let searchVisible = true; // 搜索面板是否可见
    
    // 文件选择显示文件名
    fileInput.addEventListener('change', function() {
        if (fileInput.files.length > 0) {
            fileName.textContent = fileInput.files[0].name;
        } else {
            fileName.textContent = '未选择文件';
        }
    });
    
    // 标签页切换
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-tab');
            
            // 激活按钮
            tabBtns.forEach(btn => btn.classList.remove('active'));
            btn.classList.add('active');
            
            // 显示对应面板
            tabPanes.forEach(pane => pane.classList.remove('active'));
            document.getElementById(target).classList.add('active');
        });
    });
    
    // 处理文件上传
    uploadForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const file = fileInput.files[0];
        if (!file) {
            showStatus('请选择一个文件', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
            showStatus('正在上传文件并处理...', 'info');
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '上传失败');
            }

            const data = await response.json();
            currentData = data; // 保存数据
            showStatus('文件处理成功，正在生成图谱...', 'success');
            visualizeGraph(data);
        } catch (error) {
            showStatus('处理失败: ' + error.message, 'error');
        }
    });
    
    // 处理文本输入
    textForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const text = textInput.value.trim();
        if (!text) {
            showStatus('请输入文本内容', 'error');
            return;
        }
        
        try {
            showStatus('正在处理文本...', 'info');
            const response = await fetch('/process_text', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: text })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '处理失败');
            }
            
            const data = await response.json();
            currentData = data; // 保存数据
            showStatus('文本处理成功，正在生成图谱...', 'success');
            visualizeGraph(data);
        } catch (error) {
            showStatus('处理失败: ' + error.message, 'error');
        }
    });

    // 显示状态信息
    function showStatus(message, type) {
        statusBar.textContent = message;
        statusBar.className = type;
    }
    
    // 缩放控制
    zoomIn.addEventListener('click', () => {
        if (scale < 3) {
            scale += 0.2;
            applyZoom();
        }
    });
    
    zoomOut.addEventListener('click', () => {
        if (scale > 0.3) {
            scale -= 0.2;
            applyZoom();
        }
    });
    
    resetView.addEventListener('click', () => {
        scale = 1;
        applyZoom();
    });
    
    // 图例显示/隐藏控制
    toggleLegend.addEventListener('click', () => {
        legendVisible = !legendVisible;
        const legend = d3.select('.legend');
        if (legendVisible) {
            legend.style('display', 'block');
            toggleLegend.classList.add('active');
        } else {
            legend.style('display', 'none');
            toggleLegend.classList.remove('active');
        }
    });
    
    // 搜索面板显示/隐藏控制
    toggleSearch.addEventListener('click', () => {
        searchVisible = !searchVisible;
        const searchPanel = d3.select('.search-panel');
        if (searchVisible) {
            searchPanel.style('display', 'block');
            toggleSearch.classList.add('active');
        } else {
            searchPanel.style('display', 'none');
            toggleSearch.classList.remove('active');
        }
    });
    
    function applyZoom() {
        if (currentGraph) {
            currentGraph.attr('transform', `scale(${scale})`);
        }
    }
    
    // 显示实体详情
    function showEntityDetails(entity) {
        // 清空之前的详情
        entityDetails.innerHTML = '';
        
        // 创建详情内容
        const nameEl = document.createElement('div');
        nameEl.className = 'entity-detail-item';
        nameEl.innerHTML = `<strong>名称:</strong> ${entity.name}`;
        
        const typeEl = document.createElement('div');
        typeEl.className = 'entity-detail-item';
        typeEl.innerHTML = `<strong>类型:</strong> ${entity.type}`;
        
        entityDetails.appendChild(nameEl);
        entityDetails.appendChild(typeEl);
        
        // 如果有其他属性也可以添加
        if (entity.properties) {
            for (const [key, value] of Object.entries(entity.properties)) {
                const propEl = document.createElement('div');
                propEl.className = 'entity-detail-item';
                propEl.innerHTML = `<strong>${key}:</strong> ${value}`;
                entityDetails.appendChild(propEl);
            }
        }
        
        // 添加相关关系
        if (currentData && currentData.relations) {
            const relatedRelations = currentData.relations.filter(
                rel => rel.source === entity.name || rel.target === entity.name
            );
            
            if (relatedRelations.length > 0) {
                const relationsTitle = document.createElement('div');
                relationsTitle.className = 'entity-detail-title';
                relationsTitle.textContent = '相关关系:';
                entityDetails.appendChild(relationsTitle);
                
                relatedRelations.forEach(rel => {
                    const relEl = document.createElement('div');
                    relEl.className = 'entity-detail-relation';
                    
                    if (rel.source === entity.name) {
                        relEl.innerHTML = `<span class="relation-arrow">→</span> <span class="relation-target">${rel.target}</span> <span class="relation-type">${rel.relation}</span>`;
                    } else {
                        relEl.innerHTML = `<span class="relation-source">${rel.source}</span> <span class="relation-type">${rel.relation}</span> <span class="relation-arrow">←</span>`;
                    }
                    
                    entityDetails.appendChild(relEl);
                });
            }
        }
    }

    // 使用 D3.js 可视化知识图谱
    function visualizeGraph(data) {
        // 清除现有图谱
        d3.select('#graph-container').selectAll('*').remove();
        
        // 恢复缩放
        scale = 1;

        // 设置SVG尺寸
        const width = graphContainer.clientWidth;
        const height = graphContainer.clientHeight;

        // 创建 SVG
        const svg = d3.select('#graph-container')
            .append('svg')
            .attr('width', width)
            .attr('height', height);
            
        const g = svg.append('g');
        currentGraph = g;

        // 创建力导向图
        const simulation = d3.forceSimulation()
            .force('link', d3.forceLink().id(d => d.id).distance(100))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('x', d3.forceX(width / 2).strength(0.1))
            .force('y', d3.forceY(height / 2).strength(0.1))
            .force('collision', d3.forceCollide().radius(50));

        // 准备节点和链接数据
        const entities = data.entities || [];
        const relations = data.relations || [];
        
        // 计算实体重要性（基于关系数量）
        const entityImportance = {};
        entities.forEach(entity => {
            entityImportance[entity.name] = 0;
        });
        
        relations.forEach(relation => {
            entityImportance[relation.source] = (entityImportance[relation.source] || 0) + 1;
            entityImportance[relation.target] = (entityImportance[relation.target] || 0) + 1;
        });
        
        // 计算关系权重
        const relationWeights = {};
        relations.forEach(relation => {
            const key = `${relation.source}-${relation.relation}-${relation.target}`;
            relationWeights[key] = (relationWeights[key] || 0) + 1;
        });
        
        const nodes = entities.map((entity, i) => ({
            id: i,
            name: entity.name,
            type: entity.type,
            properties: entity.properties || {},
            importance: entityImportance[entity.name] || 0
        }));

        const links = relations.map((relation, i) => {
            const sourceIndex = nodes.findIndex(n => n.name === relation.source);
            const targetIndex = nodes.findIndex(n => n.name === relation.target);
            const key = `${relation.source}-${relation.relation}-${relation.target}`;
            
            return {
                id: i,
                source: sourceIndex >= 0 ? sourceIndex : 0,
                target: targetIndex >= 0 ? targetIndex : 0,
                relation: relation.relation,
                weight: relationWeights[key] || 1
            };
        }).filter(link => link.source !== link.target); // 过滤掉自环

        // 创建箭头标记
        svg.append('defs').selectAll('marker')
            .data(['end'])
            .enter().append('marker')
            .attr('id', d => d)
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 27)
            .attr('refY', 0)
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M0,-5L10,0L0,5')
            .attr('fill', '#999');

        // 创建链接
        const link = g.append('g')
            .selectAll('g')
            .data(links)
            .enter().append('g');
            
        const linkLines = link.append('line')
            .attr('class', 'link')
            .attr('marker-end', 'url(#end)')
            .attr('stroke-width', d => Math.max(1, Math.min(5, d.weight)))
            .attr('stroke', '#999');
            
        // 添加关系标签
        const linkLabels = link.append('text')
            .attr('class', 'link-label')
            .attr('dy', -5)
            .attr('text-anchor', 'middle')
            .text(d => d.relation);

        // 创建节点组
        const node = g.append('g')
            .selectAll('g')
            .data(nodes)
            .enter().append('g')
            .attr('class', 'node')
            .call(d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended))
            .on('click', function(event, d) {
                // 取消之前的选择
                if (selectedNode) {
                    d3.select(selectedNode).classed('selected', false);
                }
                
                // 选择当前节点
                selectedNode = this;
                d3.select(this).classed('selected', true);
                
                // 显示详情
                showEntityDetails(d);
                
                event.stopPropagation(); // 阻止冒泡
            });

        // 添加节点圆圈
        node.append('circle')
            .attr('r', d => Math.max(15, Math.min(30, 15 + d.importance * 2)))
            .attr('fill', d => getNodeColor(d.type));

        // 修改节点标签位置和样式
        node.append('text')
            .attr('dy', 5)  // 将文本位置调整到圆圈中心
            .attr('text-anchor', 'middle')
            .attr('class', 'node-label')
            .style('font-weight', '50')  // 设置更细的字体
            .style('fill', '#000000')
            .text(d => d.name);

        // 点击空白处取消选择
        svg.on('click', () => {
            if (selectedNode) {
                d3.select(selectedNode).classed('selected', false);
                selectedNode = null;
                
                // 重置详情面板
                entityDetails.innerHTML = '<p class="placeholder">点击图谱中的节点查看详情</p>';
            }
        });

        // 更新力导向图
        simulation
            .nodes(nodes)
            .on('tick', ticked);

        simulation.force('link')
            .links(links);

        function ticked() {
            // 约束节点位置在视图范围内
            nodes.forEach(d => {
                d.x = Math.max(50, Math.min(width - 50, d.x));
                d.y = Math.max(50, Math.min(height - 50, d.y));
            });

            linkLines
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);
                
            linkLabels
                .attr('x', d => (d.source.x + d.target.x) / 2)
                .attr('y', d => (d.source.y + d.target.y) / 2);

            node.attr('transform', d => `translate(${d.x},${d.y})`);
        }

        function dragstarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }

        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        }

        function dragended(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }

        // 添加图例
        addLegend(svg, width, height);
        
        // 添加搜索和过滤功能
        addSearchAndFilter(svg, nodes, links);
    }
    
    // 获取节点颜色
    function getNodeColor(type) {
        const colors = {
            'Person': '#1f77b4',      // 蓝色
            'Organization': '#ff7f0e', // 橙色
            'Location': '#2ca02c',     // 绿色
            'Event': '#d62728',        // 红色
            'Time': '#9467bd',         // 紫色
            'Money': '#e377c2',        // 粉色
            'Concept': '#8c564b',      // 棕色
            'Other': '#7f7f7f'         // 灰色
        };
        return colors[type] || '#8c564b';
    }
    
    // 获取关系颜色
    function getRelationColor(relation) {
        return '#999';  // 统一返回灰色
    }
    
    // 添加图例
    function addLegend(svg, width, height) {
        const legend = svg.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(${width - 200}, 20)`);
            
        // 实体类型图例
        const entityTypes = ['Person', 'Organization', 'Location', 'Event', 'Time', 'Money', 'Concept', 'Other'];
        
        legend.append('text')
            .attr('x', 0)
            .attr('y', 0)
            .text('实体类型')
            .style('font-weight', 'bold');
            
        entityTypes.forEach((type, i) => {
            const y = 25 + i * 20;
            
            legend.append('rect')
                .attr('x', 0)
                .attr('y', y - 10)
                .attr('width', 15)
                .attr('height', 15)
                .attr('fill', getNodeColor(type));
                
            legend.append('text')
                .attr('x', 25)
                .attr('y', y)
                .text(type);
        });
    }
    
    // 添加搜索和过滤功能
    function addSearchAndFilter(svg, nodes, links) {
        // 创建搜索和过滤面板
        const searchPanel = d3.select('#graph-container')
            .append('div')
            .attr('class', 'search-panel')
            .style('position', 'absolute')
            .style('top', '10px')
            .style('left', '10px')
            .style('background', 'white')
            .style('padding', '10px')
            .style('border-radius', '5px')
            .style('box-shadow', '0 2px 5px rgba(0,0,0,0.2)');
            
        // 添加搜索框
        searchPanel.append('input')
            .attr('type', 'text')
            .attr('placeholder', '搜索实体...')
            .attr('class', 'search-input')
            .style('width', '150px')
            .style('padding', '5px')
            .style('margin-bottom', '10px')
            .on('input', function() {
                const searchTerm = this.value.toLowerCase();
                
                // 高亮匹配的节点
                svg.selectAll('.node')
                    .style('opacity', d => {
                        if (!searchTerm) return 1;
                        return d.name.toLowerCase().includes(searchTerm) ? 1 : 0.2;
                    });
                    
                // 高亮匹配的边
                svg.selectAll('.link')
                    .style('opacity', d => {
                        if (!searchTerm) return 0.6;
                        const sourceName = nodes[d.source].name.toLowerCase();
                        const targetName = nodes[d.target].name.toLowerCase();
                        return sourceName.includes(searchTerm) || targetName.includes(searchTerm) ? 0.6 : 0.1;
                    });
                    
                // 高亮匹配的标签
                svg.selectAll('.link-label')
                    .style('opacity', d => {
                        if (!searchTerm) return 1;
                        const sourceName = nodes[d.source].name.toLowerCase();
                        const targetName = nodes[d.target].name.toLowerCase();
                        return sourceName.includes(searchTerm) || targetName.includes(searchTerm) ? 1 : 0.2;
                    });
            });
            
        // 添加实体类型过滤
        const entityTypes = [...new Set(nodes.map(n => n.type))];
        
        searchPanel.append('div')
            .attr('class', 'filter-section')
            .style('margin-top', '10px');
            
        searchPanel.select('.filter-section')
            .append('div')
            .text('实体类型过滤:')
            .style('font-weight', 'bold')
            .style('margin-bottom', '5px');
            
        entityTypes.forEach(type => {
            const filterItem = searchPanel.select('.filter-section')
                .append('div')
                .style('display', 'flex')
                .style('align-items', 'center')
                .style('margin-bottom', '3px');
                
            filterItem.append('input')
                .attr('type', 'checkbox')
                .attr('id', `filter-${type}`)
                .attr('checked', true)
                .on('change', function() {
                    const checked = this.checked;
                    
                    // 过滤节点
                    svg.selectAll('.node')
                        .filter(d => d.type === type)
                        .style('opacity', checked ? 1 : 0.1);
                        
                    // 过滤相关的边
                    svg.selectAll('.link')
                        .style('opacity', d => {
                            const sourceType = nodes[d.source].type;
                            const targetType = nodes[d.target].type;
                            
                            // 如果源节点或目标节点被过滤，则边也变暗
                            const sourceVisible = sourceType === type ? checked : true;
                            const targetVisible = targetType === type ? checked : true;
                            
                            return sourceVisible && targetVisible ? 0.6 : 0.1;
                        });
                });
                
            filterItem.append('label')
                .attr('for', `filter-${type}`)
                .text(type)
                .style('margin-left', '5px')
                .style('color', getNodeColor(type));
        });
    }

    // 添加保存到Neo4j的功能
    saveToNeo4j.addEventListener('click', async () => {
        if (!currentData) {
            showStatus('没有可保存的图谱数据', 'error');
            return;
        }

        try {
            showStatus('正在保存到Neo4j...', 'info');
            const response = await fetch('/save_to_neo4j', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(currentData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '保存失败');
            }

            const result = await response.json();
            showStatus('成功保存到Neo4j数据库', 'success');
            saveToNeo4j.classList.add('active');  // 添加视觉反馈
            
            // 3秒后移除active状态
            setTimeout(() => {
                saveToNeo4j.classList.remove('active');
            }, 3000);
        } catch (error) {
            showStatus('保存失败: ' + error.message, 'error');
        }
    });
}); 