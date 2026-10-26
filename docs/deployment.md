# Публичное развёртывание SpaceBook (дни 8–9)

## Состояние

Репозиторий содержит **production-конфигурацию**, но **фактическая публичная ссылка появится только после запуска на сервере**. GitHub сам по себе не размещает PostgreSQL и FastAPI. Данный вариант рассчитан на Linux VPS и домен. Не указывайте ссылку как работающую, пока не проверили её через браузер.

## Предварительные условия

- VPS с Linux, Docker Engine и Compose v2, доступом к Интернету (для маленького тестового проекта достаточно ориентировочно 2 ГБ RAM; требования зависят от нагрузки).
- Публичный IPv4/IPv6 и доменное имя, доступ к изменению DNS.
- DNS A (или AAAA) запись вашего домена указывает на VPS; извне доступны TCP 80/443 (и UDP 443 по возможности).
- Репозиторий склонирован: `git clone https://github.com/ArseniyLebedev1/coworking-booking.git`.

## Настройка

```bash
cd coworking-booking
cp .env.production.example .env.production
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

В `.env.production` укажите свой `SITE_DOMAIN`, уникальные `POSTGRES_PASSWORD` и `JWT_SECRET_KEY`. Секреты не публикуйте. Пароль БД не должен содержать неэкранированные спецсимволы в строке подключения (для удобства используйте длинное случайное значение из букв и цифр).

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production config --quiet
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production ps
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail=80 backend web
```

Caddy выдаёт TLS-сертификат автоматически **если DNS и порты настроены**, раздаёт React из `/`, проксирует API из `/api/*` и фотографии из `/uploads/*`. PostgreSQL и API-порт 8000 не публикуются наружу. Создание таблиц выполняет Alembic. `SITE_DOMAIN` указывается **без** `https://`, например `book.example.org`.

После запуска: `https://ВАШ_ДОМЕН/`, `https://ВАШ_ДОМЕН/api/health`, `https://ВАШ_ДОМЕН/api/docs`.

## Проверка публичного стенда

1. Откройте каталог и убедитесь, что выводятся три seed-помещения.
2. Проверьте поиск по слову «Атлас», фильтры, пагинацию.
3. Зарегистрируйте нового пользователя; войдите и создайте бронь на будущую дату.
4. Попробуйте повторить ту же бронь — ожидается конфликт 409.
5. Отмените бронь в кабинете. Проверьте работу RBAC: обычному пользователю недоступна админ-панель.
6. Проверьте сертификат HTTPS и отсутствие ошибок в браузерной консоли.
7. Для администратора проверьте загрузку JPEG/PNG/WebP и статистику.

## Сохранность данных

- `postgres_data` — таблицы, пользователи и бронирования.
- `uploads_data` — загруженные фотографии.
- `caddy_data` — сертификаты HTTPS.

Остановка без удаления данных: `docker compose -f docker-compose.prod.yml --env-file .env.production down`.

**Не используйте `down -v` в production.** Перед обновлением приложения делайте резервные копии базы и фотографий. Например:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec -T db \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > coworking-backup.dump
```

Храните копию отдельно от VPS. Восстановление отработайте на тестовой базе до защиты проекта.

## Обновление

```bash
git pull --ff-only
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

## Ограничения

Это production-ready **конфигурация для учебного MVP**, а не подтверждённый промышленный аудит. Требуются эксплуатационные решения для мониторинга, rate limiting, системного бэкапа, восстановления и управления доступом к серверу. Авторизация использует короткоживущие JWT в sessionStorage, а не защищённые HttpOnly cookies. Публичная ссылка зависит от приобретённого/предоставленного VPS и домена — их нельзя автоматически создать GitHub-коммитом.
