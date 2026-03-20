import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Check, ArrowLeft, Layers, Bot, Phone, Zap } from "lucide-react";
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
        {/* Unified AI System API */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <CardTitle>Unified AI System API</CardTitle>
            </div>
            <CardDescription>
              One endpoint to create everything: scrapes website, builds voice agent + chatbot + demo page — all using the same data and prompt.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Endpoint</p>
              <code className="block rounded-lg bg-muted px-3 py-2 text-sm font-mono">
                POST {SUPABASE_URL}/functions/v1/create-ai-system
              </code>
            </div>

            <div className="rounded-lg border bg-muted/50 p-4 text-sm space-y-2">
              <p className="font-medium text-foreground">How it works</p>
              <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                <li>Scrapes website via Firecrawl (extracts content + logo via branding)</li>
                <li>LLM extracts menu, pricing, hours, address, FAQs</li>
                <li>Builds ONE shared system prompt for all agents</li>
                <li>Creates VAPI voice assistant</li>
                <li>Creates AI chatbot with same prompt + data</li>
                <li>Creates personalized demo page linked to both</li>
                <li>Returns all URLs + IDs</li>
              </ol>
            </div>

            <div>
              <p className="text-sm font-medium text-foreground mb-2">Request</p>
              <CodeBlock code={`curl -X POST '${SUPABASE_URL}/functions/v1/create-ai-system' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer ${ANON_KEY}' \\
  -d '{
    "businessName": "Mario\\'s Pizza",
    "websiteUrl": "https://mariospizza.com",
    "category": "Restaurant",
    "calendarUrl": "https://calendly.com/your-link",
    "clientName": "Mario",
    "origin": "https://yourdomain.com"
  }'`} />
            </div>

            <div>
              <p className="text-sm font-medium text-foreground mb-2">Response</p>
              <CodeBlock code={`{
  "success": true,
  "businessName": "Mario's Pizza",
  "voiceAgent": {
    "assistantId": "vapi-uuid",
    "demoPage": {
      "slug": "mario",
      "url": "https://yourdomain.com/mario",
      "id": "uuid"
    }
  },
  "chatbot": {
    "slug": "marios-pizza-chat",
    "url": "https://yourdomain.com/chatbot/marios-pizza-chat",
    "id": "uuid"
  },
  "meta": {
    "logoUrl": "https://mariospizza.com/logo.png",
    "industry": "Restaurant",
    "menuItemsCount": 45
  }
}`} />
            </div>

            <div className="rounded-lg border bg-accent/5 p-4 text-sm space-y-2">
              <p className="font-medium text-foreground">Key Features</p>
              <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                <li><strong>Single prompt</strong> — Voice agent and chatbot use identical system prompt and knowledge base</li>
                <li><strong>Logo extraction</strong> — Automatically scraped and used in demo page + chatbot UI</li>
                <li><strong>Calendar link</strong> — Dynamically used in all CTAs and chatbot booking flow</li>
                <li><strong>Cache-first</strong> — Reuses scraped data for 30 days (pass <code className="bg-background px-1 rounded text-xs">forceRefresh: true</code> to override)</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Legacy Unified API */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              <CardTitle>AI Agent API (Legacy)</CardTitle>
            </div>
            <CardDescription>
              Create Voice Agents, Chatbots, or both separately. For new integrations, use the Unified AI System API above.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Endpoint</p>
              <code className="block rounded-lg bg-muted px-3 py-2 text-sm font-mono">
                POST {SUPABASE_URL}/functions/v1/create-ai-agent
              </code>
            </div>

            <div className="rounded-lg border bg-muted/50 p-4 text-sm space-y-2">
              <p className="font-medium text-foreground">How it works</p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>Set <code className="bg-background px-1 rounded text-xs">"type"</code> to <code className="bg-background px-1 rounded text-xs">"voice"</code>, <code className="bg-background px-1 rounded text-xs">"chatbot"</code>, or <code className="bg-background px-1 rounded text-xs">"both"</code></li>
                <li>Voice agents require <code className="bg-background px-1 rounded text-xs">assistantId</code> + <code className="bg-background px-1 rounded text-xs">vapiKey</code></li>
                <li>Chatbots require <code className="bg-background px-1 rounded text-xs">websiteUrl</code></li>
                <li>Pass <code className="bg-background px-1 rounded text-xs">"calendarUrl"</code> for dynamic booking links</li>
              </ul>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Phone className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium text-foreground">Voice Agent Example</p>
              </div>
              <CodeBlock code={`curl -X POST '${SUPABASE_URL}/functions/v1/create-ai-agent' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer ${ANON_KEY}' \\
  -d '{
    "type": "voice",
    "businessName": "ABC Restaurant",
    "assistantId": "your-vapi-assistant-id",
    "vapiKey": "your-vapi-public-key",
    "calendarUrl": "https://calendly.com/your-link",
    "origin": "https://yourdomain.com"
  }'`} />
            </div>
          </CardContent>
        </Card>

        {/* Automated Voice Agent API */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              <CardTitle>Automated Voice Agent API</CardTitle>
            </div>
            <CardDescription>
              Scrape → AI prompt → VAPI assistant. Returns assistantId + logoUrl.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Endpoint</p>
              <code className="block rounded-lg bg-muted px-3 py-2 text-sm font-mono">
                POST {SUPABASE_URL}/functions/v1/create-voice-agent
              </code>
            </div>

            <div>
              <p className="text-sm font-medium text-foreground mb-2">Request</p>
              <CodeBlock code={`curl -X POST '${SUPABASE_URL}/functions/v1/create-voice-agent' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer ${ANON_KEY}' \\
  -d '{
    "businessName": "ABC Restaurant",
    "category": "Restaurant",
    "websiteUrl": "https://abcrestaurant.com",
    "calendarUrl": "https://calendly.com/your-link"
  }'`} />
            </div>

            <div>
              <p className="text-sm font-medium text-foreground mb-2">Response</p>
              <CodeBlock code={`{
  "assistantId": "vapi-assistant-uuid",
  "logoUrl": "https://abcrestaurant.com/logo.png"
}`} />
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ApiDocsPage;
