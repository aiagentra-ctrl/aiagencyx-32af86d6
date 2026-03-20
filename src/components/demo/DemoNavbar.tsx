import { Phone, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DemoNavbarProps {
  logoUrl?: string;
  companyName: string;
  onTryDemo: () => void;
  onBookCall: () => void;
}

const DemoNavbar = ({ logoUrl, companyName, onTryDemo, onBookCall }: DemoNavbarProps) => {
  return (
    <nav className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={companyName}
              className="h-9 w-auto max-w-[140px] rounded-lg object-contain"
            />
          ) : (
            <span className="text-lg font-bold text-foreground">{companyName}</span>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="ghost"
            size="sm"
            className="hidden gap-1.5 text-sm sm:inline-flex"
            onClick={onTryDemo}
          >
            <Phone className="h-3.5 w-3.5" />
            Try Demo
          </Button>
          <Button
            size="sm"
            className="gap-1.5 text-sm shadow-md shadow-primary/20"
            onClick={onBookCall}
          >
            <Calendar className="h-3.5 w-3.5" />
            Book Call
          </Button>
        </div>
      </div>
    </nav>
  );
};

export default DemoNavbar;
