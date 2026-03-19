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
        {/* Unified API */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              <CardTitle>Unified AI Agent API</CardTitle>
            </div>
            <CardDescription>
              Single endpoint to create AI Voice Agents, AI Chatbots, or both at once.
              URLs are automatically generated using your domain.
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
                <li>Pass <code className="bg-background px-1 rounded text-xs">"origin"</code> with your domain (e.g. <code className="bg-background px-1 rounded text-xs">https://yourdomain.com</code>) for clean URLs</li>
                <li><strong className="text-foreground">calendarUrl</strong> — (optional) Client's booking/calendar link. Automatically used in all "Book a Call" buttons and chatbot reservation flows</li>
                <li>If omitted, URLs use the configured SITE_URL or relative paths</li>
                <li>Auto-detects type if not specified: voice (if assistantId+vapiKey present) or chatbot (if websiteUrl present)</li>
              </ul>
            </div>

            {/* Voice Agent Example */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Phone className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium text-foreground">Create AI Voice Agent</p>
              </div>
              <CodeBlock code={`curl -X POST '${SUPABASE_URL}/functions/v1/create-ai-agent' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer ${ANON_KEY}' \\
  -d '{
    "type": "voice",
    "businessName": "ABC Dental Clinic",
    "assistantId": "your-vapi-assistant-id",
    "vapiKey": "your-vapi-public-key",
    "clientName": "John",
    "companyName": "ABC Dental",
    "industry": "Healthcare",
    "calendarUrl": "https://calendly.com/your-link",
    "origin": "https://yourdomain.com"
  }'`} />
              <p className="mt-2 text-xs text-muted-foreground">Response:</p>
              <CodeBlock code={`{
  "success": true,
  "type": "voice",
  "businessName": "ABC Dental Clinic",
  "voiceAgent": {
    "slug": "john",
    "url": "https://yourdomain.com/john",
    "id": "uuid"
  }
}`} />
            </div>

            {/* Chatbot Example */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Bot className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium text-foreground">Create AI Chatbot</p>
              </div>
              <CodeBlock code={`curl -X POST '${SUPABASE_URL}/functions/v1/create-ai-agent' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer ${ANON_KEY}' \\
  -d '{
    "type": "chatbot",
    "businessName": "ABC Dental Clinic",
    "websiteUrl": "https://abcdental.com",
    "calendarUrl": "https://calendly.com/your-link",
    "origin": "https://yourdomain.com"
  }'`} />
              <p className="mt-2 text-xs text-muted-foreground">Response:</p>
              <CodeBlock code={`{
  "success": true,
  "type": "chatbot",
  "businessName": "ABC Dental Clinic",
  "chatbot": {
    "slug": "abc-dental-clinic",
    "url": "https://yourdomain.com/chatbot/abc-dental-clinic",
    "id": "uuid",
    "analysis": {
      "industry": "Healthcare",
      "brand_tone": "Professional and caring",
      "services": ["Dental Cleaning", "Root Canal"],
      "faq_topics": ["What insurance do you accept?"]
    }
  }
}`} />
            </div>

            {/* Both Example */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Layers className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium text-foreground">Create Both (Voice + Chatbot)</p>
              </div>
              <CodeBlock code={`curl -X POST '${SUPABASE_URL}/functions/v1/create-ai-agent' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer ${ANON_KEY}' \\
  -d '{
    "type": "both",
    "businessName": "ABC Dental Clinic",
    "assistantId": "your-vapi-assistant-id",
    "vapiKey": "your-vapi-public-key",
    "websiteUrl": "https://abcdental.com",
    "clientName": "John",
    "companyName": "ABC Dental",
    "industry": "Healthcare",
    "calendarUrl": "https://calendly.com/your-link",
    "origin": "https://yourdomain.com"
  }'`} />
              <p className="mt-2 text-xs text-muted-foreground">Response:</p>
              <CodeBlock code={`{
  "success": true,
  "type": "both",
  "businessName": "ABC Dental Clinic",
  "voiceAgent": {
    "slug": "john",
    "url": "https://yourdomain.com/john"
  },
  "chatbot": {
    "slug": "abc-dental-clinic",
    "url": "https://yourdomain.com/chatbot/abc-dental-clinic"
  }
}`} />
            </div>

            {/* Calendar & Domain notes */}
            <div className="rounded-lg border bg-accent/5 p-4 text-sm space-y-2">
              <p className="font-medium text-foreground">Calendar Link System</p>
              <p className="text-muted-foreground">
                Pass <code className="bg-background px-1 rounded text-xs">"calendarUrl"</code> in your API call to set a per-client booking link. This link is automatically:
              </p>
              <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                <li>Used in all "Book a Call" and "Book Demo" buttons on the landing page</li>
                <li>Integrated into the AI chatbot's reservation flow</li>
                <li>Included in the voice agent's booking instructions</li>
              </ul>
              <p className="text-muted-foreground">
                Each client can have a different calendar link (Calendly, Cal.com, etc.) — the system handles it dynamically.
              </p>
            </div>

            <div className="rounded-lg border bg-primary/5 p-4 text-sm space-y-2">
              <p className="font-medium text-foreground">Domain System</p>
              <p className="text-muted-foreground">
                URLs automatically adapt to whichever domain you access the app from:
              </p>
              <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                <li><code className="bg-background px-1 rounded text-xs">aiagentfor.lovable.app/chatbot/gaming</code> — on Lovable</li>
                <li><code className="bg-background px-1 rounded text-xs">yourdomain.com/chatbot/gaming</code> — on custom domain</li>
              </ul>
              <p className="text-muted-foreground">
                Pass <code className="bg-background px-1 rounded text-xs">"origin"</code> in API calls for clean generated URLs (only the base domain is used, any paths are stripped).
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Automated Voice Agent API */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <CardTitle>Automated Voice Agent API</CardTitle>
            </div>
            <CardDescription>
              Fully automated pipeline: scrape website → generate production-quality system prompt via AI → create VAPI assistant. Returns only the assistantId.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Endpoint</p>
              <code className="block rounded-lg bg-muted px-3 py-2 text-sm font-mono">
                POST {SUPABASE_URL}/functions/v1/create-voice-agent
              </code>
            </div>

            <div className="rounded-lg border bg-muted/50 p-4 text-sm space-y-2">
              <p className="font-medium text-foreground">Pipeline</p>
              <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                <li>Validates input: <code className="bg-background px-1 rounded text-xs">businessName</code>, <code className="bg-background px-1 rounded text-xs">category</code>, <code className="bg-background px-1 rounded text-xs">websiteUrl</code></li>
                <li>Scrapes website via Firecrawl (extracts services, FAQs, pricing, contact info)</li>
                <li>Generates structured system prompt + knowledge base via AI (with provider failover)</li>
                <li>Creates VAPI assistant with optimized voice + model config</li>
                <li>Returns only <code className="bg-background px-1 rounded text-xs">assistantId</code></li>
              </ol>
            </div>

            <div>
              <p className="text-sm font-medium text-foreground mb-2">Request</p>
              <CodeBlock code={`curl -X POST '${SUPABASE_URL}/functions/v1/create-voice-agent' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer ${ANON_KEY}' \\
  -d '{
    "businessName": "ABC Dental Clinic",
    "category": "Healthcare",
    "websiteUrl": "https://abcdental.com",
    "calendarUrl": "https://calendly.com/your-link"
  }'`} />
            </div>

            <div>
              <p className="text-sm font-medium text-foreground mb-2">Response</p>
              <CodeBlock code={`{
  "assistantId": "vapi-assistant-uuid-here"
}`} />
            </div>

            <div className="rounded-lg border bg-primary/5 p-4 text-sm space-y-2">
              <p className="font-medium text-foreground">What gets generated</p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li><strong>System prompt</strong> — Role, Identity, Tasks, Do's &amp; Don'ts, Error Handling (business-specific)</li>
                <li><strong>Knowledge base</strong> — Extracted services, pricing, FAQs, contact details from the website</li>
                <li><strong>First message</strong> — Dynamic greeting tailored to the business</li>
                <li><strong>Calendar link</strong> — Integrated into booking flow if provided</li>
                <li><strong>Voice</strong> — Azure Andrew (high-quality, natural)</li>
                <li><strong>Model</strong> — OpenAI GPT-4o for intelligent conversation</li>
              </ul>
            </div>

            <div className="rounded-lg border bg-destructive/5 p-4 text-sm space-y-2">
              <p className="font-medium text-foreground">Error Responses</p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li><code className="bg-background px-1 rounded text-xs">400</code> — Missing required fields</li>
                <li><code className="bg-background px-1 rounded text-xs">502</code> — Website scraping or VAPI creation failed</li>
                <li><code className="bg-background px-1 rounded text-xs">500</code> — Internal error</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ApiDocsPage;
