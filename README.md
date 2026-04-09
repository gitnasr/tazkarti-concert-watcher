# Tazkarti Watcher

TypeScript Node.js server watcher for the Tazkarti events feed.

Use Node.js 20 or newer.

## Install

```bash
npm install
```

## Configuration

Create a `.env` file in the project root:

```dotenv
TARGET_NAME=amr diab
NTFY_TOPIC=https://ntfy.sh/your-topic
POLL_INTERVAL_SECONDS=30
NTFY_TOKEN=
```

Required:

- `TARGET_NAME`
- `NTFY_TOPIC`

Optional:

- `POLL_INTERVAL_SECONDS` defaults to `30`
- `NTFY_TOKEN`

## Run Locally

```bash
npm run watch
```

The watcher now runs non-interactively and is suitable for server deployment.

Release alerts and critical fault state are tracked locally in `data/.local/watcher-state.json`, which is created on first run and ignored from version control so duplicate release notifications are still suppressed across restarts.

## Run Under PM2

Create or update your `.env`, then start:

```bash
pm2 start ecosystem.config.cjs
```

Common commands:

```bash
pm2 logs tazkarti-watcher
pm2 restart tazkarti-watcher
pm2 stop tazkarti-watcher
pm2 save
```

## Typecheck

```bash
npm run check
```
