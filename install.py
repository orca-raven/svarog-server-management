#!/usr/bin/env python3
"""
Svarog Server Management System - Автоматический установщик
Автоматическая установка и настройка системы управления серверами
"""

import os
import sys
import subprocess
import platform
import json
import socket
import urllib.request
import zipfile
import shutil
import time
from pathlib import Path

class SvarogInstaller:
    def __init__(self):
        self.system = platform.system().lower()
        self.install_dir = "/opt/svarog" if self.system == "linux" else "C:\\Program Files\\Svarog"
        self.service_name = "svarog-server"
        self.port = None
        self.github_repo = "orca-raven/svarog-server-management"
        self.branch = "main"
        
    def log(self, message, level="INFO"):
        """Логирование с временной меткой"""
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] [{level}] {message}")
        
    def check_system(self):
        """Проверка операционной системы"""
        self.log(f"Обнаружена операционная система: {platform.platform()}")
        
        if self.system not in ["linux", "windows"]:
            self.log("Неподдерживаемая операционная система", "ERROR")
            sys.exit(1)
            
        return True
        
    def find_free_port(self, start_port=3000, end_port=9999):
        """Поиск свободного порта"""
        self.log(f"Поиск свободного порта в диапазоне {start_port}-{end_port}")
        
        for port in range(start_port, end_port + 1):
            try:
                with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
                    sock.bind(('', port))
                    self.port = port
                    self.log(f"Найден свободный порт: {port}")
                    return port
            except OSError:
                continue
                
        self.log("Не найден свободный порт", "ERROR")
        sys.exit(1)
        
    def check_dependencies(self):
        """Проверка и установка зависимостей"""
        self.log("Проверка зависимостей...")
        
        # Проверка Node.js
        try:
            result = subprocess.run(['node', '--version'], 
                                  capture_output=True, text=True, check=True)
            node_version = result.stdout.strip()
            self.log(f"Node.js найден: {node_version}")
            
            # Проверка минимальной версии (14.0+)
            version_num = int(node_version.split('.')[0].replace('v', ''))
            if version_num < 14:
                self.log("Требуется Node.js версии 14.0 или выше", "ERROR")
                return False
                
        except (subprocess.CalledProcessError, FileNotFoundError):
            self.log("Node.js не найден, устанавливаем...")
            if not self.install_nodejs():
                return False
                
        # Проверка npm
        try:
            result = subprocess.run(['npm', '--version'], 
                                  capture_output=True, text=True, check=True)
            npm_version = result.stdout.strip()
            self.log(f"npm найден: {npm_version}")
        except (subprocess.CalledProcessError, FileNotFoundError):
            self.log("npm не найден", "ERROR")
            return False
            
        return True
        
    def install_nodejs(self):
        """Установка Node.js"""
        if self.system == "linux":
            try:
                # Для Ubuntu/Debian
                if shutil.which('apt-get'):
                    self.log("Установка Node.js через apt...")
                    subprocess.run(['sudo', 'apt-get', 'update'], check=True)
                    subprocess.run(['sudo', 'apt-get', 'install', '-y', 'nodejs', 'npm'], check=True)
                    
                # Для CentOS/RHEL/Fedora
                elif shutil.which('yum'):
                    self.log("Установка Node.js через yum...")
                    subprocess.run(['sudo', 'yum', 'install', '-y', 'nodejs', 'npm'], check=True)
                    
                elif shutil.which('dnf'):
                    self.log("Установка Node.js через dnf...")
                    subprocess.run(['sudo', 'dnf', 'install', '-y', 'nodejs', 'npm'], check=True)
                    
                else:
                    self.log("Неподдерживаемый пакетный менеджер", "ERROR")
                    return False
                    
                return True
                
            except subprocess.CalledProcessError as e:
                self.log(f"Ошибка установки Node.js: {e}", "ERROR")
                return False
                
        elif self.system == "windows":
            self.log("Для Windows пожалуйста установите Node.js вручную с https://nodejs.org/", "ERROR")
            return False
            
    def download_source(self):
        """Скачивание исходного кода с GitHub"""
        self.log("Скачивание исходного кода...")
        
        # URL для скачивания архива
        download_url = f"https://github.com/{self.github_repo}/archive/refs/heads/{self.branch}.zip"
        temp_dir = "/tmp/svarog_install" if self.system == "linux" else "C:\\temp\\svarog_install"
        
        try:
            # Создаем временную директорию
            os.makedirs(temp_dir, exist_ok=True)
            
            # Скачиваем архив
            zip_path = os.path.join(temp_dir, "svarog.zip")
            self.log(f"Скачивание с {download_url}")
            
            urllib.request.urlretrieve(download_url, zip_path)
            self.log("Архив скачан успешно")
            
            # Распаковываем
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(temp_dir)
                
            # Находим распакованную директорию
            extracted_dirs = [d for d in os.listdir(temp_dir) 
                            if os.path.isdir(os.path.join(temp_dir, d)) and d != "__pycache__"]
            
            if not extracted_dirs:
                self.log("Не найдена распакованная директория", "ERROR")
                return False
                
            source_dir = os.path.join(temp_dir, extracted_dirs[0])
            
            # Создаем целевую директорию
            if self.system == "linux":
                subprocess.run(['sudo', 'mkdir', '-p', self.install_dir], check=True)
                subprocess.run(['sudo', 'cp', '-r', f"{source_dir}/.", self.install_dir], check=True)
                subprocess.run(['sudo', 'chown', '-R', f"{os.getenv('USER')}:{os.getenv('USER')}", 
                              self.install_dir], check=True)
            else:
                os.makedirs(self.install_dir, exist_ok=True)
                shutil.copytree(source_dir, self.install_dir, dirs_exist_ok=True)
                
            self.log(f"Исходный код скопирован в {self.install_dir}")
            
            # Очистка временных файлов
            shutil.rmtree(temp_dir)
            
            return True
            
        except Exception as e:
            self.log(f"Ошибка скачивания: {e}", "ERROR")
            return False
            
    def install_npm_dependencies(self):
        """Установка npm зависимостей"""
        self.log("Установка npm зависимостей...")
        
        try:
            os.chdir(self.install_dir)
            subprocess.run(['npm', 'install'], check=True)
            self.log("Зависимости установлены успешно")
            return True
            
        except subprocess.CalledProcessError as e:
            self.log(f"Ошибка установки зависимостей: {e}", "ERROR")
            return False
            
    def initialize_database(self):
        """Инициализация базы данных"""
        self.log("Инициализация базы данных...")
        
        try:
            os.chdir(self.install_dir)
            subprocess.run(['npm', 'run', 'init-db'], check=True)
            self.log("База данных инициализирована")
            return True
            
        except subprocess.CalledProcessError as e:
            self.log(f"Ошибка инициализации БД: {e}", "ERROR")
            return False
            
    def configure_port(self):
        """Настройка порта в конфигурации"""
        self.log(f"Настройка порта {self.port}")
        
        server_js_path = os.path.join(self.install_dir, "server.js")
        
        try:
            # Читаем файл
            with open(server_js_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # Заменяем порт
            content = content.replace('const PORT = process.env.PORT || 3000;', 
                                    f'const PORT = process.env.PORT || {self.port};')
            
            # Записываем обратно
            with open(server_js_path, 'w', encoding='utf-8') as f:
                f.write(content)
                
            self.log(f"Порт {self.port} настроен в server.js")
            return True
            
        except Exception as e:
            self.log(f"Ошибка настройки порта: {e}", "ERROR")
            return False
            
    def create_systemd_service(self):
        """Создание systemd службы для Linux"""
        if self.system != "linux":
            return True
            
        self.log("Создание systemd службы...")
        
        service_content = f"""[Unit]
Description=Svarog Server Management System
Documentation=https://github.com/orca-raven/svarog-server-management
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory={self.install_dir}
Environment=NODE_ENV=production
Environment=PORT={self.port}
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier={self.service_name}

# Безопасность
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ReadWritePaths={self.install_dir}

[Install]
WantedBy=multi-user.target
"""
        
        service_path = f"/etc/systemd/system/{self.service_name}.service"
        
        try:
            with open('/tmp/svarog.service', 'w') as f:
                f.write(service_content)
                
            subprocess.run(['sudo', 'mv', '/tmp/svarog.service', service_path], check=True)
            subprocess.run(['sudo', 'systemctl', 'daemon-reload'], check=True)
            subprocess.run(['sudo', 'systemctl', 'enable', self.service_name], check=True)
            
            self.log(f"Служба {self.service_name} создана и включена")
            return True
            
        except subprocess.CalledProcessError as e:
            self.log(f"Ошибка создания службы: {e}", "ERROR")
            return False
            
    def start_service(self):
        """Запуск службы"""
        self.log("Запуск службы...")
        
        try:
            if self.system == "linux":
                subprocess.run(['sudo', 'systemctl', 'start', self.service_name], check=True)
                
                # Проверяем статус
                time.sleep(3)
                result = subprocess.run(['sudo', 'systemctl', 'is-active', self.service_name], 
                                      capture_output=True, text=True)
                
                if result.stdout.strip() == "active":
                    self.log("Служба запущена успешно")
                    return True
                else:
                    self.log("Служба не запустилась", "ERROR")
                    self.show_service_logs()
                    return False
                    
            else:
                # Для Windows - запуск напрямую
                self.log("Запуск сервера...")
                os.chdir(self.install_dir)
                subprocess.Popen(['node', 'server.js'])
                time.sleep(3)
                return True
                
        except subprocess.CalledProcessError as e:
            self.log(f"Ошибка запуска службы: {e}", "ERROR")
            return False
            
    def show_service_logs(self):
        """Показать логи службы при ошибке"""
        if self.system == "linux":
            try:
                self.log("Последние логи службы:")
                result = subprocess.run(['sudo', 'journalctl', '-u', self.service_name, '-n', '20'], 
                                      capture_output=True, text=True)
                print(result.stdout)
            except:
                pass
                
    def test_installation(self):
        """Тестирование установки"""
        self.log("Тестирование установки...")
        
        try:
            time.sleep(5)  # Даем время службе запуститься
            
            # Проверяем доступность порта
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
                sock.settimeout(5)
                result = sock.connect_ex(('localhost', self.port))
                
                if result == 0:
                    self.log("Сервер отвечает на запросы")
                    return True
                else:
                    self.log("Сервер не отвечает", "ERROR")
                    return False
                    
        except Exception as e:
            self.log(f"Ошибка тестирования: {e}", "ERROR")
            return False
            
    def get_server_ip(self):
        """Получение IP адреса сервера"""
        try:
            # Пытаемся получить внешний IP
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
                sock.connect(("8.8.8.8", 80))
                local_ip = sock.getsockname()[0]
                
            return local_ip
        except:
            return "localhost"
            
    def install(self):
        """Основной процесс установки"""
        self.log("=== Начало установки Svarog Server Management System ===")
        
        # 1. Проверка системы
        if not self.check_system():
            return False
            
        # 2. Поиск свободного порта
        if not self.find_free_port():
            return False
            
        # 3. Проверка зависимостей
        if not self.check_dependencies():
            return False
            
        # 4. Скачивание исходного кода
        if not self.download_source():
            return False
            
        # 5. Установка npm зависимостей
        if not self.install_npm_dependencies():
            return False
            
        # 6. Инициализация базы данных
        if not self.initialize_database():
            return False
            
        # 7. Настройка порта
        if not self.configure_port():
            return False
            
        # 8. Создание службы (только для Linux)
        if not self.create_systemd_service():
            return False
            
        # 9. Запуск службы
        if not self.start_service():
            return False
            
        # 10. Тестирование
        if not self.test_installation():
            return False
            
        # 11. Успешное завершение
        server_ip = self.get_server_ip()
        
        self.log("=== УСТАНОВКА ЗАВЕРШЕНА УСПЕШНО ===", "SUCCESS")
        self.log("", "SUCCESS")
        self.log("🎉 Svarog Server Management System установлен и запущен!", "SUCCESS")
        self.log("", "SUCCESS")
        self.log(f"📍 Сервер доступен по адресу: http://{server_ip}:{self.port}", "SUCCESS")
        self.log(f"📂 Директория установки: {self.install_dir}", "SUCCESS")
        
        if self.system == "linux":
            self.log(f"⚙️  Управление службой:", "SUCCESS")
            self.log(f"   sudo systemctl start {self.service_name}", "SUCCESS")
            self.log(f"   sudo systemctl stop {self.service_name}", "SUCCESS")
            self.log(f"   sudo systemctl restart {self.service_name}", "SUCCESS")
            self.log(f"   sudo systemctl status {self.service_name}", "SUCCESS")
            self.log(f"📋 Логи службы: sudo journalctl -u {self.service_name} -f", "SUCCESS")
            
        self.log("", "SUCCESS")
        self.log("Система готова к использованию! 🚀", "SUCCESS")
        
        return True

def main():
    """Основная функция"""
    installer = SvarogInstaller()
    
    try:
        success = installer.install()
        sys.exit(0 if success else 1)
        
    except KeyboardInterrupt:
        installer.log("Установка прервана пользователем", "ERROR")
        sys.exit(1)
    except Exception as e:
        installer.log(f"Неожиданная ошибка: {e}", "ERROR")
        sys.exit(1)

if __name__ == "__main__":
    main()