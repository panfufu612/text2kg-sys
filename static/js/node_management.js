// 全局变量
let currentPage = 1;
let totalPages = 1;
let nodeTypes = [];
let editingNodeId = null;
let toastInstance = null;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 初始化Toast组件
    const toastEl = document.getElementById('toast');
    if (toastEl) {
        toastInstance = new bootstrap.Toast(toastEl);
    }
    
    // 加载节点类型
    loadNodeTypes();
    
    // 加载节点列表（第1页）
    loadNodes(1);
    
    // 注册事件处理程序
    registerEventHandlers();
});

/**
 * 注册事件处理程序
 */
function registerEventHandlers() {
    // 搜索按钮点击事件
    const searchBtn = document.getElementById('btn-search');
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            currentPage = 1;
            loadNodes(currentPage);
        });
    }
    
    // 添加节点按钮点击事件
    const addNodeBtn = document.getElementById('btn-add-node');
    if (addNodeBtn) {
        addNodeBtn.addEventListener('click', showAddNodeModal);
    }
    
    // 保存节点按钮点击事件
    const saveNodeBtn = document.getElementById('save-node');
    if (saveNodeBtn) {
        saveNodeBtn.addEventListener('click', saveNode);
    }
    
    // 删除确认按钮点击事件
    const confirmDeleteBtn = document.getElementById('confirm-delete');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', deleteNode);
    }
    
    // 添加属性按钮点击事件
    const addPropertyBtn = document.getElementById('add-property');
    if (addPropertyBtn) {
        addPropertyBtn.addEventListener('click', addPropertyField);
    }
    
    // 回车键搜索
    const filterName = document.getElementById('filter-name');
    if (filterName) {
        filterName.addEventListener('keyup', (event) => {
            if (event.key === 'Enter') {
                currentPage = 1;
                loadNodes(currentPage);
            }
        });
    }
}

/**
 * 加载节点类型
 */
