import { PhoneIncoming, Bot, ClipboardList, Send } from "lucide-react";

interface HowItWorksSectionProps {
  companyName?: string;
}

const steps = [
  { icon: PhoneIncoming, title: "Customer Calls", desc: "A customer dials your business number — any time, day or night." },
  { icon: Bot, title: "AI Answers Instantly", desc: "The AI receptionist picks up in under 2 seconds. No hold music, no voicemail." },
  { icon: ClipboardList, title: "Takes Order or Booking", desc: "It handles the full conversation — orders, reservations, questions — naturally." },
  { icon: Send, title: "You Get the Details", desc: "Order or booking info is sent to you instantly. Nothing falls through the cracks." },
];

const HowItWorksSection = ({ companyName }: HowItWorksSectionProps) => {
  return (
    <section className="border-t px-5 py-20 md:py-24">
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="mb-3 text-3xl font-bold text-foreground md:text-4xl">
          How It Works
        </h2>
        <p className="mx-auto mb-14 max-w-md text-muted-foreground">
          Four steps. Zero complexity. Fully automated from day one.
        </p>

        <div className="relative">
          {/* Connector line */}
          <div className="absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 bg-border md:block" />

          <div className="grid gap-8 md:gap-0">
            {steps.map((step, i) => (
              <div key={i} className="relative md:flex md:items-center md:gap-8" style={{ marginTop: i > 0 ? "-1px" : 0 }}>
                {/* Left content (even) / Right content (odd) */}
                <div className={`flex-1 ${i % 2 === 0 ? "md:text-right" : "md:order-3 md:text-left"}`}>
                  {i % 2 === 0 && (
                    <div className="rounded-2xl border bg-card p-5 shadow-sm md:ml-auto md:max-w-xs">
                      <h3 className="mb-1 font-bold text-foreground">{step.title}</h3>
                      <p className="text-sm text-muted-foreground">{step.desc}</p>
                    </div>
                  )}
                </div>

                {/* Center circle */}
                <div className="relative z-10 mx-auto my-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-background shadow-md md:my-0">
                  <span className="text-sm font-bold text-primary">{i + 1}</span>
                </div>

                {/* Right content (even) / Left content (odd) */}
                <div className={`flex-1 ${i % 2 === 1 ? "md:text-right md:order-1" : ""}`}>
                  {i % 2 === 1 && (
                    <div className="rounded-2xl border bg-card p-5 shadow-sm md:mr-auto md:max-w-xs">
                      <h3 className="mb-1 font-bold text-foreground">{step.title}</h3>
                      <p className="text-sm text-muted-foreground">{step.desc}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
