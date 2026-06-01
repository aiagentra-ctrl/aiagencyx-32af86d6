import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Bot, Loader2, CheckCircle, Globe } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface CreateChatbotDialogProps {
  onCreated: () => void;
}

const CreateChatbotDialog = ({ onCreated }: CreateChatbotDialogProps) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"input" | "analyzing" | "result">("input");
  const [businessName, setBusinessName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [isEcom, setIsEcom] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [storePlatform, setStorePlatform] = useState("");
  const [result, setResult] = useState<any>(null);

  const handleAnalyze = async () => {
    if (!businessName || !websiteUrl) {
      toast({ title: "Missing fields", description: "Both fields are required.", variant: "destructive" });
      return;
    }

    setStep("analyzing");

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/scrape-and-analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName, websiteUrl,
          ...(isEcom ? { storeName: storeName || businessName, storePlatform: storePlatform || undefined } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const step = data.step || "unknown";
        const errorMsg = data.error || "Analysis failed";
        throw new Error(`[${step}] ${errorMsg}`);
      }

      setResult(data);
      setStep("result");

      const providerNote = data.meta?.was_fallback
        ? " (used fallback prompt — AI was unavailable)"
        : data.meta?.ai_provider
        ? ` (via ${data.meta.ai_provider})`
        : "";
      toast({ title: "Chatbot created!" + providerNote, description: `URL: ${data.chatbot_url}` });
      onCreated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast({
        title: "Creation failed",
        description: msg,
        variant: "destructive",
      });
      setStep("input");
    }
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => {
      setStep("input");
      setBusinessName("");
      setWebsiteUrl("");
      setIsEcom(false);
      setStoreName("");
      setStorePlatform("");
      setResult(null);
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleClose())}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Bot className="mr-2 h-4 w-4" />
          Create Chatbot
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === "input" && "Create AI Chatbot"}
            {step === "analyzing" && "Analyzing Website..."}
            {step === "result" && "Chatbot Created!"}
          </DialogTitle>
          <DialogDescription>
            {step === "input" && "Enter a business name and website URL. We'll automatically research the business and generate a custom AI chatbot."}
            {step === "analyzing" && "Scraping website and generating AI chatbot configuration..."}
            {step === "result" && "Your chatbot is ready and deployed."}
          </DialogDescription>
        </DialogHeader>

        {step === "input" && (
          <div className="space-y-4 py-2">
            <div>
              <Label>Business Name *</Label>
              <Input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. ABC Dental Clinic"
              />
            </div>
            <div>
              <Label>Website URL *</Label>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <Input
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://abcdental.com"
                />
              </div>
            </div>

            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={isEcom}
                  onChange={(e) => setIsEcom(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                This is an E-Commerce store
              </label>
              {isEcom && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs">Store name</Label>
                    <Input
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      placeholder="My Store"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Platform</Label>
                    <select
                      value={storePlatform}
                      onChange={(e) => setStorePlatform(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Auto-detect</option>
                      <option value="shopify">Shopify</option>
                      <option value="woocommerce">WooCommerce</option>
                      <option value="gumroad">Gumroad</option>
                      <option value="lemonsqueezy">Lemon Squeezy</option>
                      <option value="bigcommerce">BigCommerce</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {step === "analyzing" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-foreground">Scraping website content...</p>
              <p className="text-xs text-muted-foreground">Analyzing business & generating chatbot prompt</p>
            </div>
          </div>
        )}

        {step === "result" && result && (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2 text-accent">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium text-sm">Successfully created</span>
            </div>
            <div className="rounded-lg bg-muted p-3 space-y-2 text-sm">
              <div><span className="font-medium">Industry:</span> {result.analysis?.industry}</div>
              <div><span className="font-medium">Tone:</span> {result.analysis?.brand_tone}</div>
              <div>
                <span className="font-medium">Services:</span>
                <ul className="ml-4 mt-1 list-disc text-muted-foreground">
                  {result.analysis?.services?.slice(0, 5).map((s: string, i: number) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <span className="font-medium">Chatbot URL:</span>{" "}
                <code className="rounded bg-background px-1.5 py-0.5 text-xs">{result.chatbot_url}</code>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "input" && (
            <Button onClick={handleAnalyze} disabled={!businessName || !websiteUrl}>
              Analyze & Create
            </Button>
          )}
          {step === "result" && (
            <Button onClick={handleClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateChatbotDialog;
