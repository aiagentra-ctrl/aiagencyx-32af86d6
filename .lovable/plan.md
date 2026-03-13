

# AI Voice Demo Page System

## Overview
A system that automatically creates and hosts AI voice demo pages for clients. An API creates demo page records in Supabase, and the frontend renders them dynamically with embedded Vapi voice widgets.

## 1. Supabase Setup (Lovable Cloud)
- Create `demo_pages` table with columns: `id`, `slug`, `assistant_id`, `business_name`, `description`, `vapi_key`, `views`, `created_at`
- RLS: public read access (for demo pages), authenticated write access
- Unique constraint on `slug`

## 2. Edge Function: `create-demo-page`
- **POST** endpoint, public (no JWT required)
- Accepts `assistantId`, `businessName`, `description`, `vapiKey`
- Auto-generates slug from business name (lowercase, hyphenated)
- If slug exists, appends random suffix
- Inserts record into `demo_pages`
- Returns `{ url, slug, assistantId }`
- The URL will point to the Netlify-deployed site

## 3. Edge Function: `deploy-to-netlify`
- Triggered after a demo page is created (called from `create-demo-page`)
- Builds a zip of the latest frontend build artifacts
- Deploys via Netlify API: `POST https://api.netlify.com/api/v1/sites/{site_id}/deploys` with `Content-Type: application/zip`
- Uses stored Netlify API token secret
- Note: Since the app uses dynamic routes (data from Supabase), redeployment is only needed if the frontend code changes — demo pages work without redeployment since they fetch data at runtime

## 4. Demo Page (`/demo/:slug`)
- Centered, single-column layout on a soft slate background
- White elevated card showing business name and description
- Prominent blue CTA: "Tap to speak with our AI assistant"
- Loads Vapi widget using the stored `vapiKey` and `assistantId`
- Increments view count on page load
- Typography: Plus Jakarta Sans for headings, Inter for body
- Smooth fade-in animation for the widget

## 5. Admin Dashboard (`/admin`)
- Full-width layout with clean top navigation
- **API Integration Card** at the top showing the Supabase POST endpoint URL and example payload — always visible, not hidden in settings
- **Data table** listing all demo pages with columns: Business Name, Slug, Assistant ID, Views, Created Date
- **Action buttons** per row: Copy Link (with checkmark feedback), Open Page
- **"Create Demo Page" button** opening a simple single-column modal with fields for business name, description, assistant ID, and Vapi key
- No authentication required

## 6. Routing & Netlify Config
- `/` → redirect to `/admin`
- `/admin` → Admin Dashboard
- `/demo/:slug` → Demo Page
- `*` → Not Found
- `public/_redirects` file for Netlify SPA routing

## 7. Secrets Needed
- **Netlify API Token** — for deploying via Netlify API
- **Netlify Site ID** — target site for deployments

## Design
- Colors: Tech Blue (#2563EB) primary, Slate 50 (#F8FAFC) background, Emerald (#10B981) for status/success
- Fonts: Plus Jakarta Sans (headings), Inter (body/UI)
- Snappy interactions with instant visual feedback

