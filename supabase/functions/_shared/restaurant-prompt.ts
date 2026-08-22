/**
 * Restaurant agent template.
 *
 * Restaurants differ a lot: some take table reservations only, some take
 * takeout/delivery orders only, some do both, some do neither (info line).
 * We infer those capabilities from the scraped website and only load the
 * matching prompt sections and the matching real tools.
 *
 * Everything here is overridable from the admin Templates panel via the
 * `industry_templates` row with industry_name = 'restaurant'.
 */

export type RestaurantCapabilities = {
  reservations: boolean;
  orders: boolean;
  pickup: boolean;
  delivery: boolean;
  catering: boolean;
  waitlist: boolean;
  /** third-party links found on the site (OpenTable, DoorDash, ...) */
  reservation_platform: string | null;
  ordering_platform: string | null;
  /** why we decided the above — shown in the admin panel / logs */
  evidence: string[];
};

const RES_SIGNALS = [
  "reservation", "reserve a table", "book a table", "opentable", "resy", "sevenrooms",
  "tock", "table booking", "private dining", "book now", "quandoo", "yelp reservations",
];
const ORDER_SIGNALS = [
  "order online", "order now", "online ordering", "add to cart", "doordash", "ubereats",
  "uber eats", "grubhub", "postmates", "seamless", "slice", "toast", "chownow", "deliveroo",
  "just eat", "takeaway", "take-out", "takeout", "carryout", "curbside",
];
const DELIVERY_SIGNALS = ["delivery", "we deliver", "free delivery", "delivery fee", "deliver to your door"];
const PICKUP_SIGNALS = ["pickup", "pick up", "carryout", "curbside", "collection", "take away", "takeaway"];
const CATERING_SIGNALS = ["catering", "cater your event", "event menu", "party trays", "buffet package"];
const WAITLIST_SIGNALS = ["waitlist", "wait list", "first come first served", "walk-ins", "walk ins", "no reservations"];
const NO_RES_SIGNALS = ["we do not take reservations", "no reservations", "walk-ins only", "walk ins only"];
const NO_ORDER_SIGNALS = ["dine-in only", "dine in only", "we do not offer delivery", "no takeout", "no take-out"];

const PLATFORMS: Record<string, string> = {
  opentable: "OpenTable", resy: "Resy", sevenrooms: "SevenRooms", tock: "Tock", quandoo: "Quandoo",
  doordash: "DoorDash", ubereats: "Uber Eats", "uber eats": "Uber Eats", grubhub: "Grubhub",
  slice: "Slice", toast: "Toast", chownow: "ChowNow", deliveroo: "Deliveroo", "just eat": "Just Eat",
};

const RESTAURANT_KEYWORDS = [
  "restaurant", "food", "cafe", "café", "coffee shop", "pizza", "pizzeria", "bakery", "diner",
  "grill", "bistro", "eatery", "sushi", "burger", "taco", "ramen", "steakhouse", "brewery",
  "bar and grill", "catering", "deli", "kitchen", "trattoria", "buffet", "juice bar",
];

export function isRestaurantIndustry(industry?: string | null): boolean {
  const li = (industry || "").toLowerCase();
  if (!li) return false;
  return RESTAURANT_KEYWORDS.some((k) => li.includes(k));
}

function count(hay: string, needles: string[]): { hits: number; found: string[] } {
  const found: string[] = [];
  let hits = 0;
  for (const n of needles) {
    if (hay.includes(n)) { hits++; found.push(n); }
  }
  return { hits, found };
}

/**
 * Infer what this specific restaurant actually does, from the scraped page
 * content + structured data. Admin overrides always win over inference.
 */
