

## Plan: RAG-Based Smart Recommendation System

### Summary
Upgrade the chatbot to use stored knowledge base data (from `research_data` and `scraped_data`) as a RAG source, enabling contextual product/service recommendations with rich UI cards (images, prices, descriptions, action buttons) that adapt per industry.

---

### 1. Edge Function: `chatbot-conversation/index.ts` — RAG Context Injection

**Before calling the LLM**, fetch relevant knowledge base data and inject it into the system prompt:

- Query `scraped_data` table by the chatbot's `website_url` to get cached structured data
- Extract products/menu items/services from `research_data` (already on the chatbot record) and `scraped_data.structured_data`
- Build a **knowledge base context block** with all items (name, price, description, image_url, category) and inject into the system prompt
- Add new LLM instructions for **recommendation behavior**:
  - When user asks about products/food/services, search the KB and recommend top matches
  - Return recommendations using a new structured format: `<!--recommendations:[{...}]-->`
  - Each recommendation includes: `name`, `price`, `description`, `image_url`, `category`, `actions[]`
  - Industry-aware: e-commerce shows "Buy Now" / "Add to Cart"; restaurant shows "Order" / "View Full Menu"; services show "Book Now"

**New system prompt additions:**
```
## SMART RECOMMENDATIONS
When the user asks about products, menu items, or services, search the knowledge base below and recommend the most relevant items.

Format recommendations as:
<!--recommendations:[{"name":"...","price":"...","description":"...","image_url":"...","category":"...","actions":[{"label":"Order","value":"I want to order ..."}]}]-->

Rules:
- Show 2-4 most relevant items
- Include images when available
- Personalize based on user preferences mentioned in conversation
- For restaurants: suggest combos, popular items, dietary options
- For e-commerce: suggest related products, bestsellers
- For services: suggest relevant packages, popular bookings
```

### 2. Frontend: `ChatMessage.tsx` — Parse & Render Recommendation Cards

Add a new parser alongside `parseActions` to detect `<!--recommendations:[...]-->` blocks and render them as rich product/service cards.

**Card UI per item:**
- Image (if available, with fallback)
- Name + price badge
- Short description (1-2 lines)
- Action buttons (industry-specific: "Order", "Buy Now", "Book", etc.)

Cards displayed in a horizontal scrollable row or 2-column grid below the message text.

### 3. Frontend: New Component `RecommendationCards.tsx`

Renders an array of recommendation items as visually rich cards:
- Responsive: 2-col grid on desktop, scrollable row on mobile
- Each card: rounded, shadowed, with image, title, price, description, action buttons
- Action buttons trigger the same `onAction` handler (sends value as user message)

### 4. Edge Function: Knowledge Base Preparation

In `buildSystemPrompt`, structure the KB data clearly:
- Group items by category
- Include all available fields (name, price, description, image URL)
- Limit to ~50 items to stay within context window
- Add "popular" or "featured" flags if available from scraped data

---

### Files Summary

| File | Change |
|------|--------|
| `supabase/functions/chatbot-conversation/index.ts` | Edit — fetch scraped_data, build KB context, add recommendation instructions to system prompt |
| `src/components/chatbot/ChatMessage.tsx` | Edit — parse `<!--recommendations:-->` blocks, render RecommendationCards |
| `src/components/chatbot/RecommendationCards.tsx` | Create — rich product/service card grid component |
| `src/components/chatbot/ActionButtons.tsx` | No change (reused for card actions) |

