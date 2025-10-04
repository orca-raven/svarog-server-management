# 🚀 Инструкция по загрузке Svarog на GitHub

## Код готов к загрузке! Следуйте инструкциям ниже:

### Шаг 1: Создание репозитория на GitHub

1. **Откройте https://github.com** в браузере
2. **Войдите в свой аккаунт** (orca-raven)
3. **Нажмите зеленую кнопку "New"** или перейдите на https://github.com/new
4. **Заполните форму:**
   - Repository name: `svarog-server-management`
   - Description: `🔧 Svarog - система управления серверами, АРМ и виртуальными машинами`
   - Выберите **Private** (приватный репозиторий)
   - **НЕ** ставьте галочки на "Add a README file", "Add .gitignore", "Choose a license"
5. **Нажмите "Create repository"**

### Шаг 2: Загрузка кода (выполните в PowerShell)

```powershell
# Перейдите в папку проекта
cd c:\vscodeproj\serverstat_co

# URL уже настроен правильно, просто загружаем код
git push -u origin master
```

### Шаг 3: Проверка загрузки

После выполнения команд:
1. Откройте https://github.com/orca-raven/svarog-server-management
2. Убедитесь, что все файлы загружены
3. Проверьте, что README.md отображается корректно

## 📋 Список файлов в репозитории:

✅ **Основные файлы:**
- `README.md` - Документация проекта
- `CHANGELOG.md` - История изменений  
- `package.json` - Зависимости Node.js
- `server.js` - Основной сервер
- `install.py` - **Автоматический установщик для Linux**

✅ **API маршруты (routes/):**
- `servers.js` - API для серверов
- `arms.js` - API для АРМ  
- `vms.js` - API для виртуальных машин
- `settings.js` - API настроек и статистики

✅ **Frontend (public/):**
- `index.html` - Главная страница
- `settings.html` - Страница настроек
- `styles.css` - Material Design стили
- `script.js` - Основная логика
- `settings.js` - Логика настроек

✅ **Утилиты:**
- `scripts/init-db.js` - Инициализация базы данных
- `.gitignore` - Исключения для git

## 🤖 Автоматическая установка

После загрузки на GitHub, система может быть установлена на любом Linux сервере командой:

```bash
curl -sSL https://raw.githubusercontent.com/orca-raven/svarog-server-management/main/install.py | python3
```

### Что делает установщик:
- ✅ Проверяет операционную систему
- ✅ Находит свободный порт (3000-9999)
- ✅ Устанавливает Node.js и npm (если нужно)
- ✅ Скачивает код с GitHub
- ✅ Устанавливает зависимости
- ✅ Инициализирует базу данных
- ✅ Создает systemd службу `svarog-server`
- ✅ Настраивает автозапуск
- ✅ Запускает и тестирует сервер
- ✅ Выводит IP адрес и порт для доступа

## 🎯 Управление службой на Linux:

```bash
# Запуск службы
sudo systemctl start svarog-server

# Остановка службы  
sudo systemctl stop svarog-server

# Перезапуск службы
sudo systemctl restart svarog-server

# Статус службы
sudo systemctl status svarog-server

# Просмотр логов
sudo journalctl -u svarog-server -f
```

## ✨ Готово!

После создания репозитория и загрузки кода:
- ✅ Проект будет доступен в приватном репозитории
- ✅ Автоматический установщик будет работать 
- ✅ Система готова к развертыванию на серверах
- ✅ Версия 1.0.3 с полным функционалом

---

**Кодовое имя**: Svarog  
**Текущая версия**: 1.0.3  
**Статус**: Готов к продакшн использованию 🚀