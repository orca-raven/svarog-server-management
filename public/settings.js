// Инициализация страницы настроек
document.addEventListener('DOMContentLoaded', function() {
    initializeSettings();
});

function initializeSettings() {
    loadComponentsStats();
    loadPingSettings();
    loadApiSettings();
    setupEventListeners();
}

function setupEventListeners() {
    // Закрытие модального окна компонентов
    document.getElementById('close-component-modal').addEventListener('click', closeComponentModal);
    
    // Закрытие модального окна при клике вне его
    document.getElementById('component-modal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeComponentModal();
        }
    });
}

// Загрузка статистики компонентов
async function loadComponentsStats() {
    try {
        const response = await fetch('/api/settings/components-stats');
        
        // Проверяем content-type перед парсингом JSON
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            const text = await response.text();
            console.error('Ошибка: ответ не является JSON:', text);
            throw new Error('Сервер вернул неожиданный тип данных');
        }
        
        const stats = await response.json();
        
        if (response.ok) {
            console.log('Полученная статистика:', stats); // Отладочная информация
            renderComponentsStats(stats);
        } else {
            console.error('Ошибка загрузки статистики:', stats.error);
        }
    } catch (error) {
        console.error('Ошибка загрузки статистики компонентов:', error);
    }
}

// Отрисовка статистики компонентов
function renderComponentsStats(stats) {
    const container = document.getElementById('components-stats');
    
    if (!stats || Object.keys(stats).length === 0) {
        container.innerHTML = '<p class="no-data">Нет данных о компонентах</p>';
        return;
    }
    
    let html = '';
    
    Object.entries(stats).forEach(([componentType, components]) => {
        // Проверяем что components - это объект и не пустой
        if (components && typeof components === 'object' && !Array.isArray(components) && Object.keys(components).length > 0) {
            html += `
                <div class="component-category">
                    <h3>${getComponentTypeName(componentType)}</h3>
                    <div class="component-list">
            `;
            
            // Сортируем компоненты по количеству использований
            const sortedComponents = Object.entries(components)
                .filter(([key, value]) => key && key !== 'null' && key !== 'undefined' && typeof value === 'number')
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10); // Показываем только топ-10
            
            sortedComponents.forEach(([componentName, count]) => {
                // Убеждаемся что componentName - строка
                const displayName = typeof componentName === 'string' ? componentName : String(componentName);
                const safeName = displayName.replace(/'/g, "\\'"); // Экранируем кавычки
                
                html += `
                    <div class="component-item" onclick="showComponentEquipment('${componentType}', '${safeName}')">
                        <span class="component-name">${displayName}</span>
                        <span class="component-count">${count}</span>
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        }
    });
    
    if (html === '') {
        html = '<p class="no-data">Нет данных о компонентах</p>';
    }
    
    container.innerHTML = html;
}

// Получить название типа компонента
function getComponentTypeName(type) {
    const names = {
        'cpu_model': 'Модели процессоров',
        'cpu_generation': 'Поколения процессоров',
        'operating_system': 'Операционные системы',
        'system_disk_model': 'Модели системных дисков',
        'archive_disk_model': 'Модели архивных дисков',
        'database_disk_model': 'Модели дисков БД',
        'raid_controller_model': 'RAID контроллеры',
        'analytics': 'Аналитика'
    };
    return names[type] || type;
}

// Показать оборудование с компонентом
async function showComponentEquipment(componentType, componentName) {
    try {
        const response = await fetch(`/api/settings/component-equipment/${componentType}/${encodeURIComponent(componentName)}`);
        const equipment = await response.json();
        
        if (response.ok) {
            renderComponentEquipment(componentName, equipment);
            document.getElementById('component-modal').classList.add('active');
        } else {
            showNotification('Ошибка загрузки данных: ' + equipment.error, 'error');
        }
    } catch (error) {
        console.error('Ошибка загрузки оборудования:', error);
        showNotification('Ошибка сети: ' + error.message, 'error');
    }
}

// Отрисовка оборудования с компонентом
function renderComponentEquipment(componentName, equipment) {
    document.getElementById('component-modal-title').textContent = `Оборудование с компонентом: ${componentName}`;
    
    const tbody = document.getElementById('component-equipment-list');
    
    if (!equipment || equipment.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="no-data">Нет оборудования с данным компонентом</td></tr>';
        return;
    }
    
    tbody.innerHTML = equipment.map(item => `
        <tr>
            <td>${item.equipment_type}</td>
            <td>${item.netbios_name || '-'}</td>
            <td>${item.ip_address || '-'}</td>
            <td>${item.installation_address || '-'}</td>
        </tr>
    `).join('');
}

// Закрытие модального окна компонентов
function closeComponentModal() {
    document.getElementById('component-modal').classList.remove('active');
}

// Экспорт данных
async function exportData(type) {
    try {
        const response = await fetch(`/api/settings/export?type=${type}`);
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `server_management_${type}_${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            showNotification('Экспорт завершен успешно', 'success');
        } else {
            const error = await response.json();
            showNotification('Ошибка экспорта: ' + error.error, 'error');
        }
    } catch (error) {
        console.error('Ошибка экспорта:', error);
        showNotification('Ошибка сети: ' + error.message, 'error');
    }
}

// Импорт данных
async function importData() {
    const fileInput = document.getElementById('import-file');
    const file = fileInput.files[0];
    
    if (!file) {
        showNotification('Выберите файл для импорта', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch('/api/settings/import', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification(result.message, 'success');
            fileInput.value = '';
            // Обновляем статистику
            loadComponentsStats();
        } else {
            showNotification('Ошибка импорта: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Ошибка импорта:', error);
        showNotification('Ошибка сети: ' + error.message, 'error');
    }
}

// Загрузка настроек ping
async function loadPingSettings() {
    try {
        const response = await fetch('/api/settings/ping-settings');
        const settings = await response.json();
        
        if (response.ok) {
            document.getElementById('ping-enabled').checked = settings.enabled;
            document.getElementById('ping-interval').value = settings.interval;
            document.getElementById('ping-timeout').value = settings.timeout;
        } else {
            console.error('Ошибка загрузки настроек ping:', settings.error);
        }
    } catch (error) {
        console.error('Ошибка загрузки настроек ping:', error);
    }
}

// Сохранение настроек ping
async function savePingSettings() {
    const enabled = document.getElementById('ping-enabled').checked;
    const interval = parseInt(document.getElementById('ping-interval').value);
    const timeout = parseInt(document.getElementById('ping-timeout').value);
    
    if (interval < 1 || interval > 1440) {
        showNotification('Интервал должен быть от 1 до 1440 минут', 'error');
        return;
    }
    
    if (timeout < 1 || timeout > 60) {
        showNotification('Таймаут должен быть от 1 до 60 секунд', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/settings/ping-settings', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                enabled,
                interval,
                timeout
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification(result.message, 'success');
        } else {
            showNotification('Ошибка сохранения: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Ошибка сохранения настроек:', error);
        showNotification('Ошибка сети: ' + error.message, 'error');
    }
}

// Загрузка настроек API
async function loadApiSettings() {
    try {
        const response = await fetch('/api/settings/api-settings');
        const result = await response.json();
        
        if (response.ok) {
            document.getElementById('api-enabled').checked = result.api_enabled;
        } else {
            console.error('Ошибка загрузки настроек API:', result.error);
        }
    } catch (error) {
        console.error('Ошибка загрузки настроек API:', error);
    }
}

// Сохранение настроек API
async function saveApiSettings() {
    const apiEnabled = document.getElementById('api-enabled').checked;
    
    try {
        const response = await fetch('/api/settings/api-settings', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                api_enabled: apiEnabled
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification(result.message, 'success');
            
            // Если API был отключен, предупреждаем пользователя
            if (!apiEnabled) {
                showNotification('⚠️ Внешний API доступ отключен. Это повышает безопасность системы.', 'warning');
            }
        } else {
            showNotification('Ошибка сохранения: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Ошибка сохранения настроек API:', error);
        showNotification('Ошибка сети: ' + error.message, 'error');
    }
}

// Показать уведомление
function showNotification(message, type = 'info') {
    // Создаем элемент уведомления
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Добавляем стили для уведомления
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 4px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        max-width: 400px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    
    // Устанавливаем цвет в зависимости от типа
    switch(type) {
        case 'success':
            notification.style.backgroundColor = '#4caf50';
            break;
        case 'error':
            notification.style.backgroundColor = '#f44336';
            break;
        case 'warning':
            notification.style.backgroundColor = '#ff9800';
            break;
        default:
            notification.style.backgroundColor = '#2196f3';
    }
    
    // Добавляем на страницу
    document.body.appendChild(notification);
    
    // Удаляем через 5 секунд
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}