function loadNodeTypes() {
    fetch('/api/node_types')
        .then(response => {
            if (!response.ok) {
                throw new Error(`服务器响应错误: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // 保存节点类型列表
            nodeTypes = data.types || [];
            
            // 获取更详细的节点类型信息（如果有）
            const typeDetails = data.type_details || nodeTypes.map(type => ({ type, count: 0 }));
            
            // 更新筛选下拉框
            const filterTypeSelect = document.getElementById('filter-type');
            if (filterTypeSelect) {
                // 保持"全部类型"选项
                filterTypeSelect.innerHTML = '<option value="">全部类型</option>';
                
                // 添加所有节点类型，并显示数量
                typeDetails.forEach(item => {
                    const displayText = `${item.type} (${item.count})`;
                    filterTypeSelect.innerHTML += `<option value="${escapeHtml(item.type)}">${escapeHtml(displayText)}</option>`;
                });
            }
            
            // 更新节点类型下拉框
            const nodeTypeSelect = document.getElementById('node-type');
            if (nodeTypeSelect) {
                // 清空当前选项
                nodeTypeSelect.innerHTML = '';
                
                // 添加节点类型选项
                typeDetails.forEach(item => {
                    const displayText = `${item.type} (${item.count})`;
                    nodeTypeSelect.innerHTML += `<option value="${escapeHtml(item.type)}">${escapeHtml(displayText)}</option>`;
                });
                
                // 添加自定义类型选项
                nodeTypeSelect.innerHTML += '<option value="__custom__">-- 添加自定义类型 --</option>';
                
                // 添加选择事件处理
                nodeTypeSelect.addEventListener('change', function() {
                    if (this.value === '__custom__') {
                        promptCustomNodeType();
                    }
                });
            }
        })
        .catch(error => {
            console.error('加载节点类型失败:', error);
            showToast('错误', `加载节点类型失败: ${error.message}`, 'danger');
        });
}

/**
 * 弹出自定义节点类型输入框
 */
function promptCustomNodeType() {
    // 使用 SweetAlert2 或 Bootstrap 模态框
    Swal.fire({
        title: '添加自定义节点类型',
        input: 'text',
        inputPlaceholder: '请输入新的节点类型名称',
        showCancelButton: true,
        confirmButtonText: '添加',
        cancelButtonText: '取消',
        inputValidator: (value) => {
            if (!value) {
                return '请输入节点类型名称';
            }
            // 检查类型是否已存在
            if (nodeTypes.includes(value)) {
                return '该节点类型已存在';
            }
        }
    }).then((result) => {
        if (result.isConfirmed && result.value) {
            // 添加新类型
            const newType = result.value.trim();
            nodeTypes.push(newType);
            
            // 更新节点类型下拉框
            const nodeTypeSelect = document.getElementById('node-type');
            if (nodeTypeSelect) {
                // 添加新类型选项
                const newOption = document.createElement('option');
                newOption.value = newType;
                newOption.textContent = newType + ' (新)';
                
                // 插入到自定义选项之前
                const customOption = nodeTypeSelect.querySelector('option[value="__custom__"]');
                nodeTypeSelect.insertBefore(newOption, customOption);
                
                // 选择新添加的类型
                nodeTypeSelect.value = newType;
            }
        } else {
            // 如果取消，重设为第一个选项
            const nodeTypeSelect = document.getElementById('node-type');
            if (nodeTypeSelect && nodeTypeSelect.options.length > 0) {
                nodeTypeSelect.selectedIndex = 0;
            }
        }
    });
}

/**
 * 加载节点列表
 * @param {number} page 页码
 */
function loadNodes(page) {
    // 获取筛选条件
    const nameFilter = document.getElementById('filter-name')?.value || '';
    const typeFilter = document.getElementById('filter-type')?.value || '';
    
    // 构建查询参数
    const params = new URLSearchParams({
        page: page,
        limit: 10  // 每页10条
    });
    
    if (nameFilter) {
        params.append('name', nameFilter);
    }
    
    if (typeFilter) {
        params.append('type', typeFilter);
    }
    
    // 显示加载状态
    const nodeListElement = document.getElementById('node-list');
    if (nodeListElement) {
        nodeListElement.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-3">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">加载中...</span>
                    </div>
                    <p class="mt-2">正在加载节点数据...</p>
                </td>
            </tr>
        `;
    }
    
    // 发送请求
    fetch(`/api/admin/nodes?${params.toString()}`)
        .then(response => {
            console.log("API响应状态:", response.status);
            console.log("API响应头:", Object.fromEntries(response.headers.entries()));
            
            // 如果是500错误，尝试获取错误详情
            if (!response.ok) {
                return response.text().then(text => {
                    console.error("服务器错误详情:", text);
                    try {
                        return JSON.parse(text);
                    } catch (e) {
                        throw new Error(`服务器错误: ${response.status} - ${text.substring(0, 100)}`);
                    }
                });
            }
            
            return response.json();
        })
        .then(data => {
            // 检查返回的数据是否包含错误信息
            if (data.error) {
                console.warn("API返回错误:", data.error);
                showToast('警告', `数据加载包含警告: ${data.error}`, 'warning');
            }
            
            // 更新全局页码变量
            currentPage = data.page || 1;
            totalPages = data.pages || 1;
            
            // 渲染节点列表
            renderNodeTable(data.nodes || []);
            
            // 渲染分页
            renderPagination(currentPage, totalPages);
        })
        .catch(error => {
            console.error('加载节点列表失败:', error);
            showToast('错误', `加载节点列表失败: ${error.message}`, 'danger');
            
            // 显示错误信息在节点列表区域
            if (nodeListElement) {
                nodeListElement.innerHTML = `
                    <tr>
                        <td colspan="5" class="text-center py-3 text-danger">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            加载失败: ${error.message}
                        </td>
                    </tr>
                `;
            }
        });
}

/**
 * 渲染节点表格
 * @param {Array} nodes 节点数据
 */
function renderNodeTable(nodes) {
    const nodeListElement = document.getElementById('node-list');
    if (!nodeListElement) return;
    
    // 清空现有内容
    nodeListElement.innerHTML = '';
    
    // 检查是否有数据
    if (nodes.length === 0) {
        nodeListElement.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-3">
                    <i class="fas fa-info-circle me-2"></i>没有找到符合条件的节点
                </td>
            </tr>
        `;
        return;
    }
    
    // 遍历节点数据，生成表格行
    nodes.forEach(node => {
        // 获取显示名称，优先使用display_name，其次是title，再次是name
        const displayName = node.display_name || 
                           (node.properties && node.properties.title ? node.properties.title : null) || 
                           node.title || 
                           node.name || 
                           '未命名节点';
        
        const row = document.createElement('tr');
        
        // 设置行内容
        row.innerHTML = `
            <td>${node.id}</td>
            <td>
                <div class="d-flex flex-column">
                    <span class="fw-bold">${escapeHtml(displayName)}</span>
                    ${displayName !== node.name && node.name ? 
                      `<small class="text-muted">(系统名: ${escapeHtml(node.name)})</small>` : ''}
                </div>
            </td>
            <td><span class="badge bg-primary">${escapeHtml(node.type || '未知')}</span></td>
            <td>${node.prop_count}</td>
            <td class="action-buttons">
                <button class="btn btn-sm btn-outline-info view-node" data-id="${node.id}" title="查看">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-sm btn-outline-primary edit-node" data-id="${node.id}" title="编辑">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger delete-node" data-id="${node.id}" 
                        data-name="${escapeHtml(displayName)}" title="删除">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>
        `;
        
        // 添加到表格
        nodeListElement.appendChild(row);
    });
    
    // 为按钮添加事件处理程序
    nodeListElement.querySelectorAll('.view-node').forEach(btn => {
        btn.addEventListener('click', () => showViewNodeModal(btn.dataset.id));
    });
    
    nodeListElement.querySelectorAll('.edit-node').forEach(btn => {
        btn.addEventListener('click', () => showEditNodeModal(btn.dataset.id));
    });
    
    nodeListElement.querySelectorAll('.delete-node').forEach(btn => {
        btn.addEventListener('click', () => showDeleteModal(btn.dataset.id, btn.dataset.name));
    });
}

/**
 * 渲染分页控件
 * @param {number} currentPage 当前页码
 * @param {number} totalPages 总页数
 */
function renderPagination(currentPage, totalPages) {
    const paginationElement = document.getElementById('pagination');
    if (!paginationElement) return;
    
    // 清空现有内容
    paginationElement.innerHTML = '';
    
    // 如果只有一页，不显示分页
    if (totalPages <= 1) return;
    
    // 上一页按钮
    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
    prevLi.innerHTML = `
        <a class="page-link" href="#" aria-label="上一页" ${currentPage === 1 ? 'tabindex="-1" aria-disabled="true"' : ''}>
            <span aria-hidden="true">&laquo;</span>
        </a>
    `;
    if (currentPage > 1) {
        prevLi.querySelector('a').addEventListener('click', (e) => {
            e.preventDefault();
            loadNodes(currentPage - 1);
        });
    }
    paginationElement.appendChild(prevLi);
    
    // 页码按钮
    // 计算显示的页码范围（最多显示5个页码）
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    
    // 如果页数不足5页，则调整startPage
    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const pageLi = document.createElement('li');
        pageLi.className = `page-item ${i === currentPage ? 'active' : ''}`;
        pageLi.innerHTML = `<a class="page-link" href="#">${i}</a>`;
        
        // 添加点击事件
        if (i !== currentPage) {
            pageLi.querySelector('a').addEventListener('click', (e) => {
                e.preventDefault();
                loadNodes(i);
            });
        }
        
        paginationElement.appendChild(pageLi);
    }
    
    // 下一页按钮
    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
    nextLi.innerHTML = `
        <a class="page-link" href="#" aria-label="下一页" ${currentPage === totalPages ? 'tabindex="-1" aria-disabled="true"' : ''}>
            <span aria-hidden="true">&raquo;</span>
        </a>
    `;
    if (currentPage < totalPages) {
        nextLi.querySelector('a').addEventListener('click', (e) => {
            e.preventDefault();
            loadNodes(currentPage + 1);
        });
    }
    paginationElement.appendChild(nextLi);
}

/**
 * 显示添加节点模态框
 */
function showAddNodeModal() {
    // 重置表单
    const form = document.getElementById('node-form');
    if (form) form.reset();
    
    // 清除节点ID（表示这是新增操作）
    const nodeIdInput = document.getElementById('node-id');
    if (nodeIdInput) nodeIdInput.value = '';
    
    // 清空属性区域，添加title和name属性
    const propertiesContainer = document.getElementById('node-properties');
    if (propertiesContainer) {
        propertiesContainer.innerHTML = `
            <!-- title属性（显示名称） -->
            <div class="property-field mb-2" data-key="title">
                <div class="input-group">
                    <span class="input-group-text bg-info text-white">title (标题)</span>
                    <input type="text" class="form-control property-value" name="title" required>
                </div>
                <div class="form-text">标题属性，会作为节点显示名称</div>
            </div>
            
            <!-- name属性（系统名称） -->
            <div class="property-field mb-2" data-key="name">
                <div class="input-group">
                    <span class="input-group-text">name (系统名)</span>
                    <input type="text" class="form-control property-value" name="name" required>
                </div>
                <div class="form-text">系统内部使用的名称（如未填写，将自动使用title属性值）</div>
            </div>
        `;
    }
    
    // 设置标题
    const modalTitle = document.getElementById('nodeModalTitle');
    if (modalTitle) modalTitle.textContent = '添加节点';
    
    // 清除编辑状态
    editingNodeId = null;
    
    // 显示保存按钮
    const saveBtn = document.getElementById('save-node');
    if (saveBtn) saveBtn.style.display = 'block';
    
    // 显示添加属性按钮
    const addPropertyBtn = document.getElementById('add-property');
    if (addPropertyBtn) addPropertyBtn.style.display = 'block';
    
    // 显示模态框
    const modal = new bootstrap.Modal(document.getElementById('nodeModal'));
    modal.show();
}

/**
 * 显示查看节点模态框
 * @param {string} nodeId 节点ID
 */
function showViewNodeModal(nodeId) {
    // 加载节点数据
    fetch(`/api/admin/nodes/${nodeId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`服务器响应错误: ${response.status}`);
            }
            return response.json();
        })
        .then(node => {
            // 获取显示名称，优先使用title属性
            const displayName = (node.properties && node.properties.title) || 
                               node.title || 
                               node.display_name || 
                               node.name || 
                               '未命名节点';
            
            // 设置标题
            const modalTitle = document.getElementById('nodeModalTitle');
            if (modalTitle) modalTitle.textContent = `查看节点：${displayName}`;
            
            // 填充表单（只读模式）
            fillNodeForm(node, true);
            
            // 隐藏保存按钮
            const saveBtn = document.getElementById('save-node');
            if (saveBtn) saveBtn.style.display = 'none';
            
            // 隐藏添加属性按钮
            const addPropertyBtn = document.getElementById('add-property');
            if (addPropertyBtn) addPropertyBtn.style.display = 'none';
            
            // 显示模态框
            const modal = new bootstrap.Modal(document.getElementById('nodeModal'));
            modal.show();
        })
        .catch(error => {
            console.error('加载节点详情失败:', error);
            showToast('错误', `加载节点详情失败: ${error.message}`, 'danger');
        });
}

/**
 * 显示编辑节点模态框
 * @param {string} nodeId 节点ID
 */
function showEditNodeModal(nodeId) {
    // 加载节点数据
    fetch(`/api/admin/nodes/${nodeId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`服务器响应错误: ${response.status}`);
            }
            return response.json();
        })
        .then(node => {
            // 获取显示名称，优先使用title属性
            const displayName = (node.properties && node.properties.title) || 
                               node.title || 
                               node.display_name || 
                               node.name || 
                               '未命名节点';
            
            // 填充表单（可编辑模式）
            fillNodeForm(node, false);
            
            // 设置编辑状态
            editingNodeId = nodeId;
            
            // 设置标题
            const modalTitle = document.getElementById('nodeModalTitle');
            if (modalTitle) modalTitle.textContent = `编辑节点：${displayName}`;
            
            // 显示保存按钮
            const saveBtn = document.getElementById('save-node');
            if (saveBtn) saveBtn.style.display = 'block';
            
            // 显示添加属性按钮
            const addPropertyBtn = document.getElementById('add-property');
            if (addPropertyBtn) addPropertyBtn.style.display = 'block';
            
            // 显示模态框
            const modal = new bootstrap.Modal(document.getElementById('nodeModal'));
            modal.show();
        })
        .catch(error => {
            console.error('加载节点详情失败:', error);
            showToast('错误', `加载节点详情失败: ${error.message}`, 'danger');
        });
}

/**
 * 填充节点表单
 * @param {Object} node 节点数据
 * @param {boolean} readOnly 是否只读模式
 */
function fillNodeForm(node, readOnly) {
    // 设置节点ID
    const nodeIdInput = document.getElementById('node-id');
    if (nodeIdInput) nodeIdInput.value = node.id;
    
    // 设置节点名称（用于传统节点名称字段，实际上现在主要作用是兼容）
    const nodeNameInput = document.getElementById('node-name');
    if (nodeNameInput) {
        // 优先使用title属性作为显示名称
        const displayName = (node.properties && node.properties.title) || 
                           node.title || 
                           node.display_name || 
                           node.name || '';
        nodeNameInput.value = displayName;
        nodeNameInput.readOnly = readOnly;
    }
    
    // 设置节点类型
    const nodeTypeSelect = document.getElementById('node-type');
    if (nodeTypeSelect) {
        // 确保节点类型存在于选项中
        let typeExists = false;
        for (let i = 0; i < nodeTypeSelect.options.length; i++) {
            if (nodeTypeSelect.options[i].value === node.type) {
                typeExists = true;
                break;
            }
        }
        
        // 如果类型不存在，添加它
        if (!typeExists && node.type) {
            nodeTypeSelect.innerHTML += `<option value="${escapeHtml(node.type)}">${escapeHtml(node.type)}</option>`;
        }
        
        nodeTypeSelect.value = node.type || '';
        nodeTypeSelect.disabled = readOnly;
    }
    
    // 设置节点属性
    const propertiesContainer = document.getElementById('node-properties');
    if (propertiesContainer) {
        propertiesContainer.innerHTML = '';
        
        const properties = node.properties || {};
        
        // 特殊处理：先添加title属性（如果存在）
        if (properties.title !== undefined || !readOnly) {
            const titleValue = properties.title || '';
            const titleFieldDiv = document.createElement('div');
            titleFieldDiv.className = 'property-field mb-2';
            titleFieldDiv.dataset.key = 'title';
            
            titleFieldDiv.innerHTML = `
                <div class="input-group">
                    <span class="input-group-text bg-info text-white">title (标题)</span>
                    <input type="text" class="form-control property-value" name="title" 
                           value="${escapeHtml(titleValue)}" ${readOnly ? 'readonly' : ''}>
                    ${readOnly ? '' : `
                    <button type="button" class="btn btn-outline-danger remove-property" title="移除属性">
                        <i class="fas fa-times"></i>
                    </button>
                    `}
                </div>
                <div class="form-text">标题属性，会作为节点显示名称</div>
            `;
            
            propertiesContainer.appendChild(titleFieldDiv);
        }
        
        // 特殊处理：再添加name属性（如果存在）
        if (properties.name !== undefined) {
            const nameValue = properties.name || '';
            const nameFieldDiv = document.createElement('div');
            nameFieldDiv.className = 'property-field mb-2';
            nameFieldDiv.dataset.key = 'name';
            
            nameFieldDiv.innerHTML = `
                <div class="input-group">
                    <span class="input-group-text">name (系统名)</span>
                    <input type="text" class="form-control property-value" name="name" 
                           value="${escapeHtml(nameValue)}" ${readOnly ? 'readonly' : ''}>
                    ${readOnly ? '' : `
                    <button type="button" class="btn btn-outline-danger remove-property" title="移除属性">
                        <i class="fas fa-times"></i>
                    </button>
                    `}
                </div>
                <div class="form-text">系统内部使用的名称</div>
            `;
            
            propertiesContainer.appendChild(nameFieldDiv);
        }
        
        // 添加其他属性
        Object.entries(properties).forEach(([key, value]) => {
            // 跳过特殊属性和已处理的属性
            if (key === 'type' || key === 'title' || key === 'name') return;
            
            const fieldDiv = document.createElement('div');
            fieldDiv.className = 'property-field mb-2';
            fieldDiv.dataset.key = key;
            
            fieldDiv.innerHTML = `
                <div class="input-group">
                    <span class="input-group-text">${escapeHtml(key)}</span>
                    <input type="text" class="form-control property-value" name="${escapeHtml(key)}" 
                           value="${escapeHtml(value || '')}" ${readOnly ? 'readonly' : ''}>
                    ${readOnly ? '' : `
                    <button type="button" class="btn btn-outline-danger remove-property" title="移除属性">
                        <i class="fas fa-times"></i>
                    </button>
                    `}
                </div>
            `;
            
            propertiesContainer.appendChild(fieldDiv);
        });
        
        // 为删除按钮添加事件
        propertiesContainer.querySelectorAll('.remove-property').forEach(btn => {
            btn.addEventListener('click', function() {
                this.closest('.property-field').remove();
            });
        });
    }
    
    // 添加属性字段按钮
    const addPropertyBtn = document.getElementById('add-property');
    if (addPropertyBtn) {
        addPropertyBtn.style.display = readOnly ? 'none' : 'block';
    }
}

/**
 * 添加新的属性字段
 */
function addPropertyField() {
    const propertiesContainer = document.getElementById('node-properties');
    if (!propertiesContainer) return;
    
    // 创建一个唯一的键名
    let key = 'property';
    let counter = 1;
    let existingKeys = Array.from(propertiesContainer.querySelectorAll('.property-field')).map(field => field.dataset.key);
    
    while (existingKeys.includes(key + counter)) {
        counter++;
    }
    
    key = key + counter;
    
    // 创建新的属性字段
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'property-field mb-2';
    fieldDiv.dataset.key = key;
    
    fieldDiv.innerHTML = `
        <div class="input-group">
            <input type="text" class="form-control property-key" placeholder="属性名" value="${key}">
            <input type="text" class="form-control property-value" placeholder="属性值">
            <button type="button" class="btn btn-outline-danger remove-property" title="移除属性">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    // 添加到容器
    propertiesContainer.appendChild(fieldDiv);
    
    // 为删除按钮添加事件
    fieldDiv.querySelector('.remove-property').addEventListener('click', function() {
        fieldDiv.remove();
    });
    
    // 为属性名输入框添加事件，更新data-key属性
    fieldDiv.querySelector('.property-key').addEventListener('change', function() {
        fieldDiv.dataset.key = this.value;
    });
}

/**
 * 显示删除确认对话框
 * @param {string} nodeId 节点ID
 * @param {string} nodeName 节点名称
 */
function showDeleteModal(nodeId, nodeName) {
    // 设置要删除的节点ID
    editingNodeId = nodeId;
    
    // 设置节点名称
    const deleteNodeNameElement = document.getElementById('delete-node-name');
    if (deleteNodeNameElement) {
        deleteNodeNameElement.textContent = nodeName;
    }
    
    // 显示确认对话框
    const modal = new bootstrap.Modal(document.getElementById('deleteModal'));
    modal.show();
}

/**
 * 保存节点数据（创建或更新）
 */
function saveNode() {
    // 获取节点数据
    const nodeId = document.getElementById('node-id')?.value;
    const nodeType = document.getElementById('node-type')?.value;
    
    // 收集节点属性
    const nodeProperties = {};
    const propertyFields = document.querySelectorAll('.property-field');
    
    // 处理所有属性字段
    propertyFields.forEach(field => {
        let key = field.dataset.key;
        let value;
        
        // 如果是已有属性（带有input-group-text的字段）
        const keyElement = field.querySelector('.input-group-text');
        if (keyElement) {
            // 清除可能的括号说明文字（例如"title (标题)"）
            key = keyElement.textContent.split(' (')[0].trim();
            value = field.querySelector('.property-value').value.trim();
        } else {
            // 如果是新添加的属性（带有key输入框的字段）
            key = field.querySelector('.property-key').value.trim();
            value = field.querySelector('.property-value').value.trim();
        }
        
        // 将有效属性添加到属性对象中
        if (key) {
            nodeProperties[key] = value;
        }
    });
    
    // 获取title和name属性
    const titleValue = nodeProperties.title || '';
    let nameValue = nodeProperties.name || '';
    
    // 检查必填字段
    if (!titleValue) {
        showToast('错误', '节点标题(title)不能为空', 'danger');
        return;
    }
    
    if (!nodeType) {
        showToast('错误', '节点类型不能为空', 'danger');
        return;
    }
    
    // 如果name为空，自动使用title作为name
    if (!nameValue) {
        nameValue = titleValue;
        nodeProperties.name = nameValue;
    }
    
    // 确保title和name属性存在
    nodeProperties.title = titleValue;
    nodeProperties.name = nameValue;
    
    // 准备请求数据
    const nodeData = {
        name: nameValue,
        title: titleValue, 
        type: nodeType,
        properties: nodeProperties
    };
    
    // 记录正在保存的数据（调试用）
    console.log('正在保存节点数据:', nodeData);
    
    // 确定是创建还是更新
    const isUpdating = !!nodeId;
    const url = isUpdating ? `/api/admin/nodes/${nodeId}` : '/api/admin/nodes';
    const method = isUpdating ? 'PUT' : 'POST';
    
    // 显示保存中状态
    const saveBtn = document.getElementById('save-node');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>保存中...';
    }
    
    // 发送请求
    fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(nodeData)
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || `服务器响应错误: ${response.status}`);
            });
        }
        return response.json();
    })
    .then(data => {
        // 关闭模态框
        const modal = bootstrap.Modal.getInstance(document.getElementById('nodeModal'));
        if (modal) modal.hide();
        
        // 显示成功消息
        showToast('成功', data.message || (isUpdating ? '节点更新成功' : '节点创建成功'), 'success');
        
        // 刷新节点列表
        loadNodes(currentPage);
    })
    .catch(error => {
        console.error('保存节点失败:', error);
        showToast('错误', `保存节点失败: ${error.message}`, 'danger');
    })
    .finally(() => {
        // 恢复保存按钮状态
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '保存';
        }
    });
}

