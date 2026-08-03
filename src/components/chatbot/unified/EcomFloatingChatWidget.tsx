import type React from "react";
import { forwardRef, useImperativeHandle, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X } from "lucide-react";
import BusinessLogo from "../BusinessLogo";
import EcomChatShell, { type EcomChatShellHandle } from "./ecom/EcomChatShell";

export interface EcomFloatingChatWidgetHandle {
  open: () => void;
  close: () => void;
  toggle: () => void;
  sendMessage: (t: string) => void;
  startVoice: () => void;
}

interface Props {
  chatbotId?: string;
  businessName: string;
  logoUrl?: string | null;
  productCount?: number;
  vapiKey?: string;
  assistantId?: string;
  suggestionChips?: string[];
  greeting?: string;
  visitorFirstName?: string;
  featuredProducts?: any[];
  faqs?: { q: string; a: string }[];
  /** When true, render inside its container (absolute) instead of fixed to viewport. For admin preview. */
  contained?: boolean;
  /** Initial open state (for preview) */
  defaultOpen?: boolean;
  /** Controlled open state (e.g. opened by a page CTA). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Copy overrides so non-ecommerce verticals read correctly. */
  heroTagline?: string;
  introBlurb?: string;
  heroGreeting?: string;
  sampleRecent?: { text: string; label?: string };
  tipLabel?: React.ReactNode;
}

const EcomFloatingChatWidget = forwardRef<EcomFloatingChatWidgetHandle, Props>(({
  chatbotId, businessName, logoUrl, productCount, vapiKey, assistantId,
  suggestionChips, greeting, visitorFirstName, featuredProducts, faqs,
  contained = false, defaultOpen = false,
  open: openProp, onOpenChange, heroTagline, introBlurb, tipLabel,
}, ref) => {
  const [openState, setOpenState] = useState(defaultOpen);
  const open = openProp !== undefined ? openProp : openState;
  const setOpen = (v: boolean | ((p: boolean) => boolean)) => {
    const next = typeof v === "function" ? (v as (p: boolean) => boolean)(open) : v;
    setOpenState(next);
    onOpenChange?.(next);
  };
  const [showTip, setShowTip] = useState(false);
  const chatRef = useRef<EcomChatShellHandle>(null);

  useEffect(() => {
    if (contained) return;
    const seen = sessionStorage.getItem("ecom_widget_tip_seen");
    if (!seen && !open) {
      const t1 = setTimeout(() => setShowTip(true), 1500);
      const t2 = setTimeout(() => { setShowTip(false); sessionStorage.setItem("ecom_widget_tip_seen", "1"); }, 8000);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [contained, open]);

  useImperativeHandle(ref, () => ({
    open: () => { setOpen(true); setShowTip(false); },
    close: () => setOpen(false),
    toggle: () => setOpen((v) => !v),
    sendMessage: (t: string) => { setOpen(true); setTimeout(() => chatRef.current?.sendMessage(t), 350); },
    startVoice: () => { setOpen(true); setTimeout(() => chatRef.current?.startVoice(), 350); },
  }));

  const positionCls = contained ? "absolute" : "fixed";

  return (
    <>
      {/* FAB */}
      <AnimatePresence>
        {!open && (
          <motion.div
            key="fab"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
            className={`${positionCls} bottom-5 right-5 z-50 flex flex-col items-end gap-2`}
          >
            {showTip && (
              <motion.div
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="mr-1 max-w-[220px] rounded-2xl rounded-br-sm border border-black/5 bg-white px-3 py-2 text-sm text-slate-700 shadow-lg"
              >
                {tipLabel || <>👋 Chat with <strong>{businessName}</strong>'s AI</>}
              </motion.div>
            )}
            <button
              type="button"
              onClick={() => { setOpen(true); setShowTip(false); }}
              aria-label="Open chat"
              className="relative flex h-16 w-16 items-center justify-center rounded-full shadow-2xl transition-transform active:scale-95"
              style={{ background: "var(--brand, #2563EB)" }}
            >
              <span className="absolute inset-0 rounded-full" style={{ background: "var(--brand,#2563EB)", animation: "widgetPulse 2s ease-out infinite", opacity: 0.35 }} />
              <style>{`@keyframes widgetPulse { 0% { transform: scale(1); opacity: .35 } 100% { transform: scale(1.5); opacity: 0 } }`}</style>
              {logoUrl ? (
                <div className="relative h-11 w-11 overflow-hidden rounded-full bg-white p-0.5 ring-2 ring-white/60">
                  <img src={logoUrl} alt={businessName} className="h-full w-full rounded-full object-contain" />
                </div>
              ) : (
                <MessageCircle className="relative h-7 w-7 text-white" strokeWidth={2.2} />
              )}
              <span className="absolute right-0 top-0 h-3 w-3 rounded-full border-2 border-white bg-green-500" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PANEL */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className={`${positionCls} bottom-5 right-5 z-50 flex flex-col overflow-hidden rounded-3xl border border-black/5 bg-white shadow-2xl`}
            style={{ width: "min(calc(100vw - 2.5rem), 390px)", height: "min(calc(100vh - 2.5rem), 640px)" }}
          >
            {/* Close button overlay */}
            <button
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-500 shadow-sm ring-1 ring-black/5 backdrop-blur transition hover:text-slate-900"
            >
              <X className="h-4 w-4" />
            </button>
            {chatbotId ? (
              <EcomChatShell
                ref={chatRef}
                chatbotId={chatbotId}
                businessName={businessName}
                logoUrl={logoUrl}
                productCount={productCount}
                vapiKey={vapiKey}
                assistantId={assistantId}
                suggestionChips={suggestionChips}
                greeting={greeting}
                visitorFirstName={visitorFirstName}
                featuredProducts={featuredProducts}
                faqs={faqs}
                heroTagline={heroTagline}
                introBlurb={introBlurb}
                className="h-full"
              />
            ) : (
              <div className="flex h-full items-center justify-center p-8 text-center text-sm text-slate-500">
                <div>
                  <BusinessLogo url={logoUrl} name={businessName} size={56} rounded="2xl" />
                  <p className="mt-4 font-medium text-slate-700">Chat preview</p>
                  <p className="mt-1 text-xs">The live chat appears here once the demo is created.</p>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});

EcomFloatingChatWidget.displayName = "EcomFloatingChatWidget";
export default EcomFloatingChatWidget;