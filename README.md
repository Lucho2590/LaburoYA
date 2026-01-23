# LaburoYA

Plataforma de empleo para Mar del Plata que conecta trabajadores con empleadores mediante un sistema de matching automático.

## Estructura del proyecto

```
laburo-ya/
├── frontend/    # Next.js + Tailwind + Firebase Auth
└── backend/     # Express + Firebase Admin SDK
```

## Tech Stack

### Frontend
- Next.js 16
- Tailwind CSS
- shadcn/ui
- Firebase Auth (client-side)

### Backend
- Express.js
- Firebase Admin SDK
- Firestore

## Setup Local

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local  # Configurar variables
npm run dev
```

### Backend

```bash
cd backend
npm install
cp .env.example .env  # Configurar variables
npm run dev
```

## Variables de Entorno

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

### Backend (.env)
```
PORT=3001
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

## Deploy

- **Frontend**: Vercel (root directory: `frontend`)
- **Backend**: Railway / Render (root directory: `backend`)
