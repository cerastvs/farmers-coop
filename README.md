# Farmers Cooperative

## Local setup

Install dependencies, start PostgreSQL on port `5434`, apply the database
migrations, and seed the development data:

```bash
npm install
cp .env.example .env
npm run db:start
npm run db:migrate
npm run db:seed
```

Generate a session signing key with `openssl rand -base64 32` and use its
output as `SESSION_SECRET` in `.env` before starting the app.

Then start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The local database connection is:

```text
postgresql://farmers_coop:farmers_coop@localhost:5434/farmers_coop
```

Stop the database without deleting its data with:

```bash
npm run db:stop
```

## Development accounts

All seeded accounts use the password `password123`.

| Role | Username |
| --- | --- |
| Member | `member1` |
| President | `president1` |
| Treasurer | `treasurer1` |
| Secretary | `secretary1` |
| Applicant | `applicant1` |

## Implemented workflows

- Membership application review, approval, rejection, notifications, and member
  record management
- Cash-loan requests, officer review, status history, and payment verification
- Farm-supply requests, inventory management, review, and completion
- Machinery reservation, approval, in-use, overdue, return, and cancellation
- In-app notifications, audit entries, activity logs, reports, and posts

SMS delivery and ImgBB credentials are intentionally deferred. In-app
notifications are used for workflow outcomes in the meantime.
