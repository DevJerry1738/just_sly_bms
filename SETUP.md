# Just Sly Business Suite — Documentation & Setup Guide

Welcome to the **Just Sly Business Management Suite**, a modern, enterprise-grade platform built for unified operational control across retail branches, wholesale orders, inventory, and analytics.

---

## 📋 Prerequisites

Before running the application locally, ensure you have the following installed on your machine:

1. **Node.js**: Version `18.x` or `20.x` (Recommended). You can manage Node versions using [nvm](https://github.com/nvm-sh/nvm).
2. **Package Manager**: `npm` (comes with Node.js) or `bun` / `pnpm`.
3. **Git**: Installed and configured.

---

## 🚀 Initializing the Application for the First Time

Follow these step-by-step instructions to get the application running locally:

### 1. Clone the Repository & Navigate to Project Directory
```bash
git clone <repository-url>
cd business-suite-main
```

### 2. Install Dependencies
Run the install command using your preferred package manager:

**Using npm:**
```bash
npm install
```

**Using bun:**
```bash
bun install
```

---

### 3. Configure Environment Variables
Create or verify your `.env` file in the root directory. Ensure the following Supabase configuration variables are defined:

```env
VITE_SUPABASE_URL="https://<your-supabase-project-id>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<your-supabase-publishable-key>"
VITE_SUPABASE_PROJECT_ID="<your-supabase-project-id>"

SUPABASE_URL="https://<your-supabase-project-id>.supabase.co"
SUPABASE_PUBLISHABLE_KEY="<your-supabase-publishable-key>"
SUPABASE_PROJECT_ID="<your-supabase-project-id>"
```

---

### 4. Start the Development Server
Launch the local dev server:

**Using npm:**
```bash
npm run dev
```

**Using bun:**
```bash
bun run dev
```

Once started, open your browser and navigate to:
```
http://localhost:3000
```
(or the port shown in your terminal output).

---

## 🛠 Available Scripts

In the project directory, you can run:

| Command | Description |
| :--- | :--- |
| `npm run dev` | Runs the app in development mode with HMR |
| `npm run build` | Builds the production app bundle |
| `npm run preview` | Previews the production build locally |
| `npm run lint` | Runs ESLint to check for code quality issues |

---

## 🎨 Tech Stack & Architecture Highlights

- **Framework**: Vite + React + TanStack Router (File-based routing)
- **State & Data Fetching**: TanStack React Query + Supabase JS Client
- **UI & Styling**: Tailwind CSS v4 + shadcn/ui primitives + Inter typography system
- **Icons**: Lucide React
- **Notifications**: Sonner
- **Offline Database**: Dexie.js (IndexedDB)
- **PWA**: Custom Service Worker + Web App Manifest
- **Data Architecture**: Repository Pattern with persistent Sync Queue

---

## 📶 Offline-First Architecture

This application is designed as an **Offline-First PWA**. All data reads and writes go through local repositories backed by IndexedDB, and mutations are queued for background synchronization when online. See [OFFLINE_ARCHITECTURE.md](OFFLINE_ARCHITECTURE.md) for the full developer guide.

Key layers:
- **Repositories** (`src/repositories/`): `BaseRepository<T>` handles local CRUD + sync queue enqueuing
- **Sync Engine** (`src/services/sync/`): `SyncQueue`, `SyncManager`, `SyncScheduler`, `ConflictResolver`
- **Network Status** (`src/services/offline/`): Centralized online/offline detection
- **PWA Components** (`src/components/offline/`): Banner, status indicator, install button, update toast

---

## 📁 Key Directory Structure

```
business-suite-main/
├── public/
│   ├── manifest.json          # PWA Web App Manifest
│   ├── sw.js                  # Service Worker
│   └── offline.html           # Offline fallback page
├── src/
│   ├── assets/                # Brand logos (no_bg, white_bg, dark_bg)
│   ├── components/
│   │   ├── common/            # Shared components (DataTable, StatusBadge, PageWrapper, etc.)
│   │   ├── layout/            # Layout components (AppShell, AppSidebar, AppTopbar)
│   │   ├── offline/           # PWA & offline UX components (OfflineBanner, SyncStatus, etc.)
│   │   └── ui/                # Primitive shadcn components
│   ├── config/                # Global app and navigation configs
│   ├── database/              # Dexie.js IndexedDB schema & singleton instance
│   ├── features/              # Feature modules (dashboard, inventory, sales, etc.)
│   ├── hooks/                 # Custom hooks (useNetworkStatus, usePwaInstall, useServiceWorker)
│   ├── integrations/          # External services (Supabase client)
│   ├── providers/             # App context providers (Auth, Theme)
│   ├── repositories/          # Data access layer (BaseRepository, entity repos)
│   ├── routes/                # TanStack router page routes
│   ├── services/
│   │   ├── offline/           # Network status service
│   │   └── sync/              # Sync engine (queue, manager, scheduler, conflict resolver)
│   └── styles.css             # Global CSS variables & token design system
├── OFFLINE_ARCHITECTURE.md    # Developer guide for offline-first patterns
├── .env                       # Local environment configuration
└── package.json               # Dependencies and build scripts
```

