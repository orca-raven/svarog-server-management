const express = require('express');

module.exports = (db) => {
    const router = express.Router();

    // Получить все виртуальные машины
    router.get('/', (req, res) => {
        const sql = `SELECT vm.*, s.netbios_name as server_name, s.ip_address as server_ip 
                     FROM virtual_machines vm 
                     LEFT JOIN servers s ON vm.virtual_server_id = s.id
                     ORDER BY vm.vm_name`;
        
        db.all(sql, [], (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json(rows);
        });
    });

    // Получить виртуальную машину по ID
    router.get('/:id', (req, res) => {
        const sql = `SELECT vm.*, s.netbios_name as server_name, s.ip_address as server_ip 
                     FROM virtual_machines vm 
                     LEFT JOIN servers s ON vm.virtual_server_id = s.id
                     WHERE vm.id = ?`;
        
        db.get(sql, [req.params.id], (err, row) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            if (!row) {
                res.status(404).json({ error: 'Виртуальная машина не найдена' });
                return;
            }
            res.json(row);
        });
    });

    // Проверка ресурсов сервера виртуализации
    router.get('/check-resources/:serverId', (req, res) => {
        const serverId = req.params.serverId;
        const { cpu, ram, disk_capacity } = req.query;

        // Получаем информацию о сервере
        const serverSql = `SELECT total_cores, ram_amount FROM servers WHERE id = ? AND type = 'сервер виртуализации'`;
        
        db.get(serverSql, [serverId], (err, server) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            if (!server) {
                res.status(404).json({ error: 'Сервер виртуализации не найден' });
                return;
            }

            // Получаем сумму ресурсов виртуальных машин на этом сервере
            const vmSql = `SELECT 
                           COALESCE(SUM(allocated_cpu), 0) as used_cpu,
                           COALESCE(SUM(CAST(REPLACE(allocated_ram, ' ГБ', '') AS REAL)), 0) as used_ram
                           FROM virtual_machines WHERE virtual_server_id = ?`;
            
            db.get(vmSql, [serverId], (err, usage) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }

                const totalCores = server.total_cores;
                const totalRam = parseFloat(server.ram_amount.replace(/[^\d.]/g, '')) || 0;
                
                // Резерв 5%
                const availableCores = Math.floor(totalCores * 0.95);
                const availableRam = totalRam * 0.95;
                
                const usedCores = usage.used_cpu || 0;
                const usedRam = usage.used_ram || 0;
                
                const requestedCpu = parseInt(cpu) || 0;
                const requestedRam = parseFloat(ram) || 0;
                
                const canAllocate = (usedCores + requestedCpu <= availableCores) && 
                                   (usedRam + requestedRam <= availableRam);

                res.json({
                    canAllocate,
                    totalCores,
                    availableCores,
                    usedCores,
                    totalRam,
                    availableRam,
                    usedRam,
                    message: canAllocate ? 'Ресурсы доступны' : 'Ресурсов не хватает, выберите другой сервер'
                });
            });
        });
    });

    // Получить альтернативные сервера с достаточными ресурсами
    router.get('/alternative-servers/:excludeId', (req, res) => {
        const excludeId = req.params.excludeId;
        const { cpu, ram } = req.query;
        
        const requestedCpu = parseInt(cpu) || 0;
        const requestedRam = parseFloat(ram) || 0;

        // Получаем все сервера виртуализации кроме исключенного
        const sql = `SELECT id, netbios_name, ip_address, total_cores, ram_amount 
                     FROM servers 
                     WHERE type = 'сервер виртуализации' AND id != ?`;
        
        db.all(sql, [excludeId], (err, servers) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            const alternatives = [];
            let processed = 0;

            if (servers.length === 0) {
                res.json([]);
                return;
            }

            servers.forEach(server => {
                // Получаем использованные ресурсы для каждого сервера
                const vmSql = `SELECT 
                               COALESCE(SUM(allocated_cpu), 0) as used_cpu,
                               COALESCE(SUM(CAST(REPLACE(allocated_ram, ' ГБ', '') AS REAL)), 0) as used_ram
                               FROM virtual_machines WHERE virtual_server_id = ?`;
                
                db.get(vmSql, [server.id], (err, usage) => {
                    processed++;
                    
                    if (!err) {
                        const totalCores = server.total_cores;
                        const totalRam = parseFloat(server.ram_amount.replace(/[^\d.]/g, '')) || 0;
                        
                        const availableCores = Math.floor(totalCores * 0.95);
                        const availableRam = totalRam * 0.95;
                        
                        const usedCores = usage.used_cpu || 0;
                        const usedRam = usage.used_ram || 0;
                        
                        const canAllocate = (usedCores + requestedCpu <= availableCores) && 
                                           (usedRam + requestedRam <= availableRam);

                        if (canAllocate) {
                            alternatives.push({
                                id: server.id,
                                name: server.netbios_name,
                                ip: server.ip_address,
                                availableCores: availableCores - usedCores,
                                availableRam: availableRam - usedRam
                            });
                        }
                    }

                    if (processed === servers.length) {
                        res.json(alternatives);
                    }
                });
            });
        });
    });

    // Создать новую виртуальную машину
    router.post('/', async (req, res) => {
        const {
            vm_name, vm_id, netbios_name, ip_address, virtual_server_id,
            allocated_cpu, allocated_ram, disks, network_types,
            operating_system, role, comments, ping_enabled
        } = req.body;

        // Проверяем ресурсы сервера перед созданием
        if (virtual_server_id && allocated_cpu && allocated_ram) {
            try {
                const ram = parseFloat(allocated_ram.replace(/[^\d.]/g, '')) || 0;
                const resourceCheck = await checkResourcesAvailability(db, virtual_server_id, allocated_cpu, ram);
                
                if (!resourceCheck.canAllocate) {
                    return res.status(400).json({ 
                        error: 'Недостаточно ресурсов на выбранном сервере. ' + resourceCheck.message 
                    });
                }
            } catch (error) {
                console.error('Ошибка проверки ресурсов:', error);
                return res.status(500).json({ error: 'Ошибка проверки ресурсов сервера' });
            }
        }

        const sql = `INSERT INTO virtual_machines (
            vm_name, vm_id, netbios_name, ip_address, virtual_server_id,
            allocated_cpu, allocated_ram, disks, network_types,
            operating_system, role, comments, ping_enabled
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        const params = [
            vm_name, vm_id, netbios_name, ip_address, virtual_server_id,
            allocated_cpu || 1, allocated_ram, JSON.stringify(disks || []),
            JSON.stringify(network_types || []), operating_system, role,
            comments, ping_enabled !== undefined ? ping_enabled : 1
        ];

        db.run(sql, params, function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ id: this.lastID, message: 'Виртуальная машина создана успешно' });
        });
    });

    // Обновить виртуальную машину
    router.put('/:id', async (req, res) => {
        const {
            vm_name, vm_id, netbios_name, ip_address, virtual_server_id,
            allocated_cpu, allocated_ram, disks, network_types,
            operating_system, role, comments, ping_enabled
        } = req.body;

        // Проверяем ресурсы сервера перед обновлением (если сервер или ресурсы изменились)
        if (virtual_server_id && allocated_cpu && allocated_ram) {
            try {
                const ram = parseFloat(allocated_ram.replace(/[^\d.]/g, '')) || 0;
                
                // Получаем текущие ресурсы этой ВМ чтобы исключить их из расчета
                const currentVmSql = `SELECT virtual_server_id, allocated_cpu, allocated_ram FROM virtual_machines WHERE id = ?`;
                
                const currentVm = await new Promise((resolve, reject) => {
                    db.get(currentVmSql, [req.params.id], (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    });
                });

                // Если сервер или ресурсы изменились, проверяем доступность
                if (!currentVm || 
                    currentVm.virtual_server_id != virtual_server_id || 
                    currentVm.allocated_cpu != allocated_cpu ||
                    currentVm.allocated_ram != allocated_ram) {
                    
                    const resourceCheck = await checkResourcesAvailability(db, virtual_server_id, allocated_cpu, ram, req.params.id);
                    
                    if (!resourceCheck.canAllocate) {
                        return res.status(400).json({ 
                            error: 'Недостаточно ресурсов на выбранном сервере. ' + resourceCheck.message 
                        });
                    }
                }
            } catch (error) {
                console.error('Ошибка проверки ресурсов:', error);
                return res.status(500).json({ error: 'Ошибка проверки ресурсов сервера' });
            }
        }

        const sql = `UPDATE virtual_machines SET 
            vm_name = ?, vm_id = ?, netbios_name = ?, ip_address = ?,
            virtual_server_id = ?, allocated_cpu = ?, allocated_ram = ?,
            disks = ?, network_types = ?, operating_system = ?, role = ?,
            comments = ?, ping_enabled = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`;

        const params = [
            vm_name, vm_id, netbios_name, ip_address, virtual_server_id,
            allocated_cpu || 1, allocated_ram, JSON.stringify(disks || []),
            JSON.stringify(network_types || []), operating_system, role,
            comments, ping_enabled !== undefined ? ping_enabled : 1,
            req.params.id
        ];

        db.run(sql, params, function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            if (this.changes === 0) {
                res.status(404).json({ error: 'Виртуальная машина не найдена' });
                return;
            }
            res.json({ message: 'Виртуальная машина обновлена успешно' });
        });
    });

    // Удалить виртуальную машину
    router.delete('/:id', (req, res) => {
        const sql = `DELETE FROM virtual_machines WHERE id = ?`;
        
        db.run(sql, [req.params.id], function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            if (this.changes === 0) {
                res.status(404).json({ error: 'Виртуальная машина не найдена' });
                return;
            }
            res.json({ message: 'Виртуальная машина удалена успешно' });
        });
    });

    return router;
};

// Вспомогательная функция для проверки ресурсов
async function checkResourcesAvailability(db, serverId, requestedCpu, requestedRam, excludeVmId = null) {
    return new Promise((resolve, reject) => {
        // Получаем информацию о сервере
        const serverSql = `SELECT total_cores, ram_amount FROM servers WHERE id = ? AND type = 'сервер виртуализации'`;
        
        db.get(serverSql, [serverId], (err, server) => {
            if (err) {
                reject(err);
                return;
            }
            if (!server) {
                resolve({ canAllocate: false, message: 'Сервер виртуализации не найден' });
                return;
            }

            // Получаем сумму ресурсов виртуальных машин на этом сервере (исключая текущую ВМ при редактировании)
            let vmSql = `SELECT 
                           COALESCE(SUM(allocated_cpu), 0) as used_cpu,
                           COALESCE(SUM(CAST(REPLACE(allocated_ram, ' ГБ', '') AS REAL)), 0) as used_ram
                           FROM virtual_machines WHERE virtual_server_id = ?`;
            let params = [serverId];
            
            if (excludeVmId) {
                vmSql += ` AND id != ?`;
                params.push(excludeVmId);
            }
            
            db.get(vmSql, params, (err, usage) => {
                if (err) {
                    reject(err);
                    return;
                }

                const totalCores = server.total_cores;
                const totalRam = parseFloat(server.ram_amount.replace(/[^\d.]/g, '')) || 0;
                
                // Резерв 5%
                const availableCores = Math.floor(totalCores * 0.95);
                const availableRam = totalRam * 0.95;
                
                const usedCores = usage.used_cpu || 0;
                const usedRam = usage.used_ram || 0;
                
                const canAllocate = (usedCores + requestedCpu <= availableCores) && 
                                   (usedRam + requestedRam <= availableRam);

                resolve({
                    canAllocate,
                    totalCores,
                    availableCores,
                    usedCores,
                    totalRam,
                    availableRam,
                    usedRam,
                    message: canAllocate ? 'Ресурсы доступны' : `Требуется ${requestedCpu} ядер и ${requestedRam} ГБ, доступно ${availableCores - usedCores} ядер и ${(availableRam - usedRam).toFixed(1)} ГБ`
                });
            });
        });
    });
}