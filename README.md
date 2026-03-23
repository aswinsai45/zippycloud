<div align="center">

# ⚡ ZippyCloud

### Multi-cloud file storage with automatic failover

Upload your files to AWS S3 and Azure Blob Storage simultaneously.
If one cloud goes down, the other one seamlessly takes over.

[Access ZippyCloud here](https://zippycloud.vercel.app) · [Report a Bug](https://github.com/aswinsai45/zippycloud/issues)

</div>

---

## What Is ZippyCloud?

ZippyCloud lets you store files across two cloud providers at the same time — AWS S3 and Azure Blob Storage. Every file you upload goes to both clouds simultaneously. When you download, the app automatically picks whichever cloud is fastest for your network. If one cloud is unavailable, the other takes over without you doing anything.

You connect your own AWS and Azure accounts. ZippyCloud never owns your storage — it just orchestrates it.

---

# 👤 User Guide

## Getting Started

### 1. Create an Account

Visit the app and click **Sign up**. Enter your email and password. You'll be logged in immediately.

### 2. Connect Your Cloud Accounts

Before uploading files you need to connect at least one cloud provider. Go to **Settings** in the sidebar.

**To connect AWS S3 you'll need:**

- AWS Access Key ID
- AWS Secret Access Key
- S3 Bucket Name
- Region (e.g. `ap-south-1`)

**To connect Azure Blob Storage you'll need:**

- Storage Account Name
- Account Key
- Container Name

Don't have these yet? See the setup guides below:

- [How to get AWS credentials →](#aws-credentials)
- [How to get Azure credentials →](#azure-credentials)

Once connected, both providers show a green **Connected** badge on the Settings page.

### 3. Upload a File

Go to **Dashboard**. Drag and drop any file into the upload zone, or click it to browse your files. The file will be uploaded to both AWS and Azure simultaneously. You'll see a confirmation toast when it's done.

Any file type is supported — documents, images, videos, code, archives, anything.

### 4. Download a File

In the file table, hover over any file and click **Download**. The app measures which cloud is faster for your network right now and downloads from that one. The toast tells you which provider served the file.

### 5. Failover in Action

If one of your cloud providers is unavailable (wrong credentials, outage, deleted file), the download automatically falls back to the other provider. You'll see a toast saying which provider was used as fallback.

### 6. Delete a File

Hover over a file row and click the trash icon. This removes the metadata record from the database. Note — you'll need to manually delete the actual objects from your AWS S3 bucket and Azure container separately.

---

## Getting Your Cloud Credentials

### AWS Credentials

1. Sign in to [aws.amazon.com](https://aws.amazon.com)
2. Go to **S3** → create a bucket in a region close to you
3. Go to **IAM** → Users → Create user → attach `AmazonS3FullAccess`
4. Inside the user → Security credentials → Create access key
5. Copy the **Access Key ID** and **Secret Access Key**

### Azure Credentials

1. Sign in to [portal.azure.com](https://portal.azure.com)
2. Search **Storage accounts** → Create one
3. Inside the storage account → **Containers** → create a container named `files`
4. Inside the storage account → **Access keys** → copy the account name and key1

---

## Network Latency Widget

The dashboard shows a live **Network Latency** bar that measures how fast your browser can reach AWS and Azure from your current network. The fastest provider is highlighted and used for your next download. This re-probes automatically every 60 seconds.

---

## FAQ

**Can I connect just one cloud provider?**
Yes. If you only connect AWS, files upload to AWS only. Failover won't work without both providers connected but uploads and downloads still work normally.

**Is my data safe?**
Your cloud credentials are encrypted before being stored. Row Level Security ensures you can only ever access your own files and credentials — no other user can see your data even at the database level.

**What's the file size limit?**
There's no enforced limit in the app. Practical limits depend on your cloud provider settings and your network connection.

**How do I disconnect a cloud provider?**
Go to Settings and click the trash icon next to the connected provider.

---

# 🛠️ Developer Guide

## Tech Stack

| Layer           | Technology                              |
| --------------- | --------------------------------------- |
| Frontend        | React + TypeScript + TailwindCSS (Vite) |
| Backend         | FastAPI (Python)                        |
| Auth & Database | Supabase                                |
| Cloud A         | AWS S3                                  |
| Cloud B         | Azure Blob Storage                      |
| Frontend Deploy | Vercel                                  |
| Backend Deploy  | Render                                  |

---

## Architecture Overview

```
UPLOAD
User → FastAPI backend → AWS S3  (parallel)
                       → Azure Blob Storage

DOWNLOAD
Browser probes AWS + Azure latency
→ Sends ?prefer=aws|azure hint to backend
→ Backend tries preferred provider first
→ Falls back to other if preferred fails
→ Streams file to browser
```

The system has three independent layers:

- **Server-side latency cache** — background task probes clouds every 60s, used to order uploads
- **Client-side latency probe** — browser measures latency before download, used to route downloads
- **Failover** — always active, ensures correctness regardless of latency decisions

---

## Prerequisites

- Python 3.9+
- Node.js 18+
- Supabase account
- AWS account with an S3 bucket and IAM credentials
- Azure account with a storage account and container

---

## Local Setup

### 1. Clone the repo

```bash
git clone https://github.com/yourusername/zippycloud.git
cd zippycloud
```

### 2. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run `supabase_setup.sql` in the SQL Editor
3. Go to **Authentication → Providers → Email** → disable **Confirm email**
4. Collect your keys from **Settings → API Keys**

### 3. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Generate encryption key (run once, never change after users save credentials)
python generate_fernet_key.py

cp .env.example .env
# Fill in SUPABASE_URL, SUPABASE_SERVICE_KEY, FERNET_KEY
```

Start:

```bash
cd src
uvicorn main:app --reload
# Swagger UI at http://localhost:8000/docs
```

### 4. Frontend

```bash
cd frontend
npm install
cp .env.example .env
# Fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_URL
npm run dev
# App at http://localhost:5173
```

---

## Environment Variables

### Backend `.env`

| Variable               | Description                    | Where to find                     |
| ---------------------- | ------------------------------ | --------------------------------- |
| `SUPABASE_URL`         | Your Supabase project URL      | Settings → General                |
| `SUPABASE_SERVICE_KEY` | Service role secret key        | Settings → API Keys → Secret keys |
| `FERNET_KEY`           | Encryption key for credentials | `python generate_fernet_key.py`   |

### Frontend `.env`

| Variable                 | Description               | Where to find                         |
| ------------------------ | ------------------------- | ------------------------------------- |
| `VITE_SUPABASE_URL`      | Your Supabase project URL | Settings → General                    |
| `VITE_SUPABASE_ANON_KEY` | Publishable anon key      | Settings → API Keys → Publishable key |
| `VITE_API_URL`           | Backend URL               | `http://localhost:8000` locally       |

---

## Deployment

### Order matters:

```
1. Push to GitHub
2. Deploy backend on Render → get your Render URL
3. Temporarily set allow_origins=["*"] in main.py → push
4. Deploy frontend on Vercel → use Render URL as VITE_API_URL → get Vercel URL
5. Update allow_origins in main.py to your Vercel URL → push
6. Done
```

### Render (backend)

- Root directory: `backend`
- Build: `pip install -r requirements.txt`
- Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Runtime root: `src`
- Add all three backend env vars

### Vercel (frontend)

- Root directory: `frontend`
- Add all three frontend env vars
- `vercel.json` handles SPA routing automatically

---

## Project Structure

```
zippycloud/
├── supabase_setup.sql
├── frontend/
│   └── src/
│       ├── components/        # ErrorBoundary, ProtectedRoute
│       ├── contexts/          # AuthContext, ToastContext
│       ├── layouts/           # AppLayout (sidebar + mobile drawer)
│       ├── lib/               # supabase.ts, latency.ts
│       └── pages/             # AuthPage, DashboardPage, SettingsPage
└── backend/
    └── src/
        ├── app/
        │   ├── routers/       # files.py, cloud.py, auth.py
        │   ├── dependencies.py
        │   └── latency.py
        └── main.py
```

---

## License

MIT
