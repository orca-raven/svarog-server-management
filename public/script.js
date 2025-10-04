// Глобальные переменные
let currentTab = 'servers';
let currentData = {};
let editMode = false;
let autocompleteCache = {};

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    setupEventListeners();
    loadStatistics();
    loadTabData(currentTab);
    loadPingSettings();
}

function setupEventListeners() {
    // Переключение вкладок
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            const tab = button.dataset.tab;
            switchTab(tab);
        });
    });

    // Кнопки добавления
    document.getElementById('add-btn').addEventListener('click', () => {
        openAddModal();
    });

    // Модальные окна
    document.getElementById('close-modal').addEventListener('click', closeModal);
    document.getElementById('close-component-modal').addEventListener('click', closeComponentModal);

    // Редактирование
    document.getElementById('edit-btn').addEventListener('click', toggleEditMode);
    document.getElementById('cancel-btn').addEventListener('click', cancelEdit);
    document.getElementById('save-btn').addEventListener('click', saveItem);
    document.getElementById('delete-btn').addEventListener('click', deleteItem);

    // Закрытие модальных окон по клику вне
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });

    // Сортировка таблиц
    document.querySelectorAll('.data-table th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            sortTable(th.dataset.sort, th.closest('table'));
        });
    });
}

// Переключение вкладок
function switchTab(tab) {
    // Обновляем активную кнопку
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

    // Обновляем содержимое
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tab}-tab`).classList.add('active');

    currentTab = tab;
    loadTabData(tab);
}

// Загрузка данных для вкладки
async function loadTabData(tab) {
    try {
        let endpoint = '';
        switch(tab) {
            case 'servers':
                endpoint = '/api/servers';
                break;
            case 'arms':
                endpoint = '/api/arms';
                break;
            case 'vms':
                endpoint = '/api/vms';
                break;
        }

        const response = await fetch(endpoint);
        
        // Проверяем content-type перед парсингом JSON
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            const text = await response.text();
            console.error('Ошибка: ответ не является JSON:', text);
            throw new Error('Сервер вернул неожиданный тип данных');
        }
        
        const data = await response.json();
        
        if (response.ok) {
            renderTable(tab, data);
        } else {
            showNotification('Ошибка загрузки данных: ' + data.error, 'error');
        }
    } catch (error) {
        showNotification('Ошибка сети: ' + error.message, 'error');
    }
}

// Отрисовка таблицы
function renderTable(tab, data) {
    const tbody = document.getElementById(`${tab}-tbody`);
    tbody.innerHTML = '';

    data.forEach(item => {
        const row = document.createElement('tr');
        row.addEventListener('click', () => openDetailModal(tab, item.id));

        let statusClass = 'status-unknown';
        let statusText = 'Неизвестно';
        
        if (item.ping_status === 'online') {
            statusClass = 'status-online';
            statusText = 'Онлайн';
        } else if (item.ping_status === 'offline') {
            statusClass = 'status-offline';
            statusText = 'Офлайн';
        }

        if (tab === 'vms') {
            row.innerHTML = `
                <td>${item.vm_name || ''}</td>
                <td>${item.netbios_name || ''}</td>
                <td>${item.ip_address || ''}</td>
                <td>${item.server_name || ''} ${item.server_ip ? '- ' + item.server_ip : ''}</td>
                <td>${item.allocated_cpu || ''}</td>
                <td>${item.allocated_ram || ''}</td>
                <td><span class="status-indicator ${statusClass}">${statusText}</span></td>
            `;
        } else {
            row.innerHTML = `
                <td>${item.netbios_name || ''}</td>
                <td>${item.type || ''}</td>
                <td>${item.ip_address || ''}</td>
                <td>${item.role || ''}</td>
                <td>${item.operating_system || ''}</td>
                <td><span class="status-indicator ${statusClass}">${statusText}</span></td>
            `;
        }

        tbody.appendChild(row);
    });
}

// Сортировка таблицы
function sortTable(column, table) {
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    
    rows.sort((a, b) => {
        const aIndex = Array.from(table.querySelectorAll('th')).findIndex(th => th.dataset.sort === column);
        const bIndex = aIndex;
        
        const aText = a.cells[aIndex].textContent.trim();
        const bText = b.cells[bIndex].textContent.trim();
        
        // Натуральная сортировка для чисел
        const aNum = parseInt(aText);
        const bNum = parseInt(bText);
        
        if (!isNaN(aNum) && !isNaN(bNum)) {
            return aNum - bNum;
        }
        
        return aText.localeCompare(bText);
    });
    
    tbody.innerHTML = '';
    rows.forEach(row => tbody.appendChild(row));
}

// Загрузка статистики
async function loadStatistics() {
    try {
        const response = await fetch('/api/settings/stats');
        const stats = await response.json();
        
        if (response.ok) {
            document.getElementById('servers-count').textContent = stats.servers;
            document.getElementById('arms-count').textContent = stats.arms;
        }
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

// Открытие модального окна для просмотра/редактирования
async function openDetailModal(tab, id) {
    try {
        let endpoint = '';
        switch(tab) {
            case 'servers':
                endpoint = `/api/servers/${id}`;
                break;
            case 'arms':
                endpoint = `/api/arms/${id}`;
                break;
            case 'vms':
                endpoint = `/api/vms/${id}`;
                break;
        }

        const response = await fetch(endpoint);
        
        // Проверяем content-type перед парсингом JSON
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            const text = await response.text();
            console.error('Ошибка: ответ не является JSON:', text);
            throw new Error('Сервер вернул неожиданный тип данных');
        }
        
        const data = await response.json();
        
        if (response.ok) {
            currentData = { ...data, type: tab };
            renderDetailModal(data, tab);
            document.getElementById('detail-modal').classList.add('active');
        } else {
            showNotification('Ошибка загрузки данных: ' + data.error, 'error');
        }
    } catch (error) {
        showNotification('Ошибка сети: ' + error.message, 'error');
    }
}

// Открытие модального окна для добавления
function openAddModal() {
    const emptyData = getEmptyData(currentTab);
    currentData = { ...emptyData, type: currentTab, isNew: true };
    renderDetailModal(emptyData, currentTab, true);
    document.getElementById('detail-modal').classList.add('active');
}

// Получение пустых данных для нового элемента
function getEmptyData(tab) {
    const baseData = {
        netbios_name: '',
        domain: 'НЕТ',
        inventory_number: '',
        delivery_date: '',
        commissioning_date: '',
        installation_address: '',
        ip_address: '',
        ipmi_address: '',
        role: 'Нет',
        operating_system: '',
        cpu_model: '',
        cpu_generation: '',
        cpu_count: 1,
        cores_per_cpu: 1,
        ram_amount: '',
        network_cards: [],
        system_disk_model: '',
        system_disk_count: 1,
        system_disk_capacity: '',
        archive_disk_model: '',
        archive_disk_count: 0,
        archive_disk_capacity: '',
        archive_raid_type: 'Raid 5',
        database_disk_model: '',
        database_disk_count: 0,
        database_disk_capacity: '',
        raid_controller_model: '',
        comments: '',
        ping_enabled: 1
    };

    if (tab === 'servers') {
        baseData.type = 'сервер';
    } else if (tab === 'arms') {
        baseData.type = 'АРМ';
    } else if (tab === 'vms') {
        return {
            vm_name: '',
            vm_id: '',
            netbios_name: '',
            ip_address: '',
            virtual_server_id: '',
            allocated_cpu: 1,
            allocated_ram: '',
            disks: [{ capacity: '', type: 'SSD' }],
            network_types: ['Офисная'],
            operating_system: '',
            role: '',
            comments: '',
            ping_enabled: 1
        };
    }

    return baseData;
}

// Отрисовка модального окна с деталями
function renderDetailModal(data, tab, isEdit = false) {
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const editBtn = document.getElementById('edit-btn');
    const deleteBtn = document.getElementById('delete-btn');
    const modalFooter = document.getElementById('modal-footer');
    
    if (tab === 'vms') {
        modalTitle.textContent = isEdit || currentData.isNew ? 
            (currentData.isNew ? 'Добавить виртуальную машину' : 'Редактировать виртуальную машину') :
            'Информация о виртуальной машине';
    } else {
        const typeName = tab === 'servers' ? 'сервере' : 'АРМ';
        modalTitle.textContent = isEdit || currentData.isNew ? 
            (currentData.isNew ? `Добавить ${tab === 'servers' ? 'сервер' : 'АРМ'}` : `Редактировать ${typeName}`) :
            `Информация о ${typeName}`;
    }
    
    editBtn.style.display = isEdit || currentData.isNew ? 'none' : 'block';
    deleteBtn.style.display = isEdit || currentData.isNew ? 'none' : 'block';
    modalFooter.style.display = isEdit || currentData.isNew ? 'block' : 'none';
    
    if (tab === 'vms') {
        renderVMForm(modalBody, data, isEdit || currentData.isNew);
    } else {
        renderServerForm(modalBody, data, isEdit || currentData.isNew, tab);
    }
    
    editMode = isEdit || currentData.isNew;
}

// Отрисовка формы сервера/АРМ
function renderServerForm(container, data, isEdit, tab) {
    const readonly = isEdit ? '' : 'readonly';
    const disabled = isEdit ? '' : 'disabled';
    const isARM = tab === 'arms';
    
    container.innerHTML = `
        <div class="form-section">
            <h3>Основная информация</h3>
            <div class="form-row">
                <div class="form-group">
                    <label>Имя NETBIOS *</label>
                    <input type="text" id="netbios_name" value="${data.netbios_name || ''}" ${readonly} required>
                </div>
                <div class="form-group">
                    <label>Домен</label>
                    <select id="domain" ${disabled}>
                        <option value="НЕТ" ${data.domain === 'НЕТ' ? 'selected' : ''}>НЕТ</option>
                        <option value="BGorod.ru" ${data.domain === 'BGorod.ru' ? 'selected' : ''}>BGorod.ru</option>
                        <option value="BGKLGD.local" ${data.domain === 'BGKLGD.local' ? 'selected' : ''}>BGKLGD.local</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Тип</label>
                    <select id="type" ${disabled}>
                        <option value="сервер" ${data.type === 'сервер' ? 'selected' : ''}>Сервер</option>
                        <option value="сервер виртуализации" ${data.type === 'сервер виртуализации' ? 'selected' : ''}>Сервер виртуализации</option>
                        <option value="АРМ" ${data.type === 'АРМ' ? 'selected' : ''}>АРМ</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Инвентарный номер</label>
                    <input type="text" id="inventory_number" value="${data.inventory_number || ''}" ${readonly}>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Дата поставки</label>
                    <input type="date" id="delivery_date" value="${data.delivery_date || ''}" ${readonly}>
                </div>
                <div class="form-group">
                    <label>Дата ввода в эксплуатацию</label>
                    <input type="date" id="commissioning_date" value="${data.commissioning_date || ''}" ${readonly}>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Адрес установки</label>
                    <input type="text" id="installation_address" value="${data.installation_address || ''}" ${readonly}>
                </div>
                <div class="form-group">
                    <label>IP адрес</label>
                    <input type="text" id="ip_address" value="${data.ip_address || ''}" ${readonly}>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Адрес IPMI</label>
                    <input type="text" id="ipmi_address" value="${data.ipmi_address || ''}" ${readonly}>
                </div>
                ${!isARM ? `<div class="form-group">
                    <label>Аналитика</label>
                    <select id="role" ${disabled}>
                        <option value="Нет" ${data.role === 'Нет' ? 'selected' : ''}>Нет</option>
                        <option value="ГРЗ" ${data.role === 'ГРЗ' ? 'selected' : ''}>ГРЗ</option>
                        <option value="Стерильные зоны" ${data.role === 'Стерильные зоны' ? 'selected' : ''}>Стерильные зоны</option>
                        <option value="Лица" ${data.role === 'Лица' ? 'selected' : ''}>Лица</option>
                    </select>
                </div>` : ''}
            </div>
            <div class="form-row full-width">
                <div class="form-group">
                    <label>Операционная система</label>
                    <input type="text" id="operating_system" value="${data.operating_system || ''}" ${readonly} data-autocomplete="operating_system">
                </div>
            </div>
        </div>

        <div class="form-section">
            <h3>CPU</h3>
            ${isARM ? `
            <div class="form-row">
                <div class="form-group">
                    <label>Модель процессора</label>
                    <input type="text" id="cpu_model" value="${data.cpu_model || ''}" ${readonly} data-autocomplete="cpu_model">
                </div>
                <div class="form-group">
                    <label>Количество ОЗУ</label>
                    <input type="text" id="ram_amount" value="${data.ram_amount || ''}" ${readonly} placeholder="например: 16 ГБ">
                </div>
            </div>
            ` : `
            <div class="form-row">
                <div class="form-group">
                    <label>Модель процессора</label>
                    <input type="text" id="cpu_model" value="${data.cpu_model || ''}" ${readonly} data-autocomplete="cpu_model">
                </div>
                <div class="form-group">
                    <label>Поколение</label>
                    <input type="text" id="cpu_generation" value="${data.cpu_generation || ''}" ${readonly} data-autocomplete="cpu_generation">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Количество CPU</label>
                    <input type="number" id="cpu_count" value="${data.cpu_count || 1}" ${readonly} min="1" onchange="updateTotalCores()">
                </div>
                <div class="form-group">
                    <label>Количество ядер на процессор</label>
                    <input type="number" id="cores_per_cpu" value="${data.cores_per_cpu || 1}" ${readonly} min="1" onchange="updateTotalCores()">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Всего ядер</label>
                    <input type="number" id="total_cores" value="${data.total_cores || 1}" readonly>
                </div>
                <div class="form-group">
                    <label>Количество ОЗУ</label>
                    <input type="text" id="ram_amount" value="${data.ram_amount || ''}" ${readonly} placeholder="например: 16 ГБ">
                </div>
            </div>
            `}
        </div>

        ${!isARM ? `<div class="form-section">
            <h3>Сеть</h3>
            <div id="network-cards-container">
                ${renderNetworkCards(data.network_cards, isEdit)}
            </div>
            ${isEdit ? '<button type="button" class="add-field-btn" onclick="addNetworkCard()">Добавить сетевую карту</button>' : ''}
        </div>` : ''}

        <div class="form-section">
            <h3>Диски</h3>
            ${isARM ? `
            <div id="disks-container">
                <h4>Диски</h4>
                ${renderVMDisks(data.disks, isEdit)}
            </div>
            ${isEdit ? '<button type="button" class="add-field-btn" onclick="addVMDisk()">Добавить диск</button>' : ''}
            ` : `
            <h4>Системный диск</h4>
            <div class="form-row">
                <div class="form-group">
                    <label>Модель диска</label>
                    <input type="text" id="system_disk_model" value="${data.system_disk_model || ''}" ${readonly} data-autocomplete="system_disk_model">
                </div>
                <div class="form-group">
                    <label>Количество</label>
                    <input type="number" id="system_disk_count" value="${data.system_disk_count || 1}" ${readonly} min="1">
                </div>
            </div>
            <div class="form-row full-width">
                <div class="form-group">
                    <label>Объем диска</label>
                    <input type="text" id="system_disk_capacity" value="${data.system_disk_capacity || ''}" ${readonly} placeholder="например: 500 ГБ">
                </div>
            </div>

            <h4>Диск под архив</h4>
            <div class="form-row">
                <div class="form-group">
                    <label>Модель</label>
                    <input type="text" id="archive_disk_model" value="${data.archive_disk_model || ''}" ${readonly} data-autocomplete="archive_disk_model">
                </div>
                <div class="form-group">
                    <label>Количество</label>
                    <input type="number" id="archive_disk_count" value="${data.archive_disk_count || 0}" ${readonly} min="0" onchange="updateArchiveCapacity()">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Объем диска (ТБ)</label>
                    <input type="number" id="archive_disk_capacity" value="${parseFloat(data.archive_disk_capacity) || 0}" ${readonly} min="0" step="0.1" onchange="updateArchiveCapacity()">
                </div>
                <div class="form-group">
                    <label>Тип Raid</label>
                    <select id="archive_raid_type" ${disabled} onchange="updateArchiveCapacity()">
                        <option value="Raid 5" ${data.archive_raid_type === 'Raid 5' ? 'selected' : ''}>Raid 5</option>
                        <option value="Raid 6" ${data.archive_raid_type === 'Raid 6' ? 'selected' : ''}>Raid 6</option>
                    </select>
                </div>
            </div>
            <div class="form-row full-width">
                <div class="form-group">
                    <label>Полный объем</label>
                    <input type="text" id="archive_total_capacity" value="${data.archive_total_capacity || ''}" readonly>
                </div>
            </div>

            <h4>Диск под базу</h4>
            <div class="form-row">
                <div class="form-group">
                    <label>Модель</label>
                    <input type="text" id="database_disk_model" value="${data.database_disk_model || ''}" ${readonly} data-autocomplete="database_disk_model">
                </div>
                <div class="form-group">
                    <label>Количество</label>
                    <input type="number" id="database_disk_count" value="${data.database_disk_count || 0}" ${readonly} min="0">
                </div>
            </div>
            <div class="form-row full-width">
                <div class="form-group">
                    <label>Объем</label>
                    <input type="text" id="database_disk_capacity" value="${data.database_disk_capacity || ''}" ${readonly} placeholder="например: 1 ТБ">
                </div>
            </div>

            <div class="form-row full-width">
                <div class="form-group">
                    <label>Модель Raid контроллера</label>
                    <input type="text" id="raid_controller_model" value="${data.raid_controller_model || ''}" ${readonly} data-autocomplete="raid_controller_model">
                </div>
            </div>
            `}
        </div>

        <div class="form-section">
            <h3>Комментарии</h3>
            <div class="form-row full-width">
                <div class="form-group">
                    <label>Комментарии</label>
                    <textarea id="comments" ${readonly}>${data.comments || ''}</textarea>
                </div>
            </div>
        </div>
    `;

    if (isEdit) {
        setupAutocomplete();
        setupUniqueValidation();
    }
}

// Отрисовка формы виртуальной машины
async function renderVMForm(container, data, isEdit) {
    const readonly = isEdit ? '' : 'readonly';
    const disabled = isEdit ? '' : 'disabled';
    
    // Получаем список серверов виртуализации
    let virtualizationServers = [];
    if (isEdit) {
        try {
            const response = await fetch('/api/servers/virtualization/list');
            if (response.ok) {
                virtualizationServers = await response.json();
            }
        } catch (error) {
            console.error('Ошибка загрузки серверов виртуализации:', error);
        }
    }
    
    const serverOptions = virtualizationServers.map(server => 
        `<option value="${server.id}" ${data.virtual_server_id == server.id ? 'selected' : ''}>${server.netbios_name} - ${server.ip_address}</option>`
    ).join('');
    
    container.innerHTML = `
        <div class="form-section">
            <h3>Основная информация</h3>
            <div class="form-row">
                <div class="form-group">
                    <label>Имя виртуальной машины *</label>
                    <input type="text" id="vm_name" value="${data.vm_name || ''}" ${readonly} required>
                </div>
                <div class="form-group">
                    <label>ID (Proxmox)</label>
                    <input type="text" id="vm_id" value="${data.vm_id || ''}" ${readonly}>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Имя NETBIOS</label>
                    <input type="text" id="netbios_name" value="${data.netbios_name || ''}" ${readonly}>
                </div>
                <div class="form-group">
                    <label>IP адрес</label>
                    <input type="text" id="ip_address" value="${data.ip_address || ''}" ${readonly}>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Виртуальный сервер</label>
                    <select id="virtual_server_id" ${disabled} onchange="checkServerResources()">
                        <option value="">Выберите сервер</option>
                        ${serverOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label>ОС</label>
                    <input type="text" id="operating_system" value="${data.operating_system || ''}" ${readonly}>
                </div>
            </div>
            <div id="resource-warning" class="resource-warning" style="display: none;"></div>
        </div>

        <div class="form-section">
            <h3>Выделенные ресурсы</h3>
            <div class="form-row">
                <div class="form-group">
                    <label>CPU (ядра)</label>
                    <input type="number" id="allocated_cpu" value="${data.allocated_cpu || 1}" ${readonly} min="1" onchange="checkServerResources()">
                </div>
                <div class="form-group">
                    <label>RAM</label>
                    <input type="text" id="allocated_ram" value="${data.allocated_ram || ''}" ${readonly} placeholder="например: 4 ГБ" onchange="checkServerResources()">
                </div>
            </div>
            <div id="disks-container">
                <h4>Диски</h4>
                ${renderVMDisks(data.disks, isEdit)}
            </div>
            ${isEdit ? '<button type="button" class="add-field-btn" onclick="addVMDisk()">Добавить диск</button>' : ''}
            
            <div class="form-row full-width">
                <div class="form-group">
                    <label>Тип сети</label>
                    <div id="network-types-container">
                        ${renderNetworkTypes(data.network_types, isEdit)}
                    </div>
                </div>
            </div>
        </div>

        <div class="form-section">
            <h3>Комментарии</h3>
            <div class="form-row full-width">
                <div class="form-group">
                    <label>Комментарии</label>
                    <textarea id="comments" ${readonly}>${data.comments || ''}</textarea>
                </div>
            </div>
        </div>
    `;
}

// Отрисовка сетевых карт
function renderNetworkCards(cards, isEdit) {
    if (!cards || !Array.isArray(cards)) cards = [{ model: '', ports: 1, speed: '' }];
    if (cards.length === 0) cards = [{ model: '', ports: 1, speed: '' }];
    
    return cards.map((card, index) => `
        <div class="dynamic-field" data-index="${index}">
            ${isEdit && cards.length > 1 ? `
                <div class="dynamic-field-header">
                    <h4>Сетевая карта ${index + 1}</h4>
                    <button type="button" class="remove-field-btn" onclick="removeNetworkCard(${index})">
                        <i class="material-icons">delete</i>
                    </button>
                </div>
            ` : `<h4>Сетевая карта ${index + 1}</h4>`}
            <div class="form-row">
                <div class="form-group">
                    <label>Модель</label>
                    <input type="text" name="network_model_${index}" value="${card.model || ''}" ${isEdit ? '' : 'readonly'}>
                </div>
                <div class="form-group">
                    <label>Количество портов</label>
                    <input type="number" name="network_ports_${index}" value="${card.ports || 1}" ${isEdit ? '' : 'readonly'} min="1">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Скорость (Гбит/с)</label>
                    <input type="text" name="network_speed_${index}" value="${card.speed || ''}" ${isEdit ? '' : 'readonly'} placeholder="например: 1">
                </div>
            </div>
        </div>
    `).join('');
}

// Отрисовка дисков ВМ
function renderVMDisks(disks, isEdit) {
    if (!disks || !Array.isArray(disks)) disks = [{ capacity: '', type: 'SSD' }];
    if (disks.length === 0) disks = [{ capacity: '', type: 'SSD' }];
    
    return disks.map((disk, index) => `
        <div class="dynamic-field" data-index="${index}">
            ${isEdit && disks.length > 1 ? `
                <div class="dynamic-field-header">
                    <h5>Диск ${index + 1}</h5>
                    <button type="button" class="remove-field-btn" onclick="removeVMDisk(${index})">
                        <i class="material-icons">delete</i>
                    </button>
                </div>
            ` : `<h5>Диск ${index + 1}</h5>`}
            <div class="form-row">
                <div class="form-group">
                    <label>Объем диска</label>
                    <input type="text" name="disk_capacity_${index}" value="${disk.capacity || ''}" ${isEdit ? '' : 'readonly'} placeholder="например: 50 ГБ">
                </div>
                <div class="form-group">
                    <label>Тип диска</label>
                    <select name="disk_type_${index}" ${isEdit ? '' : 'disabled'}>
                        <option value="SSD" ${disk.type === 'SSD' ? 'selected' : ''}>SSD</option>
                        <option value="HDD" ${disk.type === 'HDD' ? 'selected' : ''}>HDD</option>
                    </select>
                </div>
            </div>
        </div>
    `).join('');
}

// Отрисовка типов сети
function renderNetworkTypes(types, isEdit) {
    if (!types || !Array.isArray(types)) types = ['Офисная'];
    
    const allTypes = ['Офисная', 'Серверная'];
    
    return allTypes.map(type => `
        <label style="display: block; margin-bottom: 0.5rem;">
            <input type="checkbox" name="network_types" value="${type}" 
                   ${types.includes(type) ? 'checked' : ''} ${isEdit ? '' : 'disabled'}>
            ${type}
        </label>
    `).join('');
}

// Функции для добавления/удаления полей
function addNetworkCard() {
    const container = document.getElementById('network-cards-container');
    const index = container.children.length;
    const newCard = document.createElement('div');
    newCard.innerHTML = renderNetworkCards([{ model: '', ports: 1, speed: '' }], true).replace(/data-index="0"/, `data-index="${index}"`);
    container.appendChild(newCard.firstElementChild);
}

function removeNetworkCard(index) {
    const container = document.getElementById('network-cards-container');
    const cards = container.querySelectorAll('.dynamic-field');
    if (cards.length > 1) {
        cards[index].remove();
        // Переиндексируем оставшиеся карты
        container.querySelectorAll('.dynamic-field').forEach((card, newIndex) => {
            card.dataset.index = newIndex;
            card.querySelector('h4').textContent = `Сетевая карта ${newIndex + 1}`;
        });
    }
}

function addVMDisk() {
    const container = document.getElementById('disks-container');
    const index = container.querySelectorAll('.dynamic-field').length;
    const newDisk = document.createElement('div');
    newDisk.innerHTML = renderVMDisks([{ capacity: '', type: 'SSD' }], true).replace(/data-index="0"/, `data-index="${index}"`);
    container.appendChild(newDisk.firstElementChild);
}

function removeVMDisk(index) {
    const container = document.getElementById('disks-container');
    const disks = container.querySelectorAll('.dynamic-field');
    if (disks.length > 1) {
        disks[index].remove();
        // Переиндексируем оставшиеся диски
        container.querySelectorAll('.dynamic-field').forEach((disk, newIndex) => {
            disk.dataset.index = newIndex;
            disk.querySelector('h5').textContent = `Диск ${newIndex + 1}`;
        });
    }
}

// Обновление общего количества ядер
function updateTotalCores() {
    const cpuCount = parseInt(document.getElementById('cpu_count').value) || 1;
    const coresPerCpu = parseInt(document.getElementById('cores_per_cpu').value) || 1;
    document.getElementById('total_cores').value = cpuCount * coresPerCpu;
}

// Обновление общего объема архивного диска
function updateArchiveCapacity() {
    const count = parseInt(document.getElementById('archive_disk_count').value) || 0;
    const capacity = parseFloat(document.getElementById('archive_disk_capacity').value) || 0;
    const raidType = document.getElementById('archive_raid_type').value;
    
    if (count > 0 && capacity > 0) {
        const realCapacity = capacity * Math.pow(10, 12) / Math.pow(1024, 4);
        let totalCapacity = 0;
        
        if (raidType === 'Raid 5' && count > 1) {
            totalCapacity = (count - 1) * realCapacity;
        } else if (raidType === 'Raid 6' && count > 2) {
            totalCapacity = (count - 2) * realCapacity;
        }
        
        document.getElementById('archive_total_capacity').value = totalCapacity.toFixed(2) + ' ТБ';
    } else {
        document.getElementById('archive_total_capacity').value = '';
    }
}

// Проверка ресурсов сервера
async function checkServerResources() {
    const serverId = document.getElementById('virtual_server_id').value;
    const cpu = document.getElementById('allocated_cpu').value;
    const ramText = document.getElementById('allocated_ram').value;
    const ram = parseFloat(ramText.replace(/[^\d.]/g, '')) || 0;
    
    const warningDiv = document.getElementById('resource-warning');
    
    if (!serverId || !cpu || !ram) {
        warningDiv.style.display = 'none';
        return;
    }
    
    try {
        const response = await fetch(`/api/vms/check-resources/${serverId}?cpu=${cpu}&ram=${ram}`);
        const result = await response.json();
        
        if (response.ok) {
            if (result.canAllocate) {
                warningDiv.innerHTML = `
                    <div style="background: #dcfce7; color: #166534; padding: 1rem; border-radius: var(--border-radius); margin-top: 1rem;">
                        <strong>✓ Ресурсы доступны</strong><br>
                        Используется: ${result.usedCores}/${result.availableCores} ядер, ${result.usedRam.toFixed(1)}/${result.availableRam.toFixed(1)} ГБ
                    </div>
                `;
                warningDiv.style.display = 'block';
            } else {
                // Получаем альтернативные серверы
                const altResponse = await fetch(`/api/vms/alternative-servers/${serverId}?cpu=${cpu}&ram=${ram}`);
                const alternatives = await altResponse.json();
                
                let message = `<strong>⚠ ${result.message}</strong><br>`;
                message += `Требуется: ${cpu} ядер, ${ram} ГБ<br>`;
                message += `Доступно: ${(result.availableCores - result.usedCores)} ядер, ${(result.availableRam - result.usedRam).toFixed(1)} ГБ`;
                
                if (alternatives.length > 0) {
                    message += '<br><br><strong>Доступные альтернативы:</strong><br>';
                    alternatives.forEach(alt => {
                        message += `• <strong>${alt.name}</strong> (${alt.ip}) - свободно: ${alt.availableCores} ядер, ${alt.availableRam.toFixed(1)} ГБ<br>`;
                    });
                } else {
                    message += '<br><br><em>Нет доступных альтернативных серверов с достаточными ресурсами.</em>';
                }
                
                warningDiv.innerHTML = `
                    <div style="background: #fee2e2; color: #991b1b; padding: 1rem; border-radius: var(--border-radius); margin-top: 1rem;">
                        ${message}
                    </div>
                `;
                warningDiv.style.display = 'block';
            }
        }
    } catch (error) {
        console.error('Ошибка проверки ресурсов:', error);
        warningDiv.innerHTML = `
            <div style="background: #fef3c7; color: #92400e; padding: 1rem; border-radius: var(--border-radius); margin-top: 1rem;">
                <strong>⚠ Ошибка проверки ресурсов:</strong> ${error.message}
            </div>
        `;
        warningDiv.style.display = 'block';
    }
}

// Переключение режима редактирования
function toggleEditMode() {
    renderDetailModal(currentData, currentData.type, true);
}

function cancelEdit() {
    if (currentData.isNew) {
        closeModal();
    } else {
        renderDetailModal(currentData, currentData.type, false);
    }
}

// Сохранение элемента
async function saveItem() {
    try {
        // Валидация обязательных полей
        const validationResult = await validateRequiredFields();
        if (!validationResult.isValid) {
            showNotification(validationResult.message, 'error');
            return;
        }

        // Проверка уникальности полей
        const uniquenessResult = await validateUniqueness();
        if (!uniquenessResult.isValid) {
            showNotification(uniquenessResult.message, 'error');
            return;
        }

        // Если это виртуальная машина, проверяем ресурсы перед сохранением
        if (currentData.type === 'vms') {
            const resourceCheck = await validateVMResources();
            if (!resourceCheck.isValid) {
                showNotification(resourceCheck.message, 'error');
                return; // Не закрываем модальное окно
            }
        }

        const formData = collectFormData();
        
        let endpoint = '';
        let method = 'POST';
        
        if (currentData.type === 'servers') {
            endpoint = '/api/servers';
            if (!currentData.isNew) {
                endpoint += `/${currentData.id}`;
                method = 'PUT';
            }
        } else if (currentData.type === 'arms') {
            endpoint = '/api/arms';
            if (!currentData.isNew) {
                endpoint += `/${currentData.id}`;
                method = 'PUT';
            }
        } else if (currentData.type === 'vms') {
            endpoint = '/api/vms';
            if (!currentData.isNew) {
                endpoint += `/${currentData.id}`;
                method = 'PUT';
            }
        }
        
        const response = await fetch(endpoint, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        // Проверяем content-type перед парсингом JSON
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            const text = await response.text();
            console.error('Ошибка: ответ не является JSON:', text);
            throw new Error('Сервер вернул неожиданный тип данных');
        }
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification(result.message, 'success');
            closeModal();
            loadTabData(currentData.type);
            loadStatistics();
        } else {
            showNotification('Ошибка сохранения: ' + result.error, 'error');
        }
    } catch (error) {
        showNotification('Ошибка сети: ' + error.message, 'error');
    }
}

// Удаление элемента
async function deleteItem() {
    if (!currentData.id) {
        showNotification('Нет данных для удаления', 'error');
        return;
    }

    const itemName = currentData.netbios_name || currentData.vm_name || 'элемент';
    const confirmed = confirm(`Вы уверены, что хотите удалить "${itemName}"? Это действие нельзя отменить.`);
    
    if (!confirmed) {
        return;
    }

    try {
        let endpoint = '';
        
        if (currentData.type === 'servers') {
            endpoint = `/api/servers/${currentData.id}`;
        } else if (currentData.type === 'arms') {
            endpoint = `/api/arms/${currentData.id}`;
        } else if (currentData.type === 'vms') {
            endpoint = `/api/vms/${currentData.id}`;
        }
        
        const response = await fetch(endpoint, {
            method: 'DELETE'
        });
        
        // Проверяем, что ответ содержит JSON
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            const result = await response.json();
            
            if (response.ok) {
                showNotification(result.message, 'success');
                closeModal();
                loadTabData(currentData.type);
                loadStatistics();
            } else {
                showNotification('Ошибка удаления: ' + result.error, 'error');
            }
        } else {
            // Если ответ не JSON, значит произошла ошибка сервера
            const text = await response.text();
            console.error('Ошибка сервера:', text);
            showNotification('Ошибка удаления: неожиданный ответ сервера', 'error');
        }
    } catch (error) {
        console.error('Ошибка удаления:', error);
        showNotification('Ошибка сети: ' + error.message, 'error');
    }
}

// Валидация обязательных полей
async function validateRequiredFields() {
    if (currentData.type === 'vms') {
        const vmName = document.getElementById('vm_name').value.trim();
        const ip = document.getElementById('ip_address').value.trim();
        
        if (!vmName) {
            return { isValid: false, message: 'Поле "Имя виртуальной машины" обязательно для заполнения' };
        }
        
        if (!ip) {
            return { isValid: false, message: 'Поле "IP адрес" обязательно для заполнения' };
        }
    } else {
        const netbiosName = document.getElementById('netbios_name').value.trim();
        const ip = document.getElementById('ip_address').value.trim();
        const inventoryNumber = document.getElementById('inventory_number').value.trim();
        
        if (!netbiosName) {
            return { isValid: false, message: 'Поле "Имя NETBIOS" обязательно для заполнения' };
        }
        
        if (!ip) {
            return { isValid: false, message: 'Поле "IP адрес" обязательно для заполнения' };
        }
        
        if (!inventoryNumber) {
            return { isValid: false, message: 'Поле "Инвентарный номер" обязательно для заполнения' };
        }
    }
    
    return { isValid: true };
}

// Валидация уникальности полей
async function validateUniqueness() {
    if (currentData.type === 'vms') {
        // Для ВМ проверяем только имя и IP
        const vmName = document.getElementById('vm_name').value.trim();
        const ip = document.getElementById('ip_address').value.trim();
        
        if (vmName) {
            const result = await checkFieldUniqueness('netbios_name', vmName);
            if (!result.isUnique) {
                return { isValid: false, message: result.message };
            }
        }
        
        if (ip) {
            const result = await checkFieldUniqueness('ip_address', ip);
            if (!result.isUnique) {
                return { isValid: false, message: result.message };
            }
        }
    } else {
        // Для серверов и АРМ проверяем все три поля
        const netbiosName = document.getElementById('netbios_name').value.trim();
        const ip = document.getElementById('ip_address').value.trim();
        const inventoryNumber = document.getElementById('inventory_number').value.trim();
        
        if (netbiosName) {
            const result = await checkFieldUniqueness('netbios_name', netbiosName);
            if (!result.isUnique) {
                return { isValid: false, message: result.message };
            }
        }
        
        if (ip) {
            const result = await checkFieldUniqueness('ip_address', ip);
            if (!result.isUnique) {
                return { isValid: false, message: result.message };
            }
        }
        
        if (inventoryNumber) {
            const result = await checkFieldUniqueness('inventory_number', inventoryNumber);
            if (!result.isUnique) {
                return { isValid: false, message: result.message };
            }
        }
    }
    
    return { isValid: true };
}

// Проверка уникальности конкретного поля
async function checkFieldUniqueness(field, value) {
    try {
        const excludeId = currentData.isNew ? null : currentData.id;
        const endpoint = currentData.type === 'arms' ? '/api/arms' : '/api/servers';
        const url = `${endpoint}/check-unique/${field}/${encodeURIComponent(value)}${excludeId ? `?excludeId=${excludeId}` : ''}`;
        
        const response = await fetch(url);
        const result = await response.json();
        
        if (response.ok) {
            return result;
        } else {
            console.error('Ошибка проверки уникальности:', result.error);
            return { isUnique: true }; // При ошибке разрешаем сохранение
        }
    } catch (error) {
        console.error('Ошибка сети при проверке уникальности:', error);
        return { isUnique: true }; // При ошибке разрешаем сохранение
    }
}

// Валидация ресурсов ВМ перед сохранением
async function validateVMResources() {
    const serverId = document.getElementById('virtual_server_id').value;
    const cpu = document.getElementById('allocated_cpu').value;
    const ramText = document.getElementById('allocated_ram').value;
    const ram = parseFloat(ramText.replace(/[^\d.]/g, '')) || 0;
    
    if (!serverId) {
        return {
            isValid: false,
            message: 'Необходимо выбрать виртуальный сервер'
        };
    }
    
    if (!cpu || cpu <= 0) {
        return {
            isValid: false,
            message: 'Необходимо указать количество CPU'
        };
    }
    
    if (!ram || ram <= 0) {
        return {
            isValid: false,
            message: 'Необходимо указать объем RAM'
        };
    }
    
    try {
        const response = await fetch(`/api/vms/check-resources/${serverId}?cpu=${cpu}&ram=${ram}`);
        const result = await response.json();
        
        if (response.ok) {
            if (!result.canAllocate) {
                // Получаем альтернативные серверы
                const altResponse = await fetch(`/api/vms/alternative-servers/${serverId}?cpu=${cpu}&ram=${ram}`);
                const alternatives = await altResponse.json();
                
                let message = 'Ресурсов не хватает, выберите другой сервер.';
                if (alternatives.length > 0) {
                    message += ' Доступные альтернативы: ';
                    message += alternatives.map(alt => `${alt.name} (свободно: ${alt.availableCores} ядер, ${alt.availableRam.toFixed(1)} ГБ)`).join(', ');
                }
                
                return {
                    isValid: false,
                    message: message
                };
            }
            
            return { isValid: true };
        } else {
            return {
                isValid: false,
                message: 'Ошибка проверки ресурсов: ' + result.error
            };
        }
    } catch (error) {
        return {
            isValid: false,
            message: 'Ошибка сети при проверке ресурсов: ' + error.message
        };
    }
}

// Сбор данных формы
function collectFormData() {
    const data = {};
    
    if (currentData.type === 'vms') {
        // Собираем данные виртуальной машины
        data.vm_name = document.getElementById('vm_name').value;
        data.vm_id = document.getElementById('vm_id').value;
        data.netbios_name = document.getElementById('netbios_name').value;
        data.ip_address = document.getElementById('ip_address').value;
        data.virtual_server_id = document.getElementById('virtual_server_id').value || null;
        data.allocated_cpu = parseInt(document.getElementById('allocated_cpu').value) || 1;
        data.allocated_ram = document.getElementById('allocated_ram').value;
        data.operating_system = document.getElementById('operating_system').value;
        data.role = document.getElementById('role').value;
        data.comments = document.getElementById('comments').value;
        
        // Собираем диски
        data.disks = [];
        document.querySelectorAll('#disks-container .dynamic-field').forEach((diskDiv, index) => {
            const capacity = diskDiv.querySelector(`[name="disk_capacity_${index}"]`).value;
            const type = diskDiv.querySelector(`[name="disk_type_${index}"]`).value;
            if (capacity) {
                data.disks.push({ capacity, type });
            }
        });
        
        // Собираем типы сети
        data.network_types = [];
        document.querySelectorAll('[name="network_types"]:checked').forEach(checkbox => {
            data.network_types.push(checkbox.value);
        });
        
    } else {
        // Собираем данные сервера/АРМ
        data.netbios_name = document.getElementById('netbios_name').value;
        data.domain = document.getElementById('domain').value;
        data.type = document.getElementById('type').value;
        data.inventory_number = document.getElementById('inventory_number').value;
        data.delivery_date = document.getElementById('delivery_date').value;
        data.commissioning_date = document.getElementById('commissioning_date').value;
        data.installation_address = document.getElementById('installation_address').value;
        data.ip_address = document.getElementById('ip_address').value;
        data.ipmi_address = document.getElementById('ipmi_address').value;
        
        // Роль только для серверов, не для АРМ
        const roleElement = document.getElementById('role');
        data.role = roleElement ? roleElement.value : '';
        
        data.operating_system = document.getElementById('operating_system').value;
        data.cpu_model = document.getElementById('cpu_model').value;
        
        // Дополнительные поля CPU только для серверов
        const cpuGenElement = document.getElementById('cpu_generation');
        data.cpu_generation = cpuGenElement ? cpuGenElement.value : '';
        
        const cpuCountElement = document.getElementById('cpu_count');
        data.cpu_count = cpuCountElement ? (parseInt(cpuCountElement.value) || 1) : 1;
        
        const coresPerCpuElement = document.getElementById('cores_per_cpu');
        data.cores_per_cpu = coresPerCpuElement ? (parseInt(coresPerCpuElement.value) || 1) : 1;
        
        data.ram_amount = document.getElementById('ram_amount').value;
        
        // Проверяем, это АРМ или сервер, и собираем соответствующие данные
        const isARM = currentData.type === 'arms';
        
        if (isARM) {
            // Для АРМ собираем диски как в ВМ
            data.disks = [];
            const disksContainer = document.getElementById('disks-container');
            if (disksContainer) {
                disksContainer.querySelectorAll('.dynamic-field').forEach((diskDiv, index) => {
                    const capacityElement = diskDiv.querySelector(`[name="disk_capacity_${index}"]`);
                    const typeElement = diskDiv.querySelector(`[name="disk_type_${index}"]`);
                    if (capacityElement && typeElement) {
                        const capacity = capacityElement.value;
                        const type = typeElement.value;
                        if (capacity) {
                            data.disks.push({ capacity, type });
                        }
                    }
                });
            }
        } else {
            // Для серверов собираем традиционные поля дисков
            const systemDiskModelElement = document.getElementById('system_disk_model');
            data.system_disk_model = systemDiskModelElement ? systemDiskModelElement.value : '';
            
            const systemDiskCountElement = document.getElementById('system_disk_count');
            data.system_disk_count = systemDiskCountElement ? (parseInt(systemDiskCountElement.value) || 1) : 1;
            
            const systemDiskCapacityElement = document.getElementById('system_disk_capacity');
            data.system_disk_capacity = systemDiskCapacityElement ? systemDiskCapacityElement.value : '';
            
            const archiveDiskModelElement = document.getElementById('archive_disk_model');
            data.archive_disk_model = archiveDiskModelElement ? archiveDiskModelElement.value : '';
            
            const archiveDiskCountElement = document.getElementById('archive_disk_count');
            data.archive_disk_count = archiveDiskCountElement ? (parseInt(archiveDiskCountElement.value) || 0) : 0;
            
            const archiveDiskCapacityElement = document.getElementById('archive_disk_capacity');
            data.archive_disk_capacity = archiveDiskCapacityElement ? archiveDiskCapacityElement.value : '';
            
            const archiveRaidTypeElement = document.getElementById('archive_raid_type');
            data.archive_raid_type = archiveRaidTypeElement ? archiveRaidTypeElement.value : '';
            
            const databaseDiskModelElement = document.getElementById('database_disk_model');
            data.database_disk_model = databaseDiskModelElement ? databaseDiskModelElement.value : '';
            
            const databaseDiskCountElement = document.getElementById('database_disk_count');
            data.database_disk_count = databaseDiskCountElement ? (parseInt(databaseDiskCountElement.value) || 0) : 0;
            
            const databaseDiskCapacityElement = document.getElementById('database_disk_capacity');
            data.database_disk_capacity = databaseDiskCapacityElement ? databaseDiskCapacityElement.value : '';
            
            const raidControllerModelElement = document.getElementById('raid_controller_model');
            data.raid_controller_model = raidControllerModelElement ? raidControllerModelElement.value : '';
        }
        
        const commentsElement = document.getElementById('comments');
        data.comments = commentsElement ? commentsElement.value : '';
        
        // Собираем сетевые карты только для серверов
        data.network_cards = [];
        if (!isARM) {
            const networkContainer = document.getElementById('network-cards-container');
            if (networkContainer) {
                networkContainer.querySelectorAll('.dynamic-field').forEach((cardDiv, index) => {
                    const modelElement = cardDiv.querySelector(`[name="network_model_${index}"]`);
                    const portsElement = cardDiv.querySelector(`[name="network_ports_${index}"]`);
                    const speedElement = cardDiv.querySelector(`[name="network_speed_${index}"]`);
                    
                    if (modelElement && portsElement && speedElement) {
                        const model = modelElement.value;
                        const ports = parseInt(portsElement.value) || 1;
                        const speed = speedElement.value;
                        if (model || ports > 1 || speed) {
                            data.network_cards.push({ model, ports, speed });
                        }
                    }
                });
            }
        }
    }
    
    return data;
}

// Автокомплит
function setupAutocomplete() {
    document.querySelectorAll('[data-autocomplete]').forEach(input => {
        const type = input.dataset.autocomplete;
        
        input.addEventListener('input', async function() {
            const value = this.value;
            if (value.length < 2) {
                hideAutocomplete(this);
                return;
            }
            
            try {
                if (!autocompleteCache[type]) {
                    const response = await fetch(`/api/settings/components/${type}`);
                    if (response.ok) {
                        autocompleteCache[type] = await response.json();
                    } else {
                        autocompleteCache[type] = [];
                    }
                }
                
                const suggestions = autocompleteCache[type].filter(item => 
                    item.toLowerCase().includes(value.toLowerCase())
                );
                
                showAutocomplete(this, suggestions);
            } catch (error) {
                console.error('Ошибка автокомплита:', error);
            }
        });
        
        input.addEventListener('blur', function() {
            setTimeout(() => hideAutocomplete(this), 200);
        });
    });
}

function showAutocomplete(input, suggestions) {
    hideAutocomplete(input);
    
    if (suggestions.length === 0) return;
    
    const container = document.createElement('div');
    container.className = 'autocomplete-suggestions';
    
    suggestions.forEach(suggestion => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        item.textContent = suggestion;
        item.addEventListener('click', () => {
            input.value = suggestion;
            hideAutocomplete(input);
        });
        container.appendChild(item);
    });
    
    input.parentNode.style.position = 'relative';
    input.parentNode.appendChild(container);
}

function hideAutocomplete(input) {
    const existing = input.parentNode.querySelector('.autocomplete-suggestions');
    if (existing) {
        existing.remove();
    }
}

// Настройка валидации уникальности
function setupUniqueValidation() {
    const fieldsToCheck = ['netbios_name', 'ip_address', 'inventory_number'];
    
    fieldsToCheck.forEach(fieldId => {
        const input = document.getElementById(fieldId);
        if (input) {
            input.addEventListener('blur', async function() {
                const value = this.value.trim();
                if (value) {
                    const result = await checkFieldUniqueness(fieldId, value);
                    
                    // Удаляем предыдущие сообщения об ошибках
                    const existingError = this.parentNode.querySelector('.unique-error');
                    if (existingError) {
                        existingError.remove();
                    }
                    
                    if (!result.isUnique) {
                        const errorDiv = document.createElement('div');
                        errorDiv.className = 'unique-error';
                        errorDiv.style.color = '#dc2626';
                        errorDiv.style.fontSize = '0.875rem';
                        errorDiv.style.marginTop = '0.25rem';
                        errorDiv.textContent = result.message;
                        
                        this.parentNode.appendChild(errorDiv);
                        this.style.borderColor = '#dc2626';
                    } else {
                        this.style.borderColor = '';
                    }
                }
            });
        }
    });
}

// Закрытие модальных окон
function closeModal() {
    document.getElementById('detail-modal').classList.remove('active');
    editMode = false;
    currentData = {};
}

function closeComponentModal() {
    document.getElementById('component-modal').classList.remove('active');
}

// Уведомления
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// Обновление данных каждые 30 секунд
setInterval(() => {
    loadStatistics();
    loadTabData(currentTab);
}, 30000);