/**
 * Niche packs — the landing template stays identical for every industry, only the
 * copy, vocabulary, colours, dashboard labels and chatbot text change.
 *
 * Real Estate is the default pack. Adding a new industry = one more object here.
 */

export interface NicheCtx {
  /** Business / company name. */
  company: string;
  /** Possessive form of the company name ("Acme's"). */
  co: string;
  /** Owner first name, when known. */
  firstName?: string;
}

export interface DashStat {
  label: string;
  icon: string;
  value: string;
  tone?: "green" | "amber" | "red";
}

export interface DashGroup {
  label: string;
  live?: boolean;
  stats: DashStat[];
}

export interface FlowNode {
  step: string;
  title: string;
  points: string[];
}

export interface DashActivity {
  icon: string;
  src: string;
  text: string;
  badge: string;
  tone: "green" | "amber" | "red";
}

export interface RevealStep {
  n: number;
  title: string;
  desc: string;
}

export interface NichePack {
  id: string;
  label: string;
  /** Keywords matched against the stored industry string. */
  keywords: string[];
  /** Optional brand-colour overrides (blue accent — CTAs stay orange system-wide). */
  brand?: { brand: string; brandSoft: string; brandRing: string };

  hero: {
    eyebrow: (c: NicheCtx) => string;
    headline: (c: NicheCtx) => { lead: string; highlight: string };
    subhead: (c: NicheCtx) => string;
    voiceCta: (c: NicheCtx) => string;
    chatCta: (c: NicheCtx) => string;
    micro: string;
    phoneIn: string;
    phoneOut: string;
  };

  demo: {
    headline: (c: NicheCtx) => string;
    sub: (c: NicheCtx) => string;
    voiceSub: string;
    chatSub: string;
    voicePrompts: string[];
    chatPrompts: string[];
  };

  reveal: {
    headline: (c: NicheCtx) => string;
    sub: (c: NicheCtx) => string;
    steps: RevealStep[];
  };

  proof: {
    headline: (c: NicheCtx) => string;
    sub: string;
    outcomes: string[];
  };

  cta: {
    headline: (c: NicheCtx) => string;
    body: (c: NicheCtx) => string;
  };

  footer: {
    subtext: string;
  };

  dashboard: {
    title: string;
    agentNav: { icon: string; label: string }[];
    groups: DashGroup[];
    flow: FlowNode[];
    activity: DashActivity[];
  };

  chat: {
    chips: string[];
    heroGreeting: (c: NicheCtx) => string;
    heroTagline: (c: NicheCtx) => string;
    introBlurb: (c: NicheCtx) => string;
    sampleRecent: { label: string; text: string };
    faqs: (c: NicheCtx) => { q: string; a: string }[];
  };
}

/* ── Shared 8-step reveal flow (identical wording across niches) ───────────── */
const REVEAL_STEPS = (nouns: { close: string; reactivate: string }): RevealStep[] => [
  { n: 1, title: "Get Found", desc: "AI SEO — local search optimization" },
  { n: 2, title: "Capture", desc: "Website, Google, calls" },
  { n: 3, title: "Respond", desc: "AI receptionist, 24/7" },
  { n: 4, title: "Book", desc: "Qualified, confirmed, scheduled" },
  { n: 5, title: "Close", desc: nouns.close },
  { n: 6, title: "Get Reviews", desc: "Requested, tracked, protected" },
  { n: 7, title: "Reactivate", desc: nouns.reactivate },
  { n: 8, title: "Track", desc: "Revenue, SEO, and reviews — one dashboard" },
];

