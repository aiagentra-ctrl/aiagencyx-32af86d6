import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Check, ArrowLeft, Zap } from "lucide-react";
import { Link } from "react-router-dom";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const CodeBlock = ({ code }: { code: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group">
      <pre className="rounded-lg bg-foreground/5 border p-4 text-xs font-mono text-foreground overflow-x-auto">
        {code}
      </pre>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={copy}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
};

const ApiDocsPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-6 py-4">
          <Link to="/admin">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <h1 className="text-xl font-bold text-card-foreground">API Documentation</h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-8 px-6 py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <CardTitle>Create Demo API</CardTitle>
            </div>
            <CardDescription>
              One endpoint. Three inputs. Returns a live demo URL with voice agent + chatbot + personalized website.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Endpoint</p>
              <code className="block rounded-lg bg-muted px-3 py-2 text-sm font-mono">
                POST {SUPABASE_URL}/functions/v1/create-demo
              </code>
            </div>

            <div className="rounded-lg border bg-muted/50 p-4 text-sm space-y-2">
              <p className="font-medium text-foreground">How it works</p>
              <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                <li>Scrapes website via Firecrawl (content + logo)</li>
                <li>LLM extracts menu, pricing, hours, address, FAQs</li>
                <li>Injects data into admin-configured system prompt</li>
                <li>Creates VAPI voice assistant</li>
                <li>Creates AI chatbot (same prompt + data)</li>
                <li>Generates personalized demo website</li>
                <li>Returns <code className="bg-background px-1 rounded text-xs">demo_url</code></li>
              </ol>
            </div>

            <div>
              <p className="text-sm font-medium text-foreground mb-2">Request (only 3 fields)</p>
              <CodeBlock code={`curl -X POST '${SUPABASE_URL}/functions/v1/create-demo' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer ${ANON_KEY}' \\
  -d '{
    "business_name": "Mario\\'s Pizza",
    "website_url": "https://mariospizza.com",
    "calendar_link": "https://calendly.com/your-link"
  }'`} />
            </div>

            <div>
              <p className="text-sm font-medium text-foreground mb-2">Response</p>
              <CodeBlock code={`{
  "demo_url": "https://yourdomain.com/marios-pizza"
}`} />
            </div>

            <div className="rounded-lg border bg-accent/5 p-4 text-sm space-y-2">
              <p className="font-medium text-foreground">Key Features</p>
              <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                <li><strong>Zero config in API</strong> — all settings (VAPI keys, system prompt, voice, branding) come from admin panel</li>
                <li><strong>Single prompt</strong> — voice agent and chatbot use identical system prompt</li>
                <li><strong>Logo extraction</strong> — automatically scraped and shown on demo page + chatbot</li>
                <li><strong>Cache-first</strong> — reuses scraped data for 30 days</li>
                <li><strong>calendar_link</strong> is optional — falls back to admin default</li>
              </ul>
            </div>

            <div className="rounded-lg border p-4 text-sm space-y-2">
              <p className="font-medium text-foreground">Prerequisites (one-time setup in Admin → Settings)</p>
              <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                <li>VAPI Public Key + Private Key</li>
                <li>Default system prompt (with {"{business_name}"} placeholder)</li>
                <li>Voice settings (provider, voice ID)</li>
                <li>Default calendar link (optional fallback)</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ApiDocsPage;
