# AI Demo Deployer

A self-contained system for generating AI voice/chat demo pages for prospects, plus an admin dashboard for leads, inbox, follow-ups and tracking.

Hosting is handled entirely by Lovable — the app is published to a `*.lovable.app` domain (currently https://aiagencyx.lovable.app). There is no external hosting provider and no build/zip/upload step.

## System overview

### 1. Backend API (edge functions)

```
POST https://<project>.supabase.co/functions/v1/create-demo-page
```

Creates a demo page record and returns a live URL. Public, so automation tools (n8n, Zapier) can call it.

Example request:

```json
{
  "assistantId": "8fc61c4d-047d-4285-843c-251cb72d5a01",
  "businessName": "Denat Clinic",
  "description": "AI assistant for Denat Clinic",
  "vapiKey": "d64d76bd-e596-4560-bbb1-94dece3667b6"
}
```

Logic: slugify the business name (`Denat Clinic` → `denat-clinic`), append a random suffix if taken, insert into `demo_pages`, and return:

```json
{
  "url": "https://aiagencyx.lovable.app/demo/denat-clinic",
  "slug": "denat-clinic",
  "assistantId": "8fc61c4d-047d-4285-843c-251cb72d5a01"
}
```

### 2. Dynamic demo pages

Route: `/demo/:slug` — renders the niche-specific landing page (real estate is the default template, customised per niche) with the Vapi voice agent and chat widget wired in.

### 3. Admin dashboard

Route: `/admin` — demo pages, leads, inbox, conversations, follow-ups, tracking, health checks and settings.

## Routing

Client-side routing with React Router. Lovable hosting has built-in SPA fallback, so deep links such as `/demo/some-slug` and page refreshes work without any redirects config file.

## Deploying

Click **Publish** in the Lovable editor (top right).

- Frontend changes go live when you publish an update.
- Backend changes (edge functions, migrations) deploy automatically.

New demo pages do **not** require a deploy: they are database rows served by the existing `/demo/:slug` route the moment they are created.

A custom domain can be connected in Project settings → Domains after the first publish.

## Database

Table `demo_pages`: `id`, `slug` (unique), `assistant_id`, `business_name`, `description`, `vapi_key`, `views`, `created_at`, plus the landing-page personalisation columns.

RLS: public read by slug, writes restricted to the service role / admin functions.

## Development

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

Built with [Lovable](https://lovable.dev). Continue in the [Lovable editor](https://lovable.dev/projects/ba602a26-69d4-4721-b99a-e61b282afdb5).