/* ── Local business / contractor (the generic default for non-property niches) ── */
const localBusiness: NichePack = {
  id: "local_business",
  label: "Local Business",
  keywords: [
    "contractor", "construction", "fence", "deck", "roofing", "plumb", "hvac", "electric",
    "landscap", "cleaning", "handyman", "painting", "remodel", "local business", "restaurant",
    "garage", "auto repair", "salon", "dentistry", "gym", "pizza", "cafe",
  ],

  hero: {
    eyebrow: (c) => `AI agent for ${c.company}`,
    headline: (c) => ({
      lead: `${c.firstName ? `${c.firstName}, your` : "Your"} customers won’t wait —`,
      highlight: `will ${c.company}?`,
    }),
    subhead: (c) =>
      `Every enquiry answered in seconds, day or night. See ${c.co} agent answer a real question below.`,
    voiceCta: (c) => `Hear ${c.co} Agent`,
    chatCta: (c) => `Try ${c.co} Agent`,
    micro: "No signup. No install. Speak to it in the next ten seconds.",
    phoneIn: "Can someone come out to look at it this week?",
    phoneOut: "Estimate booked for Thursday, 2pm.",
  },

  demo: {
    headline: (c) => `${c.firstName ? `${c.firstName}, this` : "This"} isn’t a pitch. Talk to it yourself.`,
    sub: (c) => `This agent has already read ${c.co} website. Ask it anything a real customer would.`,
    voiceSub: "Answers the phone in one ring",
    chatSub: "Same brain, on your website",
    voicePrompts: [
      "Do you do repairs or just new installs?",
      "How much does a replacement usually run?",
      "Can someone come out for a free estimate?",
      "Do you handle emergency repairs?",
    ],
    chatPrompts: [
      "What services do you offer?",
      "What areas do you cover?",
      "Book me an estimate",
      "How much does a typical job cost?",
    ],
  },

  reveal: {
    headline: (c) =>
      `${c.firstName ? `${c.firstName}, the` : "The"} agent is one part. This is ${c.co} whole system.`,
    sub: () =>
      "Calls, email, WhatsApp, Instagram and customer scoring running in one pipeline — every conversation feeding the same brain.",
    steps: REVEAL_STEPS({ close: "Quote follow-up, automated", reactivate: "Old leads, past customers, back in play" }),
  },

  proof: {
    headline: (c) => `Businesses like ${c.company} are already running this.`,
    sub: "Same setup, same agent, live on their phones and their websites right now.",
    outcomes: [
      "Enquiries answered in under 5 seconds, any hour",
      "Appointments booked while the team is out on the job",
      "Every customer scored and followed up automatically",
    ],
  },

  cta: {
    headline: (c) => `See ${c.co} full system, live.`,
    body: (c) =>
      `${c.firstName ? `${c.firstName}, in` : "In"} 20 minutes we’ll walk through the dashboard above with ${c.co} own jobs and enquiries in it.`,
  },

  footer: {
    subtext:
      "We build AI voice and chat agents for local businesses — answering, qualifying and booking around the clock.",
  },

  dashboard: {
    title: "Growth overview",
    agentNav: [
      { icon: "🤖", label: "Lead Agent" },
      { icon: "📞", label: "Receptionist" },
      { icon: "💰", label: "Quote Follow-Up" },
      { icon: "⭐", label: "Review Agent" },
      { icon: "🔄", label: "Reactivation" },
      { icon: "🔎", label: "Local SEO" },
    ],
    groups: [
      {
        label: "Revenue",
        live: true,
        stats: [
          { label: "Total customers captured", icon: "📥", value: "142" },
          { label: "Calls", icon: "📞", value: "87" },
          { label: "Missed calls recovered", icon: "↩️", value: "23", tone: "green" },
          { label: "Appointments booked", icon: "📅", value: "54" },
          { label: "Quotes sent", icon: "📄", value: "41" },
          { label: "Jobs won", icon: "✅", value: "19", tone: "green" },
          { label: "Estimated revenue", icon: "💵", value: "$86.4k", tone: "green" },
          { label: "Avg. job value", icon: "📊", value: "$4.5k" },
        ],
      },
      {
        label: "AI Activity",
        stats: [
          { label: "Calls handled", icon: "🤖", value: "87" },
          { label: "Customers contacted", icon: "📤", value: "142" },
          { label: "Follow-ups sent", icon: "🔁", value: "218" },
          { label: "Appointments booked", icon: "✅", value: "54", tone: "green" },
        ],
      },
      {
        label: "Local SEO",
        stats: [
          { label: "Ranking trend", icon: "📈", value: "↑ Improving", tone: "amber" },
          { label: "Keywords tracked", icon: "🔎", value: "34" },
          { label: "Organic traffic", icon: "🌐", value: "1,204" },
          { label: "SEO tasks completed", icon: "✅", value: "16", tone: "green" },
        ],
      },
      {
        label: "Reviews",
        stats: [
          { label: "Reviews requested", icon: "⭐", value: "96" },
          { label: "Reviews received", icon: "⭐", value: "41", tone: "green" },
          { label: "Average rating", icon: "🌟", value: "4.8" },
          { label: "Recent reviews", icon: "🕐", value: "7 this wk" },
        ],
      },
    ],
    flow: [
      { step: "GET FOUND", title: "AI SEO", points: ["Local keyword research", "GBP optimization", "Ongoing ranking monitoring"] },
      { step: "CAPTURE", title: "All Channels", points: ["Website forms caught instantly", "Google Business messages routed in", "Every call logged"] },
      { step: "RESPOND", title: "Receptionist", points: ["Answers FAQs instantly", "Collects project details", "Works nights + weekends"] },
      { step: "BOOK", title: "Qualification", points: ["Confirms it's a real job", "Checks calendar automatically", "Sends confirmation"] },
      { step: "CLOSE", title: "Quote Follow-Up", points: ["Tracks pending quotes", "Follows up automatically", "Flags ready-to-close customers"] },
      { step: "REVIEWS", title: "Review Agent", points: ["Sends request after job", "Follows up if no response", "Flags negative feedback early"] },
      { step: "REACTIVATE", title: "Old Enquiries", points: ["Re-engages cold quotes", "Reaches past customers", "Revives lost enquiries"] },
      { step: "TRACK", title: "Dashboard", points: ["Revenue in one view", "AI + SEO + Reviews together", "No switching tools"] },
    ],
    activity: [
      { icon: "🌐", src: "Website", text: "Sarah Johnson — new estimate request", badge: "Hot", tone: "red" },
      { icon: "📱", src: "SMS", text: "Quote follow-up sent — J. Marsh", badge: "Pending", tone: "amber" },
      { icon: "📞", src: "Missed call", text: "Recovered + booked an estimate", badge: "Booked", tone: "green" },
      { icon: "⭐", src: "Review request", text: "5-star review received", badge: "New", tone: "green" },
    ],
  },

  chat: {
    chips: ["🛠 Services", "📅 Book an estimate", "💰 Pricing", "📍 Areas we cover"],
    heroGreeting: (c) => `Hi, I'm ${c.co} AI 👋`,
    heroTagline: () => "Ask me about services, pricing, availability or the areas we cover.",
    introBlurb: (c) =>
      `I've read ${c.co} whole site. Ask me about services, pricing, booking an estimate or the areas we cover.`,
    sampleRecent: { label: "Popular question", text: "Can someone come out this week?" },
    faqs: (c) => [
      { q: "What services do you offer?", a: `Ask the AI and it will list exactly what ${c.company} does, with what's included.` },
      { q: "How much does a typical job cost?", a: `Describe the job and the AI will give ${c.co} usual price range and what changes it.` },
      { q: "Can I book an estimate?", a: "Ask for an estimate and the AI will take your preferred day and time, then confirm it with the team." },
      { q: "Which areas do you cover?", a: `The AI knows every area ${c.company} works in — just ask about your town or postcode.` },
      { q: "Do you handle emergency repairs?", a: "Tell the AI what's happened and it will confirm whether the team can come out urgently." },
    ],
  },
};