export function detectRestaurantCapabilities(input: {
  content?: string | null;
  structured?: any;
  overrides?: Partial<RestaurantCapabilities> | null;
}): RestaurantCapabilities {
  const structuredText = (() => {
    try { return JSON.stringify(input.structured || {}); } catch { return ""; }
  })();
  const hay = `${input.content || ""}\n${structuredText}`.toLowerCase();
  const evidence: string[] = [];

  const res = count(hay, RES_SIGNALS);
  const ord = count(hay, ORDER_SIGNALS);
  const del = count(hay, DELIVERY_SIGNALS);
  const pick = count(hay, PICKUP_SIGNALS);
  const cat = count(hay, CATERING_SIGNALS);
  const wait = count(hay, WAITLIST_SIGNALS);
  const noRes = count(hay, NO_RES_SIGNALS);
  const noOrd = count(hay, NO_ORDER_SIGNALS);

  let reservations = res.hits > 0 && noRes.hits === 0;
  let orders = ord.hits > 0 && noOrd.hits === 0;

  if (res.found.length) evidence.push(`reservation signals: ${res.found.slice(0, 4).join(", ")}`);
  if (ord.found.length) evidence.push(`ordering signals: ${ord.found.slice(0, 4).join(", ")}`);
  if (noRes.found.length) evidence.push(`explicitly no reservations: ${noRes.found[0]}`);
  if (noOrd.found.length) evidence.push(`explicitly dine-in only: ${noOrd.found[0]}`);

  // A site with a real menu but no signals at all: assume phone reservations
  // (safest universal behaviour) and no ordering.
  const hasMenu = Array.isArray(input.structured?.menu_items) && input.structured.menu_items.length > 0;
  if (!reservations && !orders) {
    reservations = noRes.hits === 0;
    evidence.push(hasMenu
      ? "no explicit signals — defaulting to reservations + info only"
      : "no menu or signals found — info-only agent");
  }

  const platform = (found: string[]) => {
    for (const f of found) {
      for (const [k, label] of Object.entries(PLATFORMS)) {
        if (f.includes(k)) return label;
      }
    }
    return null;
  };

  // Explicit denials beat keyword presence: a page saying "no delivery" still
  // contains the word "delivery", so check for the negated forms directly.
  const denies = (words: string[]) =>
    words.some((w) => new RegExp(`\\b(no|not|never|don'?t|do not|we don'?t)\\b[^.\\n]{0,24}\\b${w}\\b`).test(hay))
    || words.some((w) => new RegExp(`\\b${w}\\b[^.\\n]{0,12}\\b(not available|unavailable)\\b`).test(hay));

  const noDelivery = denies(["delivery", "deliver", "delivering"]) || /\bpick[\s-]?up only\b|\btakeaway only\b/.test(hay);
  const noPickup = denies(["pickup", "pick up", "takeout", "take-?out", "takeaway"]) || /\bdelivery only\b/.test(hay);
  const noCatering = denies(["catering", "cater"]);

  if (noDelivery && del.hits > 0) evidence.push("delivery mentioned but explicitly declined");
  if (noPickup && pick.hits > 0) evidence.push("pickup mentioned but explicitly declined");

  const base: RestaurantCapabilities = {
    reservations,
    orders,
    pickup: orders && !noPickup && (pick.hits > 0 || ord.hits > 0),
    delivery: orders && !noDelivery && del.hits > 0,
    catering: cat.hits > 0 && !noCatering,
    waitlist: wait.hits > 0,
    reservation_platform: platform(res.found),
    ordering_platform: platform(ord.found),
    evidence,
  };

  return { ...base, ...(input.overrides || {}) } as RestaurantCapabilities;
}

export function capabilityLabel(caps: RestaurantCapabilities): string {
  if (caps.reservations && caps.orders) return "reservations + orders";
  if (caps.reservations) return "reservations only";
  if (caps.orders) return "orders only";
  return "information only";
}

// ── Prompt assembly ────────────────────────────────────────────────────────

export type RestaurantPromptInput = {
  agentName: string;
  businessName: string;
  caps: RestaurantCapabilities;
  knowledgeBase?: string | null;
  structured?: any;
  chatbotId?: string | null;
  channel?: "voice" | "chat";
  /** industry_templates.system_prompt_template — when set it replaces the base block */
  templateOverride?: string | null;
  /** free-text notes from the industry matcher / admin */
  adaptationNotes?: string | null;
  knowledgeBaseAttached?: boolean;
};

