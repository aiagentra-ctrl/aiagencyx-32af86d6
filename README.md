# Remix of Remix of  AI Demo Deployer (38)

Project: Deploy Demo Page System Using Netlify API (Zip File Method)

We need to deploy our AI Voice Demo Page System using the Netlify API Zip File deployment method as described here:

https://docs.netlify.com/api-and-cli-guides/api-guides/get-started-with-api/#zip-file-method

The deployment must use my Netlify API token so all demo pages are hosted under my Netlify account.

The deployed app will include:

• Supabase Edge Function API
• Dynamic Vapi demo pages
• Admin dashboard

System Overview

We are building a self-contained demo system with three parts.

1. Supabase Edge Function API

Endpoint:

POST
https://.supabase.co/functions/v1/create-demo-page

Purpose:

Creates a new demo page record and returns a live URL.

2. Dynamic Demo Pages

Route:

/demo/:slug

Example:

https://ourproject.netlify.app/demo/denat-clinic

Each page will automatically load the Vapi voice assistant widget.

The page should display:

• Business name
• Description
• Call-to-action: “Tap to speak with our AI assistant”
• Embedded Vapi voice widget

Widget initialization:

const vapi = new Vapi(vapiKey);
vapi.start({ assistantId });


3. Admin Dashboard

Route:

/admin

Dashboard features:

• List all demo pages
• Show business name
• Show slug
• Show assistant ID
• Show views
• Show created date

Buttons:

• Copy link
• Open page
• Create demo page manually

The admin page should also show the API endpoint for integrations like n8n.

Database Structure

Table: demo_pages

id            uuid (PK)
slug          text (unique)
assistant_id  text
business_name text
description   text
vapi_key      text
views         integer default 0
created_at    timestamptz


RLS Rules:

• Public read by slug
• Authenticated write

Edge Function Logic

Endpoint:

POST /create-demo-page

Example request:

{
  "assistantId": "8fc61c4d-047d-4285-843c-251cb72d5a01",
  "businessName": "Denat Clinic",
  "description": "AI assistant for Denat Clinic",
  "vapiKey": "d64d76bd-e596-4560-bbb1-94dece3667b6"
}


Logic:

Generate slug from businessName

Example:

Denat Clinic → denat-clinic

If slug already exists → append random suffix.

Insert record into demo_pages table.

Return response:

{
 "url": "https://yourapp.netlify.app/demo/denat-clinic",
 "slug": "denat-clinic",
 "assistantId": "8fc61c4d-047d-4285-843c-251cb72d5a01"
}


This API must be public so tools like n8n or automation workflows can call it easily.

Netlify Deployment (Important)

We must deploy the frontend using the Netlify API Zip File Method.

Process:

Build the frontend (React / Next / Vite).

Zip the build folder.

Example:

build.zip


Deploy using Netlify API:

POST
https://api.netlify.com/api/v1/sites/{site_id}/deploys

Headers:

Authorization: Bearer NETLIFY_API_TOKEN
Content-Type: application/zip


Body:

ZIP file containing the compiled site.

This will publish the site automatically.

Netlify Routing Requirements

Because we use dynamic routes, add redirects file.

File:

public/_redirects


Content:

/demo/*   /index.html   200
/admin    /index.html   200
/*        /index.html   200


This ensures React routing works correctly on Netlify.

React Routes

App routes:

/               → redirect to /admin
/admin          → admin dashboard
/demo/:slug     → demo page
*               → not found


Files That Must Exist

supabase/migrations/create_demo_pages.sql

supabase/functions/create-demo-page/index.ts

src/pages/DemoPage.tsx

src/pages/AdminDashboard.tsx

src/pages/Index.tsx

src/App.tsx


Final Goal

The system should work like this:

Automation tool (like n8n) calls the API:

POST /create-demo-page

The system creates a record in Supabase.

A demo page link is generated automatically.

Example:

https://ourproject.netlify.app/demo/denat-clinic

The page loads a Vapi voice assistant instantly for the business.

This allows us to create AI voice demo pages automatically for clients.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://aiagencyx.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ba602a26-69d4-4721-b99a-e61b282afdb5).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
