import { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Send, Loader2, ShoppingBag, ExternalLink, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import BusinessLogo from "../BusinessLogo";
import { cn } from "@/lib/utils";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chatbot-conversation`;

export type ChipContext = "default" | "post-product" | "post-policy";
export type VoiceState = "idle" | "connecting" | "listening" | "speaking";

export type Msg = {
  role: "user" | "assistant";
  content: string;
  voice?: boolean;
  products?: Product[];
  ts?: number;
};

type Product = {
  id?: string;
  name: string;
  price?: number | string;
  compare_at_price?: number | string;
  currency?: string;
  image_url?: string;
  product_url?: string;
  in_stock?: boolean;
  category?: string;
};

export interface UnifiedChatWindowHandle {
  sendMessage: (text: string) => void;
  startVoice: () => void;
}

interface Props {
  chatbotId: string;
  businessName: string;
  logoUrl?: string | null;
  productCount?: number;
  greeting?: string;
  vapiKey?: string;
  assistantId?: string;
  suggestionChips?: string[];
  className?: string;
  height?: number | string;
  preSeed?: Msg[];
}

const DEFAULT_CHIPS = [
  "🏆 Show bestsellers",
  "🎁 Gift ideas",
  "💰 Under $100",
  "📦 Shipping info",
];
const POST_PRODUCT_CHIPS = [
  "🔄 Compare these",
  "📏 Different size?",
  "🎨 Other colors?",
  "📦 Check stock",
];
const POST_POLICY_CHIPS = [
  "🚚 Shipping time?",
  "💳 Payment options",
  "📞 Talk to someone",
  "🛒 Keep shopping",
];

/** Strip emoji + trailing punctuation from chip label to get a clean query. */
function chipToQuery(chip: string): string {
  return chip.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "").trim();
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

// ============ SUB-COMPONENTS ============

const TypingIndicator = () => (
  <div className="flex items-center gap-1.5 py-1">
    {[0, 150, 300].map((delay) => (
      <span
        key={delay}
        className="h-1.5 w-1.5 rounded-full bg-slate-400"
        style={{ animation: `typingBounce 0.8s ${delay}ms infinite ease-in-out` }}
      />
    ))}
    <style>{`@keyframes typingBounce { 0%,100% { transform: translateY(0); opacity: .4 } 50% { transform: translateY(-5px); opacity: 1 } }`}</style>
  </div>
);

const ProductCard = ({ p, onTrack }: { p: Product; onTrack: () => void }) => {
  const onSale = p.compare_at_price && Number(p.compare_at_price) > Number(p.price || 0);
  const cur = p.currency === "USD" || !p.currency ? "$" : `${p.currency} `;
  const oos = p.in_stock === false;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
      className="group w-[175px] flex-shrink-0 snap-start overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
      style={{ borderColor: "rgba(0,0,0,.08)" }}
    >
      <div className="relative aspect-square bg-slate-50">
        {p.image_url ? (
          <img src={p.image_url} alt={p.name} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center"><ShoppingBag className="h-8 w-8 text-slate-300" /></div>
        )}
        {onSale && (
          <span className="absolute right-2 top-2 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">SALE</span>
        )}
        {oos && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-xs font-medium text-slate-600">Out of Stock</div>
        )}
      </div>
      <div className="space-y-1.5 p-3">
        <h4 className="line-clamp-2 min-h-[34px] text-[13px] font-semibold leading-tight text-slate-900">{p.name}</h4>
        {p.price !== undefined && p.price !== "" && (
          <div className="flex items-baseline gap-1.5">
            <span className="text-[15px] font-bold" style={{ color: "var(--brand, #2563EB)" }}>{cur}{p.price}</span>
            {onSale && <span className="text-xs text-slate-400 line-through">{cur}{p.compare_at_price}</span>}
          </div>
        )}
        <div>
          {oos ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Out of stock
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> In stock
            </span>
          )}
        </div>
        {p.product_url && (
          <a
            href={p.product_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onTrack}
            className="mt-1 flex h-8 w-full items-center justify-center gap-1 rounded-xl text-[13px] font-semibold transition-transform active:scale-95"
            style={{ background: "var(--brand, #2563EB)", color: "var(--brand-text, #fff)" }}
          >
            {oos ? "View" : "Order Now"} <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </motion.div>
  );
};

const ProductCardsRow = ({ products, onTrack }: { products: Product[]; onTrack: () => void }) => (
  <div className="ml-9 mt-2">
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.06 } } }}
      className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
    >
      {products.map((p, i) => <ProductCard key={p.id || i} p={p} onTrack={onTrack} />)}
    </motion.div>
  </div>
);

// ============ MAIN COMPONENT ============

const UnifiedChatWindow = forwardRef<UnifiedChatWindowHandle, Props>(({
  chatbotId, businessName, logoUrl, productCount, greeting,
  vapiKey, assistantId, suggestionChips, className, height = 580, preSeed,
}, ref) => {
  const [messages, setMessages] = useState<Msg[]>(preSeed || []);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [chipContext, setChipContext] = useState<ChipContext>("default");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sessionId = useRef(crypto.randomUUID());
  const vapiRef = useRef<any>(null);

  const chips = chipContext === "post-product" ? POST_PRODUCT_CHIPS
    : chipContext === "post-policy" ? POST_POLICY_CHIPS
    : (suggestionChips && suggestionChips.length > 0 ? suggestionChips : DEFAULT_CHIPS);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    const el = textareaRef.current; if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [input]);

  const sendMessage = useCallback(async (text: string) => {
    text = text.trim(); if (!text || isLoading) return;
    setMessages((p) => [...p, { role: "user", content: text, ts: Date.now() }]);
    setInput("");
    setIsLoading(true);
    let acc = "";
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
        const parsed = parseRecommendations(acc);
        const clean = stripActions(parsed.text);
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          const msg: Msg = { role: "assistant", content: clean, products: parsed.items, ts: Date.now() };
          if (last?.role === "assistant") return prev.map((m, i) => i === prev.length - 1 ? msg : m);
          return [...prev, msg];
        });
        if (parsed.items.length > 0) setChipContext("post-product");
        else if (/shipping|return|refund|policy|payment/i.test(clean)) setChipContext("post-policy");
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
      setMessages((p) => [...p, { role: "assistant", content: e?.message || "Sorry, something went wrong.", ts: Date.now() }]);
    } finally {
      setIsLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [chatbotId, isLoading]);

  const startVoice = useCallback(async () => {
    if (!vapiKey || !assistantId || voiceState !== "idle") return;
    try {
      setVoiceState("connecting");
      const { default: Vapi } = await import("@vapi-ai/web");
      const vapi = new Vapi(vapiKey);
      vapiRef.current = vapi;
      vapi.on("call-start", () => setVoiceState("listening"));
      vapi.on("speech-start", () => setVoiceState("speaking"));
      vapi.on("speech-end", () => setVoiceState("listening"));
      vapi.on("call-end", () => { setVoiceState("idle"); setVoiceTranscript(""); vapiRef.current = null; });
      vapi.on("error", () => { setVoiceState("idle"); vapiRef.current = null; });
      vapi.on("message", (m: any) => {
        if (m?.type === "transcript") {
          if (m.transcriptType === "partial") setVoiceTranscript(m.transcript || "");
          else if (m.transcriptType === "final" && m.transcript?.trim()) {
            const role = m.role === "user" ? "user" : "assistant";
            setMessages((prev) => [...prev, { role, content: m.transcript, voice: true, ts: Date.now() }]);
            setVoiceTranscript("");
          }
        }
      });
      vapi.start(assistantId);
    } catch (e) { console.error(e); setVoiceState("idle"); }
  }, [vapiKey, assistantId, voiceState]);

  const stopVoice = useCallback(() => {
    try { vapiRef.current?.stop?.(); } catch {}
    setVoiceState("idle"); setVoiceTranscript(""); vapiRef.current = null;
  }, []);

  const toggleVoice = useCallback(() => {
    if (voiceState === "idle") startVoice(); else stopVoice();
  }, [voiceState, startVoice, stopVoice]);

  useImperativeHandle(ref, () => ({ sendMessage, startVoice }), [sendMessage, startVoice]);
  useEffect(() => () => { try { vapiRef.current?.stop?.(); } catch {} }, []);

  const voiceActive = voiceState === "listening" || voiceState === "speaking";
  const productsKnown = productCount && productCount > 0 ? `${productCount} products` : "your store";

  return (
    <div
      className={cn("flex flex-col overflow-hidden rounded-3xl border border-black/5 bg-white shadow-2xl", className)}
      style={{ height }}
    >
      {/* HEADER */}
      <div className="flex h-16 items-center justify-between border-b border-black/5 bg-white px-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-3">
          <BusinessLogo url={logoUrl} name={businessName} size={36} rounded="lg" />
          <div>
            <p className="text-sm font-semibold text-slate-900">{businessName}</p>
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
              <span className="text-xs text-slate-500">Online · Knows {productsKnown}</span>
            </div>
          </div>
        </div>
        {vapiKey && assistantId && (
          <button
            type="button"
            onClick={toggleVoice}
            disabled={voiceState === "connecting"}
            title={voiceActive ? "Stop voice" : "Switch to voice"}
            aria-label={voiceActive ? "Stop voice" : "Start voice"}
            className="relative flex h-[38px] w-[38px] items-center justify-center rounded-full border-[1.5px] transition-all hover:scale-105"
            style={
              voiceActive
                ? { background: "var(--brand, #2563EB)", color: "var(--brand-text, #fff)", borderColor: "var(--brand, #2563EB)" }
                : { background: "var(--brand-light, rgba(37,99,235,.08))", color: "var(--brand, #2563EB)", borderColor: "var(--brand-mid, #93c5fd)" }
            }
          >
            {voiceState === "connecting" ? <Loader2 className="h-4 w-4 animate-spin" />
              : voiceActive ? <MicOff className="h-[18px] w-[18px]" />
              : <Mic className="h-[18px] w-[18px]" />}
            {voiceActive && (
              <span className="pointer-events-none absolute inset-0 rounded-full" style={{
                background: "var(--brand, #2563EB)",
                animation: "brandPulse 1.5s ease-out infinite",
                opacity: 0.3,
              }} />
            )}
            <style>{`@keyframes brandPulse { 0% { transform: scale(1); opacity: .3 } 100% { transform: scale(1.6); opacity: 0 } }`}</style>
          </button>
        )}
      </div>

      {/* CHIPS */}
      {messages.length > 0 && (
        <div className="flex gap-2 overflow-x-auto border-b border-slate-100 bg-white px-4 py-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {chips.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => sendMessage(chipToQuery(chip))}
              disabled={isLoading}
              className="flex h-8 flex-shrink-0 items-center whitespace-nowrap rounded-full border-[1.5px] border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 transition-all hover:-translate-y-0.5 active:scale-95"
              style={{ ["--tw-hover-bg" as any]: "var(--brand-light)" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "var(--brand-light, rgba(37,99,235,.08))";
                (e.currentTarget as HTMLElement).style.borderColor = "var(--brand, #2563EB)";
                (e.currentTarget as HTMLElement).style.color = "var(--brand, #2563EB)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "";
                (e.currentTarget as HTMLElement).style.borderColor = "";
                (e.currentTarget as HTMLElement).style.color = "";
              }}
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* MESSAGE THREAD */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4" style={{ background: "#fafafa" }}>
        {messages.length === 0 ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center px-6 text-center">
            <BusinessLogo url={logoUrl} name={businessName} size={56} rounded="2xl" />
            <h3 className="mt-4 text-xl font-semibold text-slate-900">Hi! I'm {businessName}'s AI</h3>
            <p className="mt-1 max-w-[240px] text-sm text-slate-500">
              {greeting || "I know every product in the store. Ask me anything — or try voice 🎙"}
            </p>
            <div className="mt-5 grid w-full max-w-[280px] grid-cols-2 gap-2">
              {(suggestionChips || DEFAULT_CHIPS).slice(0, 4).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => sendMessage(chipToQuery(c))}
                  className="rounded-2xl border-[1.5px] border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 transition-all hover:-translate-y-0.5 hover:shadow-sm"
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--brand, #2563EB)";
                    (e.currentTarget as HTMLElement).style.background = "var(--brand-light, rgba(37,99,235,.08))";
                    (e.currentTarget as HTMLElement).style.color = "var(--brand, #2563EB)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "";
                    (e.currentTarget as HTMLElement).style.background = "";
                    (e.currentTarget as HTMLElement).style.color = "";
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {messages.map((m, i) => (
                <MessageBubble key={i} msg={m} logoUrl={logoUrl} businessName={businessName} onTrackProduct={() => {}} />
              ))}
            </AnimatePresence>
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex items-start gap-2">
                <div className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-white"
                  style={{ background: "var(--brand, #2563EB)" }}>
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <div className="rounded-[4px_18px_18px_18px] border border-black/10 bg-white px-4 py-3 shadow-sm">
                  <TypingIndicator />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* VOICE ACTIVE BAR or INPUT */}
      {voiceActive || voiceState === "connecting" ? (
        <div className="flex h-20 flex-col items-center justify-center gap-1 border-t border-black/5 bg-white px-4">
          <div className="flex items-center gap-3">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-full"
              style={{ background: "var(--brand, #2563EB)" }}>
              <span className="absolute inset-0 rounded-full"
                style={{ background: "var(--brand, #2563EB)", opacity: 0.25, animation: "vOrb1 1.5s infinite ease-out" }} />
              <span className="absolute inset-0 rounded-full"
                style={{ background: "var(--brand, #2563EB)", opacity: 0.15, animation: "vOrb2 1.5s infinite ease-out 0.5s" }} />
              <Mic className="relative h-5 w-5" style={{ color: "var(--brand-text, #fff)" }} />
              <style>{`
                @keyframes vOrb1 { 0% { transform: scale(1); opacity: .25 } 100% { transform: scale(1.5); opacity: 0 } }
                @keyframes vOrb2 { 0% { transform: scale(1); opacity: .15 } 100% { transform: scale(2); opacity: 0 } }
              `}</style>
            </div>
            <span className="text-sm text-slate-600">
              {voiceState === "connecting" ? "Connecting..."
                : voiceState === "speaking" ? "AI is responding..."
                : "Listening..."}
            </span>
            <button
              type="button"
              onClick={stopVoice}
              className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
            >Stop</button>
          </div>
          {voiceTranscript && (
            <p className="line-clamp-2 max-w-full px-4 text-center text-xs text-slate-400">{voiceTranscript}</p>
          )}
        </div>
      ) : (
        <form
          onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
          className="flex items-end gap-2 border-t border-black/5 bg-white px-3 py-2.5 shadow-[0_-2px_12px_rgba(0,0,0,0.03)]"
        >
          <textarea
            ref={textareaRef}
            value={input}
            rows={1}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
            }}
            placeholder="Ask about products, prices, sizes..."
            disabled={isLoading}
            className="min-h-[38px] max-h-[120px] flex-1 resize-none rounded-[20px] border-[1.5px] border-slate-200 bg-slate-50 px-3.5 py-2 text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-transparent focus:bg-white focus:outline-none focus:ring-[3px]"
            style={{ ["--tw-ring-color" as any]: "var(--brand-light, rgba(37,99,235,.12))" }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--brand, #2563EB)";
              e.currentTarget.style.boxShadow = "0 0 0 3px var(--brand-light, rgba(37,99,235,.12))";
            }}
            onBlur={(e) => { e.currentTarget.style.borderColor = ""; e.currentTarget.style.boxShadow = ""; }}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full transition-all active:scale-95 disabled:cursor-not-allowed"
            style={
              input.trim() && !isLoading
                ? { background: "var(--brand, #2563EB)", color: "var(--brand-text, #fff)", boxShadow: "0 2px 8px var(--brand-light, rgba(37,99,235,.3))" }
                : { background: "#e2e8f0", color: "#94a3b8" }
            }
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-[18px] w-[18px]" />}
          </button>
        </form>
      )}
    </div>
  );
});
UnifiedChatWindow.displayName = "UnifiedChatWindow";

// ============ MessageBubble ============

const MessageBubble = ({ msg, logoUrl, businessName, onTrackProduct }: {
  msg: Msg; logoUrl?: string | null; businessName: string; onTrackProduct: () => void;
}) => {
  const isUser = msg.role === "user";
  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        className="flex justify-end"
      >
        <div className="max-w-[72%] rounded-[18px_18px_4px_18px] px-4 py-2.5 text-sm leading-relaxed text-white"
          style={{ background: "#2563EB", wordBreak: "break-word" }}>
          {msg.voice && <span className="mr-1">🎙</span>}
          {msg.content}
        </div>
      </motion.div>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0, x: -16, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 340, damping: 28 }}
      className="flex flex-col"
    >
      <div className="flex items-start gap-2">
        <div className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-full"
          style={{ background: "var(--brand, #2563EB)", color: "var(--brand-text, #fff)" }}>
          {logoUrl
            ? <img src={logoUrl} alt="" className="h-full w-full object-cover" />
            : <Sparkles className="h-3.5 w-3.5" />}
        </div>
        <div className="max-w-[75%] rounded-[4px_18px_18px_18px] border border-black/10 bg-white px-4 py-2.5 text-sm leading-relaxed text-slate-800 shadow-sm"
          style={{ wordBreak: "break-word" }}>
          {msg.voice && <span className="mr-1">🔊</span>}
          {msg.content ? (
            <div className="prose prose-sm max-w-none [&>p]:m-0 [&>p:not(:last-child)]:mb-2">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          ) : <TypingIndicator />}
        </div>
      </div>
      {msg.products && msg.products.length > 0 && (
        <ProductCardsRow products={msg.products} onTrack={onTrackProduct} />
      )}
    </motion.div>
  );
};

export default UnifiedChatWindow;