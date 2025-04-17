/**
 * 关系管理页面JavaScript
 */

// 全局变量
let currentPage = 1;
let totalPages = 1;
let relationsList = [];
let relationTypes = [];
let currentRelationId = null;
let currentRelation = null;

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', () => {
    // 初始化页面
    init();
    
    // 初始化节点搜索功能
    initNodeSearch();
    
    // 监听节点名称变化
    watchNodeInputs();
    
    // 监听关系类型变化
    watchRelationTypeInput();
});

/**
 * 初始化页面
 */
function init() {
    // 添加浏览器控制台警告，提醒ID处理方式
    console.warn('⚠️ 警告: 本系统中的Neo4j节点和关系ID为大整数，超出JavaScript安全整数范围，' + 
                 '必须使用字符串形式处理，避免使用parseInt等方法转换为数字类型');
    console.info('JavaScript最大安全整数: ' + Number.MAX_SAFE_INTEGER + '，超过此值可能导致精度丢失');
    console.info('Neo4j节点和关系ID长度通常为19位，需要确保完整精度');
    
    // 添加样式规则，确保ID列宽度足够并使用等宽字体
    addCustomStyles();
    
    // 处理已存在的id-cell元素
    processExistingIdCells();
    
    // 检查数据库连接状态
    checkDatabaseConnection();
    
    // 加载关系类型
    loadRelationTypes();
    
    // 加载关系列表
    loadRelations(currentPage);
    
    // 注册事件处理程序
    registerEventHandlers();
}

/**
 * 添加自定义样式规则
 */
function addCustomStyles() {
    // 创建样式元素
    const style = document.createElement('style');
    style.textContent = `
        /* ID单元格样式 */
        .id-cell {
            font-family: 'Consolas', 'Courier New', monospace; /* 等宽字体确保数字对齐 */
            white-space: nowrap;    /* 防止ID换行 */
            min-width: 200px;       /* 确保足够宽度容纳19位ID */
            overflow: visible;      /* 确保ID完全可见 */
            word-break: keep-all;   /* 防止ID被分割 */
            font-size: 0.9rem;      /* 稍微小一点的字体 */
            user-select: all;       /* 点击时选中整个ID便于复制 */
            cursor: copy;           /* 显示复制指针 */
            letter-spacing: 0.5px;  /* 字母间距稍大，提高可读性 */
            border-right: 1px dashed #dee2e6; /* 添加分隔线 */
            font-weight: 500;       /* 稍微加粗 */
            padding: 0.5rem;        /* 增加内边距 */
            color: #495057;         /* 颜色更深，增加对比度 */
        }
        
        /* 让ID列显示更突出 */
        .id-cell::before {
            content: "ID: ";
            color: #6c757d;
            font-weight: normal;
            font-size: 0.85rem;
        }
        
        /* 表格头部ID列固定宽度 */
        table th:first-child {
            min-width: 200px;
            width: 200px;
            font-family: sans-serif; /* 表头使用非等宽字体 */
            text-align: center;
            background-color: #f8f9fa;
        }
        
        /* ID高亮样式 */
        .id-cell:hover {
            background-color: #f0f8ff; /* 淡蓝色背景 */
            border-radius: 4px;
            box-shadow: inset 0 0 0 1px #c5e5fd;
        }
        
        /* 显示已选择ID的输入框样式 */
        input.has-id {
            border-color: #28a745 !important;
            background-color: #f8fff8 !important;
            box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.075), 0 0 0 0.2rem rgba(40, 167, 69, 0.25);
        }
        
        /* 为了更好地突出19位ID，添加特殊样式 */
        .id-cell[data-length="19"] {
            font-weight: bold;
            color: #212529;
        }
        
        /* 字体上下间距调整，使19位数字更易读 */
        .id-cell {
            line-height: 1.5;
            padding-top: 6px;
            padding-bottom: 6px;
        }
        
        /* 表格中的ID列整体精致化 */
        table tbody tr td:first-child {
            position: relative;
            background-color: #fafafa;
        }

        /* 数组格式展示的ID样式 */
        .id-array {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            padding: 4px;
            background-color: #f8f9fa;
            border-radius: 4px;
            margin-top: 5px;
        }
        
        .id-digit {
            display: inline-block;
            width: 18px;
            height: 24px;
            line-height: 24px;
            text-align: center;
            margin: 1px;
            font-family: monospace;
            font-size: 1rem;
            background-color: white;
            border: 1px solid #dee2e6;
            border-radius: 3px;
            color: #495057;
        }
    `;
    
    // 将样式添加到文档头部
    document.head.appendChild(style);
    
    console.log('添加了自定义样式，优化ID显示，确保19位ID完整显示');
    
    // 添加ID长度检测功能 - 使用MutationObserver替换已弃用的DOMNodeInserted事件
    const idCellObserverCallback = function(mutationsList, observer) {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    // 检查是否为元素节点
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // 检查节点本身是否为id-cell
                        if (node.classList && node.classList.contains('id-cell')) {
                            processIdCell(node);
                        }
                        
                        // 检查子元素中是否有id-cell
                        const idCells = node.querySelectorAll('.id-cell');
                        idCells.forEach(idCell => processIdCell(idCell));
                    }
                });
            }
        }
    };
    
    // 创建并启动观察器 - 使用全局变量以便在其他函数中访问
    window.idCellObserver = new MutationObserver(idCellObserverCallback);
    
    // 配置观察选项已移动到startIdCellObserver函数中
}

/**
 * 检查数据库连接状态
 */
