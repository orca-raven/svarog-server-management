# 🚨 Временное решение для установки на macOS

## Проблема
Репозиторий приватный → GitHub возвращает HTML с 404 → Python не может парсить HTML как код

## Решение 1: Ручная установка (РАБОТАЕТ СЕЙЧАС)

```bash
# 1. Скачать архив репозитория вручную
curl -L -o svarog.zip "https://github.com/orca-raven/svarog-server-management/archive/refs/heads/master.zip"

# 2. Распаковать
unzip svarog.zip
cd svarog-server-management-master

# 3. Запустить установщик
python3 install.py
```

## Решение 2: Через Git Clone

```bash
# Клонировать репозиторий (потребует авторизации)
git clone https://github.com/orca-raven/svarog-server-management.git
cd svarog-server-management

# Запустить установщик
python3 install.py
```

## Решение 3: Создать публичный Gist

Создадим публичный gist только с install.py:

1. Откройте https://gist.github.com/
2. Вставьте содержимое install.py
3. Сделайте gist публичным
4. Используйте ссылку вида:

```bash
curl -sSL https://gist.githubusercontent.com/USERNAME/GIST_ID/raw/install.py | python3
```

## Решение 4: Сделать репозиторий публичным (РЕКОМЕНДУЕТСЯ)

Следуйте инструкциям в `MAKE_PUBLIC_INSTRUCTIONS.md`

---

**Для немедленного тестирования используйте Решение 1** ☝️