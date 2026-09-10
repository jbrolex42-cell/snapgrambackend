# Snapgram

- **Backend:** Node.js + Express + MongoDB (Mongoose), JWT auth, bcrypt password hashing
- **Frontend:** Vanilla HTML/CSS/JS (no build step) that calls the API directly

## 1. Backend setup

bash
cd backend
cp .env.example .env
# edit .env: set MONGO_URI (local MongoDB or a MongoDB Atlas connection string)
# and set JWT_SECRET to a long random string

npm install
npm run dev      # or: npm start

The API runs on `http://localhost:5000` by default. Health check: `GET /api/health`.

You need a running MongoDB instance — either install it locally or use a free
MongoDB Atlas cluster and paste its connection string into `MONGO_URI`.

## 2. Frontend setup

No build tools needed — it's plain HTML/CSS/JS.

bash
cd frontend
python3 -m http.server 8080
# then open http://localhost:8080

If your backend isn't on `localhost:5000`, update `API_BASE` in `frontend/config.js`.

## API overview

| Method | Route                          | Auth | Purpose                       |
|--------|---------------------------------|------|--------------------------------|
| POST   | /api/auth/register              | no   | Create account                 |
| POST   | /api/auth/login                 | no   | Log in, get JWT                |
| GET    | /api/users/:id                  | no   | Profile + their posts          |
| PUT    | /api/users/:id                  | yes  | Edit own bio/avatar            |
| POST   | /api/users/:id/follow           | yes  | Follow a user                  |
| POST   | /api/users/:id/unfollow         | yes  | Unfollow a user                |
| GET    | /api/posts/feed                 | yes  | Posts from people you follow   |
| GET    | /api/posts/explore               | no   | All posts, newest first        |
| POST   | /api/posts                      | yes  | Create a post                  |
| DELETE | /api/posts/:id                  | yes  | Delete your own post           |
| POST   | /api/posts/:id/like             | yes  | Like a post                    |
| POST   | /api/posts/:id/unlike           | yes  | Unlike a post                  |
| POST   | /api/posts/:id/comments         | yes  | Comment on a post              |

Auth routes return a JWT; send it as `Authorization: Bearer <token>` on
protected routes. Image uploads are handled client-side as base64 data URLs
(no file storage service wired up) — swap in S3/Cloudinary for production.

## New in this pass: verification, subscriptions, redesign

**Verification (blue tick):** any user can apply from their own profile
(`POST /api/verification/request`). Requests sit in `verificationStatus:
'pending'` until an admin approves or rejects them. There's no self-serve
way to become an admin — set it directly in the database:

js
// in a mongo shell / Compass, against your snapgram DB
db.users.updateOne({ email: "you@example.com" }, { $set: { isAdmin: true } })

Once `isAdmin: true`, log out and back in (or just refresh — the app
re-fetches your user on load) and an "Admin" button appears in the top bar
linking to the pending-requests queue.

**Subscriptions (Snapgram+):** real Stripe Checkout, subscription mode.
You need a Stripe account (test mode is fine) to actually exercise this:

1. Create a recurring Price in the Stripe Dashboard, copy its ID into
   `STRIPE_PRICE_ID` in `backend/.env`.
2. Copy your test secret key into `STRIPE_SECRET_KEY`.
3. For local webhook delivery: `stripe listen --forward-to
   localhost:5000/api/subscriptions/webhook`, then paste the printed
   `whsec_...` into `STRIPE_WEBHOOK_SECRET`.
4. Set `CLIENT_URL` to wherever the frontend is served (e.g.
   `http://localhost:8080`) — Stripe redirects back there after checkout.

Without a webhook running, `isSubscribed` will never flip to `true` even
after a successful test payment — the webhook is what confirms it, not the
redirect.

**Redesign:** the frontend now uses a white/blue Instagram-like visual
style (see `frontend/style.css`) — original SVG icons and layout, not
copied assets, since Snapgram can't reuse Instagram's actual logo, icon
set, or trademarked name/branding.

## New in this pass: Stories, DMs, hashtags/search, notifications, saved posts, block/report/2FA

**Stories:** `POST /api/stories` creates a story that auto-deletes after 24h via
a MongoDB TTL index on `expiresAt` (no cron job needed). `GET
/api/stories/feed` returns active stories from people you follow, grouped
by user, with per-viewer "seen" state.

**Direct messages:** `Conversation` + `Message` models, 1:1 only. Starting a
conversation (`POST /api/conversations`) and sending a message both check
`blockedUsers` in both directions and refuse if either side has blocked the
other.

**Hashtags & search:** captions are scanned for `#word` on post creation
and stored on `Post.hashtags`. `GET /api/search?q=` returns matching users
and hashtags together; `GET /api/posts/hashtag/:tag` returns that tag's
posts.

**Notifications:** a `Notification` doc is created on like, comment, and
follow (never for actions on your own content). `GET /api/notifications`
lists mine; `POST /api/notifications/read-all` clears the unread badge.

**Saved posts:** `User.savedPosts` plus `POST /api/posts/:id/save` /
`/unsave` / `GET /api/posts/saved/mine`. Shows as a "Saved" tab on your own
profile only.

**Block / report:** `POST /api/users/:id/block` severs any existing follow
relationship both ways and blocks future follows/messages between the two
accounts. `POST /api/reports` accepts a `targetType` of `user` or `post`;
admins review the queue at `GET /api/reports` (needs `isAdmin: true`, same
as verification review).

