# Projekt Giełda Marek

## Uruchomienie w Docker Compose

### First Run

1. Skopiuj plik `.env.example` do `.env`.
2. Uzupełnij `APP_SECRET_KEY` oraz klucze API, jeśli chcesz używać integracji Finnhub, Twelve Data lub Alpha Vantage.
3. Upewnij się, że `DATABASE_URL` wskazuje na działającą bazę PostgreSQL.
4. Uruchom cały stack:

```bash
docker compose up --build
```

5. Otwórz aplikację:

`http://localhost:3000`

## Co startuje razem

- `app` - główna aplikacja Next.js
- `postgres` - baza PostgreSQL dla środowiska kontenerowego
- `postgres-setup` - jednorazowy bootstrap migracji i weryfikacji bazy

## Dane lokalne

- PostgreSQL jest domyślną bazą runtime aplikacji
- SQLite może nadal działać lokalnie pod ścieżką `/app/data/stock_analyst.db`, jeśli ręcznie ustawisz `DATABASE_PROVIDER=sqlite`
- Dane są trzymane w volume `app_data`
- PostgreSQL ma własny volume `postgres_data`
- `app_data` zostaje na potrzeby zgodności i ewentualnego importu ze starego SQLite.
- `postgres-setup` odpala się automatycznie przy `docker compose up` i blokuje start `app`, dopóki migracje się nie powiedzą sukcesem.

## Zmienne środowiskowe

Minimalny zestaw dla startu:

```env
APP_SECRET_KEY=change-me-to-a-long-random-secret
DATABASE_PROVIDER=postgres
FINNHUB_API_KEY=
TWELVEDATA_API_KEY=
ALPHA_VANTAGE_API_KEY=
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
SQLITE_DB_PATH=/app/data/stock_analyst.db
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/app_db
```

## Setup PostgreSQL

Najprostsza komenda startowa:

```bash
npm run setup:postgres
```

Opcjonalny import danych ze SQLite:

```bash
npm run setup:postgres -- --with-import
```

Możesz też użyć zmiennej:

```env
SETUP_POSTGRES_IMPORT=1
```

Skrypt `setup:postgres`:
- odpala migracje,
- uruchamia `db:check`,
- opcjonalnie odpala import SQLite -> PostgreSQL,
- po imporcie robi ponowny check stanu bazy.

## Migracje PostgreSQL

Po ustawieniu `DATABASE_URL` uruchom:

```bash
npm run migrate:postgres
```

Skrypt:
- tworzy tabelę `schema_migrations`, jeśli jeszcze nie istnieje,
- wykonuje pliki `*.sql` z katalogu `migrations/postgres` w kolejności alfabetycznej,
- zapisuje wykonane migracje, więc kolejne uruchomienie odpali tylko brakujące pliki.

## Diagnostyka PostgreSQL

Szybki check połączenia i stanu migracji:

```bash
npm run db:check
```

Skrypt pokazuje:
- czy połączenie z PostgreSQL działa,
- ile migracji zostało wykrytych, wykonanych i ile jeszcze czeka,
- podstawowe liczniki rekordów w najważniejszych tabelach.

## Smoke Test PostgreSQL

Po uruchomieniu aplikacji możesz sprawdzić podstawowy flow:

```bash
npm run smoke-test:postgres
```

Skrypt testuje:
- `/api/health`
- logowanie przez `/api/auth/login`
- sesję przez `/api/auth/me`
- kilka chronionych endpointów opartych o PostgreSQL, m.in. `settings`, `portfolio`, `reports`, `performance`, `sectors`

Opcjonalne zmienne:

```env
SMOKE_BASE_URL=http://127.0.0.1:3000
SMOKE_USERNAME=pytomek@o2.pl
SMOKE_PASSWORD=admin123
```

## Import danych SQLite -> PostgreSQL

Jeśli masz już dane w SQLite i chcesz je przenieść do PostgreSQL, uruchom:

```bash
npm run setup:postgres -- --with-import
```

Ten tryb:
- uruchamia migracje,
- sprawdza bazę,
- importuje dane z `SQLITE_DB_PATH`,
- wykonuje ponowny check po imporcie.

## Uwaga

- Aplikacja jest teraz przygotowana tak, by domyślnie działać na `PostgreSQL`.
- `SQLite` zostaje jako opcjonalny fallback lokalny oraz źródło do jednorazowego importu danych.
- Jeśli chcesz wyczyścić dane lokalne, usuń volume `app_data`.

## Troubleshooting Docker Compose

Jeśli `docker compose up --build` nie startuje poprawnie:

1. Sprawdź, czy Docker Desktop jest uruchomiony.
2. Upewnij się, że nie ma konfliktu na portach `3000` lub `5432`.
3. Sprawdź logi:

```bash
docker compose logs -f postgres
docker compose logs -f postgres-setup
docker compose logs -f app
```

4. Jeśli `postgres-setup` się wywalił, uruchom:

```bash
npm run db:check
```

5. Jeśli importujesz stare dane, upewnij się, że `SQLITE_DB_PATH` wskazuje na faktyczny plik SQLite.
