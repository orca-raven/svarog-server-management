const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const ping = require('ping');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Подключение к базе данных
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error('Ошибка подключения к базе данных:', err.message);
    } else {
        console.log('Подключение к SQLite базе данных установлено.');
    }
});

// Middleware для проверки API доступа
const checkApiAccess = (req, res, next) => {
    // Разрешаем доступ к статическим файлам
    if (!req.path.startsWith('/api/')) {
        return next();
    }

    // Разрешаем доступ к настройкам API (всегда доступны)
    if (req.path.startsWith('/api/settings/api-settings')) {
        return next();
    }

    // Проверяем настройку API для остальных маршрутов
    db.get('SELECT setting_value FROM settings WHERE setting_key = ?', ['api_enabled'], (err, row) => {
        if (err) {
            console.error('Ошибка проверки настроек API:', err);
            return res.status(500).json({ error: 'Ошибка сервера' });
        }

        const apiEnabled = row && row.setting_value === '1';
        
        if (!apiEnabled) {
            return res.status(403).json({ 
                error: 'API доступ отключен', 
                message: 'Внешний API доступ отключен в настройках системы для повышения безопасности' 
            });
        }

        next();
    });
};

// Применяем middleware для проверки API
app.use(checkApiAccess);

// Маршруты
const serversRouter = require('./routes/servers')(db);
const armsRouter = require('./routes/arms')(db);
const vmsRouter = require('./routes/vms')(db);
const settingsRouter = require('./routes/settings')(db);

app.use('/api/servers', serversRouter);
app.use('/api/arms', armsRouter);
app.use('/api/vms', vmsRouter);
app.use('/api/settings', settingsRouter);

// Обработка ошибок API
app.use('/api/*', (err, req, res, next) => {
    console.error('API Error:', err);
    res.status(500).json({ error: err.message || 'Внутренняя ошибка сервера' });
});

// Обработка 404 для API
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'API маршрут не найден' });
});

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Страница настроек
app.get('/settings.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'settings.html'));
});

// Функция проверки доступности серверов
async function checkServerAvailability() {
    try {
        // Проверяем серверы
        const serverSql = `SELECT id, netbios_name, ip_address FROM servers WHERE ping_enabled = 1`;
        
        db.all(serverSql, [], async (err, serverRows) => {
            if (err) {
                console.error('Ошибка при получении списка серверов для ping:', err.message);
                return;
            }

            for (const row of serverRows) {
                if (row.ip_address) {
                    try {
                        const result = await ping.promise.probe(row.ip_address, {
                            timeout: 10
                        });
                        
                        const status = result.alive ? 'online' : 'offline';
                        const updateTime = new Date().toISOString();
                        
                        db.run(`UPDATE servers SET ping_status = ?, last_ping = ? WHERE id = ?`, 
                               [status, updateTime, row.id]);
                        
                        console.log(`Ping ${row.netbios_name} (${row.ip_address}): ${status}`);
                    } catch (pingError) {
                        console.error(`Ошибка ping для ${row.netbios_name}:`, pingError.message);
                    }
                }
            }
        });

        // Проверяем АРМ
        const armSql = `SELECT id, netbios_name, ip_address FROM arms WHERE ping_enabled = 1`;
        
        db.all(armSql, [], async (err, armRows) => {
            if (err) {
                console.error('Ошибка при получении списка АРМ для ping:', err.message);
                return;
            }

            for (const row of armRows) {
                if (row.ip_address) {
                    try {
                        const result = await ping.promise.probe(row.ip_address, {
                            timeout: 10
                        });
                        
                        const status = result.alive ? 'online' : 'offline';
                        const updateTime = new Date().toISOString();
                        
                        db.run(`UPDATE arms SET ping_status = ?, last_ping = ? WHERE id = ?`, 
                               [status, updateTime, row.id]);
                        
                        console.log(`Ping ${row.netbios_name} (${row.ip_address}): ${status}`);
                    } catch (pingError) {
                        console.error(`Ошибка ping для ${row.netbios_name}:`, pingError.message);
                    }
                }
            }
        });
    } catch (error) {
        console.error('Ошибка при проверке доступности серверов:', error.message);
    }
}

// Настройка cron для проверки серверов каждый час
cron.schedule('0 * * * *', () => {
    console.log('Запуск проверки доступности серверов...');
    checkServerAvailability();
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    console.log(`Откройте http://localhost:${PORT} в браузере`);
    
    // Первоначальная проверка серверов при запуске
    setTimeout(() => {
        checkServerAvailability();
    }, 5000);
});

module.exports = app;