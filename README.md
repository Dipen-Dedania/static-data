# static-data

A **static JSON data repository** hosted on GitHub and served as an API via [RapidAPI](https://rapidapi.com/dipen27891/api/india-information). The repo acts as the content store — RapidAPI sits in front of it as a proxy, adding custom response headers via its **Response Transformations** feature.

---

## 🔗 Live API

> **RapidAPI Endpoint:** https://rapidapi.com/dipen27891/api/india-information
>
> **Raw Content Base URL:** `https://raw.githubusercontent.com/dipen27891/static-data/main`

---

## 🏗️ How It Works

```
Client Request
     │
     ▼
┌─────────────┐      proxies to      ┌──────────────────────────────────────────────┐
│   RapidAPI  │ ──────────────────▶  │  GitHub Raw Content (this repo)              │
│  (Gateway)  │                      │  raw.githubusercontent.com/dipen27891/...    │
└─────────────┘                      └──────────────────────────────────────────────┘
     │
     │  Response Transformations
     │  (adds custom headers, e.g. CORS, rate-limit, auth)
     ▼
Client Response
```

1. **Static JSON files** live in the `api/` folder, organised by category (e.g. `api/india/`).
2. **RapidAPI** proxies every `GET` request to the matching GitHub raw URL.
3. **Response Transformations** in RapidAPI inject extra headers (e.g. `Access-Control-Allow-Origin`, `X-RapidAPI-*`) that GitHub's raw CDN does not add by default.
4. **OpenAPI specs** are auto-generated from the real data so RapidAPI always has an up-to-date API definition.

---

## 📂 Repository Structure

```
static-data/
├── api/
│   └── india/
│       ├── india-capital-city.json     # Capital cities of Indian states & UTs
│       ├── india-city.json             # Comprehensive list of Indian cities
│       ├── india-mountains.json        # Major mountain peaks in India
│       ├── india-popular-city.json     # Popular cities with airport codes
│       ├── india-rivers.json           # Major rivers and their origins
│       └── openapi.json               # ⚙️ Auto-generated OpenAPI spec (per folder)
│
├── openapi.json                        # ⚙️ Auto-generated combined OpenAPI spec
├── generate-openapi.js                 # 🛠️ Script to regenerate OpenAPI specs
├── country.json                        # Country-level reference data
├── make-my-trip-package.json           # Travel package data
└── README.md
```

---

## 📋 Available Endpoints

### India (`/api/india/`)

| Endpoint | Description |
|---|---|
| `GET /api/india/india-capital-city.json` | Capital city of each Indian state & union territory |
| `GET /api/india/india-city.json` | Full list of cities with state & district |
| `GET /api/india/india-mountains.json` | Mountain peaks with range & height |
| `GET /api/india/india-popular-city.json` | Popular cities with airport codes |
| `GET /api/india/india-rivers.json` | Major rivers with their origin locations |

---

## ⚙️ OpenAPI Spec Generation

OpenAPI 3.0 specs are auto-generated from the real JSON data — schemas and examples are inferred directly from file contents.

### Run the generator

```bash
node generate-openapi.js
```

### Options

```bash
node generate-openapi.js \
  --base-url https://raw.githubusercontent.com/dipen27891/static-data/main \
  --api-dir  ./api
```

### What it generates

| Output | Description |
|---|---|
| `api/<folder>/openapi.json` | Per-folder spec (import for a single-category API on RapidAPI) |
| `openapi.json` | Combined spec with all folders & endpoints |

> **Re-run this script whenever you add or modify JSON files** so the specs stay in sync.

---

## 🚀 Deploying to RapidAPI

1. Push your changes to `main` (GitHub serves raw files automatically).
2. Go to your [RapidAPI Provider Dashboard](https://rapidapi.com/developer/dashboard).
3. Select your API → **"Edit API"** → **"Import OpenAPI Spec"** → upload `openapi.json`.
4. Set the **Base URL** to:
   ```
   https://raw.githubusercontent.com/dipen27891/static-data/main
   ```
5. Under **"Response Transformations"**, add the headers you need, e.g.:
   ```
   Access-Control-Allow-Origin: *
   Cache-Control: public, max-age=3600
   ```

---

## ➕ Adding New Data

1. Create a new folder under `api/` (e.g. `api/world/`).
2. Add your `.json` files inside it.
3. Regenerate the specs:
   ```bash
   node generate-openapi.js
   ```
4. Commit & push — the new endpoints are live instantly via GitHub raw CDN.
5. Re-import `openapi.json` in RapidAPI to register the new endpoints.

---

## 📄 License

MIT