**Two-factor authentication (TOTP):** standard authenticator-app flow —
`POST /api/auth/2fa/setup` returns a QR code, `POST /api/auth/2fa/enable`
confirms it with a 6-digit code. Once enabled, `POST /api/auth/login`
returns `{ requires2FA: true, preAuthToken }` instead of a session token;
the frontend then calls `POST /api/auth/2fa/login-verify` with that token
and the code from the authenticator app to get the real JWT. The
`preAuthToken` is a separate, 5-minute-lived JWT claim (`preAuthUserId`,
not `userId`) — it can't be used to call any authenticated route on its
own, only to complete the second login step.

No new env vars needed for any of this — it all reuses `MONGO_URI` and
`JWT_SECRET` already in `.env`.

## What's still left out

Nothing from the original feature list — Reels is now built too (see below).
What's genuinely out of scope for an app like this: a Shop/checkout system,
ad delivery, AI filters/AR effects, and a real recommendation algorithm —
these need infrastructure or business relationships beyond what a demo app
should try to fake.

## New in this pass: Reels, bug fixes, deployment

**Reels:** a separate `Reel` model (video posts, distinct from photo
`Post`s) with the same like/comment/hashtag shape as regular posts. `GET
/api/reels` is a public discovery feed (like Explore); `GET /api/reels/feed`
is the following-only version. Reels are accessed from a new icon in the
top bar, and the "+" create screen now has Post/Reel tabs.

**Reels & video storage:** videos are uploaded as base64 `data:` URIs
through the same JSON API as images, same as the rest of this app — there's
no real file storage. That's fine for a few-second demo clip but doesn't
scale: base64 inflates file size by ~33%, and the body-size limit is capped
at 25mb specifically to keep that from breaking. For anything beyond
demoing, swap this for direct-to-storage uploads (S3, Cloudinary, Mux) with
the API only storing the resulting URL — the same fix noted earlier for
image posts, more pressing here.

**Bug fixes from the previous pass:**
- The "subscribed" / "checkout cancelled" banner used to persist across
  every navigation after checkout; it now clears after being shown once.
- The notification bell's unread dot used to stay visible until you
  navigated away and back after opening Notifications; it now clears
  immediately.
- `POST /api/users/:id/follow` didn't check `blockedUsers` — a blocked user
  could still follow you. Fixed.
- The Reports feature (`POST /api/reports`, admin review) was fully built
  on the backend last pass but had no admin UI — the Admin panel now has
  Verification / Reports tabs.
- Registration accepted any string as a username or email. Added basic
  format validation (username: 3-30 chars, letters/numbers/underscore/dot;
  email: basic shape check) — not exhaustive, but catches obvious garbage.

## Deploying this for real

This wasn't tested against live infrastructure from here — treat the
following as a starting checklist, not a guarantee, and verify each step
against a staging environment before pointing real users at it.

**Database — MongoDB Atlas (free tier is enough to start):**
1. Create a cluster at mongodb.com/atlas, add a database user, and allow
   network access from your backend host's IP (or `0.0.0.0/0` while
   testing, then narrow it).
2. Copy the connection string into `MONGO_URI` on your backend host.

**Backend — any Node host (Render, Railway, Fly.io, a VPS, etc.):**
A `Dockerfile` is included in `backend/` if your host wants a container;
otherwise `npm install && npm start` with these environment variables set:

| Variable | Notes |
|---|---|
| `MONGO_URI` | Atlas connection string |
| `JWT_SECRET` | long random string, different from any dev value |
| `PORT` | most hosts inject this automatically |
| `FRONTEND_ORIGIN` | your deployed frontend's exact origin, e.g. `https://snapgram.example.com` — CORS is wide open (`*`) by default for local dev; **set this in production** or any site can call your API from a browser |
| `CLIENT_URL` | same as `FRONTEND_ORIGIN` — used to build Stripe redirect URLs |
| `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` | see below |

**Frontend — any static host (Netlify, Vercel, S3+CloudFront, GitHub
Pages):** it's plain files, no build step. Before deploying, update
`frontend/config.js`'s `API_BASE` to your deployed backend's URL. Then
upload/deploy the `frontend/` folder as-is.

**Switching Stripe to live mode:**
1. Toggle your Stripe Dashboard out of test mode.
2. Create the recurring Price again in live mode (test-mode Prices don't
   carry over) and update `STRIPE_PRICE_ID`.
3. Copy the live secret key into `STRIPE_SECRET_KEY`.
4. In the Stripe Dashboard, add a webhook endpoint pointing at
   `https://your-backend/api/subscriptions/webhook`, subscribed to
   `checkout.session.completed`, `customer.subscription.updated`, and
   `customer.subscription.deleted` — then copy *that* endpoint's signing
   secret into `STRIPE_WEBHOOK_SECRET` (it's different from the CLI
   `stripe listen` one you used locally).
5. Do at least one real test purchase with a real card before calling it
   done — webhook delivery and signature verification are the two things
   most likely to silently misbehave in production.

**Things this checklist deliberately doesn't cover:** a CDN or object
storage for images/video (see the Reels note above — this matters more as
usage grows), rate limiting, structured logging/monitoring, and automated
backups for the database. All reasonable next steps, none of them
built here.