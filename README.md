This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Supabase development setup

The frontend reads Supabase configuration from the uncommitted `.env.local` file. It shows `LOCAL` or `HOSTED DEVELOPMENT` in the protected administrator UI so the active target is visible.

### Hosted development (approved project)

Each groupmate must obtain the hosted project URL and publishable/anonymous key privately from the authorized project owner. Never commit `.env.local`. Most development tasks need only the public variables; the protected Account Management flow additionally requires the authorized project owner to place the server-only key in their own uncommitted `.env.local`.

```powershell
git clone REPOSITORY_URL
cd GraveNav\web
npm install
copy .env.hosted.example .env.local
notepad .env.local
npm run dev
```

Set `NEXT_PUBLIC_SUPABASE_URL` to the approved hosted project URL, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to its publishable/anonymous key, and `NEXT_PUBLIC_APP_ORIGIN` to the public application origin. During `npm run dev`, GraveNav deliberately uses `http://localhost:3000` even if a production origin is present; a deployed production build uses the configured `NEXT_PUBLIC_APP_ORIGIN`. Restart the frontend after changing environment variables.

For protected Auth Admin account provisioning, place the hosted Supabase Secret key in `.env.local` as `SUPABASE_SECRET_KEY`. The server also accepts the legacy `SUPABASE_SERVICE_ROLE_KEY` name. Do not prefix either variable with `NEXT_PUBLIC_`, do not put either key in browser code, and do not share or commit the value. Restart `npm run dev` after adding it.

For hosted invitation testing while the frontend runs locally, add this exact URL to the hosted Supabase Auth URL Configuration redirect allow list:

```text
http://localhost:3000/auth/callback
```

The protected invitation endpoint sends invited users to that callback with an internal invitation marker. The callback exchanges the code for a session and routes the user to `/auth/set-password`; after the password is saved, the server verifies the linked GraveNav account before routing to the role-aware administrator workspace. The public homepage remains `/` and does not require authentication.

For a later Vercel deployment, set `NEXT_PUBLIC_APP_ORIGIN` to the approved production application origin in that deployment and add its corresponding `/auth/callback` URL separately in hosted Supabase. Never use the production origin for local invitation tests.

Visitors do not need accounts. Administrators and managers need individually approved Supabase Auth accounts linked to active GraveNav `account` records. Do not use one shared password.

### Local Docker fallback

Copy `.env.example` to `.env.local`, then use the local URL and anonymous key printed by `npx supabase status`. Keep the local Supabase stack running before starting the frontend. This fallback is separate from the hosted development project; do not run schema pushes from this frontend task.

The public visitor surfaces query only the approved active public view. Administrator surfaces use authenticated RLS policies, and account provisioning remains a protected server-only operation. Photo uploads stay disabled until the private Storage bucket and signed-URL policies are confirmed.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
