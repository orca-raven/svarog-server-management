const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');

module.exports = (db) => {
    const router = express.Router();

    // Настройка multer для загрузки файлов
    const upload = multer({ dest: 'uploads/' });

    // Специальный маршрут для управления API (всегда доступен)
    router.get('/api-settings', (req, res) => {
        db.get('SELECT setting_value FROM settings WHERE setting_key = ?', ['api_enabled'], (err, row) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            
            const apiEnabled = row ? row.setting_value === '1' : false;
            res.json({ api_enabled: apiEnabled });
        });
    });

    router.put('/api-settings', (req, res) => {
        const { api_enabled } = req.body;
        const value = api_enabled ? '1' : '0';
        
        db.run('UPDATE settings SET setting_value = ?, updated_at = CURRENT_TIMESTAMP WHERE setting_key = ?', 
               [value, 'api_enabled'], (err) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            
            res.json({ 
                success: true, 
                api_enabled: api_enabled,
                message: api_enabled ? 'API доступ включен' : 'API доступ отключен'
            });
        });
    });

    // Получить статистику
    router.get('/stats', (req, res) => {
        const serverCountSql = `SELECT COUNT(*) as count FROM servers WHERE type != 'сервер виртуализации'`;
        const armCountSql = `SELECT COUNT(*) as count FROM arms`;
        const vmCountSql = `SELECT COUNT(*) as count FROM virtual_machines`;

        db.get(serverCountSql, [], (err, serverResult) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            db.get(armCountSql, [], (err, armResult) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }

                db.get(vmCountSql, [], (err, vmResult) => {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }

                    res.json({
                        servers: serverResult.count,
                        arms: armResult.count,
                        vms: vmResult.count
                    });
                });
            });
        });
    });

    // Получить компоненты для автокомплита
    router.get('/components/:type', (req, res) => {
        const type = req.params.type;
        const sql = `SELECT component_value, usage_count FROM components 
                     WHERE component_type = ? 
                     ORDER BY usage_count DESC, component_value ASC`;
        
        db.all(sql, [type], (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json(rows.map(row => row.component_value));
        });
    });

    // Получить статистику компонентов с подсчетом в реальном времени
    router.get('/components-stats', (req, res) => {
        console.log('Запрос статистики компонентов получен');
        
        const stats = {};
        const componentTypes = [
            'cpu_model', 'operating_system', 'system_disk_model'
        ];
        
        let completedQueries = 0;
        const totalQueries = componentTypes.length;

        // Упрощенная версия для отладки
        componentTypes.forEach(type => {
            const sql = `SELECT ${type} as component_value, COUNT(*) as count FROM servers WHERE ${type} IS NOT NULL AND ${type} != '' GROUP BY ${type}`;
            
            db.all(sql, [], (err, rows) => {
                if (err) {
                    console.error(`Ошибка загрузки статистики для ${type}:`, err);
                    stats[type] = {};
                } else {
                    console.log(`Результат для ${type}:`, rows);
                    const groupedStats = {};
                    rows.forEach(row => {
                        if (row.component_value && row.component_value.trim() !== '') {
                            groupedStats[row.component_value] = row.count;
                        }
                    });
                    stats[type] = groupedStats;
                }
                
                completedQueries++;
                console.log(`Завершено запросов: ${completedQueries}/${totalQueries}`);
                if (completedQueries === totalQueries) {
                    console.log('Отправляем статистику:', stats);
                    res.json(stats);
                }
            });
        });
    });

    // Тестовый endpoint для проверки данных в базе
    router.get('/test-data', (req, res) => {
        console.log('Тестовый запрос данных');
        
        const queries = [
            { name: 'servers', sql: 'SELECT COUNT(*) as count FROM servers' },
            { name: 'arms', sql: 'SELECT COUNT(*) as count FROM arms' },
            { name: 'vms', sql: 'SELECT COUNT(*) as count FROM virtual_machines' },
            { name: 'server_details', sql: 'SELECT netbios_name, cpu_model, operating_system, system_disk_model FROM servers LIMIT 5' }
        ];
        
        const results = {};
        let completed = 0;
        
        queries.forEach(query => {
            if (query.name === 'server_details') {
                db.all(query.sql, [], (err, rows) => {
                    if (err) {
                        console.error(`Ошибка запроса ${query.name}:`, err);
                        results[query.name] = { error: err.message };
                    } else {
                        console.log(`${query.name}:`, rows);
                        results[query.name] = rows;
                    }
                    
                    completed++;
                    if (completed === queries.length) {
                        res.json(results);
                    }
                });
            } else {
                db.get(query.sql, [], (err, row) => {
                    if (err) {
                        console.error(`Ошибка запроса ${query.name}:`, err);
                        results[query.name] = { error: err.message };
                    } else {
                        console.log(`${query.name}: ${row.count} записей`);
                        results[query.name] = row.count;
                    }
                    
                    completed++;
                    if (completed === queries.length) {
                        res.json(results);
                    }
                });
            }
        });
    });

    // Получить оборудование с определенным компонентом
    router.get('/component-equipment/:type/:value', (req, res) => {
        const { type, value } = req.params;
        
        if (!type || !value) {
            res.status(400).json({ error: 'Необходимо указать type и value' });
            return;
        }

        let sql = '';
        let column = '';

        // Определяем какой столбец искать
        switch(type) {
            case 'cpu_model':
                column = 'cpu_model';
                break;
            case 'cpu_generation':
                column = 'cpu_generation';
                break;
            case 'operating_system':
                column = 'operating_system';
                break;
            case 'system_disk_model':
                column = 'system_disk_model';
                break;
            case 'archive_disk_model':
                column = 'archive_disk_model';
                break;
            case 'database_disk_model':
                column = 'database_disk_model';
                break;
            case 'raid_controller_model':
                column = 'raid_controller_model';
                break;
            case 'analytics':
                column = 'role';
                break;
            default:
                res.status(400).json({ error: 'Неподдерживаемый тип компонента' });
                return;
        }

        sql = `SELECT 'Сервер' as equipment_type, netbios_name, ip_address, installation_address 
               FROM servers WHERE ${column} = ?
               UNION ALL
               SELECT 'АРМ' as equipment_type, netbios_name, ip_address, installation_address 
               FROM arms WHERE ${column} = ?`;

        db.all(sql, [value, value], (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json(rows);
        });
    });

    // Получить список оборудования с определенным компонентом (старый endpoint для совместимости)
    router.get('/equipment-with-component', (req, res) => {
        const { type, value } = req.query;
        
        if (!type || !value) {
            res.status(400).json({ error: 'Необходимо указать type и value' });
            return;
        }

        let sql = '';
        let column = '';

        // Определяем какой столбец искать
        switch(type) {
            case 'cpu_model':
                column = 'cpu_model';
                break;
            case 'cpu_generation':
                column = 'cpu_generation';
                break;
            case 'operating_system':
                column = 'operating_system';
                break;
            case 'system_disk_model':
                column = 'system_disk_model';
                break;
            case 'archive_disk_model':
                column = 'archive_disk_model';
                break;
            case 'database_disk_model':
                column = 'database_disk_model';
                break;
            case 'raid_controller_model':
                column = 'raid_controller_model';
                break;
            case 'role':
                column = 'role';
                break;
            default:
                res.status(400).json({ error: 'Неподдерживаемый тип компонента' });
                return;
        }

        sql = `SELECT 'Сервер' as equipment_type, netbios_name, ip_address, installation_address 
               FROM servers WHERE ${column} = ?
               UNION ALL
               SELECT 'АРМ' as equipment_type, netbios_name, ip_address, installation_address 
               FROM arms WHERE ${column} = ?`;

        db.all(sql, [value, value], (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json(rows);
        });
    });

    // Экспорт данных
    router.get('/export', (req, res) => {
        const { type } = req.query; // 'servers', 'arms', 'vms', 'all'
        
        let promises = [];
        
        if (type === 'servers' || type === 'all') {
            promises.push(new Promise((resolve, reject) => {
                db.all('SELECT * FROM servers', [], (err, rows) => {
                    if (err) reject(err);
                    else resolve({ name: 'Серверы', data: rows });
                });
            }));
        }
        
        if (type === 'arms' || type === 'all') {
            promises.push(new Promise((resolve, reject) => {
                db.all('SELECT * FROM arms', [], (err, rows) => {
                    if (err) reject(err);
                    else resolve({ name: 'АРМ', data: rows });
                });
            }));
        }
        
        if (type === 'vms' || type === 'all') {
            promises.push(new Promise((resolve, reject) => {
                const sql = `SELECT vm.*, s.netbios_name as server_name 
                             FROM virtual_machines vm 
                             LEFT JOIN servers s ON vm.virtual_server_id = s.id`;
                db.all(sql, [], (err, rows) => {
                    if (err) reject(err);
                    else resolve({ name: 'Виртуальные_машины', data: rows });
                });
            }));
        }

        Promise.all(promises)
            .then(results => {
                const workbook = XLSX.utils.book_new();
                
                results.forEach(result => {
                    const worksheet = XLSX.utils.json_to_sheet(result.data);
                    XLSX.utils.book_append_sheet(workbook, worksheet, result.name);
                });

                const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
                
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', `attachment; filename="export_${type}_${new Date().toISOString().split('T')[0]}.xlsx"`);
                res.send(buffer);
            })
            .catch(err => {
                res.status(500).json({ error: err.message });
            });
    });

    // Импорт данных
    router.post('/import', upload.single('file'), (req, res) => {
        if (!req.file) {
            res.status(400).json({ error: 'Файл не загружен' });
            return;
        }

        try {
            const workbook = XLSX.readFile(req.file.path);
            const results = { added: 0, skipped: 0, errors: [] };

            workbook.SheetNames.forEach(sheetName => {
                const worksheet = workbook.Sheets[sheetName];
                const data = XLSX.utils.sheet_to_json(worksheet);
                
                data.forEach(row => {
                    try {
                        // Определяем тип данных по названию листа или по полям
                        let tableName = '';
                        if (sheetName.toLowerCase().includes('сервер') || row.type === 'сервер' || row.type === 'сервер виртуализации') {
                            tableName = 'servers';
                        } else if (sheetName.toLowerCase().includes('арм') || row.type === 'АРМ') {
                            tableName = 'arms';
                        } else if (sheetName.toLowerCase().includes('виртуальн') || row.vm_name) {
                            tableName = 'virtual_machines';
                        }

                        if (tableName) {
                            // Проверяем, существует ли уже такая запись
                            const checkField = tableName === 'virtual_machines' ? 'vm_name' : 'netbios_name';
                            const checkValue = tableName === 'virtual_machines' ? row.vm_name : row.netbios_name;
                            
                            if (checkValue) {
                                const checkSql = `SELECT id FROM ${tableName} WHERE ${checkField} = ?`;
                                db.get(checkSql, [checkValue], (err, existing) => {
                                    if (err) {
                                        results.errors.push(`Ошибка проверки ${checkValue}: ${err.message}`);
                                        return;
                                    }
                                    
                                    if (existing) {
                                        results.skipped++;
                                    } else {
                                        // Добавляем новую запись
                                        insertRecord(db, tableName, row)
                                            .then(() => results.added++)
                                            .catch(err => results.errors.push(`Ошибка добавления ${checkValue}: ${err.message}`));
                                    }
                                });
                            }
                        }
                    } catch (error) {
                        results.errors.push(`Ошибка обработки строки: ${error.message}`);
                    }
                });
            });

            // Возвращаем результат через небольшую задержку, чтобы дать время на обработку
            setTimeout(() => {
                res.json(results);
            }, 2000);

        } catch (error) {
            res.status(500).json({ error: `Ошибка обработки файла: ${error.message}` });
        }
    });

    // Получить настройки ping
    router.get('/ping-settings', (req, res) => {
        const sql = `SELECT setting_key, setting_value FROM settings 
                     WHERE setting_key IN ('ping_enabled', 'ping_interval', 'ping_timeout')`;
        
        db.all(sql, [], (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            
            const settings = {};
            rows.forEach(row => {
                settings[row.setting_key] = row.setting_value;
            });
            
            res.json(settings);
        });
    });

    // Обновить настройки ping
    router.put('/ping-settings', (req, res) => {
        const { ping_enabled, ping_interval, ping_timeout } = req.body;
        
        const updates = [
            { key: 'ping_enabled', value: ping_enabled },
            { key: 'ping_interval', value: ping_interval },
            { key: 'ping_timeout', value: ping_timeout }
        ];

        let completed = 0;
        let errors = [];

        updates.forEach(update => {
            if (update.value !== undefined) {
                const sql = `UPDATE settings SET setting_value = ?, updated_at = CURRENT_TIMESTAMP WHERE setting_key = ?`;
                db.run(sql, [update.value, update.key], (err) => {
                    completed++;
                    if (err) {
                        errors.push(`Ошибка обновления ${update.key}: ${err.message}`);
                    }
                    
                    if (completed === updates.filter(u => u.value !== undefined).length) {
                        if (errors.length > 0) {
                            res.status(500).json({ errors });
                        } else {
                            res.json({ message: 'Настройки обновлены успешно' });
                        }
                    }
                });
            } else {
                completed++;
            }
        });
    });

    return router;
};