export function menuSection(structured: any): string {
  const menu = structured?.menu_items || [];
  if (!Array.isArray(menu) || menu.length === 0) return "";
  const byCategory: Record<string, any[]> = {};
  for (const item of menu) {
    const cat = item?.category || "Other";
    (byCategory[cat] ||= []).push(item);
  }
  return Object.entries(byCategory)
    .map(([cat, items]) =>
      `### ${cat}\n${(items as any[])
        .map((i) => `- ${i.name}${i.price ? ` — ${i.price}` : ""}${i.description ? `: ${i.description}` : ""}`)
        .join("\n")}`)
    .join("\n\n");
}

const BASE_BLOCK = `[IDENTITY]
You are {agent_name}, a real team member at {business_name}.
You know the menu, the hours and how the place runs. You are warm, quick and easy to talk to.
You are NOT an AI, a bot or a virtual assistant. Never say the words "AI", "assistant", "system", "tool", "function" or "API".

[STYLE]
- One to three short sentences per reply. Never lecture.
- Always use contractions. Natural acknowledgements: "Sure thing", "Gotcha", "Of course", "Let me check that".
- Say prices naturally: "twelve ninety-nine", not "$12.99".
- Ask ONE question at a time and never re-ask something already answered.
- Never read long lists out loud — describe two or three options conversationally.

[WHAT THIS RESTAURANT ACTUALLY DOES]
{capability_line}
Never offer a service that is not listed above. If a caller asks for something we don't do, say so warmly and offer the closest thing we do offer.

[MENU QUESTIONS]
- Answer from the menu and knowledge below only. Never invent a dish, price, ingredient or allergen answer.
- "What's good?" → name two or three popular items with a short appetising description.
- Allergy or dietary questions → answer only what is documented; otherwise take a note for the team.`;

const RESERVATION_BLOCK = `
[TASK: TABLE RESERVATIONS]
Step 1: "Sure — what day were you thinking?" <wait>
Step 2: "And what time works best?" <wait>
Step 3: "How many people will it be?" <wait>
Step 4: Call check_reservation_availability with the date, time and party size.
   - Offer ONLY the times it returns. Never invent or promise a time it did not return.
   - If it returns nothing, offer the nearest options it suggests or take a note for the team.
Step 5: Collect the name, then the phone number, then an email if they'd like a confirmation.
Step 6: Read the whole reservation back once: name, party size, day and time.
Step 7: Only after the caller says yes, call book_reservation with the exact slot returned earlier.
Step 8: Confirm only what the tool actually confirmed. If it fails, say the team will call to finalise and take a note.`;

const NO_RESERVATION_BLOCK = `
[TASK: SEATING — NO RESERVATIONS]
We don't take reservations. If a caller asks to book a table, say warmly that we're first-come, first-served and give the best times to walk in.
For large parties or private events, take their name, phone, date, party size and details, then use send_office_note so the team can call back.`;

const ORDER_BLOCK = `
[TASK: TAKING ORDERS]
Step 1: "What can I get started for you?" <wait>
Step 2: Suggest two or three matching items with prices spoken naturally. <wait>
Step 3: "Want to add a side or a drink with that?" <wait>
Step 4: "Any allergies or changes — no onions, extra sauce, anything like that?" <wait>
Step 5: {fulfilment_question} <wait>
Step 6: Read the order back with the item names and the approximate total, then ask "Sound right?" <wait>
Step 7: Collect the name and phone number (plus the delivery address when it's delivery).
Step 8: Call place_order with the full item list. Confirm only what the tool confirms.
Step 9: Give the pickup or delivery timing exactly as the tool returned it, and never promise a time it did not give.`;

const NO_ORDER_BLOCK = `
[TASK: ORDERS — NOT OFFERED]
We don't take phone orders{ordering_hint}. If someone asks to order, say so kindly and point them to what we do offer (dining in{reservation_hint}).
Never take card or payment details.`;

const CATERING_BLOCK = `
[TASK: CATERING & LARGE EVENTS]
Collect the event date, guest count, type of event, budget range if offered, name, phone and email, then use send_office_note so the events team can follow up. Never quote a catering price.`;

