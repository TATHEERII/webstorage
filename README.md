# Cloudflare Storage Website

A fully serverless storage website hosted on Cloudflare Pages with authentication, private/shared file storage, and admin user management.

## Features

- User authentication (register/login)
- Private file storage per user
- Shared file storage (share files with other users)
- Admin panel to create and delete users
- All hosted on Cloudflare Pages + Pages Functions + KV + R2

## Project Structure

```
├── functions/
│   ├── api/[[path]].js   # Pages Functions API routes
│   └── utils.js          # Auth and utility helpers
├── public/
│   └── index.html        # Frontend SPA
├── package.json
└── README.md
```

## Setup

1. Connect this repository to Cloudflare Pages in the dashboard.

2. Configure KV and R2 bindings in Pages:
   - Go to **Settings > Functions > Bindings**
   - Add KV namespace binding: `STORAGE`
   - Add R2 bucket binding: `FILES`

3. Set environment variable:
   - Go to **Settings > Environment variables**
   - Add `ADMIN_EMAILS` with comma-separated admin emails

4. Deploy - Pages automatically detects the `functions/` and `public/` directories.

## Local Development

```bash
npm install
npm run dev
```