function checkDatabaseConnection() {
    console.log('检查数据库连接状态...');
    
    const connectedBadge = document.getElementById('db-connected');
    const disconnectedBadge = document.getElementById('db-disconnected');
    
    // 发送一个简单的请求来检查数据库连接
    fetch('/api/relation-types')
        .then(response => {
            if (!response.ok) {
                throw new Error(`服务器响应错误: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('数据库连接成功:', data);
            
            // 更新连接状态指示器
            if (connectedBadge) connectedBadge.classList.remove('d-none');
            if (disconnectedBadge) disconnectedBadge.classList.add('d-none');
            
            // 启用添加关系按钮
            const addRelationBtn = document.getElementById('btn-add-relation');
            if (addRelationBtn) addRelationBtn.disabled = false;
        })
        .catch(error => {
            console.error('数据库连接检查失败:', error);
            
            // 更新连接状态指示器
            if (connectedBadge) connectedBadge.classList.add('d-none');
            if (disconnectedBadge) {
                disconnectedBadge.classList.remove('d-none');
                disconnectedBadge.innerHTML = `<i class="fas fa-exclamation-triangle me-1"></i>数据库连接失败: ${error.message || '未知错误'}`;
            }
            
            // 禁用添加关系按钮
            const addRelationBtn = document.getElementById('btn-add-relation');
            if (addRelationBtn) addRelationBtn.disabled = true;
            
            // 显示错误提示
            showToast('无法连接到数据库，请检查Neo4j服务是否正在运行', 'error');
            
            // 10秒后重试
            setTimeout(checkDatabaseConnection, 10000);
        });
}

/**
 * 加载关系类型
 */
function loadRelationTypes() {
    fetch('/api/relation-types')
        .then(response => response.json())
        .then(data => {
            relationTypes = data.types || [];
            populateRelationTypesDropdown();
        })
        .catch(error => {
            console.error('获取关系类型失败:', error);
            showToast('获取关系类型失败', 'error');
        });
}

/**
 * 填充关系类型下拉框
 */
function populateRelationTypesDropdown() {
    const filterSelect = document.getElementById('filter-relation');
    const datalist = document.getElementById('relation-types-list');
    
    // 清空现有选项
    if (filterSelect) {
        filterSelect.innerHTML = '<option value="">全部类型</option>';
    }
    
    if (datalist) {
        datalist.innerHTML = '';
    }
    
    // 添加关系类型选项
    relationTypes.forEach(type => {
        if (filterSelect) {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            filterSelect.appendChild(option);
        }
        
        if (datalist) {
            const option = document.createElement('option');
            option.value = type;
            datalist.appendChild(option);
        }
    });
}

/**
 * 加载关系列表
 * @param {number} page 页码
 */
function loadRelations(page) {
    // 获取筛选参数
    const source = document.getElementById('filter-source').value.trim();
    const relation = document.getElementById('filter-relation').value;
    const target = document.getElementById('filter-target').value.trim();
    
    // 构建请求URL
    let url = `/api/admin/relations?page=${page}&limit=10`;
    if (source) url += `&source=${encodeURIComponent(source)}`;
    if (relation) url += `&type=${encodeURIComponent(relation)}`;
    if (target) url += `&target=${encodeURIComponent(target)}`;
    
    // 发送请求
    fetch(url)
        .then(response => response.json())
        .then(data => {
            relationsList = data.relations || [];
            totalPages = data.pages || 1;
            currentPage = page;
            
            // 更新关系列表
            updateRelationsList();
            
            // 更新分页
            updatePagination();
        })
        .catch(error => {
            console.error('加载关系列表失败:', error);
            showToast('加载关系列表失败', 'error');
        });
}

/**
 * 更新关系列表
 */
function updateRelationsList() {
    const tableBody = document.getElementById('relation-list');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    if (!relationsList || relationsList.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center">没有找到符合条件的关系</td></tr>';
        return;
    }
    
    relationsList.forEach(relation => {
        const row = document.createElement('tr');
        
        // 获取源节点和目标节点信息，确保不是undefined
        const sourceName = relation.source_name || '未命名';
        const sourceType = relation.source_type || '未知';
        const sourceDisplay = `${sourceName} <span class="badge bg-light text-dark">${sourceType}</span>`;
        
        const targetName = relation.target_name || '未命名';
        const targetType = relation.target_type || '未知';
        const targetDisplay = `${targetName} <span class="badge bg-light text-dark">${targetType}</span>`;
        
        // 保存源节点和目标节点ID供编辑和删除使用，但不显示
        const sourceId = String(relation.source_id || '');
        const targetId = String(relation.target_id || '');
        const relationType = relation.type || '未知关系';
        
        // 将关系信息存储为自定义数据属性，用于后续编辑和删除操作
        const relationData = {
            sourceId: sourceId,
            targetId: targetId,
            type: relationType,
            sourceName: sourceName,
            targetName: targetName,
            sourceType: sourceType,
            targetType: targetType
        };
        
        const relationDataAttr = encodeURIComponent(JSON.stringify(relationData));
        
        row.innerHTML = `
            <td>${sourceDisplay}</td>
            <td><span class="badge bg-secondary">${relationType}</span></td>
            <td>${targetDisplay}</td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary edit-relation-btn" data-relation-info="${relationDataAttr}" title="编辑关系">
                        <i class="fas fa-edit"></i>
                    </button>
                    <div class="btn-group-vertical border-start"></div>
                    <button class="btn btn-danger delete-relation-btn" data-relation-info="${relationDataAttr}" title="删除关系">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </td>
        `;
        
        tableBody.appendChild(row);
        
        // 添加点击事件监听器，避免在HTML中内联事件处理程序
        const editBtn = row.querySelector('.edit-relation-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                const relationInfo = JSON.parse(decodeURIComponent(editBtn.getAttribute('data-relation-info')));
                console.log(`点击编辑按钮，关系: ${relationInfo.sourceName} -[${relationInfo.type}]-> ${relationInfo.targetName}`);
                editRelationByNodes(relationInfo);
            });
        }
        
        const deleteBtn = row.querySelector('.delete-relation-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                const relationInfo = JSON.parse(decodeURIComponent(deleteBtn.getAttribute('data-relation-info')));
                console.log(`点击删除按钮，关系: ${relationInfo.sourceName} -[${relationInfo.type}]-> ${relationInfo.targetName}`);
                showDeleteConfirmationByNodes(relationInfo);
            });
        }
    });
}

/**
 * 更新分页控件
 */
function updatePagination() {
    const pagination = document.getElementById('pagination');
    if (!pagination) return;
    
    pagination.innerHTML = '';
    
    // 添加上一页按钮
    const prevItem = document.createElement('li');
    prevItem.className = `page-item ${currentPage <= 1 ? 'disabled' : ''}`;
    prevItem.innerHTML = `
        <a class="page-link" href="#" onclick="return ${currentPage > 1 ? 'loadRelations(' + (currentPage - 1) + ')' : 'false'}">
            <i class="fas fa-chevron-left"></i>
        </a>
    `;
    pagination.appendChild(prevItem);
    
    // 计算要显示的页码范围
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    
    if (endPage - startPage < 4 && totalPages > 4) {
        startPage = Math.max(1, endPage - 4);
    }
    
    // 添加页码按钮
    for (let i = startPage; i <= endPage; i++) {
        const pageItem = document.createElement('li');
        pageItem.className = `page-item ${i === currentPage ? 'active' : ''}`;
        pageItem.innerHTML = `
            <a class="page-link" href="#" onclick="return loadRelations(${i})">${i}</a>
        `;
        pagination.appendChild(pageItem);
    }
    
    // 添加下一页按钮
    const nextItem = document.createElement('li');
    nextItem.className = `page-item ${currentPage >= totalPages ? 'disabled' : ''}`;
    nextItem.innerHTML = `
        <a class="page-link" href="#" onclick="return ${currentPage < totalPages ? 'loadRelations(' + (currentPage + 1) + ')' : 'false'}">
            <i class="fas fa-chevron-right"></i>
        </a>
    `;
    pagination.appendChild(nextItem);
}

/**
 * 注册事件处理程序
 */
function registerEventHandlers() {
    // 搜索按钮点击事件
    const searchBtn = document.getElementById('btn-search');
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            currentPage = 1;
            loadRelations(currentPage);
        });
    }
    
    // 回车键搜索
    const filterInputs = ['filter-source', 'filter-target'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('keyup', (event) => {
                if (event.key === 'Enter') {
                    currentPage = 1;
                    loadRelations(currentPage);
                }
            });
        }
    });
    
    // 关系类型选择变化时搜索
    const filterRelation = document.getElementById('filter-relation');
    if (filterRelation) {
        filterRelation.addEventListener('change', () => {
            currentPage = 1;
            loadRelations(currentPage);
        });
    }
    
    // 添加关系按钮事件
    const addRelationBtn = document.getElementById('btn-add-relation');
    if (addRelationBtn) {
        addRelationBtn.addEventListener('click', () => {
            resetRelationForm();
            // 设置模态框标题
            document.getElementById('relationModalTitle').textContent = '添加关系';
            const modal = new bootstrap.Modal(document.getElementById('relationModal'));
            modal.show();
        });
    }
    
    // 三元组组件点击事件
    setupTripleItemsClickHandlers();
    
    // 保存关系按钮事件
    const saveRelationBtn = document.getElementById('save-relation');
    if (saveRelationBtn) {
        saveRelationBtn.addEventListener('click', () => {
            saveRelation();
        });
    }
    
    // 确认删除按钮事件
    const confirmDeleteBtn = document.getElementById('confirm-delete');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', () => {
            deleteRelationByNodes();
        });
    }
    
    // 高级搜索按钮事件
    const advancedSearchBtn = document.getElementById('btn-advanced-search');
    if (advancedSearchBtn) {
        advancedSearchBtn.addEventListener('click', () => {
            const advancedPanel = document.getElementById('advanced-search-panel');
            if (advancedPanel) {
                advancedPanel.classList.toggle('d-none');
            }
        });
    }
    
    // 添加属性按钮事件
    const addPropertyBtn = document.getElementById('add-property');
    if (addPropertyBtn) {
        addPropertyBtn.addEventListener('click', () => {
            addPropertyField();
        });
    }
}

/**
 * 设置三元组组件的点击事件处理程序
 */
function setupTripleItemsClickHandlers() {
    // 源节点点击事件 - 聚焦到源节点输入框
    const sourceVisual = document.getElementById('visual-source');
    if (sourceVisual) {
        sourceVisual.addEventListener('click', () => {
            const sourceNameInput = document.getElementById('relation-source-name');
            if (sourceNameInput) {
                sourceNameInput.focus();
            }
        });
    }
    
    // 关系类型点击事件 - 聚焦到关系类型输入框
    const relationVisual = document.getElementById('visual-relation');
    if (relationVisual) {
        relationVisual.addEventListener('click', () => {
            const relationTypeInput = document.getElementById('relation-type-input');
            if (relationTypeInput) {
                relationTypeInput.focus();
            }
        });
    }
    
    // 目标节点点击事件 - 聚焦到目标节点输入框
    const targetVisual = document.getElementById('visual-target');
    if (targetVisual) {
        targetVisual.addEventListener('click', () => {
            const targetNameInput = document.getElementById('relation-target-name');
            if (targetNameInput) {
                targetNameInput.focus();
            }
        });
    }
}

/**
 * 基于源节点和目标节点编辑关系
 * @param {Object} relationInfo 关系信息对象
 */
function editRelationByNodes(relationInfo) {
    console.info(`准备编辑关系: ${relationInfo.sourceName} -[${relationInfo.type}]-> ${relationInfo.targetName}`);
    
    // 首先清空表单
    resetRelationForm();
    
    // 设置源节点和目标节点信息
    document.getElementById('relation-source').value = relationInfo.sourceId;
    document.getElementById('relation-source-name').value = relationInfo.sourceName;
    document.getElementById('relation-target').value = relationInfo.targetId;
    document.getElementById('relation-target-name').value = relationInfo.targetName;
    document.getElementById('relation-type').value = relationInfo.type;
    document.getElementById('relation-type-input').value = relationInfo.type;
    
    // 保存原始关系信息，用于后续更新操作
    currentRelation = {
        sourceId: relationInfo.sourceId,
        targetId: relationInfo.targetId,
        originalType: relationInfo.type
    };
    
    // 更新三元组可视化
    updateTripleVisualization(relationInfo);
    
    // 获取关系的属性
    fetchRelationProperties(relationInfo);
    
    // 设置模态框标题
    document.getElementById('relationModalTitle').textContent = '编辑关系';
    
    // 显示模态框
    const modal = new bootstrap.Modal(document.getElementById('relationModal'));
    modal.show();
}

/**
 * 获取关系的属性
 * @param {Object} relationInfo 关系信息
 */
function fetchRelationProperties(relationInfo) {
    // 构建请求数据
    const data = {
        sourceNodeId: relationInfo.sourceId,
        targetNodeId: relationInfo.targetId,
        relationType: relationInfo.type
    };
    
    // 发送请求获取关系属性
    fetch('/api/admin/relations/properties-by-nodes', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(result => {
        if (result.error) {
            console.error(`获取关系属性出错: ${result.error}`);
            showToast(result.error, 'warning');
            return;
        }
        
        // 显示关系属性
        displayRelationProperties(result.properties || {});
    })
    .catch(error => {
        console.error('获取关系属性失败:', error);
        showToast('获取关系属性失败: ' + (error.message || '未知错误'), 'error');
    });
}

/**
 * 显示基于节点的删除确认对话框
 * @param {Object} relationInfo 关系信息
 */
function showDeleteConfirmationByNodes(relationInfo) {
    console.info(`准备删除关系: ${relationInfo.sourceName} -[${relationInfo.type}]-> ${relationInfo.targetName}`);
    
    // 保存当前要删除的关系信息
    currentRelation = {
        sourceId: relationInfo.sourceId,
        targetId: relationInfo.targetId,
        type: relationInfo.type,
        sourceName: relationInfo.sourceName,
        targetName: relationInfo.targetName,
        sourceType: relationInfo.sourceType,
        targetType: relationInfo.targetType
    };
    
    // 更新确认对话框内容
    const sourceEl = document.getElementById('delete-source');
    const relationEl = document.getElementById('delete-relation');
    const targetEl = document.getElementById('delete-target');
    
    if (sourceEl) sourceEl.innerHTML = `${relationInfo.sourceName} <small class="text-muted">(${relationInfo.sourceType})</small>`;
    if (relationEl) relationEl.textContent = relationInfo.type;
    if (targetEl) targetEl.innerHTML = `${relationInfo.targetName} <small class="text-muted">(${relationInfo.targetType})</small>`;
    
    // 显示确认对话框
    const modal = new bootstrap.Modal(document.getElementById('deleteModal'));
    modal.show();
}

/**
 * 基于节点信息删除关系
 */
function deleteRelationByNodes() {
    if (!currentRelation) {
        showToast('无法删除关系，未指定关系信息', 'error');
        return;
    }
    
    // 禁用删除按钮，防止重复点击
    const confirmBtn = document.getElementById('confirm-delete');
    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>删除中...';
    }
    
    // 构建请求数据
    const data = {
        sourceNodeId: currentRelation.sourceId,
        targetNodeId: currentRelation.targetId,
        relationType: currentRelation.type
    };
    
    // 发送请求
    fetch('/api/admin/relations/delete-by-nodes', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => {
        console.info(`删除关系请求状态码: ${response.status}`);
        return response.json();
    })
    .then(result => {
        console.info('删除关系响应:', result);
        
        // 启用删除按钮
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = '<i class="fas fa-trash-alt me-1"></i>确认删除';
        }
        
        if (result.error) {
            console.error(`删除关系出错: ${result.error}`);
            showToast(result.error, 'error');
            return;
        }
        
        // 关闭确认对话框
        const modal = bootstrap.Modal.getInstance(document.getElementById('deleteModal'));
        if (modal) {
            modal.hide();
        }
        
        // 构建详细的成功消息
        let successMsg = '关系删除成功';
        if (result.deleted_count && result.deleted_count > 0) {
            successMsg = `成功删除 ${result.deleted_count} 个关系: ${currentRelation.sourceName} -[${currentRelation.type}]-> ${currentRelation.targetName}`;
        }
        
        console.info(successMsg);
        
        // 显示成功消息
        showToast(successMsg, 'success');
        
        // 重新加载关系列表
        loadRelations(currentPage);
    })
    .catch(error => {
        console.error('删除关系失败:', error);
        showToast('删除关系失败: ' + (error.message || '未知错误'), 'error');
        
        // 启用删除按钮
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = '<i class="fas fa-trash-alt me-1"></i>确认删除';
        }
    });
}

/**
 * 显示关系详情
 * @param {Object} relation 关系对象
 */
function displayRelationDetails(relation) {
    // 确保所有ID都是字符串类型且保持完整精度
    const relationId = String(relation.id || '');
    const sourceId = String(relation.source_id || '');
    const targetId = String(relation.target_id || '');
    
    console.log(`显示关系详情: ID=${relationId}, 长度=${relationId.length}位`);
    console.log(`源节点ID: ${sourceId}, 长度=${sourceId.length}位`);
    console.log(`目标节点ID: ${targetId}, 长度=${targetId.length}位`);
    
    // 设置关系ID，确保显示完整19位
    document.getElementById('relation-id').value = relationId;
    
    // 设置源节点和目标节点信息，确保ID完整性
    document.getElementById('relation-source').value = sourceId;
    document.getElementById('relation-source-name').value = relation.source_name || '';
    document.getElementById('relation-target').value = targetId;
    document.getElementById('relation-target-name').value = relation.target_name || '';
    
    // 设置关系类型
    document.getElementById('relation-type').value = relation.type || '';
    document.getElementById('relation-type-input').value = relation.type || '';
    
    // 添加ID长度信息到UI元素的title属性
    const sourceNameInput = document.getElementById('relation-source-name');
    if (sourceNameInput && sourceId) {
        sourceNameInput.title = `ID: ${sourceId} (${sourceId.length}位)`;
    }
    
    const targetNameInput = document.getElementById('relation-target-name');
    if (targetNameInput && targetId) {
        targetNameInput.title = `ID: ${targetId} (${targetId.length}位)`;
    }
    
    // 添加特殊样式以突出显示必填字段
    sourceNameInput?.classList.add('has-id');
    targetNameInput?.classList.add('has-id');
    
    // 更新三元组可视化
    updateTripleVisualization(relation);
    
    // 显示关系属性
    displayRelationProperties(relation.properties || {});
    
    // 确保表单控件处于可用状态
    const formInputs = document.querySelectorAll('#relation-form input:not([type="hidden"])');
    formInputs.forEach(input => { input.disabled = false; });
    
    // 确保节点搜索按钮可用
    const sourceSearchBtn = document.getElementById('search-source-node');
    const targetSearchBtn = document.getElementById('search-target-node');
    if (sourceSearchBtn) sourceSearchBtn.disabled = false;
    if (targetSearchBtn) targetSearchBtn.disabled = false;
    
    // 显示添加属性按钮
    const addPropertyBtn = document.getElementById('add-property');
    if (addPropertyBtn) {
        addPropertyBtn.style.display = 'inline-block';
    }
    
    // 启用保存按钮
    const saveBtn = document.getElementById('save-relation');
    if (saveBtn) {
        saveBtn.disabled = false;
    }
}

/**
 * 更新三元组可视化
 * @param {Object} data 关系数据
 */
function updateTripleVisualization(data) {
    if (!data) return;
    
    const sourceVisual = document.getElementById('visual-source');
    const relationVisual = document.getElementById('visual-relation');
    const targetVisual = document.getElementById('visual-target');
    
    if (sourceVisual && (data.sourceName || data.source_name)) {
        sourceVisual.textContent = data.sourceName || data.source_name || '源节点';
        sourceVisual.classList.remove('validation-warning');
    }
    
    if (relationVisual && data.type) {
        relationVisual.textContent = data.type;
        relationVisual.classList.remove('validation-warning');
    }
    
    if (targetVisual && (data.targetName || data.target_name)) {
        targetVisual.textContent = data.targetName || data.target_name || '目标节点';
        targetVisual.classList.remove('validation-warning');
    }
}

/**
 * 显示关系属性
 * @param {Object} properties 属性对象
 */
function displayRelationProperties(properties) {
    const propertiesContainer = document.getElementById('relation-properties');
    
    if (!propertiesContainer) return;
    
    // 清空现有属性
    propertiesContainer.innerHTML = '';
    
    // 如果没有属性
    if (!properties || Object.keys(properties).length === 0) {
        propertiesContainer.innerHTML = '<p class="text-muted text-center">无属性</p>';
        return;
    }
    
    // 添加每个属性
    Object.entries(properties).forEach(([key, value]) => {
        addPropertyField(key, value);
    });
}

/**
 * 将ID转换为数组形式，确保19位精度
 * @param {string|number} id 要转换的ID
 * @returns {Array} 19位数字的数组
 */
function idToArray(id) {
    // 确保ID是字符串类型
    const idStr = String(id || '');
    console.log(`转换ID为数组: ${idStr}, 长度: ${idStr.length}位`);
    
    // 如果ID不符合要求，发出警告
    if (!/^\d+$/.test(idStr)) {
        console.warn(`ID格式异常，不是纯数字: ${idStr}`);
    }
    
    // 创建19位数组，初始化为0
    const digitArray = new Array(19).fill(0);
    
    // 将ID的每一位填入数组，从右向左填充
    for (let i = 0; i < idStr.length && i < 19; i++) {
        const digitPosition = idStr.length - 1 - i; // 从右向左
        const arrayPosition = 18 - i; // 数组从右向左填充
        digitArray[arrayPosition] = parseInt(idStr.charAt(digitPosition), 10);
    }
    
    console.log(`ID数组结果: [${digitArray.join(', ')}]`);
    return digitArray;
}

/**
 * 将数组格式的ID转回字符串
 * @param {Array} idArray 19位数字数组
 * @returns {string} 字符串形式的ID
 */
function arrayToId(idArray) {
    if (!Array.isArray(idArray) || idArray.length !== 19) {
        console.error(`ID数组格式不正确: ${JSON.stringify(idArray)}`);
        return '';
    }
    
    // 移除前导零
    let startIndex = 0;
    while (startIndex < 18 && idArray[startIndex] === 0) {
        startIndex++;
    }
    
    // 将非零数字拼接成字符串
    const idStr = idArray.slice(startIndex).join('');
    console.log(`数组转回ID: ${idStr}, 长度: ${idStr.length}位`);
    
    return idStr;
}

/**
 * 创建可视化的ID数组展示界面
 * @param {string|number} id 要展示的ID
 * @param {string} containerId 容器元素ID
 */
function createIdArrayVisualization(id, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // 将ID转为数组
    const idArray = idToArray(id);
    
    // 创建展示元素
    const visualContainer = document.createElement('div');
    visualContainer.className = 'id-array';
    
    // 为每一位创建一个格子
    idArray.forEach((digit, index) => {
        const digitElement = document.createElement('span');
        digitElement.className = 'id-digit';
        digitElement.textContent = digit;
        digitElement.setAttribute('data-position', index);
        digitElement.title = `位置: ${index+1}/19`;
        
        // 标记前导零
        if (digit === 0 && index < 18 && idArray.slice(0, index+1).every(d => d === 0)) {
            digitElement.style.color = '#adb5bd';
            digitElement.style.backgroundColor = '#f8f9fa';
        }
        
        visualContainer.appendChild(digitElement);
    });
    
    // 清空并添加到容器
    container.innerHTML = '';
    container.appendChild(visualContainer);
}

/**
 * 添加属性字段
 * @param {string} key 属性名
 * @param {*} value 属性值
 */
function addPropertyField(key = '', value = '') {
    const propertiesContainer = document.getElementById('relation-properties');
    
    if (!propertiesContainer) return;
    
    const propertyRow = document.createElement('div');
    propertyRow.className = 'property-row';
    
    propertyRow.innerHTML = `
        <input type="text" class="property-key" placeholder="属性名" value="${key}">
        <input type="text" class="property-value" placeholder="属性值" value="${value}">
        <button type="button" class="btn btn-outline-danger btn-sm remove-property"><i class="fas fa-times"></i></button>
    `;
    
    // 添加删除按钮事件
    const removeBtn = propertyRow.querySelector('.remove-property');
    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            propertyRow.remove();
        });
    }
    
    propertiesContainer.appendChild(propertyRow);
}

/**
 * 重置关系表单
 */
function resetRelationForm() {
    // 清空关系ID和当前关系信息
    currentRelationId = null;
    currentRelation = null;
    document.getElementById('relation-id').value = '';
    
    // 清空源节点和目标节点
    document.getElementById('relation-source').value = '';
    document.getElementById('relation-source-name').value = '';
    document.getElementById('relation-target').value = '';
    document.getElementById('relation-target-name').value = '';
    
    // 清空关系类型
    document.getElementById('relation-type').value = '';
    document.getElementById('relation-type-input').value = '';
    
    // 重置三元组可视化
    document.getElementById('visual-source').textContent = '源节点';
    document.getElementById('visual-relation').textContent = '关系';
    document.getElementById('visual-target').textContent = '目标节点';
    
    // 清空属性
    const propertiesContainer = document.getElementById('relation-properties');
    if (propertiesContainer) {
        propertiesContainer.innerHTML = '';
    }
    
    // 确保节点搜索按钮和输入框处于可用状态
    const sourceSearchBtn = document.getElementById('search-source-node');
    const targetSearchBtn = document.getElementById('search-target-node');
    const formInputs = document.querySelectorAll('#relation-form input:not([type="hidden"])');
    
    if (sourceSearchBtn) sourceSearchBtn.disabled = false;
    if (targetSearchBtn) targetSearchBtn.disabled = false;
    formInputs.forEach(input => { input.disabled = false; });
    
    // 显示添加属性按钮
    const addPropertyBtn = document.getElementById('add-property');
    if (addPropertyBtn) {
        addPropertyBtn.style.display = 'inline-block';
    }
    
    // 设置模态框标题
    document.getElementById('relationModalTitle').textContent = '添加关系';
}

/**
 * 保存关系
 */
function saveRelation() {
    console.log('开始保存关系...');
    
    // 获取源节点和目标节点
    const sourceId = document.getElementById('relation-source').value;
    const sourceName = document.getElementById('relation-source-name').value;
    const targetId = document.getElementById('relation-target').value;
    const targetName = document.getElementById('relation-target-name').value;
    const relationType = document.getElementById('relation-type-input').value;
    
    console.log(`源节点: ID=${sourceId}, 名称=${sourceName}`);
    console.log(`目标节点: ID=${targetId}, 名称=${targetName}`);
    console.log(`关系类型: ${relationType}`);
    
    // 验证必填字段
    // 确保sourceId存在且非空
    if (!sourceId || sourceId === 'undefined' || sourceId === 'null' || sourceId.trim() === '') {
        showToast('请选择源节点', 'warning');
        console.log('验证失败: 未选择源节点或节点ID无效', {sourceId, sourceName});
        
        // 聚焦到源节点输入框以便用户操作
        const sourceNameInput = document.getElementById('relation-source-name');
        if (sourceNameInput) {
            sourceNameInput.focus();
        }
        
        // 高亮显示源节点部分提示用户
        const visualSource = document.getElementById('visual-source');
        if (visualSource) {
            visualSource.classList.add('validation-error');
            setTimeout(() => {
                visualSource.classList.remove('validation-error');
            }, 2000);
        }
        return;
    }
    
    if (!relationType) {
        showToast('请输入关系类型', 'warning');
        console.log('验证失败: 未输入关系类型');
        return;
    }
    
    if (!targetId) {
        showToast('请选择目标节点', 'warning');
        console.log('验证失败: 未选择目标节点');
        return;
    }
    
    // 源节点和目标节点不能相同
    if (sourceId === targetId) {
        showToast('源节点和目标节点不能相同', 'warning');
        console.log('验证失败: 源节点和目标节点相同');
        return;
    }
    
    // 获取关系属性
    const properties = {};
    const propertyRows = document.querySelectorAll('.property-row');
    
    propertyRows.forEach((row, index) => {
        const key = row.querySelector('.property-key').value.trim();
        const value = row.querySelector('.property-value').value.trim();
        
        if (key && value) {
            properties[key] = value;
            console.log(`属性 ${index+1}: ${key}=${value}`);
        }
    });
    
    console.log('属性总数:', Object.keys(properties).length);
    
    // 构建请求数据
    const data = {
        sourceNodeId: sourceId,
        targetNodeId: targetId,
        type: relationType,
        properties: properties
    };
    
    // 添加原始关系类型，用于更新操作
    if (currentRelation && currentRelation.originalType) {
        data.originalType = currentRelation.originalType;
    }
    
    // 是否为更新操作
    const isUpdate = currentRelation && 
                     currentRelation.sourceId === sourceId && 
                     currentRelation.targetId === targetId;
    
    console.log(`操作类型: ${isUpdate ? '更新关系' : '创建关系'}`);
    console.log('请求数据:', JSON.stringify(data));
    
    // 显示保存中状态
    const saveButton = document.getElementById('save-relation');
    if (saveButton) {
        saveButton.disabled = true;
        saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
    }
    
    // 发送请求
    const url = '/api/admin/relations/save-by-nodes';
    
    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => {
        console.log(`收到响应状态: ${response.status}`);
        return response.json();
    })
    .then(result => {
        console.log('响应数据:', result);
        
        // 恢复按钮状态
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.innerHTML = '<i class="fas fa-save btn-icon"></i>保存';
        }
        
        if (result.error) {
            showToast(result.error, 'error');
            console.error('保存失败:', result.error);
            return;
        }
        
        // 关闭模态框
        const modal = bootstrap.Modal.getInstance(document.getElementById('relationModal'));
        if (modal) {
            modal.hide();
        }
        
        // 显示成功消息
        const successMsg = isUpdate ? '关系更新成功' : '关系创建成功';
        showToast(successMsg, 'success');
        console.log(successMsg, result);
        
        // 重新加载关系列表
        loadRelations(currentPage);
    })
    .catch(error => {
        console.error('保存关系时发生错误:', error);
        showToast(`保存关系失败: ${error.message || '未知错误'}`, 'error');
        
        // 恢复按钮状态
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.innerHTML = '<i class="fas fa-save btn-icon"></i>保存';
        }
    });
}

/**
 * 显示提示消息
 * @param {string} message 消息内容
 * @param {string} type 消息类型（success, warning, error）
 */
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastTitle = document.getElementById('toast-title');
    const toastMessage = document.getElementById('toast-message');
    
    if (!toast || !toastTitle || !toastMessage) return;
    
    // 设置标题
    let title = '提示';
    let bgClass = 'bg-info';
    
    switch (type) {
        case 'success':
            title = '成功';
            bgClass = 'bg-success';
            break;
        case 'warning':
            title = '警告';
            bgClass = 'bg-warning';
            break;
        case 'error':
            title = '错误';
            bgClass = 'bg-danger';
            break;
    }
    
    toastTitle.textContent = title;
    toastMessage.textContent = message;
    
    // 移除旧的背景类
    toast.classList.remove('bg-success', 'bg-warning', 'bg-danger', 'bg-info');
    
    // 添加新的背景类
    if (type !== 'info') {
        toast.classList.add(bgClass);
    }
    
    // 显示提示框
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
}

/**
 * 处理已存在的ID单元格
 */
function processExistingIdCells() {
    // 查找页面中所有已存在的id-cell元素
    const existingIdCells = document.querySelectorAll('.id-cell');
    if (existingIdCells.length > 0) {
        console.info(`处理${existingIdCells.length}个已存在的ID单元格`);
        existingIdCells.forEach(cell => processIdCell(cell));
    }
    
    // 确保在DOM内容加载后启动观察器
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            startIdCellObserver();
        });
    } else {
        // 如果DOM已经加载完成，立即启动观察器
        startIdCellObserver();
    }
}

/**
 * 启动ID单元格观察器
 */
function startIdCellObserver() {
    if (window.idCellObserver && document.body) {
        window.idCellObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
        console.info('ID单元格观察器已成功启动');
    } else {
        console.warn('无法启动ID单元格观察器');
    }
}

/**
 * 处理ID单元格的函数
 * @param {HTMLElement} element 要处理的ID单元格元素
 */
function processIdCell(element) {
    const id = element.textContent;
    const length = id.trim().length;
    element.setAttribute('data-length', length);
    
    if (length < 19) {
        element.setAttribute('title', `警告: ID长度不足19位 (${length}位)`);
        element.style.color = '#dc3545'; // 红色
    } else if (length > 19) {
        element.setAttribute('title', `警告: ID长度超过19位 (${length}位)`);
        element.style.color = '#fd7e14'; // 橙色
    } else {
        element.setAttribute('title', `ID长度正确: 19位`);
        // 使用默认颜色
    }
}

/**
 * 节点搜索和选择功能
 */
function initNodeSearch() {
    // 添加源节点搜索按钮事件
    const searchSourceBtn = document.getElementById('search-source-node');
    if (searchSourceBtn) {
        searchSourceBtn.addEventListener('click', () => {
            const sourceName = document.getElementById('relation-source-name').value.trim();
            if (sourceName) {
                searchNodes(sourceName, 'source');
            } else {
                showToast('请输入源节点名称', 'warning');
            }
        });
    }
    
    // 添加目标节点搜索按钮事件
    const searchTargetBtn = document.getElementById('search-target-node');
    if (searchTargetBtn) {
        searchTargetBtn.addEventListener('click', () => {
            const targetName = document.getElementById('relation-target-name').value.trim();
            if (targetName) {
                searchNodes(targetName, 'target');
            } else {
                showToast('请输入目标节点名称', 'warning');
            }
        });
    }
    
    // 监听源节点搜索输入框的Enter键
    const sourceNameInput = document.getElementById('relation-source-name');
    if (sourceNameInput) {
        sourceNameInput.addEventListener('keyup', (event) => {
            if (event.key === 'Enter') {
                const sourceName = sourceNameInput.value.trim();
                if (sourceName) {
                    searchNodes(sourceName, 'source');
                }
            }
        });
    }
    
    // 监听目标节点搜索输入框的Enter键
    const targetNameInput = document.getElementById('relation-target-name');
    if (targetNameInput) {
        targetNameInput.addEventListener('keyup', (event) => {
            if (event.key === 'Enter') {
                const targetName = targetNameInput.value.trim();
                if (targetName) {
                    searchNodes(targetName, 'target');
                }
            }
        });
    }
    
    // 点击页面其他地方隐藏搜索结果
    document.addEventListener('click', (event) => {
        const sourceSearchResults = document.getElementById('source-search-results');
        const targetSearchResults = document.getElementById('target-search-results');
        
        // 检查点击是否在搜索结果区域外
        if (sourceSearchResults && !sourceSearchResults.contains(event.target) && 
            event.target.id !== 'search-source-node' && event.target.id !== 'relation-source-name') {
            sourceSearchResults.classList.add('d-none');
        }
        
        if (targetSearchResults && !targetSearchResults.contains(event.target) && 
            event.target.id !== 'search-target-node' && event.target.id !== 'relation-target-name') {
            targetSearchResults.classList.add('d-none');
        }
    });
}

/**
 * 搜索节点
 * @param {string} query 搜索关键词
 * @param {string} type 节点类型（source或target）
 */
function searchNodes(query, type) {
    console.log(`开始搜索${type === 'source' ? '源' : '目标'}节点: "${query}"`);
    
    // 显示搜索中状态
    const searchBtn = document.getElementById(`search-${type}-node`);
    if (searchBtn) {
        searchBtn.disabled = true;
        searchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    }
    
    // 显示搜索状态提示
    const searchResults = document.getElementById(`${type}-search-results`);
    if (searchResults) {
        const listGroup = searchResults.querySelector('.list-group');
        if (listGroup) {
            listGroup.innerHTML = '<div class="list-group-item text-center"><i class="fas fa-spinner fa-spin me-2"></i>正在搜索...</div>';
            searchResults.classList.remove('d-none');
        }
    }
    
    const url = `/api/search/nodes?query=${encodeURIComponent(query)}&limit=10`;
    console.log(`发送请求: ${url}`);
    
    fetch(url)
        .then(response => {
            console.log(`搜索请求返回状态: ${response.status}`);
            if (!response.ok) {
                throw new Error(`服务器响应错误: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log(`搜索返回 ${data.nodes ? data.nodes.length : 0} 个结果`);
            if (data.nodes) {
                data.nodes.forEach((node, index) => {
                    console.log(`结果 ${index+1}: ID=${node.id}, 名称=${node.name}, 类型=${node.type}`);
                });
            }
            
            // 显示搜索结果
            displaySearchResults(data.nodes || [], type);
        })
        .catch(error => {
            console.error(`搜索${type === 'source' ? '源' : '目标'}节点失败:`, error);
            
            // 显示错误提示
            if (searchResults) {
                const listGroup = searchResults.querySelector('.list-group');
                if (listGroup) {
                    listGroup.innerHTML = `<div class="list-group-item text-center text-danger">
                        <i class="fas fa-exclamation-triangle me-2"></i>搜索失败: ${error.message || '未知错误'}
                    </div>`;
                }
            }
            
            showToast(`搜索节点失败: ${error.message || '未知错误'}`, 'error');
        })
        .finally(() => {
            // 恢复按钮状态
            if (searchBtn) {
                searchBtn.disabled = false;
                searchBtn.innerHTML = '<i class="fas fa-search"></i>';
            }
        });
}

/**
 * 显示节点搜索结果
 * @param {Array} nodes 节点列表
 * @param {string} type 节点类型（source或target）
 */
function displaySearchResults(nodes, type) {
    const resultsContainer = document.getElementById(`${type}-search-results`);
    const listGroup = resultsContainer.querySelector('.list-group');
    
    if (!resultsContainer || !listGroup) return;
    
    // 清空现有结果
    listGroup.innerHTML = '';
    
    // 显示结果容器
    resultsContainer.classList.remove('d-none');
    
    // 如果没有结果
    if (nodes.length === 0) {
        const noResult = document.createElement('div');
        noResult.className = 'list-group-item text-center text-muted';
        noResult.textContent = '未找到匹配的节点';
        listGroup.appendChild(noResult);
        return;
    }
    
    // 添加每个节点到结果列表
    nodes.forEach(node => {
        const item = document.createElement('a');
        item.href = '#';
        item.className = 'list-group-item list-group-item-action';
        item.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <span>${node.name}</span>
                <span class="badge bg-secondary">${node.type}</span>
            </div>
        `;
        
        // 添加点击事件
        item.addEventListener('click', (event) => {
            event.preventDefault();
            selectNode(node, type);
            resultsContainer.classList.add('d-none');
        });
        
        listGroup.appendChild(item);
    });
}

/**
 * 选择节点
 * @param {Object} node 节点对象
 * @param {string} type 节点类型（source或target）
 */
function selectNode(node, type) {
    console.log(`选择${type === 'source' ? '源' : '目标'}节点:`, node);
    
    try {
        // 确保node和node.id存在
        if (!node || node.id === undefined || node.id === null) {
            console.error(`选择节点错误: 无效的节点数据`, node);
            showToast(`无法选择节点: 缺少节点ID`, 'error');
            return;
        }
        
        // 更新隐藏的ID字段
        const idField = document.getElementById(`relation-${type}`);
        if (idField) {
            idField.value = node.id;
            console.log(`设置${type === 'source' ? '源' : '目标'}节点ID: ${node.id}`);
            
            // 标记该节点已通过搜索结果选择
            const nameField = document.getElementById(`relation-${type}-name`);
            if (nameField) {
                nameField.isNodeSelected = true;
                
                // 移除警告样式
                const visualElement = document.getElementById(`visual-${type}`);
                if (visualElement) {
                    visualElement.classList.remove('validation-warning');
                }
            }
        } else {
            console.error(`未找到${type === 'source' ? '源' : '目标'}节点ID字段`);
        }
        
        // 更新显示名称字段
        const nameField = document.getElementById(`relation-${type}-name`);
        if (nameField) {
            nameField.value = node.name;
            nameField.setAttribute('title', `ID: ${node.id} | 类型: ${node.type}`);
            nameField.classList.add('has-id');
        } else {
            console.error(`未找到${type === 'source' ? '源' : '目标'}节点名称字段`);
        }
        
        // 更新三元组可视化
        const visualElement = document.getElementById(`visual-${type}`);
        if (visualElement) {
            visualElement.textContent = node.name;
            visualElement.title = `类型: ${node.type}`;
        }
        
        // 更新搜索结果状态
        const searchResults = document.getElementById(`${type}-search-results`);
        if (searchResults) {
            searchResults.classList.add('d-none');
        }
    } catch (error) {
        console.error(`选择节点时出错:`, error);
        showToast(`无法选择节点: ${error.message || '未知错误'}`, 'error');
    }
}

/**
 * 监听节点名称输入框的变化
 */
function watchNodeInputs() {
    // 监听源节点名称变化
    const sourceNameInput = document.getElementById('relation-source-name');
    if (sourceNameInput) {
        sourceNameInput.addEventListener('input', () => {
            onNodeNameChange('source');
        });
    }
    
    // 监听目标节点名称变化
    const targetNameInput = document.getElementById('relation-target-name');
    if (targetNameInput) {
        targetNameInput.addEventListener('input', () => {
            onNodeNameChange('target');
        });
    }
}

/**
 * 当节点名称输入框变化时触发
 * @param {string} type 节点类型（source或target）
 */
function onNodeNameChange(type) {
    const nameInput = document.getElementById(`relation-${type}-name`);
    const idInput = document.getElementById(`relation-${type}`);
    const visualElement = document.getElementById(`visual-${type}`);
    
    if (!nameInput || !idInput || !visualElement) return;
    
    const currentValue = nameInput.value.trim();
    
    // 如果输入框内容被清空，清除ID值
    if (currentValue === '') {
        idInput.value = '';
        nameInput.classList.remove('has-id');
        visualElement.textContent = type === 'source' ? '源节点' : '目标节点';
        visualElement.title = '';
        
        // 由于清空了节点，显示三元组组件的默认名称
        updateTripleVisualization({
            ...type === 'source' && { source_name: '源节点' },
            ...type === 'target' && { target_name: '目标节点' }
        });
        
        return;
    }
    
    // 如果不是通过选择节点输入的，且输入框内容变化，清除ID值
    if (!nameInput.isNodeSelected) {
        idInput.value = '';
        nameInput.classList.remove('has-id');
        
        // 使用输入的文本更新可视化，但加上警告样式
        visualElement.textContent = currentValue;
        visualElement.title = '未选择节点，请从搜索结果中选择';
        
        // 添加警告样式
        if (!visualElement.classList.contains('validation-warning') && currentValue) {
            visualElement.classList.add('validation-warning');
        }
    }
    
    // 重置已选择标记，下次输入变化时会检查
    nameInput.isNodeSelected = false;
}

/**
 * 监听关系类型输入框的变化
 */
function watchRelationTypeInput() {
    const typeInput = document.getElementById('relation-type-input');
    const hiddenTypeInput = document.getElementById('relation-type');
    const visualRelation = document.getElementById('visual-relation');
    
    if (typeInput && hiddenTypeInput && visualRelation) {
        typeInput.addEventListener('input', () => {
            const value = typeInput.value.trim();
            
            // 更新隐藏字段和可视化
            hiddenTypeInput.value = value;
            visualRelation.textContent = value || '关系';
            
            if (value) {
                visualRelation.classList.remove('validation-warning');
            } else {
                visualRelation.classList.add('validation-warning');
            }
        });
    }
    
    // 关系类型输入框回车键触发保存
    if (typeInput) {
        typeInput.addEventListener('keyup', (event) => {
            if (event.key === 'Enter') {
                const saveButton = document.getElementById('save-relation');
                if (saveButton) {
                    saveButton.click();
                }
            }
        });
    }
} 