# Инструкция по загрузке Svarog на GitHub

## Шаги для создания приватного репозитория и загрузки кода:

### 1. Создание репозитория на GitHub
1. Зайдите на https://github.com
2. Нажмите "New repository" (зеленая кнопка)
3. Укажите название: `svarog-server-management`
4. Описание: `Svarog - система управления серверами, АРМ и виртуальными машинами`
5. Выберите **Private** (приватный репозиторий)
6. НЕ добавляйте README, .gitignore или лицензию (они уже есть в проекте)
7. Нажмите "Create repository"

### 2. Подключение локального репозитория к GitHub
Выполните команды в терминале (в папке проекта):

```bash
# Добавляем remote origin (замените YOUR_USERNAME на ваш GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/svarog-server-management.git

# Загружаем код на GitHub
git push -u origin master
```

### 3. Обновление install.py
После создания репозитория обновите файл `install.py`:
- Строка 22: замените `YOUR_USERNAME/svarog-server-management` на реальный путь к репозиторию

### 4. Создание release (опционально)
1. На странице репозитория нажмите "Releases"
2. Нажмите "Create a new release"
3. Tag version: `v1.0.3`
4. Release title: `Svarog v1.0.3 - Initial Release`
5. Описание:
   ```
   🎉 Первый релиз системы управления серверами Svarog!
   
   Возможности:
   - Управление серверами, АРМ и виртуальными машинами
   - Мониторинг доступности через ping
   - Статистика компонентов
   - Импорт/экспорт данных
   - Material Design интерфейс
   - Автоматический установщик для Linux
   ```
6. Нажмите "Publish release"

## Команды для быстрой загрузки:

```bash
# Если репозиторий уже создан на GitHub
cd c:\vscodeproj\serverstat_co
git remote add origin https://github.com/YOUR_USERNAME/svarog-server-management.git
git push -u origin master
```

## Проверка установщика:

После загрузки кода, установщик можно будет запустить командой:
```bash
curl -sSL https://raw.githubusercontent.com/YOUR_USERNAME/svarog-server-management/main/install.py | python3
```

## Структура репозитория:
```
svarog-server-management/
├── README.md              # Документация проекта
├── CHANGELOG.md           # История изменений
├── install.py             # Автоматический установщик
├── package.json           # Зависимости Node.js
├── .gitignore            # Исключения для git
├── server.js             # Основной сервер
├── routes/               # API маршруты
├── public/               # Frontend файлы
└── scripts/              # Утилиты
```

Репозиторий готов к использованию! 🚀