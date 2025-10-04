# Server Management System Project

Веб-приложение для управления серверами, АРМ и виртуальными машинами с базой данных SQLite и Material Design интерфейсом.

## Возможности
- Управление серверами, АРМ и виртуальными машинами
- Проверка доступности через ping
- Импорт/экспорт данных
- Material Design интерфейс
- Автокомплит для повторяющихся данных

## Технологии
- Backend: Node.js + Express
- Database: SQLite
- Frontend: HTML5, CSS3, JavaScript (ES6+)
- Design: Material Design

## Прогресс
- [x] Создание структуры проекта
- [x] Настройка базы данных
- [x] Создание backend API
- [x] Создание frontend интерфейса
- [x] Тестирование функционала

## Структура проекта
- server.js - основной сервер Express
- routes/ - API маршруты для серверов, АРМ, ВМ и настроек
- public/ - фронтенд (HTML, CSS, JS)
- scripts/ - утилиты инициализации БД
- database.db - SQLite база данных

## Команды запуска
- npm install - установка зависимостей
- npm run init-db - инициализация базы данных
- npm start - запуск в продакшн режиме
- npm run dev - запуск в режиме разработки