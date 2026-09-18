<p align="center">
  <img src="frontend/public/app-logo.png" alt="Blackletter" width="72" />
</p>

<h1 align="center">Blackletter</h1>

<p align="center"><strong>Source-grounded case-law research and AI-assisted memorandum drafting.</strong></p>
<p align="center">Opinion search · Source retrieval · Streaming analysis · Case briefs</p>

Blackletter searches precedential opinions through CourtListener and uses a hosted large language model to draft a legal research memo from retrieved source text.

## What it does

- Searches CourtListener and displays case metadata, excerpts, and source links.
- Retrieves and validates opinion text for up to three leading results.
- Streams a source-grounded memorandum with numbered source references.
- Stops when no usable authority is available instead of drafting unsupported analysis.
- Generates a structured brief from a CourtListener opinion ID.

## Data source

[CourtListener](https://www.courtlistener.com/) is a free legal research platform maintained by the nonprofit [Free Law Project](https://free.law/). Its collections include millions of opinions from U.S. federal and state courts.

Blackletter uses CourtListener's precedential-opinion search and opinion-text records: case names, courts, filing dates, citations, excerpts, source links, and full opinion text when available. It does not access PACER or RECAP filings, sealed records, client files, oral-argument audio, or CourtListener's other collections. Coverage and text availability vary by jurisdiction.

## Research flow

```text
Question → CourtListener search → Source validation → LLM draft → Linked sources
```

The analysis stream sends source records as soon as search completes, before the backend prepares the draft.

## How it stays reliable

- Drafting requires usable CourtListener text that matches the selected case record.
- Input, source context, output, search size, and in-memory caches are bounded.
- The model is instructed to use only supplied sources and identify missing evidence.
- Public deployments fail closed when Redis-backed rate or budget controls are unavailable.
- Queries are not stored in the browser or written in full to application logs.

## Architecture

```text
Browser / React + Vite
          ↓ REST + SSE
        FastAPI
          ├── CourtListener API — opinion search and source text
          ├── Together AI / DeepSeek-V4-Flash-0731 — memo and case-brief drafting
          └── Upstash Redis — public-demo rate and budget controls
```

**Stack:** React, TypeScript, Vite, Material UI, FastAPI, Python 3.11, HTTPX, Together AI, DeepSeek-V4-Flash-0731, CourtListener, Upstash Redis, Vercel, and Railway-compatible hosting.

## API surface

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Service version and safety-control status |
| `GET` | `/api/search?q=...&limit=5` | CourtListener metadata and excerpt search without LLM use |
| `POST` | `/api/analysis` | Non-streaming source-grounded draft |
| `POST` | `/api/analysis/stream` | Server-Sent Events stream for the research memo |
| `GET` | `/api/summarize/{case_id}` | Structured brief for one numeric CourtListener opinion ID |
| `GET` | `/api/docs` | Interactive documentation in local debug mode only |

## Run locally

### Requirements

- Python 3.11
- Node.js 18 or newer
- CourtListener API key
- Together AI API key

### Backend

```bash
git clone https://github.com/jerthermit/blackletter-hermitedge.git
cd blackletter-hermitedge/backend

python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

The API runs at `http://localhost:8000`. Local interactive documentation is available at `http://localhost:8000/api/docs`.

### Frontend

In another terminal:

```bash
cd blackletter-hermitedge/frontend
npm ci
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`.

Local example configuration disables the Redis gate for development only. API keys remain server-side in `backend/.env`; the frontend environment contains only the public backend URL.

## Verification

```bash
cd backend
source .venv/bin/activate
pip install -r requirements-dev.txt
PYTHONDONTWRITEBYTECODE=1 python -m pytest -p no:cacheprovider

cd ../frontend
npm run typecheck
npm run build
```

## Deployment

- Deploy `frontend/` as a static Vite application using `npm run build` and the generated `dist/` directory.
- Set `VITE_API_BASE_URL` to the public backend origin.
- Deploy `backend/` with Python 3.11 and start it with `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
- Set `DEBUG=false` and `REQUIRE_SECURITY_GATE=true` on the public backend.
- Configure `TOGETHER_API_KEY`, `COURTLISTENER_API_KEY`, `UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN` in the hosting platform's secret store.
- Set `ALLOWED_ORIGINS` to the exact deployed frontend origin; wildcard origins are rejected.
- Keep every credential out of frontend variables, source control, build output, and deployment logs.

The API is public and unauthenticated. Redis limits demo usage and estimated spend; provider-side billing controls remain necessary.

## Limits

- Blackletter supports legal research; it does not provide legal advice.
- Search requests precedential opinions but does not enforce a federal-only or jurisdiction-specific filter.
- Numbered source markers identify retrieved records; they are not validated legal citations.
- Blackletter does not determine whether an opinion remains good law.
- Review the linked record and verify authority with an official or professional citator before use.

Built by [Emman at Hermit Edge](https://hermitedge.com).

## Copyright

Copyright © 2026 Emman Ermitaño. All rights reserved.
