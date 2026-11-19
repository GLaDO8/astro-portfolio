# Garage

A small marketplace for `garage.shrey.fyi`, hosted on Vercel as a separate project in this repository.
The Vercel project root directory is **`apps/garage`**. The portfolio keeps its existing build.

The app uses the portfolio’s shared color tokens and Commissioner font. It includes category chips,
product details, a saved box, the contact/city request form, and a private `/admin` page for listings
and requests. Categories come from available listings, so empty categories disappear automatically.

## Local preview

From the repository root:

```sh
pnpm install
pnpm run garage:setup -- --seed
pnpm run garage:dev
```

Open `http://localhost:4322`. The generated local admin password is in
`apps/garage/.local-admin-password`. The password, hash, database, and photos are ignored by Git
and excluded from Vercel uploads. Setup preserves existing credentials and data. Stop this app’s
dev server before running setup because the local database permits a single process.

Local development uses PGlite, an embedded Postgres database, and local photo files under
`.local-data/`. It makes no requests to a cloud database or photo store. The sample seed is local
only and clearly marked in the UI. Omit `--seed` for an empty local catalog.

## Vercel deployment

Create or select a separate Vercel project for Garage, connect this repository, and set its root
directory to `apps/garage`. Keep **Include source files outside of the Root Directory in the Build
Step** enabled so the shared portfolio tokens and font are available. The included `vercel.json` configures Vite, the `/admin` route, and a
single Node.js API function. Install/build commands use pnpm and the workspace lockfile.

Connect a **Neon Postgres** database through the Vercel Marketplace and a **public Vercel Blob**
store. Use separate databases or Neon branches and separate Blob stores for Preview and Production.
Do not point a preview deployment at the production catalog or inbox.

Required server environment variables:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Garage’s pooled Postgres connection, injected by the Neon integration |
| `BLOB_READ_WRITE_TOKEN` | Garage’s public Blob store token, injected by Vercel |
| `ADMIN_PASSWORD_HASH` | Generated password hash; never the plain password |

Store production credentials in the connected secret manager/Vercel project settings. Do not copy
local demo credentials into production. Generate a hash in a terminal with:

```sh
node apps/garage/scripts/admin-password.mjs
```

The prompt hides your password. Save it in your password manager, then save the generated hash
as `ADMIN_PASSWORD_HASH` in the Garage project. The password hash is never sent to the browser.

The first migration lives in `migrations/0001_garage.sql` and creates the isolated `garage` schema.
Review and test it on a development Neon branch before production. Supply its direct connection
as `DATABASE_URL_UNPOOLED` through the secret manager, then run:

```sh
node apps/garage/scripts/migrate.mjs --remote --confirm garage
```

The migration command requires the direct connection and explicit target confirmation. It never
seeds sample listings. After a preview has passed the full flow, deploy to Production and attach
`garage.shrey.fyi` in Vercel. Add the exact CNAME record Vercel reports at Porkbun. Nameservers can
stay as they are. No hosting resources or DNS records have been created by the local setup.

## Admin and requests

- Login uses a salted password hash and a 12-hour HttpOnly, Secure, SameSite session cookie.
  Sign out revokes the session. Changing the hash also invalidates existing sessions.
- Listings include title, price or free, description, category, brand, original HTTPS link,
  optional photo, and availability. Draft, reserved, and gone listings are hidden from visitors.
- Photos support JPG, PNG, and WebP, up to **4 MB**, within Vercel Functions’ request-body limit.
  They are public product photos. Buyer details are stored only in Postgres and returned only
  to an authenticated admin.
- A request requires a name and at least an email or WhatsApp number with country code. The
  Bangalore checkbox sets the city; unchecking it requires a city name.
- Requests snapshot current prices and reject unavailable products in one database statement.
  A request does not reserve a product or collect payment. Confirm the handover with the buyer.
- The private inbox supports new, contacted, and closed states. There are no automatic email or
  WhatsApp notifications; use the contact links in the inbox to reply.
- The browser stores only selected product IDs and titles. It does not save buyer contact details.
- Public submissions and login attempts are rate limited in Postgres. Mutations require the
  same origin. There is no public endpoint for buyer details.

## Checks

```sh
pnpm run garage:typecheck
pnpm run garage:test
pnpm run garage:build
```

The API tests run real Postgres queries in an isolated in-memory PGlite instance. The browser
check expects the five sample listings and a running local preview. It only accepts localhost,
submits a synthetic request, uploads a photo, creates a test listing, then reserves that listing:

```sh
pnpm run garage:test:browser
```

The Vercel adapter, database credentials, Blob integration, custom domain, and delivery on the
live domain must also be verified after deployment.
