## Plan: Dental Clinic Industry Template — Dynamic Personalization Sections

### Summary

Build a dedicated dental clinic template with 5 new/upgraded website sections (Problem, Outcome, Solution, ROI Calculator, Why Every Clinic) that match the reference images. Store the dental template content in `industry_templates` so voice agent, chatbot, and website all pull from the same source. The existing generic sections remain untouched — dental-specific rendering activates when `industry` matches dental/clinic/healthcare.

---

### 1. Database: Seed Dental Industry Template

Create a migration that inserts a comprehensive `industry_templates` row for `dental` with:

- `system_prompt_template`: Dental-specific voice prompt (appointment booking flow, services, patient recall)
- `hero_subtitle_template`: "We built a live AI receptionist for {business_name} — it books appointments, answers patient questions, and never misses a call."
- `first_message_template`: Dental-friendly greeting
- `chatbot_nav_items`: Book Appointment, Our Services, Location & Hours, Insurance Info
- `floating_bubbles`: Dental-specific ("Book a cleaning for next week", "Do you accept my insurance?")
- New JSONB fields in the template: `outcome_benefits`, `solution_features`, `roi_defaults`, `why_clinic_scenarios` (stored inside existing flexible JSONB or as part of `problem_statements` extended structure)

---

### 2. New Component: `DentalProblemSection.tsx`

Matches the "Every Missed Call = Lost Patients = Lost Revenue" reference image:

- 4 pain-point cards with icons (clock, phone-off, users, calendar)
- Each card: icon + text description
- Math block at bottom: "3 missed calls/day x $250 = $750/day → $15,000+/month"
- Red/warm color accents for urgency
- CTA button: "See How Much You Could Be Losing — Book a Free Demo"

---

### 3. New Component: `DentalOutcomeSection.tsx`

Matches "What If Every Call Became a Booked Appointment?" reference:

- Moon emoji + headline
- 6 benefit cards in 3x2 grid with green checkmarks
- Benefits: 24/7 answered, 30% more bookings, 2-3 staff hours saved, 20-50% revenue increase, zero missed opportunities, no empty slots
- CTA: "See How It Works"

---

### 4. New Component: `DentalSolutionSection.tsx`

Matches "Meet Your 24/7 AI Call Agent" reference:

- Robot emoji + headline + subtitle "The Receptionist That Never Sleeps"
- 6 feature cards in 3x2 grid with icons (Phone, Calendar, MessageSquare, Clock, Brain, BarChart)
- Features: 24/7 Call Answering, Instant Booking, Automatic Follow-Ups, No-Show Reduction, Smart Memory, Analytics Dashboard
- CTA: "Watch the AI in Action — Book a Free Demo"

---

### 5. New Component: `DentalROISection.tsx`

Matches the ROI Calculator reference image:

- Interactive sliders: Patient calls/day, Missed calls, Average patient value
- Real-time calculated outputs: Revenue Lost/Month, Appointments Recovered, Monthly Gain with AI
- "AI pays for itself in approximately X days" line
- CTA: "See It in Action — Book a Free Demo"

---

### 6. New Component: `DentalWhyClinicSection.tsx`

Matches "Why Every Clinic Needs a 24/7 AI Receptionist" reference:

- Scenario table with 3 rows (Conservative, Realistic, Busy Clinic)
- Columns: Scenario, Missed Calls, Avg Patient Value, Monthly Revenue Lost, Recovered with AI
- Bottom callout: "Even saving 1 new patient/day = $7,500/month in added revenue"
- Guarantee line: "Recover 30% More Appointments in 30 Days — Or It's Free Forever"

---

### 7. `DemoPage.tsx` — Conditional Dental Layout

Add industry detection logic:

```
const isDental = ["dental", "clinic", "dentist", "healthcare", "medical", "doctor"]
  .some(k => (page.industry || "").toLowerCase().includes(k));
```

When `isDental`:

- Render dental-specific sections instead of generic ProblemSection/OutcomeSection
- Section order: Hero → VoiceAgent → PersonalizationProof → DentalProblem → DentalWhyClinic → DentalROI → DentalOutcome → DentalSolution → CTA → Footer
- Non-dental pages continue using existing generic sections unchanged

---

### 8. `create-demo/index.ts` — Use Dental Template

The existing template engine already handles this — when `industry=dental`, it loads the dental template. Add the dental-specific `dynamic_content` fields (roi_defaults, solution_features, etc.) so frontend can consume them. Also update `buildGenericVoicePrompt`'s dental branch to use a more detailed appointment booking flow.

---

### Files Summary


| File                                             | Change                                                                   |
| ------------------------------------------------ | ------------------------------------------------------------------------ |
| Migration                                        | Seed `industry_templates` row for "dental" with full content             |
| `src/components/demo/DentalProblemSection.tsx`   | **New** — Pain + money section                                           |
| `src/components/demo/DentalOutcomeSection.tsx`   | **New** — Vision + benefits                                              |
| `src/components/demo/DentalSolutionSection.tsx`  | **New** — Product features grid                                          |
| `src/components/demo/DentalROISection.tsx`       | **New** — Interactive ROI calculator                                     |
| `src/components/demo/DentalWhyClinicSection.tsx` | **New** — Scenario comparison table                                      |
| `src/pages/DemoPage.tsx`                         | Edit — conditional dental layout rendering                               |
| `supabase/functions/create-demo/index.ts`        | Minor — ensure dental template populates extended dynamic_content fields |
