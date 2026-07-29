# Web Storefront

Customer-facing e-commerce storefront built with Vite + React + Redux Toolkit.

## Tech Stack

- Vite 5
- React 18
- Redux Toolkit
- TailwindCSS
- TypeScript

## Development

```bash
npm install
npm run dev     # http://localhost:3000
```

## Build

```bash
npm run build   # Output: dist/
```

## Docker

```bash
docker compose up                          # Dev
docker compose -f docker-compose.prod.yml up  # Prod (nginx serving static)
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_PMI_API_URL` | PMI API base URL |
| `VITE_OMS_API_URL` | OMS API base URL |
| `VITE_WMS_API_URL` | WMS API for stock check |

## API Integration

- Fetches product catalog from PMI
- Creates orders via OMS (with OTP verification)
- Checks real-time stock via WMS `/public/stock`
