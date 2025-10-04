const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.db');

console.log('Создание структуры базы данных...');

db.serialize(() => {
    // Таблица серверов
    db.run(`CREATE TABLE IF NOT EXISTS servers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        netbios_name TEXT NOT NULL,
        domain TEXT DEFAULT 'НЕТ',
        type TEXT DEFAULT 'сервер',
        inventory_number TEXT,
        delivery_date TEXT,
        commissioning_date TEXT,
        installation_address TEXT,
        ip_address TEXT,
        ipmi_address TEXT,
        role TEXT,
        operating_system TEXT,
        
        -- CPU блок
        cpu_model TEXT,
        cpu_generation TEXT,
        cpu_count INTEGER DEFAULT 1,
        cores_per_cpu INTEGER DEFAULT 1,
        total_cores INTEGER DEFAULT 1,
        ram_amount TEXT,
        
        -- Сеть блок (JSON массив)
        network_cards TEXT DEFAULT '[]',
        
        -- Диски блок
        system_disk_model TEXT,
        system_disk_count INTEGER DEFAULT 1,
        system_disk_capacity TEXT,
        
        archive_disk_model TEXT,
        archive_disk_count INTEGER DEFAULT 0,
        archive_disk_capacity TEXT,
        archive_raid_type TEXT DEFAULT 'Raid 5',
        archive_total_capacity TEXT,
        
        database_disk_model TEXT,
        database_disk_count INTEGER DEFAULT 0,
        database_disk_capacity TEXT,
        
        raid_controller_model TEXT,
        comments TEXT,
        
        -- Ping статус
        ping_enabled INTEGER DEFAULT 1,
        ping_status TEXT DEFAULT 'unknown',
        last_ping TEXT,
        
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Таблица АРМ
    db.run(`CREATE TABLE IF NOT EXISTS arms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        netbios_name TEXT NOT NULL,
        domain TEXT DEFAULT 'НЕТ',
        type TEXT DEFAULT 'АРМ',
        inventory_number TEXT,
        delivery_date TEXT,
        commissioning_date TEXT,
        installation_address TEXT,
        ip_address TEXT,
        ipmi_address TEXT,
        role TEXT,
        operating_system TEXT,
        
        -- CPU блок
        cpu_model TEXT,
        cpu_generation TEXT,
        cpu_count INTEGER DEFAULT 1,
        cores_per_cpu INTEGER DEFAULT 1,
        total_cores INTEGER DEFAULT 1,
        ram_amount TEXT,
        
        -- Сеть блок (JSON массив)
        network_cards TEXT DEFAULT '[]',
        
        -- Диски блок
        system_disk_model TEXT,
        system_disk_count INTEGER DEFAULT 1,
        system_disk_capacity TEXT,
        
        archive_disk_model TEXT,
        archive_disk_count INTEGER DEFAULT 0,
        archive_disk_capacity TEXT,
        archive_raid_type TEXT DEFAULT 'Raid 5',
        archive_total_capacity TEXT,
        
        database_disk_model TEXT,
        database_disk_count INTEGER DEFAULT 0,
        database_disk_capacity TEXT,
        
        raid_controller_model TEXT,
        comments TEXT,
        
        -- Ping статус
        ping_enabled INTEGER DEFAULT 1,
        ping_status TEXT DEFAULT 'unknown',
        last_ping TEXT,
        
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Таблица виртуальных машин
    db.run(`CREATE TABLE IF NOT EXISTS virtual_machines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vm_name TEXT NOT NULL,
        vm_id TEXT,
        netbios_name TEXT,
        ip_address TEXT,
        virtual_server_id INTEGER,
        
        -- Ресурсы
        allocated_cpu INTEGER DEFAULT 1,
        allocated_ram TEXT,
        
        -- Диски (JSON массив)
        disks TEXT DEFAULT '[]',
        
        -- Сеть (JSON массив)
        network_types TEXT DEFAULT '[]',
        
        -- Система
        operating_system TEXT,
        role TEXT,
        comments TEXT,
        
        ping_enabled INTEGER DEFAULT 1,
        ping_status TEXT DEFAULT 'unknown',
        last_ping TEXT,
        
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (virtual_server_id) REFERENCES servers (id)
    )`);

    // Таблица настроек
    db.run(`CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        setting_key TEXT UNIQUE NOT NULL,
        setting_value TEXT,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Таблица компонентов для автокомплита
    db.run(`CREATE TABLE IF NOT EXISTS components (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        component_type TEXT NOT NULL,
        component_value TEXT NOT NULL,
        usage_count INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Вставка начальных настроек
    db.run(`INSERT OR IGNORE INTO settings (setting_key, setting_value, description) VALUES 
            ('ping_enabled', '1', 'Глобальное включение/выключение ping'),
            ('ping_interval', '60', 'Интервал ping в минутах'),
            ('ping_timeout', '10', 'Таймаут ping в секундах')`);

    console.log('База данных создана успешно!');
});

db.close((err) => {
    if (err) {
        console.error('Ошибка при закрытии базы данных:', err.message);
    } else {
        console.log('Соединение с базой данных закрыто.');
    }
});