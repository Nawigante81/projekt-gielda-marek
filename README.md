# MWPanel / MWPanelPro

## Uruchomienie w Docker Compose

### First Run

1. Skopiuj plik `.env.example` do `.env`.
2. Uzupełnij `APP_SECRET_KEY` oraz klucze API, jeśli chcesz używać integracji Finnhub, Twelve Data lub Alpha Vantage.
3. Jeśli chcesz uruchamiać aplikację na PostgreSQL, ustaw `DATABASE_PROVIDER=postgres` i upewnij się, że `DATABASE_URL` wskazuje na działającą bazę.
4. Uruchom:

```bash
docker compose up --build
```

5. Otwórz:

```text
http://localhost:3000
```

## Co startuje razem

- `app` - główna aplikacja Next.js
- `postgres` - baza PostgreSQL dla środowiska kontenerowego

## Dane lokalne

- SQLite działa w kontenerze pod ścieżką `/app/data/stock_analyst.db`
- Dane są trzymane w volume `app_data`
- PostgreSQL ma własny volume `postgres_data`
- Przełączenie na PostgreSQL będzie wymagało dalszego przepięcia adapterów danych, więc domyślnie pozostaje `sqlite`.

## Zmienne środowiskowe

Minimalny zestaw dla startu:

```env
APP_SECRET_KEY=change-me-to-a-long-random-secret
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

## Uwaga

- Aplikacja korzysta dziś z SQLite jako głównej lokalnej bazy w runtime.
- PostgreSQL jest uruchamiany równolegle jako część stacku i jest gotowy pod dalsze rozszerzenia lub migrację.
- Jeśli chcesz wyczyścić dane lokalne, usuń volume `app_data`.
