const express = require('express');

module.exports = (db) => {
    const router = express.Router();

    // Получить все сервера
    router.get('/', (req, res) => {
        const sql = `SELECT * FROM servers ORDER BY netbios_name COLLATE NOCASE`;
        
        db.all(sql, [], (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json(rows);
        });
    });

    // Получить сервер по ID
    router.get('/:id', (req, res) => {
        const sql = `SELECT * FROM servers WHERE id = ?`;
        
        db.get(sql, [req.params.id], (err, row) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            if (!row) {
                res.status(404).json({ error: 'Сервер не найден' });
                return;
            }
            res.json(row);
        });
    });

    // Создать новый сервер
    router.post('/', (req, res) => {
        const {
            netbios_name, domain, type, inventory_number, delivery_date,
            commissioning_date, installation_address, ip_address, ipmi_address,
            role, operating_system, cpu_model, cpu_generation, cpu_count,
            cores_per_cpu, ram_amount, network_cards, system_disk_model,
            system_disk_count, system_disk_capacity, archive_disk_model,
            archive_disk_count, archive_disk_capacity, archive_raid_type,
            database_disk_model, database_disk_count, database_disk_capacity,
            raid_controller_model, comments, ping_enabled
        } = req.body;

        // Вычисляем общее количество ядер
        const total_cores = (cpu_count || 1) * (cores_per_cpu || 1);

        // Вычисляем общий объем архивного диска
        let archive_total_capacity = '';
        if (archive_disk_count && archive_disk_capacity) {
            const capacity_tb = parseFloat(archive_disk_capacity);
            const real_capacity = capacity_tb * Math.pow(10, 12) / Math.pow(1024, 4);
            
            if (archive_raid_type === 'Raid 5') {
                archive_total_capacity = ((archive_disk_count - 1) * real_capacity).toFixed(2) + ' ТБ';
            } else if (archive_raid_type === 'Raid 6') {
                archive_total_capacity = ((archive_disk_count - 2) * real_capacity).toFixed(2) + ' ТБ';
            }
        }

        const sql = `INSERT INTO servers (
            netbios_name, domain, type, inventory_number, delivery_date,
            commissioning_date, installation_address, ip_address, ipmi_address,
            role, operating_system, cpu_model, cpu_generation, cpu_count,
            cores_per_cpu, total_cores, ram_amount, network_cards,
            system_disk_model, system_disk_count, system_disk_capacity,
            archive_disk_model, archive_disk_count, archive_disk_capacity,
            archive_raid_type, archive_total_capacity, database_disk_model,
            database_disk_count, database_disk_capacity, raid_controller_model,
            comments, ping_enabled
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        const params = [
            netbios_name, domain || 'НЕТ', type || 'сервер', inventory_number,
            delivery_date, commissioning_date, installation_address, ip_address,
            ipmi_address, role, operating_system, cpu_model, cpu_generation,
            cpu_count || 1, cores_per_cpu || 1, total_cores, ram_amount,
            JSON.stringify(network_cards || []), system_disk_model,
            system_disk_count || 1, system_disk_capacity, archive_disk_model,
            archive_disk_count || 0, archive_disk_capacity, archive_raid_type || 'Raid 5',
            archive_total_capacity, database_disk_model, database_disk_count || 0,
            database_disk_capacity, raid_controller_model, comments,
            ping_enabled !== undefined ? ping_enabled : 1
        ];

        db.run(sql, params, function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            
            // Сохраняем компоненты для автокомплита
            saveComponentsForAutocomplete(db, req.body);
            
            res.json({ id: this.lastID, message: 'Сервер создан успешно' });
        });
    });

    // Обновить сервер
    router.put('/:id', (req, res) => {
        const {
            netbios_name, domain, type, inventory_number, delivery_date,
            commissioning_date, installation_address, ip_address, ipmi_address,
            role, operating_system, cpu_model, cpu_generation, cpu_count,
            cores_per_cpu, ram_amount, network_cards, system_disk_model,
            system_disk_count, system_disk_capacity, archive_disk_model,
            archive_disk_count, archive_disk_capacity, archive_raid_type,
            database_disk_model, database_disk_count, database_disk_capacity,
            raid_controller_model, comments, ping_enabled
        } = req.body;

        // Вычисляем общее количество ядер
        const total_cores = (cpu_count || 1) * (cores_per_cpu || 1);

        // Вычисляем общий объем архивного диска
        let archive_total_capacity = '';
        if (archive_disk_count && archive_disk_capacity) {
            const capacity_tb = parseFloat(archive_disk_capacity);
            const real_capacity = capacity_tb * Math.pow(10, 12) / Math.pow(1024, 4);
            
            if (archive_raid_type === 'Raid 5') {
                archive_total_capacity = ((archive_disk_count - 1) * real_capacity).toFixed(2) + ' ТБ';
            } else if (archive_raid_type === 'Raid 6') {
                archive_total_capacity = ((archive_disk_count - 2) * real_capacity).toFixed(2) + ' ТБ';
            }
        }

        const sql = `UPDATE servers SET 
            netbios_name = ?, domain = ?, type = ?, inventory_number = ?,
            delivery_date = ?, commissioning_date = ?, installation_address = ?,
            ip_address = ?, ipmi_address = ?, role = ?, operating_system = ?,
            cpu_model = ?, cpu_generation = ?, cpu_count = ?, cores_per_cpu = ?,
            total_cores = ?, ram_amount = ?, network_cards = ?, system_disk_model = ?,
            system_disk_count = ?, system_disk_capacity = ?, archive_disk_model = ?,
            archive_disk_count = ?, archive_disk_capacity = ?, archive_raid_type = ?,
            archive_total_capacity = ?, database_disk_model = ?, database_disk_count = ?,
            database_disk_capacity = ?, raid_controller_model = ?, comments = ?,
            ping_enabled = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`;

        const params = [
            netbios_name, domain || 'НЕТ', type || 'сервер', inventory_number,
            delivery_date, commissioning_date, installation_address, ip_address,
            ipmi_address, role, operating_system, cpu_model, cpu_generation,
            cpu_count || 1, cores_per_cpu || 1, total_cores, ram_amount,
            JSON.stringify(network_cards || []), system_disk_model,
            system_disk_count || 1, system_disk_capacity, archive_disk_model,
            archive_disk_count || 0, archive_disk_capacity, archive_raid_type || 'Raid 5',
            archive_total_capacity, database_disk_model, database_disk_count || 0,
            database_disk_capacity, raid_controller_model, comments,
            ping_enabled !== undefined ? ping_enabled : 1, req.params.id
        ];

        db.run(sql, params, function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            if (this.changes === 0) {
                res.status(404).json({ error: 'Сервер не найден' });
                return;
            }
            
            // Сохраняем компоненты для автокомплита
            saveComponentsForAutocomplete(db, req.body);
            
            res.json({ message: 'Сервер обновлен успешно' });
        });
    });

    // Удалить сервер
    router.delete('/:id', (req, res) => {
        const sql = `DELETE FROM servers WHERE id = ?`;
        
        db.run(sql, [req.params.id], function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            if (this.changes === 0) {
                res.status(404).json({ error: 'Сервер не найден' });
                return;
            }
            res.json({ message: 'Сервер удален успешно' });
        });
    });

    // Получить сервера виртуализации
    router.get('/virtualization/list', (req, res) => {
        const sql = `SELECT id, netbios_name, ip_address, cpu_count, cores_per_cpu, 
                     total_cores, ram_amount FROM servers 
                     WHERE type = 'сервер виртуализации'
                     ORDER BY netbios_name`;
        
        db.all(sql, [], (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json(rows);
        });
    });

    // Проверка уникальности полей
    router.get('/check-unique/:field/:value', (req, res) => {
        const { field, value } = req.params;
        const excludeId = req.query.excludeId;
        
        if (!['netbios_name', 'ip_address', 'inventory_number'].includes(field)) {
            return res.status(400).json({ error: 'Недопустимое поле для проверки' });
        }
        
        let sql = `SELECT netbios_name, ip_address, inventory_number, type FROM servers WHERE ${field} = ?`;
        let params = [value];
        
        if (excludeId) {
            sql += ' AND id != ?';
            params.push(excludeId);
        }
        
        db.get(sql, params, (err, serverRow) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            
            if (serverRow) {
                const fieldNames = {
                    'netbios_name': 'Имя NETBIOS',
                    'ip_address': 'IP адрес',
                    'inventory_number': 'Инвентарный номер'
                };
                
                return res.json({
                    isUnique: false,
                    message: `${fieldNames[field]} "${value}" уже используется сервером "${serverRow.netbios_name}" (${serverRow.type})`
                });
            }
            
            // Проверяем АРМ
            sql = `SELECT netbios_name, ip_address, inventory_number, type FROM arms WHERE ${field} = ?`;
            params = [value];
            
            if (excludeId) {
                sql += ' AND id != ?';
                params.push(excludeId);
            }
            
            db.get(sql, params, (err, armRow) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                
                if (armRow) {
                    const fieldNames = {
                        'netbios_name': 'Имя NETBIOS',
                        'ip_address': 'IP адрес',
                        'inventory_number': 'Инвентарный номер'
                    };
                    
                    return res.json({
                        isUnique: false,
                        message: `${fieldNames[field]} "${value}" уже используется АРМ "${armRow.netbios_name}"`
                    });
                }
                
                // Проверяем ВМ
                sql = `SELECT vm_name, ip_address FROM virtual_machines WHERE ${field} = ?`;
                params = [value];
                
                if (excludeId) {
                    sql += ' AND id != ?';
                    params.push(excludeId);
                }
                
                if (field === 'netbios_name') {
                    sql = sql.replace('netbios_name', 'netbios_name');
                } else if (field === 'inventory_number') {
                    // ВМ не имеют инвентарных номеров
                    return res.json({ isUnique: true });
                }
                
                db.get(sql, params, (err, vmRow) => {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }
                    
                    if (vmRow) {
                        const fieldNames = {
                            'netbios_name': 'Имя NETBIOS',
                            'ip_address': 'IP адрес'
                        };
                        
                        return res.json({
                            isUnique: false,
                            message: `${fieldNames[field]} "${value}" уже используется виртуальной машиной "${vmRow.vm_name}"`
                        });
                    }
                    
                    res.json({ isUnique: true });
                });
            });
        });
    });

    return router;
};

// Функция для сохранения компонентов для автокомплита
function saveComponentsForAutocomplete(db, data) {
    const components = [
        { type: 'cpu_model', value: data.cpu_model },
        { type: 'cpu_generation', value: data.cpu_generation },
        { type: 'operating_system', value: data.operating_system },
        { type: 'system_disk_model', value: data.system_disk_model },
        { type: 'archive_disk_model', value: data.archive_disk_model },
        { type: 'database_disk_model', value: data.database_disk_model },
        { type: 'raid_controller_model', value: data.raid_controller_model },
        { type: 'role', value: data.role }
    ];

    components.forEach(comp => {
        if (comp.value && comp.value.trim()) {
            // Сначала проверяем, существует ли компонент
            db.get(`SELECT id, usage_count FROM components WHERE component_type = ? AND component_value = ?`,
                   [comp.type, comp.value.trim()], (err, existing) => {
                if (!err) {
                    if (existing) {
                        // Обновляем счетчик использования
                        db.run(`UPDATE components SET usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP 
                                WHERE component_type = ? AND component_value = ?`,
                               [comp.type, comp.value.trim()]);
                    } else {
                        // Добавляем новый компонент
                        db.run(`INSERT INTO components (component_type, component_value, usage_count) VALUES (?, ?, 1)`,
                               [comp.type, comp.value.trim()]);
                    }
                }
            });
        }
    });
}