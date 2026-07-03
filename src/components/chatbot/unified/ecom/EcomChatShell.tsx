import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft, ChevronRight, ChevronDown, MessageCircle, Home, HelpCircle,
  Mic, MicOff, RefreshCw, Send, Search, Phone, ShoppingBag, Sparkles, Loader2, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chatbot-conversation`;

type Product = {
  id?: string; name: string; price?: number | string; compare_at_price?: number | string;
  currency?: string; image_url?: string; product_url?: string; in_stock?: boolean; category?: string;
};
type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  products?: Product[];
  chips?: string[];
  kb?: string;
  voice?: boolean;
  ts: number;
};
type Session = { id: string; startedAt: number; messages: Msg[] };
type FaqItem = { q: string; a: string };
type Tab = "home" | "chats" | "faq";

export interface EcomChatShellHandle {
  sendMessage: (t: string) => void;
  startVoice: () => void;
}

interface Props {
  chatbotId: string;
  businessName: string;
  logoUrl?: string | null;
  productCount?: number;
  vapiKey?: string;
  assistantId?: string;
  suggestionChips?: string[];
  greeting?: string;
  visitorFirstName?: string;
  featuredProducts?: Product[];
  faqs?: FaqItem[];
  className?: string;
}

const DEFAULT_CHIPS = ["🏆 Bestsellers", "🎁 Gifts", "💰 Under $100", "📦 Track order"];
const DEFAULT_FAQS: FaqItem[] = [
  { q: "What is your return policy?", a: "We accept returns within 30 days of delivery for a full refund on unused items." },
  { q: "How long does shipping take?", a: "Standard shipping is 3–5 business days. Express options are available at checkout." },
  { q: "Do you offer gift wrapping?", a: "Yes — you can add gift wrap at checkout with a personalized note." },
  { q: "What sizes are available?", a: "Sizes vary per product. Ask our AI assistant about a specific item for exact availability." },
];

function chipToQuery(s: string) {
  return s.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "").trim();
}
function parseRecommendations(content: string): { text: string; items: Product[] } {
  const m = content.match(/<!--recommendations:(\[[\s\S]*?\])-->/);
  if (!m) return { text: content, items: [] };
  try {
    const items = JSON.parse(m[1]) as Product[];
    const text = (content.slice(0, m.index) + content.slice(m.index! + m[0].length)).trim();
    return { text, items };
  } catch { return { text: content, items: [] }; }
}
function stripActions(content: string): string {
  return content.replace(/<!--actions:\[[\s\S]*?\]-->\s*$/, "").trimEnd();
}
function parseKb(content: string): { text: string; kb?: string } {
  const m = content.match(/<!--kb:([\s\S]*?)-->/);
  if (!m) return { text: content };
  const text = (content.slice(0, m.index) + content.slice(m.index! + m[0].length)).trim();
  return { text, kb: m[1] };
}
function relTime(ts: number) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// ================= main =================

const EcomChatShell = forwardRef<EcomChatShellHandle, Props>(({
  chatbotId, businessName, logoUrl, productCount, vapiKey, assistantId,
  suggestionChips, visitorFirstName, featuredProducts = [], faqs, className,
}, ref) => {
  const [tab, setTab] = useState<Tab>("home");
  const [inChat, setInChat] = useState(false); // chat sub-screen inside 'home' flow
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [voiceState, setVoiceState] = useState<"idle" | "connecting" | "listening" | "speaking">("idle");
  const [sessions, setSessions] = useState<Session[]>([]);
  const sessionId = useRef<string>(crypto.randomUUID());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const vapiRef = useRef<any>(null);
  const storageKey = `ecom_widget_sessions_${chatbotId}`;

  const chips = (suggestionChips && suggestionChips.length ? suggestionChips : DEFAULT_CHIPS).slice(0, 4);
  const faqList = faqs && faqs.length ? faqs : DEFAULT_FAQS;

  // Load sessions from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setSessions(JSON.parse(raw));
    } catch {}
  }, [storageKey]);

  // Persist current session
  useEffect(() => {
    if (messages.length === 0) return;
    const current: Session = { id: sessionId.current, startedAt: messages[0]?.ts || Date.now(), messages };
    const next = [current, ...sessions.filter((s) => s.id !== sessionId.current)].slice(0, 5);
    setSessions(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading, inChat]);

  const startNewChat = useCallback(() => {
    sessionId.current = crypto.randomUUID();
    setMessages([]);
    setInChat(true);
    setTab("home");
    setTimeout(() => inputRef.current?.focus(), 200);
  }, []);

  const openSession = useCallback((s: Session) => {
    sessionId.current = s.id;
    setMessages(s.messages);
    setInChat(true);
    setTab("home");
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    text = text.trim(); if (!text || isLoading) return;
    setInChat(true);
    setTab("home");
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: text, ts: Date.now() };
    setMessages((p) => [...p, userMsg]);
    setInput("");
    setIsLoading(true);
    let acc = "";
    const asstId = crypto.randomUUID();
    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ chatbotId, sessionId: sessionId.current, message: text }),
      });
      if (!resp.ok || !resp.body) throw new Error(`Error ${resp.status}`);
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      const push = () => {
        const withKb = parseKb(acc);
        const parsed = parseRecommendations(withKb.text);
        const clean = stripActions(parsed.text);
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          const msg: Msg = {
            id: asstId, role: "assistant", content: clean,
            products: parsed.items, kb: withKb.kb, ts: Date.now(),
          };
          if (last?.role === "assistant" && last.id === asstId) {
            return prev.map((m) => (m.id === asstId ? msg : m));
          }
          return [...prev, msg];
        });
      };
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buf += decoder.decode(value, { stream: true });
        let ni: number;
        while ((ni = buf.indexOf("\n")) !== -1) {
          const line = buf.slice(0, ni).replace(/\r$/, ""); buf = buf.slice(ni + 1);
          if (!line.startsWith("data: ")) continue;
          const j = line.slice(6).trim();
          if (j === "[DONE]") continue;
          try { const c = JSON.parse(j).choices?.[0]?.delta?.content; if (c) { acc += c; push(); } } catch {}
        }
      }
    } catch (e: any) {
      setMessages((p) => [...p, { id: crypto.randomUUID(), role: "assistant", content: e?.message || "Sorry, something went wrong.", ts: Date.now() }]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [chatbotId, isLoading]);

  const startVoice = useCallback(async () => {
    if (!vapiKey || !assistantId || voiceState !== "idle") return;
    try {
      setVoiceState("connecting");
      setInChat(true);
      const { default: Vapi } = await import("@vapi-ai/web");
      const vapi = new Vapi(vapiKey);
      vapiRef.current = vapi;
      vapi.on("call-start", () => setVoiceState("listening"));
      vapi.on("speech-start", () => setVoiceState("speaking"));
      vapi.on("speech-end", () => setVoiceState("listening"));
      vapi.on("call-end", () => { setVoiceState("idle"); vapiRef.current = null; });
      vapi.on("error", () => { setVoiceState("idle"); vapiRef.current = null; });
      vapi.on("message", (m: any) => {
        if (m?.type === "transcript" && m.transcriptType === "final" && m.transcript?.trim()) {
          const role = m.role === "user" ? "user" : "assistant";
          setMessages((prev) => [...prev, { id: crypto.randomUUID(), role, content: m.transcript, voice: true, ts: Date.now() }]);
        }
      });
      vapi.start(assistantId);
    } catch (e) { console.error(e); setVoiceState("idle"); }
  }, [vapiKey, assistantId, voiceState]);

  const stopVoice = useCallback(() => {
    try { vapiRef.current?.stop?.(); } catch {}
    setVoiceState("idle"); vapiRef.current = null;
  }, []);

  useImperativeHandle(ref, () => ({ sendMessage, startVoice }), [sendMessage, startVoice]);
  useEffect(() => () => { try { vapiRef.current?.stop?.(); } catch {} }, []);

  const voiceActive = voiceState === "listening" || voiceState === "speaking";
  const recent = sessions[0];
  const firstName = visitorFirstName?.split(/\s+/)[0] || "there";

  // ============= RENDER =============

  return (
    <div className={cn("relative flex h-full w-full flex-col overflow-hidden bg-[#0a0a0a] text-white", className)}>
      {/* Screen container */}
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          {tab === "home" && !inChat && (
            <HomeScreen
              key="home"
              businessName={businessName}
              logoUrl={logoUrl}
              firstName={firstName}
              chips={chips}
              recent={recent}
              featuredProducts={featuredProducts}
              onAsk={() => startNewChat()}
              onChip={(c) => sendMessage(chipToQuery(c))}
              onOpenRecent={() => recent && openSession(recent)}
              onStartVoice={startVoice}
              onOpenProduct={(p) => sendMessage(`Tell me about ${p.name}`)}
              hasVoice={Boolean(vapiKey && assistantId)}
              productCount={productCount}
            />
          )}
          {tab === "home" && inChat && (
            <ChatScreen
              key="chat"
              businessName={businessName}
              logoUrl={logoUrl}
              productCount={productCount}
              messages={messages}
              isLoading={isLoading}
              chips={chips}
              input={input}
              setInput={setInput}
              onBack={() => setInChat(false)}
              onSend={() => sendMessage(input)}
              onChip={(c) => sendMessage(chipToQuery(c))}
              onNewChat={startNewChat}
              onToggleVoice={voiceActive ? stopVoice : startVoice}
              voiceState={voiceState}
              hasVoice={Boolean(vapiKey && assistantId)}
              scrollRef={scrollRef}
              inputRef={inputRef}
            />
          )}
          {tab === "chats" && (
            <ChatsScreen
              key="chats"
              sessions={sessions}
              logoUrl={logoUrl}
              businessName={businessName}
              onOpen={(s) => openSession(s)}
              onNew={startNewChat}
            />
          )}
          {tab === "faq" && (
            <FaqScreen
              key="faq"
              faqs={faqList}
              onAskAi={startNewChat}
              onTalkAi={startVoice}
              hasVoice={Boolean(vapiKey && assistantId)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Bottom nav */}
      <BottomNav tab={tab} onChange={(t) => { setTab(t); setInChat(false); }} />
    </div>
  );
});
EcomChatShell.displayName = "EcomChatShell";
export default EcomChatShell;

// ================= HOME =================

function HomeScreen({
  businessName, logoUrl, firstName, chips, recent, featuredProducts,
  onAsk, onChip, onOpenRecent, onStartVoice, onOpenProduct, hasVoice, productCount,
}: any) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.18 }}
      className="flex h-full flex-col overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
    >
      {/* Brand header with curved bottom */}
      <div
        className="relative px-5 pt-5 pb-14"
        style={{ background: "var(--brand, #2563EB)", color: "var(--brand-text, #fff)" }}
      >
        <div className="mb-8 flex items-center">
          {logoUrl ? (
            <div className="h-10 w-10 overflow-hidden rounded-full bg-white/95 p-1 ring-2 ring-white/30">
              <img src={logoUrl} alt={businessName} className="h-full w-full rounded-full object-contain" />
            </div>
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-sm font-bold ring-2 ring-white/30">
              {businessName.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
        <h2 className="text-2xl font-bold leading-tight">Hi {firstName} 👋</h2>
        <p className="mt-1 text-xl font-light leading-snug opacity-95">What are you shopping for today?</p>
        {/* curved cutout */}
        <svg viewBox="0 0 400 40" preserveAspectRatio="none" className="absolute -bottom-px left-0 h-10 w-full text-[#0a0a0a]">
          <path d="M0,0 C120,50 280,50 400,0 L400,40 L0,40 Z" fill="currentColor" />
        </svg>
      </div>

      <div className="-mt-6 space-y-3 px-4 pb-4">
        {/* Primary CTA */}
        <button
          onClick={onAsk}
          className="group flex w-full items-center gap-3 rounded-2xl bg-[#1a1a1a] px-4 py-4 text-left ring-1 ring-white/5 transition hover:bg-[#222] active:scale-[.99]"
        >
          <MessageCircle className="h-5 w-5" style={{ color: "var(--brand)" }} />
          <span className="flex-1 text-sm font-semibold">Ask a question</span>
          <ChevronRight className="h-4 w-4 text-white/40 transition group-hover:translate-x-0.5" />
        </button>

        {/* Chip row */}
        <div className="grid grid-cols-2 gap-2">
          {chips.map((c: string) => (
            <button
              key={c}
              onClick={() => onChip(c)}
              className="rounded-xl px-3 py-2.5 text-xs font-semibold text-white/90 transition hover:opacity-90 active:scale-[.98]"
              style={{ background: "color-mix(in srgb, var(--brand) 22%, #1a1a1a)" }}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Recent conversation */}
        {recent && (
          <button
            onClick={onOpenRecent}
            className="flex w-full items-start gap-3 rounded-2xl bg-[#1a1a1a] px-4 py-3 text-left ring-1 ring-white/5 transition hover:bg-[#222]"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white/60">Recent Conversation</p>
              <p className="mt-0.5 line-clamp-1 text-sm text-white">
                "{recent.messages.find((m: Msg) => m.role === "user")?.content || "New chat"}"
              </p>
              <p className="mt-0.5 text-[11px] text-white/40">{relTime(recent.startedAt)}</p>
            </div>
            <ChevronRight className="mt-3 h-4 w-4 text-white/40" />
          </button>
        )}

        {/* Voice CTA */}
        {hasVoice && (
          <button
            onClick={onStartVoice}
            className="group flex w-full items-center gap-3 rounded-2xl bg-[#1a1a1a] px-4 py-4 text-left ring-1 ring-white/5 transition hover:bg-[#222] active:scale-[.99]"
          >
            <Phone className="h-5 w-5" style={{ color: "var(--brand)" }} />
            <span className="flex-1 text-sm font-semibold">Start a live call</span>
            <ChevronRight className="h-4 w-4 text-white/40 transition group-hover:translate-x-0.5" />
          </button>
        )}

        {/* Featured products */}
        {featuredProducts.length > 0 && (
          <div className="pt-2">
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-white/50">Featured</p>
            <div className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {featuredProducts.slice(0, 6).map((p: Product, i: number) => (
                <MiniProductCard key={p.id || i} p={p} onClick={() => onOpenProduct(p)} />
              ))}
            </div>
          </div>
        )}

        {productCount ? (
          <p className="pt-2 text-center text-[11px] text-white/40">
            <Sparkles className="mr-1 inline h-3 w-3" style={{ color: "var(--brand)" }} />
            AI knows all {productCount} products in this store
          </p>
        ) : null}
      </div>
    </motion.div>
  );
}

function MiniProductCard({ p, onClick }: { p: Product; onClick: () => void }) {
  const cur = p.currency === "USD" || !p.currency ? "$" : `${p.currency} `;
  return (
    <button
      onClick={onClick}
      className="w-[130px] flex-shrink-0 snap-start overflow-hidden rounded-2xl bg-[#1a1a1a] text-left ring-1 ring-white/5 transition hover:ring-white/20"
    >
      <div className="aspect-square bg-[#111]">
        {p.image_url ? (
          <img src={p.image_url} alt={p.name} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center"><ShoppingBag className="h-6 w-6 text-white/20" /></div>
        )}
      </div>
      <div className="p-2">
        <p className="line-clamp-1 text-[11px] font-semibold text-white">{p.name}</p>
        {p.price !== undefined && p.price !== "" && (
          <p className="mt-0.5 text-[12px] font-bold" style={{ color: "var(--brand)" }}>{cur}{p.price}</p>
        )}
      </div>
    </button>
  );
}

// ================= CHAT =================

function ChatScreen({
  businessName, logoUrl, productCount, messages, isLoading, chips, input, setInput,
  onBack, onSend, onChip, onNewChat, onToggleVoice, voiceState, hasVoice, scrollRef, inputRef,
}: any) {
  const voiceActive = voiceState === "listening" || voiceState === "speaking";
  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}
      transition={{ duration: 0.18 }}
      className="flex h-full flex-col bg-[#0a0a0a]"
    >
      {/* Sub header */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ background: "var(--brand)", color: "var(--brand-text, #fff)" }}
      >
        <button onClick={onBack} aria-label="Back" className="rounded-full p-1 hover:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold leading-tight">{businessName} AI</p>
          <p className="truncate text-[11px] opacity-90">Your virtual assistant</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4">
        {messages.length === 0 ? (
          <div className="flex min-h-full flex-col items-center justify-center px-4 text-center">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full text-lg font-bold"
              style={{ background: "var(--brand)", color: "var(--brand-text, #fff)" }}
            >
              {logoUrl ? (
                <img src={logoUrl} alt={businessName} className="h-full w-full rounded-full object-contain bg-white p-1" />
              ) : businessName.slice(0, 2).toUpperCase()}
            </div>
            <h3 className="mt-3 text-lg font-bold text-white">{businessName} AI</h3>
            <p className="mt-1 text-sm text-white/60">
              {productCount ? `I know ${productCount} products.` : "I know this store."} Ask me anything.
            </p>
            <div className="mt-6 grid w-full max-w-[260px] grid-cols-2 gap-2">
              {chips.map((c: string) => (
                <button
                  key={c}
                  onClick={() => onChip(c)}
                  className="rounded-xl px-3 py-2.5 text-xs font-semibold text-white/90 transition hover:opacity-90"
                  style={{ background: "color-mix(in srgb, var(--brand) 22%, #1a1a1a)" }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m: Msg) => (
              <MessageRow key={m.id} m={m} logoUrl={logoUrl} businessName={businessName} onChip={onChip} />
            ))}
            {isLoading && (
              <div className="flex items-end gap-2">
                <Avatar logoUrl={logoUrl} businessName={businessName} />
                <div className="rounded-2xl rounded-bl-sm bg-[#1e1e1e] px-4 py-3">
                  <div className="flex gap-1">
                    {[0, 150, 300].map((d) => (
                      <span key={d} className="h-1.5 w-1.5 rounded-full bg-white/60"
                        style={{ animation: `chatDot 0.9s ${d}ms infinite ease-in-out` }} />
                    ))}
                  </div>
                  <style>{`@keyframes chatDot { 0%,100%{transform:translateY(0);opacity:.4} 50%{transform:translateY(-4px);opacity:1} }`}</style>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-white/5 bg-[#111] px-3 py-2.5">
        {voiceActive && (
          <div className="mb-2 flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs" style={{ background: "color-mix(in srgb, var(--brand) 18%, #1a1a1a)", color: "var(--brand)" }}>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70" style={{ background: "var(--brand)" }} />
              <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: "var(--brand)" }} />
            </span>
            {voiceState === "speaking" ? "AI is speaking…" : "Listening…"}
          </div>
        )}
        <form
          onSubmit={(e) => { e.preventDefault(); onSend(); }}
          className="flex items-center gap-1.5 rounded-2xl bg-[#1a1a1a] px-3 py-1.5 ring-1 ring-white/5 focus-within:ring-[var(--brand)]"
        >
          <MessageCircle className="h-4 w-4 text-white/40" />
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message"
            className="flex-1 bg-transparent py-2 text-sm text-white placeholder:text-white/40 focus:outline-none"
          />
          {hasVoice && (
            <button
              type="button"
              onClick={onToggleVoice}
              aria-label={voiceActive ? "Stop voice" : "Start voice"}
              className="rounded-full p-1.5 text-white/70 hover:text-white"
              disabled={voiceState === "connecting"}
            >
              {voiceState === "connecting" ? <Loader2 className="h-4 w-4 animate-spin" /> : voiceActive ? <MicOff className="h-4 w-4" style={{ color: "var(--brand)" }} /> : <Mic className="h-4 w-4" />}
            </button>
          )}
          <button
            type="button"
            onClick={onNewChat}
            aria-label="New chat"
            className="rounded-full p-1.5 text-white/70 hover:text-white"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            type="submit"
            aria-label="Send"
            disabled={!input.trim() || isLoading}
            className="flex h-9 w-9 items-center justify-center rounded-xl transition disabled:opacity-40"
            style={{ background: "var(--brand)", color: "var(--brand-text, #fff)" }}
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </motion.div>
  );
}

function Avatar({ logoUrl, businessName }: { logoUrl?: string | null; businessName: string }) {
  return (
    <div
      className="flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-bold ring-2 ring-black/40"
      style={{ background: "var(--brand)", color: "var(--brand-text, #fff)" }}
    >
      {logoUrl ? (
        <img src={logoUrl} alt={businessName} className="h-full w-full rounded-full bg-white/95 object-contain p-0.5" />
      ) : businessName.slice(0, 2).toUpperCase()}
    </div>
  );
}

function MessageRow({ m, logoUrl, businessName, onChip }: { m: Msg; logoUrl?: string | null; businessName: string; onChip: (c: string) => void }) {
  const isUser = m.role === "user";
  const [openKb, setOpenKb] = useState(false);
  if (isUser) {
    return (
      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
        <div
          className="max-w-[80%] rounded-2xl rounded-br-sm px-4 py-2.5 text-sm shadow-sm"
          style={{ background: "var(--brand)", color: "var(--brand-text, #fff)" }}
        >
          {m.content}
        </div>
      </motion.div>
    );
  }
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-1.5">
      {m.kb && (
        <div className="flex items-start gap-2">
          <Avatar logoUrl={logoUrl} businessName={businessName} />
          <button
            onClick={() => setOpenKb((v) => !v)}
            className="max-w-[80%] rounded-2xl rounded-bl-sm border-l-2 bg-[#141414] px-3 py-2 text-left text-[11px] text-white/70 ring-1 ring-white/5"
            style={{ borderLeftColor: "var(--brand)" }}
          >
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-white/80">KB search results</span>
              <ChevronDown className={cn("h-3 w-3 transition", openKb && "rotate-180")} />
            </div>
            {openKb && <p className="mt-1 whitespace-pre-wrap break-words text-white/60">{m.kb}</p>}
          </button>
        </div>
      )}
      {m.content && (
        <div className="flex items-end gap-2">
          <Avatar logoUrl={logoUrl} businessName={businessName} />
          <div className="prose prose-invert max-w-[80%] rounded-2xl rounded-bl-sm bg-[#1e1e1e] px-4 py-2.5 text-sm text-white prose-p:my-1 prose-strong:text-white">
            <ReactMarkdown>{m.content}</ReactMarkdown>
          </div>
        </div>
      )}
      {m.products && m.products.length > 0 && (
        <div className="ml-9 mt-1 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {m.products.map((p, i) => <ChatProductCard key={p.id || i} p={p} />)}
        </div>
      )}
      {m.chips && m.chips.length > 0 && (
        <div className="ml-9 mt-1 flex flex-wrap gap-1.5">
          {m.chips.map((c) => (
            <button
              key={c}
              onClick={() => onChip(c)}
              className="rounded-full px-3 py-1 text-[11px] font-semibold text-white/90"
              style={{ background: "color-mix(in srgb, var(--brand) 22%, #1a1a1a)" }}
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function ChatProductCard({ p }: { p: Product }) {
  const cur = p.currency === "USD" || !p.currency ? "$" : `${p.currency} `;
  const oos = p.in_stock === false;
  return (
    <div className="w-[150px] flex-shrink-0 snap-start overflow-hidden rounded-2xl bg-[#1a1a1a] ring-1 ring-white/5">
      <div className="aspect-square bg-[#111]">
        {p.image_url ? (
          <img src={p.image_url} alt={p.name} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center"><ShoppingBag className="h-7 w-7 text-white/20" /></div>
        )}
      </div>
      <div className="space-y-1 p-2.5">
        <p className="line-clamp-2 min-h-[32px] text-[12px] font-semibold text-white leading-tight">{p.name}</p>
        {p.price !== undefined && p.price !== "" && (
          <p className="text-[13px] font-bold" style={{ color: "var(--brand)" }}>{cur}{p.price}</p>
        )}
        <p className="text-[10px]" style={{ color: oos ? "#9ca3af" : "#4ade80" }}>{oos ? "Out of stock" : "In stock"}</p>
        {p.product_url && (
          <a
            href={p.product_url} target="_blank" rel="noopener noreferrer"
            className="mt-1 flex h-7 w-full items-center justify-center gap-1 rounded-lg text-[11px] font-semibold"
            style={{ background: "var(--brand)", color: "var(--brand-text, #fff)" }}
          >
            {oos ? "View" : "Order Now"} <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}

// ================= CHATS TAB =================

function ChatsScreen({ sessions, logoUrl, businessName, onOpen, onNew }: any) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="flex h-full flex-col overflow-y-auto bg-[#0a0a0a] px-4 py-4"
    >
      <h2 className="mb-3 text-lg font-bold text-white">Conversations</h2>
      {sessions.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <MessageCircle className="h-10 w-10 text-white/20" />
          <p className="mt-3 text-sm text-white/60">No conversations yet.</p>
          <button
            onClick={onNew}
            className="mt-4 rounded-xl px-4 py-2 text-sm font-semibold"
            style={{ background: "var(--brand)", color: "var(--brand-text,#fff)" }}
          >
            + Start New Chat
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((s: Session) => {
            const firstUser = s.messages.find((m) => m.role === "user");
            return (
              <button
                key={s.id}
                onClick={() => onOpen(s)}
                className="flex w-full items-start gap-3 rounded-2xl bg-[#1a1a1a] p-3 text-left ring-1 ring-white/5 transition hover:bg-[#222]"
              >
                <Avatar logoUrl={logoUrl} businessName={businessName} />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-white/50">{relTime(s.startedAt)}</p>
                  <p className="mt-0.5 line-clamp-1 text-sm text-white">"{firstUser?.content || "Conversation"}"</p>
                </div>
                <ChevronRight className="mt-2 h-4 w-4 text-white/30" />
              </button>
            );
          })}
          <button
            onClick={onNew}
            className="mt-2 w-full rounded-xl py-2.5 text-sm font-semibold"
            style={{ background: "var(--brand)", color: "var(--brand-text,#fff)" }}
          >
            + Start New Chat
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ================= FAQ TAB =================

function FaqScreen({ faqs, onAskAi, onTalkAi, hasVoice }: { faqs: FaqItem[]; onAskAi: () => void; onTalkAi: () => void; hasVoice: boolean }) {
  const [query, setQuery] = useState("");
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const filtered = useMemo(
    () => faqs.filter((f) => (f.q + f.a).toLowerCase().includes(query.toLowerCase())),
    [faqs, query],
  );
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="flex h-full flex-col overflow-y-auto bg-[#0a0a0a] px-4 py-4"
    >
      <h2 className="mb-3 text-lg font-bold text-white">FAQ</h2>
      <div className="flex items-center gap-2 rounded-xl bg-[#1a1a1a] px-3 py-2 ring-1 ring-white/5">
        <Search className="h-4 w-4 text-white/40" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search questions…"
          className="flex-1 bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
        />
      </div>
      <p className="mt-4 mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/50">Popular Questions</p>
      <div className="space-y-2">
        {filtered.map((f, i) => (
          <button
            key={f.q}
            onClick={() => setOpenIdx(openIdx === i ? null : i)}
            className="w-full rounded-2xl bg-[#1a1a1a] p-3 text-left ring-1 ring-white/5 transition hover:bg-[#222]"
          >
            <div className="flex items-center gap-2">
              <span className="flex-1 text-sm font-semibold text-white">{f.q}</span>
              <ChevronDown className={cn("h-4 w-4 text-white/40 transition", openIdx === i && "rotate-180")} />
            </div>
            {openIdx === i && <p className="mt-2 text-xs leading-relaxed text-white/70">{f.a}</p>}
          </button>
        ))}
        {filtered.length === 0 && <p className="text-center text-xs text-white/40">No matching questions.</p>}
      </div>

      <div className="mt-6 space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">Can't find an answer?</p>
        <button
          onClick={onAskAi}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a1a1a] py-2.5 text-sm font-semibold text-white ring-1 ring-white/5"
        >
          <MessageCircle className="h-4 w-4" style={{ color: "var(--brand)" }} /> Ask the AI
        </button>
        {hasVoice && (
          <button
            onClick={onTalkAi}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold"
            style={{ background: "var(--brand)", color: "var(--brand-text,#fff)" }}
          >
            <Phone className="h-4 w-4" /> Talk to AI
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ================= BOTTOM NAV =================

function BottomNav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const items: { id: Tab; label: string; icon: any }[] = [
    { id: "home", label: "Home", icon: Home },
    { id: "chats", label: "Chats", icon: MessageCircle },
    { id: "faq", label: "FAQ", icon: HelpCircle },
  ];
  return (
    <div className="border-t border-white/5 bg-[#0a0a0a] pt-1.5 pb-2">
      <div className="flex items-center justify-around">
        {items.map((it) => {
          const active = tab === it.id;
          const Icon = it.icon;
          return (
            <button
              key={it.id}
              onClick={() => onChange(it.id)}
              className="flex flex-1 flex-col items-center gap-0.5 py-1 transition"
              style={{ color: active ? "var(--brand)" : "rgba(255,255,255,.5)" }}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-semibold">{it.label}</span>
              {active && <span className="mt-0.5 h-0.5 w-6 rounded-full" style={{ background: "var(--brand)" }} />}
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-center text-[9px] text-white/30">
        Powered by <span className="font-semibold text-white/50">Aiagentra</span>
      </p>
    </div>
  );
}