// Вспомогательная функция для вставки записи
function insertRecord(db, tableName, data) {
    return new Promise((resolve, reject) => {
        if (tableName === 'virtual_machines') {
            const sql = `INSERT INTO virtual_machines (
                vm_name, vm_id, netbios_name, ip_address, virtual_server_id,
                allocated_cpu, allocated_ram, disks, network_types,
                operating_system, role, comments
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            
            const params = [
                data.vm_name, data.vm_id, data.netbios_name, data.ip_address,
                data.virtual_server_id, data.allocated_cpu || 1, data.allocated_ram,
                data.disks || '[]', data.network_types || '[]',
                data.operating_system, data.role, data.comments
            ];
            
            db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        } else {
            // Для серверов и АРМ
            const sql = `INSERT INTO ${tableName} (
                netbios_name, domain, type, inventory_number, delivery_date,
                commissioning_date, installation_address, ip_address, ipmi_address,
                role, operating_system, cpu_model, cpu_generation, cpu_count,
                cores_per_cpu, total_cores, ram_amount, network_cards,
                system_disk_model, system_disk_count, system_disk_capacity,
                archive_disk_model, archive_disk_count, archive_disk_capacity,
                archive_raid_type, database_disk_model, database_disk_count,
                database_disk_capacity, raid_controller_model, comments
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            
            const total_cores = (data.cpu_count || 1) * (data.cores_per_cpu || 1);
            
            const params = [
                data.netbios_name, data.domain || 'НЕТ', data.type || (tableName === 'servers' ? 'сервер' : 'АРМ'),
                data.inventory_number, data.delivery_date, data.commissioning_date,
                data.installation_address, data.ip_address, data.ipmi_address,
                data.role, data.operating_system, data.cpu_model, data.cpu_generation,
                data.cpu_count || 1, data.cores_per_cpu || 1, total_cores,
                data.ram_amount, data.network_cards || '[]', data.system_disk_model,
                data.system_disk_count || 1, data.system_disk_capacity,
                data.archive_disk_model, data.archive_disk_count || 0,
                data.archive_disk_capacity, data.archive_raid_type || 'Raid 5',
                data.database_disk_model, data.database_disk_count || 0,
                data.database_disk_capacity, data.raid_controller_model, data.comments
            ];
            
            db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        }
    });
}