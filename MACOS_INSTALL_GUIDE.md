# 🍎 Инструкция по установке Svarog на macOS

## Проблема с curl | python3
На некоторых версиях macOS команда `curl | python3` может вызывать ошибки парсинга.

## ✅ Решение 1: Загрузка файла и запуск (РЕКОМЕНДУЕТСЯ)

```bash
# Скачать установщик
curl -sSL -o install_svarog.py https://raw.githubusercontent.com/orca-raven/svarog-server-management/master/install.py

# Запустить установщик
python3 install_svarog.py

# Удалить временный файл
rm install_svarog.py
```

## ✅ Решение 2: Через wget (если установлен)

```bash
# Скачать и запустить
wget -O - https://raw.githubusercontent.com/orca-raven/svarog-server-management/master/install.py | python3
```

## ✅ Решение 3: Клонирование репозитория

```bash
# Клонировать репозиторий
git clone https://github.com/orca-raven/svarog-server-management.git
cd svarog-server-management

# Запустить установщик
python3 install.py

# Удалить папку после установки (опционально)
cd .. && rm -rf svarog-server-management
```

## ✅ Решение 4: Через Python напрямую

```bash
python3 -c "
import urllib.request
import subprocess
url = 'https://raw.githubusercontent.com/orca-raven/svarog-server-management/master/install.py'
code = urllib.request.urlopen(url).read().decode('utf-8')
exec(code)
"
```

## 🔧 Альтернативная команда curl

Если хотите использовать curl, попробуйте с дополнительными флагами:

```bash
# Вариант 1: Принудительно использовать HTTP/1.1
curl -sSL --http1.1 https://raw.githubusercontent.com/orca-raven/svarog-server-management/master/install.py | python3

# Вариант 2: С указанием User-Agent
curl -sSL -H "User-Agent: curl/7.64.1" https://raw.githubusercontent.com/orca-raven/svarog-server-management/master/install.py | python3

# Вариант 3: С принудительным TLS 1.2
curl -sSL --tlsv1.2 https://raw.githubusercontent.com/orca-raven/svarog-server-management/master/install.py | python3
```

## 📋 Что делает установщик:

- ✅ Определяет архитектуру macOS (Intel/Apple Silicon)
- ✅ Устанавливает Homebrew (если не установлен)
- ✅ Устанавливает Node.js через Homebrew
- ✅ Скачивает и настраивает Svarog Server
- ✅ Создает службу launchd для автозапуска
- ✅ Запускает сервер и проверяет работоспособность
- ✅ Выводит IP адрес и порт для подключения

## 🎯 После установки:

Управление службой на macOS:
```bash
# Запуск службы
sudo launchctl load /Library/LaunchDaemons/com.svarog.server.plist

# Остановка службы
sudo launchctl unload /Library/LaunchDaemons/com.svarog.server.plist

# Статус службы
sudo launchctl list | grep svarog
```

---

**Рекомендуется использовать Решение 1** для надежной установки! 🚀