const COMMON_TAIL = `
[ESCALATION]
Use send_office_note for complaints, lost items, refunds, existing bookings you cannot find, press or supplier calls, and anything you're not certain about. Collect a name and a callback number first.

[TRUTH RULES]
- Never confirm a reservation, an order or a message unless the tool returned success.
- Never quote prices that are not in the menu or knowledge below.
- Never give allergen guarantees. Say: "Let me have the kitchen confirm that for you."
- Never take payment details of any kind.
- If you don't know something: "Let me check on that and have someone get right back to you."

[ERROR HANDLING]
- Missed it: "Sorry, could you say that one more time?"
- Not on the menu: "Hmm, we don't have that — but we do have {closest thing}. Want to try that?"
- Noisy line or silence: check in once, then politely wrap up.`;

const CHAT_OVERRIDE = `
[CHANNEL OVERRIDE — WEB CHAT]
You are chatting on the website, not on a call. Everything above still applies with these changes:
- Open with: "Hi! Thanks for stopping by {business_name}. What can I help you with?"
- Keep replies to one to three short sentences, short line breaks are fine, no markdown headings.
- Write prices and times normally.
- There is no call transfer. Take a note with send_office_note instead.
- Confirm an email address back in writing once before booking anything.`;

export function buildRestaurantPrompt(input: RestaurantPromptInput): string {
  const caps = input.caps;
  const fulfilment = caps.delivery && caps.pickup
    ? `"Is that for pickup or delivery?"`
    : caps.delivery
      ? `"That'll be for delivery — what's the address?"`
      : `"That'll be ready for pickup — when would you like to grab it?"`;

  const capabilityLine = [
    caps.reservations ? "- We take table reservations." : "- We do NOT take reservations (first come, first served).",
    caps.orders
      ? `- We take orders${caps.pickup ? " for pickup" : ""}${caps.delivery ? (caps.pickup ? " and delivery" : " for delivery") : ""}.`
      : "- We do NOT take phone or online orders — dine-in only.",
    caps.catering ? "- We do catering and private events." : "",
    caps.waitlist ? "- We keep a walk-in waitlist on busy nights." : "",
    caps.reservation_platform ? `- Online reservations also go through ${caps.reservation_platform}.` : "",
    caps.ordering_platform ? `- Online ordering also goes through ${caps.ordering_platform}.` : "",
  ].filter(Boolean).join("\n");

  let body = (input.templateOverride && input.templateOverride.trim())
    ? input.templateOverride
    : [
      BASE_BLOCK,
      caps.reservations ? RESERVATION_BLOCK : NO_RESERVATION_BLOCK,
      caps.orders ? ORDER_BLOCK : NO_ORDER_BLOCK,
      caps.catering ? CATERING_BLOCK : "",
      COMMON_TAIL,
      input.channel === "chat" ? CHAT_OVERRIDE : "",
    ].filter(Boolean).join("\n");

  const vars: Record<string, string> = {
    agent_name: input.agentName,
    business_name: input.businessName,
    capability_line: capabilityLine,
    fulfilment_question: fulfilment,
    ordering_hint: caps.ordering_platform ? ` — online ordering is on ${caps.ordering_platform}` : "",
    reservation_hint: caps.reservations ? " or booking a table" : "",
    industry: "restaurant",
    main_service: caps.orders ? "food orders" : "dining",
  };
  body = body.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m));

  const parts = [body];

  const hours = input.structured?.business_hours;
  const address = input.structured?.address;
  const phone = input.structured?.phone;
  const facts = [
    hours ? `Hours: ${typeof hours === "string" ? hours : JSON.stringify(hours)}` : "",
    address ? `Address: ${address}` : "",
    phone ? `Phone: ${phone}` : "",
  ].filter(Boolean);
  if (facts.length) parts.push(`\n[CORE FACTS]\n${facts.join("\n")}`);

  if (input.adaptationNotes) parts.push(`\n[THIS RESTAURANT SPECIFICALLY]\n${input.adaptationNotes}`);

  const menu = menuSection(input.structured);
  if (menu) parts.push(`\n[MENU]\n${menu}`);

  if (input.knowledgeBase && !input.knowledgeBaseAttached) {
    parts.push(`\n[KNOWLEDGE BASE]\n${input.knowledgeBase}`);
  }
  if (input.knowledgeBaseAttached) {
    parts.push(`\n[KNOWLEDGE FILES]
The full menu and policy documents are attached to you as searchable files. Use them for detailed questions before saying you don't know. Never mention the files to the caller.`);
  }
  if (input.chatbotId) {
    parts.push(`\n[KNOWLEDGE LOOKUP]
Use search_knowledge_base(query) only for details not covered above. Speak only from what it returns; if it returns nothing useful, say "Let me check on that for you."
Knowledge scope id: ${input.chatbotId}`);
  }
  return parts.join("\n");
}

