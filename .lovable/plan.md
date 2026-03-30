

## Plan: Fix Hardcoded Restaurant Defaults — Make Industry-Dynamic

### Problem
Three components have hardcoded restaurant-specific fallback buttons (View Menu, Reserve Table, etc.) that show for ALL industries when dynamic data is missing.

---

### Changes

#### 1. `src/components/chatbot/ChatWidget.tsx` — Dynamic default nav items

Replace the hardcoded `defaultNavItems` (Menu, Order, Reserve, Location, FAQ) with a function that picks defaults based on an `industry` prop. If industry is "restaurant", keep current items. Otherwise, use universal defaults like "Our Services", "Book Appointment", "Contact Info", "FAQ".

Add `industry?: string` prop, passed from `DemoPage`.

#### 2. `src/components/chatbot/ChatWindow.tsx` — Dynamic default quick actions

Replace the hardcoded `defaultQuickActions` (View Menu, Reserve Table, etc.) with industry-aware defaults. Add `industry?: string` prop. For restaurant → current buttons. For others → "Our Services", "Book Now", "Hours & Location", "Special Offers".

#### 3. `src/components/demo/PersonalizationProofSection.tsx` — Dynamic section label

Already partially handled (`isMenu` check), but the heading "Your Menu (X items)" should say "Your Services" or "Your Products" for non-restaurant businesses. Pass `industry` prop to improve label selection.

#### 4. `src/pages/DemoPage.tsx` — Pass industry to ChatWidget and ChatWindow

Pass `page.industry` to the ChatWidget so it can select the right defaults.

---

### Industry Default Mapping (built into ChatWidget/ChatWindow)

```text
restaurant/cafe/food  → View Menu, Reserve Table, Hours, Today's Offers
dental/medical/clinic → Our Services, Book Appointment, Hours & Location, Insurance Info
salon/spa/beauty      → Our Services, Book Appointment, Pricing, Hours
default/other         → Our Services, Book Now, Contact Info, FAQ
```

### Files Summary

| File | Change |
|------|--------|
| `src/components/chatbot/ChatWidget.tsx` | Add `industry` prop, replace hardcoded `defaultNavItems` with industry-aware function |
| `src/components/chatbot/ChatWindow.tsx` | Add `industry` prop, replace hardcoded `defaultQuickActions` with industry-aware function |
| `src/components/demo/PersonalizationProofSection.tsx` | Add `industry` prop, fix "Your Menu" label for non-restaurant |
| `src/pages/DemoPage.tsx` | Pass `industry` to ChatWidget |

