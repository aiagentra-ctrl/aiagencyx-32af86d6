## Goal

A brand-new, standalone real-estate landing page template — not a variation of the existing demo layout. It follows the exact 6-section structure you specified, auto-populates from scraped company data, and is built to a premium SaaS visual standard.

## Structure (exactly as specified, no changes)

1. **Hero** — Nav (`{{Logo}} {{CompanyName}} | Try Demo | Book Call`), headline "{{FirstName}}, Your Leads Won't Wait — Will {{CompanyName}}?", subheadline, two buttons (📞 Talk to It Now = primary/heavy, 💬 Chat With It Now = secondary), micro-line "No sign-up. No script. Just try it.", phone mockup with "Incoming call from {{CompanyName}}" + a realistic buyer chat bubble.
2. **Demo** — 🎙 Live Demo badge, personalized headline/subhead, Voice card + Chatbot card (stack full-width on mobile, voice card first).
3. **The Reveal** — "We Didn't Just Build You a Chatbot, {{FirstName}}", dashboard preview image with caption "Already built for {{CompanyName}}. Already running.", 3 spaced flow points (⚡ / 📅 / 📊), closing line, Book a Call button.
4. **Client Proof** — headline + subhead + the YouTube embed (`eOAyie0kWGQ`), responsive 16:9 wrapper.
5. **Book a Call** — final CTA, Calendly button, subtitle, risk-reversal line.
6. **Footer** — "Let's Work Together, {{FirstName}}", subhead, Book a Call button, logo/company/contact/year/Privacy/Terms.

Every Book a Call button → `https://calendly.com/aiagentra/new-meeting` (overridable per-page by the stored calendar URL, falling back to that link).

## Design direction (distinct from existing templates)

- **Light premium** editorial layout — near-white canvas, deep ink text, one disciplined brand accent pulled from the scraped logo colors (existing `brandColors` util). Accent used only on CTAs and the "Already built. Already running." caption. Deliberately different from the dark starfield e-commerce page and the current blue demo page.
- **Typography**: two families only — a confident bold display face for headlines, a clean body face. Large size/weight contrast carries hierarchy, not color.
- **Spacing**: generous section rhythm (tighter on mobile, expansive on desktop); Reveal section gets the most breathing room.
- **Motion budget, one signature moment**: the Reveal dashboard fades + scales in on scroll, timed with its headline. Elsewhere: subtle hero phone "incoming call" pulse, gentle scroll-reveals on section headers, restrained hover lifts on the two demo cards and CTAs. Respects `prefers-reduced-motion`.
- **Mobile-first**: single-column stacking, demo cards full-width with buttons above the fold, nav stays at two actions only.

## Dynamic data

Populated from the existing demo page record + linked chatbot research data:

- `{{CompanyName}}` — company/business name
- `{{FirstName}}` — contact first name from the page record, with a graceful fallback that rewrites headlines to work without a name (no empty commas)
- `{{Logo}}` — scraped logo, initials fallback
- Brand accent color derived from logo/brand color
- Contact email/phone, calendar URL, and any scraped tagline/location used where they strengthen copy

All strings run through the existing `renderTemplate` variable substitution so admin-editable copy keeps working.

## Technical plan

- New folder `src/components/demo/realestate/v2/` with one file per section (`REHero`, `REDemo`, `REReveal`, `REProof`, `REBookCall`, `REFooter`) plus a `RealEstateLandingPage.tsx` composer — self-contained, no reuse of the existing demo sections.
- `DemoPage.tsx`: add an early return for `isRealEstate` that renders the new page (same pattern as the e-commerce branch), passing company data, logo, brand color, VAPI key/assistant, calendar URL, and chat open handler. Existing `PropertyShowcaseSection` / `RealEstateValueSection` path is left in place but no longer used by that branch.
- Voice call + chatbot wire into the existing VAPI start/end handlers and the chat widget already used on the demo page — the demo buttons are live, not decorative.
- All colors go through semantic tokens; new tokens for this template added to the design system rather than hardcoded.
- Section-level scroll/click tracking kept via the existing tracking helpers.

## One open item

The Reveal section needs the dashboard screenshot you mentioned — it wasn't attached to this thread. I'll build the section with a polished placeholder frame (browser-chrome container, partial blur/fade at the edges) and drop your real screenshot in as soon as you upload it here.<a href="[https://ibb.co/v4tDH87m"><img](https://ibb.co/v4tDH87m"><img) src="[https://i.ibb.co/3mJk7HDW/Whats-App-Image-2026-07-27-at-12-38-35-AM.jpg](https://i.ibb.co/3mJk7HDW/Whats-App-Image-2026-07-27-at-12-38-35-AM.jpg)" alt="Whats-App-Image-2026-07-27-at-12-38-35-AM" border="0"></a>  image 

here is screeshot image use this imadashboard screenshot use this propely in ui her it is ge <a href="[https://ibb.co/v4tDH87m"><img](https://ibb.co/v4tDH87m"><img) src="[https://i.ibb.co/v4tDH87m/Whats-App-Image-2026-07-27-at-12-38-35-AM.jpg](https://i.ibb.co/v4tDH87m/Whats-App-Image-2026-07-27-at-12-38-35-AM.jpg)" alt="Whats-App-Image-2026-07-27-at-12-38-35-AM" border="0"></a>           Final QA & Testing

After everything is built, I need you to thoroughly test the entire project from start to finish.

Please verify:

- Every UI component
- Every animation and transition
- Responsive design on all screen sizes
- Every button, form, and link
- Navigation and scrolling
- Data loading and personalization
- Performance and loading speed
- Cross-browser compatibility
- Overall user experience and visual consistency

Fix any UI, UX, responsiveness, animation, or functionality issues before considering the project complete.

Finally, create a complete end-to-end demo showing the entire user journey so we can review the finished experience. The final product should be production-ready with no unfinished sections or placeholder content.