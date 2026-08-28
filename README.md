<div align="center">

<pre>
██████╗ ███████╗████████╗██████╗ ██╗██╗   ██╗ █████╗
██╔══██╗██╔════╝╚══██╔══╝██╔══██╗██║██║   ██║██╔══██╗
██████╔╝█████╗     ██║   ██████╔╝██║██║   ██║███████║
██╔══██╗██╔══╝     ██║   ██╔══██╗██║╚██╗ ██╔╝██╔══██║
██║  ██║███████╗   ██║   ██║  ██║██║ ╚████╔╝ ██║  ██║
╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═══╝  ╚═╝  ╚═╝
</pre>

<b>Intelligent Campus Lost & Found System</b>

<i>Stop scrolling through WhatsApp groups. Start finding what matters.</i>

🏆 <b>Top 10 — TechSprint AI Hack '25 | GDG on Campus PCE (National Level)</b>

<br/>

[![React](https://img.shields.io/badge/React_19-TypeScript-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore-FFCA28?style=flat-square&logo=firebase)](https://firebase.google.com)
[![Vite](https://img.shields.io/badge/Vite-Build_Tool-646CFF?style=flat-square&logo=vite)](https://vitejs.dev)
[![License](https://img.shields.io/badge/License-Educational-green?style=flat-square)](#-license)

</div>

---


## 🎥 Demo

> Watch our live presentation from **TechSprint AI Hack '25**

[![Watch Demo](https://img.shields.io/badge/▶_Watch_on_YouTube-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://youtu.be/7m27rmMBnP0)

<br/>

## The Problem

Campus lost and found is broken. Items sit unclaimed in cardboard boxes. Recovery attempts drown in chaotic WhatsApp threads. A "MacBook" report never connects with the "Apple laptop" that was turned in — because no one's reading every message.

**RETRIVA fixes this.** A centralized, AI-powered platform that understands what you mean — not just what you type.

<br/>

## What Makes RETRIVA Different

### 🧠 Multimodal AI at the Core

| Feature | What it does |
|---|---|
| **Auto-Description** | Snap a photo → AI extracts brand, color, type, and condition. No manual typing. |
| **Semantic Matching** | Vector search understands that *"MacBook"* = *"Apple laptop"*. Keyword matching can't do this. |
| **Match Comparator** | Side-by-side AI analysis of two items produces a **Match Confidence Score** — so users verify ownership with evidence, not gut feeling. |

### 🛡️ Guardian AI — Privacy by Default

Privacy isn't an afterthought. Before any image goes live:

- **Face Detection** — Uploads containing faces are automatically rejected outright.
- **Document Redaction** — Student IDs, credit cards, and sensitive text are detected and masked.
- **Content Moderation** — Spam, pranks, and inappropriate uploads are banned and rejected before they ever appear.

### ⚡ Real-Time Everything

- **Instant Match Alerts** — Get notified the moment a potential match is found.
- **Secure In-App Messaging** — Coordinate retrieval without sharing your phone number.
- **Live Status Tracking** — Every report is `Open` or `Resolved`. The database stays clean automatically.

<br/>

## Tech Stack

```
┌─────────────────────────────────────────────────────┐
│                     RETRIVA                         │
├─────────────────┬───────────────────────────────────┤
│  Frontend       │  React 19 + TypeScript + Vite     │
│  Styling        │  Tailwind CSS + Lucide Icons       │
│  AI Layer       │  Groq (Qwen & LLaMA)              │
│  Backend        │  Firebase (Firestore + Auth)       │
│  Media          │  Cloudinary API                   │
└─────────────────┴───────────────────────────────────┘
```

<br/>

## Getting Started

### Prerequisites

- Node.js `v18+`
- A [Firebase project](https://console.firebase.google.com/)
- [Groq API key](https://console.groq.com/) (Groq Console)
- A [Cloudinary account](https://cloudinary.com/)

### Setup

**1. Clone the repo**
```bash
git clone https://github.com/your-username/retriva.git
cd retriva
```

**2. Install dependencies**
```bash
npm install
```

**3. Configure environment variables**

Copy `.env.example` to `.env` and fill it in. All variables are required unless noted:
```env
FIREBASE_PROJECT_ID=your_project_id        # server-side (no VITE_ prefix) — MUST match VITE_FIREBASE_PROJECT_ID below
FIREBASE_SERVICE_ACCOUNT_KEY=               # optional — unlocks persistent AI caching/rate-limit protection, see .env.example
GROQ_API_KEY=your_groq_api_key
VITE_CLOUDINARY_CLOUD_NAME=
VITE_CLOUDINARY_UPLOAD_PRESET=
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_PROJECT_ID=your_project_id   # client-side — MUST match FIREBASE_PROJECT_ID above
VITE_FIREBASE_STORAGE_BUCKET=
```

> **Important for Vercel deploys:** `FIREBASE_PROJECT_ID` and `VITE_FIREBASE_PROJECT_ID` are two separate env vars that must hold the *same* project ID. Setting only the `VITE_`-prefixed one is a common mistake — the backend falls back to a placeholder and every AI request will fail with 401 Unauthorized until both are set.
>
> Firebase and Cloudinary client configs live in `services/firebase.ts` and `services/cloudinary.ts`.

**4. Start the dev server**
```bash
npm start
```

<br/>

## Project Structure

```
retriva/
├── src/
│   ├── components/       # UI components
│   ├── services/
│   │   ├── firebase.ts   # Firestore & Auth config
│   │   ├── cloudinary.ts # Media upload config
│   │   └── aiService.ts  # AI service layer
│   ├── pages/            # Route-level views
│   └── types/            # TypeScript interfaces
├── .env                  # API keys (not committed)
└── vite.config.ts
```

<br/>

## The Team — FORGESCRIPT

Built by first-year engineering students at **Pillai College of Engineering, New Panvel**.

| Name | Branch | LinkedIn |
|---|---|---|
| Durvesh Thorat | Information Technology | [![LinkedIn](https://img.shields.io/badge/LinkedIn-blue?style=flat-square&logo=linkedin)](https://www.linkedin.com/in/durvesh-thorat/) |
| Kaustubh Bhoir | Computer Engineering | [![LinkedIn](https://img.shields.io/badge/LinkedIn-blue?style=flat-square&logo=linkedin)](https://www.linkedin.com/in/kaustubh-bhoir-ce/) |
| Nipun Tamore | Information Technology | [![LinkedIn](https://img.shields.io/badge/LinkedIn-blue?style=flat-square&logo=linkedin)](https://www.linkedin.com/in/nipun-tamore-21ba5b308/) |
| Srushtee Gawande | Information Technology | — |

<br/>

## Contributing

This is an educational project. Issues and suggestions are welcome — open a GitHub Issue or reach out to any team member.

<br/>

## License

© 2026 Team FORGESCRIPT — Pillai College of Engineering.  
Created for educational purposes. All rights reserved.

<br/>

<div align="center">

*Lost something? Found something? Let RETRIVA handle the rest.*

</div>