/**
 * 删除节点
 */
function deleteNode() {
    // 检查是否有选中的节点
    if (!editingNodeId) {
        showToast('错误', '未选择要删除的节点', 'danger');
        return;
    }
    
    // 发送删除请求
    fetch(`/api/admin/nodes/${editingNodeId}`, {
        method: 'DELETE'
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || `服务器响应错误: ${response.status}`);
            });
        }
        return response.json();
    })
    .then(data => {
        // 关闭模态框
        const modal = bootstrap.Modal.getInstance(document.getElementById('deleteModal'));
        if (modal) modal.hide();
        
        // 显示成功消息
        showToast('成功', data.message || '节点删除成功', 'success');
        
        // 刷新节点列表
        loadNodes(currentPage);
    })
    .catch(error => {
        console.error('删除节点失败:', error);
        showToast('错误', `删除节点失败: ${error.message}`, 'danger');
    });
}

/**
 * 显示Toast提示框
 * @param {string} title 标题
 * @param {string} message 消息内容
 * @param {string} type 类型（success/danger/warning/info）
 */
function showToast(title, message, type = 'info') {
    // 获取Toast元素
    const toast = document.getElementById('toast');
    const toastTitle = document.getElementById('toast-title');
    const toastMessage = document.getElementById('toast-message');
    
    if (!toast || !toastTitle || !toastMessage) return;
    
    // 设置标题和消息
    toastTitle.textContent = title;
    toastMessage.textContent = message;
    
    // 设置类型样式
    toast.className = 'toast';
    switch (type) {
        case 'success':
            toast.classList.add('bg-success', 'text-white');
            break;
        case 'danger':
            toast.classList.add('bg-danger', 'text-white');
            break;
        case 'warning':
            toast.classList.add('bg-warning', 'text-dark');
            break;
        case 'info':
        default:
            toast.classList.add('bg-info', 'text-dark');
            break;
    }
    
    // 显示Toast
    const bsToast = new bootstrap.Toast(toast, {
        delay: 5000  // 5秒后自动隐藏
    });
    bsToast.show();
}

/**
 * HTML转义函数，防止XSS攻击
 * @param {string} text 要转义的文本
 * @returns {string} 转义后的文本
 */
function escapeHtml(text) {
    if (text === null || text === undefined) {
        return '';
    }
    
    if (typeof text !== 'string') {
        text = String(text);
    }
    
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
} 