/* ── Real estate — the default pack ───────────────────────────────────────── */
const realEstate: NichePack = {
  id: "real_estate",
  label: "Real Estate",
  keywords: ["real estate", "real_estate", "realestate", "property", "properties", "realty", "estate agent", "lettings", "broker"],

  hero: {
    eyebrow: (c) => `AI agent for ${c.company}`,
    headline: (c) => ({
      lead: `${c.firstName ? `${c.firstName}, your` : "Your"} leads won’t wait —`,
      highlight: `will ${c.company}?`,
    }),
    subhead: (c) =>
      `Every enquiry answered in seconds, day or night. See ${c.co} agent answer a real question below.`,
    voiceCta: (c) => `Hear ${c.co} Agent`,
    chatCta: (c) => `Try ${c.co} Agent`,
    micro: "No signup. No install. Speak to it in the next ten seconds.",
    phoneIn: "Is the 3-bed still available?",
    phoneOut: "Viewing booked for Thursday, 4pm.",
  },

  demo: {
    headline: (c) => `${c.firstName ? `${c.firstName}, this` : "This"} isn’t a pitch. Talk to it yourself.`,
    sub: (c) => `This agent has already read ${c.co} website. Ask it anything a real buyer would.`,
    voiceSub: "Answers the phone in one ring",
    chatSub: "Same brain, on your website",
    voicePrompts: [
      "Do you have anything under $600k?",
      "Can I see the townhouse this weekend?",
      "What's the deposit on that listing?",
      "Are you open on Sunday?",
    ],
    chatPrompts: [
      "Send me 3-bed listings",
      "What areas do you cover?",
      "Book me a viewing",
      "How much is my home worth?",
    ],
  },

  reveal: {
    headline: (c) =>
      `${c.firstName ? `${c.firstName}, the` : "The"} agent is one part. This is ${c.co} whole system.`,
    sub: () =>
      "Calls, email, WhatsApp, Instagram and lead scoring running in one pipeline — every conversation feeding the same brain.",
    steps: REVEAL_STEPS({ close: "Offer follow-up, automated", reactivate: "Old leads, past buyers, back in play" }),
  },

  proof: {
    headline: (c) => `Real estate teams like ${c.company} are already running this.`,
    sub: "Same setup, same agent, live on their phones and their websites right now.",
    outcomes: [
      "Enquiries answered in under 5 seconds, any hour",
      "Viewings booked while the team is out on site",
      "Every lead scored and followed up automatically",
    ],
  },

  cta: {
    headline: (c) => `See ${c.co} full system, live.`,
    body: (c) =>
      `${c.firstName ? `${c.firstName}, in` : "In"} 20 minutes we’ll walk through the dashboard above with ${c.co} own listings and enquiries in it.`,
  },

  footer: {
    subtext:
      "We build AI voice and chat agents for real estate teams — answering, qualifying and booking around the clock.",
  },

  dashboard: {
    title: "Growth overview",
    agentNav: [
      { icon: "🤖", label: "Lead Agent" },
      { icon: "📞", label: "Receptionist" },
      { icon: "💰", label: "Offer Follow-Up" },
      { icon: "⭐", label: "Review Agent" },
      { icon: "🔄", label: "Reactivation" },
      { icon: "🔎", label: "Local SEO" },
    ],
    groups: [
      {
        label: "Revenue",
        live: true,
        stats: [
          { label: "Total leads captured", icon: "📥", value: "142" },
          { label: "Calls", icon: "📞", value: "87" },
          { label: "Missed calls recovered", icon: "↩️", value: "23", tone: "green" },
          { label: "Viewings booked", icon: "📅", value: "54" },
          { label: "Valuations sent", icon: "📄", value: "41" },
          { label: "Deals agreed", icon: "✅", value: "19", tone: "green" },
          { label: "Pipeline value", icon: "💵", value: "$1.8M", tone: "green" },
          { label: "Avg. sale price", icon: "📊", value: "$412k" },
        ],
      },
      {
        label: "AI Activity",
        stats: [
          { label: "Calls handled", icon: "🤖", value: "87" },
          { label: "Leads contacted", icon: "📤", value: "142" },
          { label: "Follow-ups sent", icon: "🔁", value: "218" },
          { label: "Viewings booked", icon: "✅", value: "54", tone: "green" },
        ],
      },
      {
        label: "Local SEO",
        stats: [
          { label: "Ranking trend", icon: "📈", value: "↑ Improving", tone: "amber" },
          { label: "Keywords tracked", icon: "🔎", value: "34" },
          { label: "Organic traffic", icon: "🌐", value: "1,204" },
          { label: "SEO tasks completed", icon: "✅", value: "16", tone: "green" },
        ],
      },
      {
        label: "Reviews",
        stats: [
          { label: "Reviews requested", icon: "⭐", value: "96" },
          { label: "Reviews received", icon: "⭐", value: "41", tone: "green" },
          { label: "Average rating", icon: "🌟", value: "4.8" },
          { label: "Recent reviews", icon: "🕐", value: "7 this wk" },
        ],
      },
    ],
    flow: [
      { step: "GET FOUND", title: "AI SEO", points: ["Local keyword research", "GBP optimization", "Ongoing ranking monitoring"] },
      { step: "CAPTURE", title: "All Channels", points: ["Portal enquiries caught instantly", "Website forms routed in", "Every call logged"] },
      { step: "RESPOND", title: "Receptionist", points: ["Answers listing questions", "Collects budget and area", "Works nights + weekends"] },
      { step: "BOOK", title: "Qualification", points: ["Confirms it's a real buyer", "Checks calendar automatically", "Sends confirmation"] },
      { step: "CLOSE", title: "Offer Follow-Up", points: ["Tracks pending offers", "Follows up automatically", "Flags ready-to-close leads"] },
      { step: "REVIEWS", title: "Review Agent", points: ["Sends request after completion", "Follows up if no response", "Flags negative feedback early"] },
      { step: "REACTIVATE", title: "Old Leads", points: ["Re-engages cold enquiries", "Reaches past buyers", "Revives lost leads"] },
      { step: "TRACK", title: "Dashboard", points: ["Revenue in one view", "AI + SEO + Reviews together", "No switching tools"] },
    ],
    activity: [
      { icon: "🌐", src: "Website", text: "Sarah Johnson — booked a viewing", badge: "Hot", tone: "red" },
      { icon: "📱", src: "SMS", text: "Valuation follow-up sent — J. Marsh", badge: "Pending", tone: "amber" },
      { icon: "📞", src: "Missed call", text: "Recovered + booked a viewing", badge: "Booked", tone: "green" },
      { icon: "⭐", src: "Review request", text: "5-star review received", badge: "New", tone: "green" },
    ],
  },

  chat: {
    chips: ["🏠 Listings", "📅 Book a viewing", "💰 Pricing", "📍 Areas we cover"],
    heroGreeting: (c) => `Hi, I'm ${c.co} AI 👋`,
    heroTagline: () => "Ask me about listings, viewings, pricing or the areas we cover.",
    introBlurb: (c) =>
      `I've read ${c.co} whole site. Ask me about listings, pricing, viewings or the areas we cover.`,
    sampleRecent: { label: "Popular question", text: "Can I book a viewing this week?" },
    faqs: (c) => [
      { q: "How much is a property I've seen listed?", a: `Ask the AI with the address or listing name and it will give you ${c.co} current asking price, plus what's included.` },
      { q: "Do you have any 3-bedroom homes available?", a: `Yes — tell the AI your budget and preferred area and it will pull ${c.co} matching 3-bed listings.` },
      { q: "How do I book a viewing?", a: "Ask for a viewing and the AI will take your preferred day and time, then confirm the slot with the team." },
      { q: "Which areas do you cover?", a: `The AI knows every area ${c.company} works in — just ask about a suburb or city and it will confirm.` },
      { q: "Can you help me work out what I can afford?", a: "Share your deposit and budget range and the AI will talk you through the price bracket that fits." },
    ],
  },
};

export const NICHE_PACKS: Record<string, NichePack> = {
  real_estate: realEstate,
  local_business: localBusiness,
};

export const DEFAULT_PACK_ID = "real_estate";

/**
 * Resolve the pack for a business. `storedNiche` is the pack id persisted at demo
 * creation time (keyword match, AI fallback); `industry` is the raw industry string.
 * Unknown → Real Estate.
 */
export const resolveNichePack = (industry?: string | null, storedNiche?: string | null): NichePack => {
  if (storedNiche && NICHE_PACKS[storedNiche]) return NICHE_PACKS[storedNiche];
  const s = (industry || "").toLowerCase().trim();
  if (!s) return NICHE_PACKS[DEFAULT_PACK_ID];
  for (const pack of Object.values(NICHE_PACKS)) {
    if (pack.keywords.some((k) => s.includes(k))) return pack;
  }
  return NICHE_PACKS[DEFAULT_PACK_ID];
};

/** Context helper — possessive form reads correctly for names ending in "s". */
export const nicheCtx = (company: string, firstName?: string): NicheCtx => ({
  company,
  co: /s$/i.test(company) ? `${company}'` : `${company}'s`,
  firstName,
});
