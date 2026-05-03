## FB UID Manager Pro — Web + Native Mobile App

Repo `xeroxxd/lol-uid` ke Lovable-e rebuild korbo: ekta Facebook UID tracking & management app, web hisebe chalbe ebong Capacitor diye Android/iOS native app banano jabe.

---

### Auth
- Lovable Cloud Auth (email + password), auto-confirm on for fast testing
- `profiles` table (id → auth.users, display_name, created_at)
- `user_roles` table + `app_role` enum (`admin`, `user`) + `has_role()` security definer function
- Trigger: signup hole profile auto-create + default role = `user`
- `/auth` page (login + signup tab), `/reset-password` page
- Protected routes; logout button in header

### Database (Lovable Cloud / Postgres)
`facebook_ids` table:
| column | type |
|--------|------|
| id | uuid PK |
| user_id | uuid → auth.users (cascade) |
| uid | text |
| password | text nullable |
| pinned | bool (Saved) |
| visited | bool (Checked) |
| note | text (max 1000) |
| tag | text enum-like: VIP/Hot/New/Done/Skip/null |
| visited_at | timestamptz nullable |
| created_at | timestamptz default now() |

RLS: user can CRUD only own rows; admin can SELECT all.
Unique index on (user_id, uid) for dedup.

### Core Features (Page: `/`)
- **Bulk import**: textarea, paste UIDs (`uid` or `uid|password` per line), auto-dedup vs existing
- **List view**: each item shows UID link (opens `https://facebook.com/{uid}` in new tab → marks visited + sets visited_at), password (masked, copy), tag badge, note preview, pinned star, checked indicator
- **Search**: filter by uid/note text
- **Filter tabs**: All / Checked / Unchecked / Saved / Noted / Tagged
- **Sort**: newest / oldest / checked / unchecked / saved
- **Per-item actions**: toggle checked, toggle saved, edit note (dialog, 1000 char), set tag, delete
- **Bulk actions**: multi-select → check/uncheck/save/delete/copy
- **Copy formats**: `UID|Pass`, UID only, Pass only
- **Export**: download `.txt` / `.csv` per category (Checked / Unchecked / Saved / All)

### UX Polish
- **Undo delete**: 6-second toast with Undo button restores item(s)
- **Swipe-to-delete**: mobile swipe-left reveals red delete action
- **Infinite scroll**: 50 items per page, loads more on scroll
- **Settings sheet**: font size (S/M/L) + view mode (compact 2-col grid / full) — persisted in localStorage
- **Mobile bottom nav**: 5 tabs — Home / Search / Import / Saved / Settings (with active pill indicator)

### Admin Panel (`/admin`)
- Visible only if `has_role(uid, 'admin')`
- Lists all users: email, signup date, total UIDs, checked count, saved count
- Search users; click user → view their UIDs (read-only)

### Design (Surprise Me)
Modern dark-first theme with smooth animations:
- Deep slate background (`hsl(222 47% 6%)`), card surfaces with subtle border + glassmorphism
- Accent: electric blue → violet gradient (`hsl(217 91% 60%)` → `hsl(262 83% 65%)`)
- Typography: Inter (body), Space Grotesk (headings)
- Animated login: gradient orb background, fade-in, button shimmer, shake on wrong password
- Glassmorphic mobile bottom nav with spring-physics pill indicator (Framer Motion)
- Smooth list item enter/exit animations, swipe gesture feedback
- Light mode toggle available in settings
- Full design tokens in `index.css` + `tailwind.config.ts` (HSL semantic tokens)

### Mobile (Capacitor — Native App)
- Setup `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/android`
- `capacitor.config.ts`: appId `app.lovable.767276cc70d34a8c96ccd71c0e42f903`, hot-reload server URL pointing to sandbox
- Mobile-optimized meta tags, splash screen, app icon
- After implementation, instructions to user: Export to GitHub → `npm install` → `npx cap add ios/android` → `npx cap sync` → `npx cap run`

### Pages Map
```text
/                  → Home (list, filters, search, bulk actions)
/import            → Bulk import page
/saved             → Saved/pinned items
/settings          → Theme, font, view mode, account, logout
/auth              → Login + signup
/reset-password    → Set new password
/admin             → Admin panel (role-gated)
```

### Out of scope (v1)
- Analytics charts (pie/bar/daily) — can add later
- Email/auth template branding
- Social login

---

### Build order
1. Enable Lovable Cloud + auth setup (profiles, roles, RLS, trigger)
2. `facebook_ids` table + RLS
3. Design system (tokens, fonts, dark theme)
4. Auth pages (`/auth`, `/reset-password`) with animations
5. Core list page + bulk import + search/filter/sort
6. Per-item actions, notes dialog, tags, bulk actions
7. Export (txt/csv) + copy formats
8. UX polish (undo delete, swipe, infinite scroll, settings persistence)
9. Mobile bottom nav + responsive layout
10. Admin panel
11. Capacitor setup + native config
