# 📱 UID Manager Pro

> Bulk import, track, tag, and export Facebook UIDs — fast, offline-capable, and installable as a real Android app.

<p align="center">
  <img src="https://img.shields.io/badge/PWA-installable-5b8def?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Android-APK%20%2B%20AAB-3ddc84?style=for-the-badge&logo=android&logoColor=white" />
  <img src="https://img.shields.io/badge/Built%20with-Lovable-ff4d6d?style=for-the-badge" />
  <img src="https://img.shields.io/github/actions/workflow/status/labib-404/UID-MANEGER/android-release.yml?style=for-the-badge&label=Release%20Build" />
  <img src="https://img.shields.io/github/v/release/labib-404/UID-MANEGER?style=for-the-badge" />
</p>

---

## ✨ Features

- ⚡ **Bulk import** thousands of Facebook UIDs in seconds
- 🖼️ **Auto profile lookup** — avatar, name, profile link
- ⭐ **Saved / tagged** lists with notes
- 📤 **Export** to CSV / JSON
- 🌙 **Dark, brutalist UI** with compact + full views
- 📲 **Installable PWA** (works offline)
- 🤖 **Native Android APK / AAB** via Capacitor + GitHub Actions

## 🧱 Tech Stack

- **Frontend:** React 18 + Vite 5 + TypeScript + Tailwind + shadcn/ui
- **Backend:** Lovable Cloud (Supabase) — Auth, Postgres + RLS, Edge Functions
- **Mobile:** Capacitor 7 (Android) + vite-plugin-pwa
- **CI/CD:** GitHub Actions (debug APK + signed release APK/AAB)

---

## 🚀 Run Locally

```bash
git clone https://github.com/labib-404/uid.git
cd uid
npm install
npm run dev
```

Open <http://localhost:8080>.

---

## 🤖 Build an Android APK (the easy way)

You don't need Android Studio. GitHub Actions does it for you.

### 1. Unsigned Debug APK (for testing on your phone)

1. Go to your repo → **Actions** tab
2. Pick **"Build Android APK"** in the left sidebar
3. Click **Run workflow** → **Run workflow**
4. Wait ~5–8 minutes ☕
5. Open the finished run → scroll down → download **`app-debug-apk`**
6. Transfer the `.apk` to your phone and install (enable *Install unknown apps*)

> ✅ Workflow file: [`.github/workflows/android-apk.yml`](.github/workflows/android-apk.yml)

### 2. Signed Release APK + AAB (for Play Store / permanent save)

Signed builds are saved as **GitHub Releases** so they live forever on your repo.

#### Step A — Generate a keystore once (on your PC)

```bash
keytool -genkey -v -keystore release.keystore \
  -alias uidmanager -keyalg RSA -keysize 2048 -validity 10000
```

Remember the passwords you set.

#### Step B — Encode keystore to base64

```bash
# Linux / Mac
base64 -w 0 release.keystore > keystore.b64

# Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("release.keystore")) | Out-File keystore.b64
```

#### Step C — Add 4 secrets to GitHub

Repo → **Settings → Secrets and variables → Actions → New repository secret**

| Secret name         | Value                                  |
|---------------------|----------------------------------------|
| `KEYSTORE_BASE64`   | contents of `keystore.b64`             |
| `KEYSTORE_PASSWORD` | the store password from Step A         |
| `KEY_ALIAS`         | `uidmanager` (or whatever you chose)   |
| `KEY_PASSWORD`      | the key password from Step A           |

#### Step D — Build & auto-release

**Option 1 — Manual:** Actions → **Build Signed Android Release** → Run workflow → enter version → Run.

**Option 2 — Tag-based release (recommended):**

```bash
git tag v1.0.0
git push origin v1.0.0
```

GitHub Actions will:

1. Build the signed **APK** + **AAB**
2. Upload them as workflow artifacts
3. Create a **GitHub Release** under `v1.0.0` with both files attached 🎉

Your releases live forever at: `https://github.com/labib-404/UID-MANEGER/releases`

> ✅ Workflow file: [`.github/workflows/android-release.yml`](.github/workflows/android-release.yml)

---

## 📲 Install as PWA (no APK needed)

- **Android Chrome:** Visit the app → menu → *Install app*
- **iOS Safari:** Share → *Add to Home Screen*

---

## 📂 Project Structure

```
UID-MANEGER/
├── src/
│   ├── components/      # UI + virtual list
│   ├── hooks/           # useFBIds, useFBProfile, useSettings
│   ├── pages/           # Home, Import, Saved, Settings
│   └── workers/         # off-main-thread heavy work
├── supabase/
│   └── functions/       # fb-profile-lookup, fb-profile-refresh
├── .github/workflows/   # APK + signed release CI
├── capacitor.config.ts
└── vite.config.ts
```

---

## 🛡️ License

MIT © [labib-404](https://github.com/labib-404)

---

<p align="center">Made with ❤️ on <a href="https://lovable.dev">Lovable</a></p>