// ── Tools, gated by capability ─────────────────────────────────────────────

export function restaurantAgentTools(caps: RestaurantCapabilities): any[] {
  const fn = (name: string) => `${Deno.env.get("SUPABASE_URL")}/functions/v1/${name}`;
  const tools: any[] = [];

  if (caps.reservations) {
    tools.push({
      type: "function",
      async: false,
      function: {
        name: "check_reservation_availability",
        description:
          "The only authority for which table times exist. Call before offering any reservation time. Never invent availability.",
        parameters: {
          type: "object",
          properties: {
            party_size: { type: "number", description: "Number of guests" },
            requested_date: { type: "string", description: "YYYY-MM-DD" },
            requested_time: { type: "string", description: "Time the guest asked for, e.g. 7:30 PM" },
            seating_preference: { type: "string", description: "indoor, outdoor, bar, booth — optional" },
            occasion: { type: "string", description: "birthday, anniversary — optional" },
          },
          required: ["party_size", "requested_date"],
        },
      },
      server: { url: fn("vapi-check-reservation") },
    });
    tools.push({
      type: "function",
      async: false,
      function: {
        name: "book_reservation",
        description:
          "Books the table on the real restaurant calendar and emails the confirmation. Only call with a slot returned by check_reservation_availability, after reading it back to the guest.",
        parameters: {
          type: "object",
          properties: {
            first_name: { type: "string" },
            last_name: { type: "string" },
            phone: { type: "string" },
            email: { type: "string" },
            party_size: { type: "number" },
            start_iso: { type: "string", description: "start_iso exactly as returned by check_reservation_availability" },
            end_iso: { type: "string" },
            slot_label: { type: "string" },
            seating_preference: { type: "string" },
            special_requests: { type: "string", description: "Allergies, occasion, high chair, accessibility" },
          },
          required: ["first_name", "phone", "party_size", "start_iso"],
        },
      },
      server: { url: fn("vapi-book-reservation") },
    });
  }

  if (caps.orders) {
    tools.push({
      type: "function",
      async: false,
      function: {
        name: "place_order",
        description:
          "Sends the finished food order to the kitchen and emails the confirmation. Only call after reading the full order back and the customer confirming.",
        parameters: {
          type: "object",
          properties: {
            first_name: { type: "string" },
            phone: { type: "string" },
            email: { type: "string" },
            fulfilment: { type: "string", enum: ["pickup", "delivery"] },
            delivery_address: { type: "string", description: "Required for delivery" },
            requested_time: { type: "string", description: "When they want it, or 'as soon as possible'" },
            items: {
              type: "array",
              description: "Every item the customer ordered",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  quantity: { type: "number" },
                  price: { type: "string" },
                  notes: { type: "string", description: "Modifications, allergies" },
                },
                required: ["name"],
              },
            },
            order_notes: { type: "string" },
          },
          required: ["phone", "fulfilment", "items"],
        },
      },
      server: { url: fn("vapi-take-order") },
    });
  }

  // Always available: office note for anything the agent can't resolve.
  tools.push({
    type: "function",
    async: false,
    function: {
      name: "send_office_note",
      description:
        "Sends a real note to the restaurant team for anything you cannot resolve: complaints, large parties, catering, lost items, existing bookings, press or supplier calls.",
      parameters: {
        type: "object",
        properties: {
          first_name: { type: "string" },
          last_name: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
          project_detail: { type: "string", description: "What the guest wants" },
          reason: { type: "string", description: "Why the team needs to handle this" },
          next_step: { type: "string" },
        },
        required: ["reason"],
      },
    },
    server: { url: fn("vapi-send-office-note") },
  });

  return tools;
}
