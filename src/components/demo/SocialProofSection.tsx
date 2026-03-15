import { Star } from "lucide-react";

interface SocialProofSectionProps {
  socialProof?: Array<{ name: string; role: string; quote: string }>;
}

const defaultProof = [
  { name: "Sarah M.", role: "Clinic Manager", quote: "We reduced missed calls by 80% in the first month. The AI handles everything professionally." },
  { name: "James K.", role: "Business Owner", quote: "Our customers love the instant response. It's like having a receptionist that never sleeps." },
  { name: "Priya D.", role: "Operations Lead", quote: "Setup was incredibly fast and the AI learned our FAQ in minutes. Game changer." },
];

const SocialProofSection = ({ socialProof }: SocialProofSectionProps) => {
  const items = socialProof && socialProof.length > 0 ? socialProof : defaultProof;

  return (
    <section className="bg-card px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-4 text-center text-3xl font-bold text-card-foreground md:text-4xl">
          Trusted by Businesses
        </h2>
        <p className="mx-auto mb-12 max-w-xl text-center text-muted-foreground">
          See what others are saying about their AI Voice Agent experience.
        </p>
        <div className="grid gap-6 md:grid-cols-3">
          {items.map((item, i) => (
            <div key={i} className="rounded-xl border bg-background p-6">
              <div className="mb-3 flex gap-1">
                {[...Array(5)].map((_, j) => (
                  <Star key={j} className="h-4 w-4 fill-accent text-accent" />
                ))}
              </div>
              <p className="mb-4 text-sm text-muted-foreground italic">"{item.quote}"</p>
              <div>
                <p className="font-semibold text-foreground">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SocialProofSection;
