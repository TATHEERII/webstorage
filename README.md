# Cloudflare Storage Website

A fully serverless storage website hosted on Cloudflare with authentication, private/shared file storage, and admin user management.

## Features

- User authentication (register/login)
- Private file storage per user
- Shared file storage (share files with other users)
- Admin panel to create and delete users
- All hosted on Cloudflare (Workers + KV + R2)

## Setup

1. Install Wrangler:
   ```bash
   npm install -g wrangler
   ```

2. Create KV namespace:
   ```bash
   wrangler kv namespace create STORAGE
   wrangler kv namespace create STORAGE --preview
   ```

3. Create R2 bucket:
   ```bash
   wrangler r2 bucket create storage-files
   ```

4. Update `wrangler.toml` with the KV namespace IDs and R2 bucket name.

5. Set admin emails:
   ```bash
   wrangler secret put ADMIN_EMAILS
   ```

6. Deploy:
   ```bash
   wrangler deploy
   ```

## Environment Variables

- `ADMIN_EMAILS`: Comma-separated list of admin email addresses. Users with these emails get admin role on registration.
