
# 5G RAN Dashboard (srsRAN & OpenAirInterface)

**Live App:** [https://af-25.vercel.app/](https://af-25.vercel.app/)  
**Stack:** Next.js (App Router) · TypeScript · Tailwind CSS · Recharts · Vercel

A lightweight, zero-install web dashboard for visualizing 5G gNodeB telemetry from **srsRAN** and **OpenAirInterface (OAI)** using a unified JSON schema. It supports realtime UE views, charts for DL/UL metrics, and a simple inference layer for quick triage (drop rate, low CQI, bitrate trends).

---

## ✨ Features

- **Dual compatibility:** unified JSON schema for srsRAN & OAI
- **Realtime UX:** auto-updating charts, rolling UE log
- **No-ops deploy:** Vercel serverless + HTTPS endpoint
- **Flexible ingest:** post snapshots from any extractor
- **Data controls:** switch between Mock/API, set endpoint, pause/flush
- **Local persistence:** history survives refresh
- **Per-UE focus:** select UE (RNTI) to filter charts

---

## 🧩 Data Schema

Example snapshot:

```json
{
  "timestamp": 1730000000000,
  "source": "srsRAN",
  "ues": [
    {
      "pci": 1,
      "rnti": 4601,
      "downlink": { "cqi": 15, "mcs": 28, "bitrate": 17000000 },
      "uplink":   { "pusch_sinr": 26.7, "rsrp": -21.2, "mcs": 28 }
    }
  ]
}
```

---

## 🔌 API

### Ingest snapshots
`POST /api/ingest`

```bash
curl -X POST https://af-25.vercel.app/api/ingest   -H "Content-Type: application/json"   -d '{
        "timestamp": 1730000000000,
        "source": "srsRAN",
        "ues": [{
          "pci": 1, "rnti": 4601,
          "downlink": { "cqi": 15, "mcs": 28, "bitrate": 17000000 },
          "uplink":   { "pusch_sinr": 26.7, "rsrp": -21.2, "mcs": 28 }
        }]
      }'
```

### Read buffer
`GET /api/ingest?all=1` → returns stored snapshots.

---

## 🚀 Quick Start (Local Dev)

```bash
# Clone
git clone https://github.com/<org-or-user>/<repo-name>.git
cd <repo-name>

# Install
npm install    # or yarn / pnpm

# Run
npm run dev
# App: http://localhost:3000
```

---

## 🧪 Mock Data

The dashboard can run in **Mock** mode for demos.  
Alternatively, send synthetic snapshots:

```bash
while true; do
  TS=$(date +%s000)
  curl -s -X POST https://af-25.vercel.app/api/ingest     -H "Content-Type: application/json"     -d "{\"timestamp\": $TS, \"source\": \"srsRAN\",
         \"ues\": [{\"pci\":1, \"rnti\":4601,
           \"downlink\": {\"cqi\": 12, \"mcs\": 22, \"bitrate\": $((RANDOM%20000000+5000000))},
           \"uplink\":   {\"pusch_sinr\": 24.5, \"rsrp\": -23.4, \"mcs\": 20}
         }]}"
  sleep 3
done
```

---

## 🐞 Known Issues

- OAI logs less structured than srsRAN (some fields derived)
- Mock generator is random (not realistic)
- Minor UI quirks (pause/flush states, chart resets on tab switch)

---

## 🗺️ Roadmap

- AI-powered inference engine
- Global hosted dashboard at ARA (multi-team login)
- Persistent DB backend (TimescaleDB/InfluxDB)
- Export snapshots to CSV/JSON

---

## 📄 License

MIT (or your project’s license of choice).
