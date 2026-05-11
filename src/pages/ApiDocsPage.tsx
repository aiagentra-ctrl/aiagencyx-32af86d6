import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Check, ArrowLeft, Zap, Phone, MessageCircle, Globe, Info, Layers } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

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

const ParamRow = ({ name, type, required, children }: { name: string; type: string; required?: boolean; children: React.ReactNode }) => (
  <div className="flex gap-3 py-2.5 border-b last:border-b-0">
    <div className="shrink-0 w-40">
      <code className="text-xs font-mono font-semibold text-foreground">{name}</code>
      <div className="flex items-center gap-1.5 mt-0.5">
        <Badge variant={required ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
          {required ? "required" : "optional"}
        </Badge>
        <span className="text-[10px] text-muted-foreground">{type}</span>
      </div>
    </div>
    <div className="text-sm text-muted-foreground leading-relaxed">{children}</div>
  </div>
);

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
        {/* ── Full Automation API ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <CardTitle>Create Demo (Full Automation)</CardTitle>
            </div>
            <CardDescription>
              One endpoint. Returns a live demo URL with voice agent + chatbot + personalized website.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Endpoint</p>
              <code className="block rounded-lg bg-muted px-3 py-2 text-sm font-mono">
                POST {SUPABASE_URL}/functions/v1/create-demo
              </code>
            </div>

            {/* Parameters */}
            <div>
              <p className="text-sm font-medium text-foreground mb-3">Parameters</p>
              <div className="rounded-lg border divide-y">
                <ParamRow name="business_name" type="string" required>
                  The name of the business (e.g. <code className="text-xs bg-muted px-1 rounded">"Mario's Pizza"</code>).
                </ParamRow>
                <ParamRow name="website_url" type="string" required>
                  The business website URL. Used for scraping content, menu, services, and branding.
                </ParamRow>
                <ParamRow name="calendar_link" type="string">
                  Calendar/booking URL (e.g. Calendly). Falls back to admin default if not provided.
                </ParamRow>
                <ParamRow name="industry" type="string">
                  <div className="space-y-2">
                    <p>
                      Industry template to use. Controls system prompt, chatbot behavior, landing page content, and voice agent script.
                    </p>
                    <div className="rounded-md bg-muted/50 border p-3 space-y-1.5">
                      <p className="text-xs font-semibold text-foreground">Supported values:</p>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="outline" className="text-xs"><code>"restaurant"</code></Badge>
                        <Badge variant="outline" className="text-xs"><code>"default"</code></Badge>
                        <Badge variant="secondary" className="text-[10px]">+ any custom template added in Admin → Templates</Badge>
                      </div>
                    </div>
                    <div className="text-xs space-y-1 text-muted-foreground">
                      <p>• <code className="bg-muted px-1 rounded">"restaurant"</code> → uses the predefined restaurant template (menu, orders, reservations)</p>
                      <p>• <code className="bg-muted px-1 rounded">"default"</code> → uses AI to dynamically generate everything</p>
                      <p>• <strong>Not provided</strong> → system auto-detects from website content, falls back to <code className="bg-muted px-1 rounded">"default"</code></p>
                    </div>
                  </div>
                </ParamRow>
              </div>
            </div>

            {/* Follow-up parameters */}
            <div>
              <p className="text-sm font-medium text-foreground mb-3">Follow-Up Parameters (optional, enables auto follow-up)</p>
              <div className="rounded-lg border divide-y">
                <ParamRow name="firstName" type="string">Lead's first name. Required for follow-up to fire.</ParamRow>
                <ParamRow name="campaignName" type="string">Campaign label shown in templates. Required for follow-up to fire.</ParamRow>
                <ParamRow name="campaignId" type="string">ManyReach campaign id. Required for follow-up to fire.</ParamRow>
                <ParamRow name="messageThreadId" type="string">ManyReach thread id used for the reply. Required for follow-up to fire.</ParamRow>
                <ParamRow name="senderEmail" type="string">From-address used to send the follow-up. Required for follow-up to fire.</ParamRow>
                <ParamRow name="company" type="string">Lead's company. Used in templates.</ParamRow>
                <ParamRow name="industry" type="string">Lead's industry (separate from website template industry).</ParamRow>
                <ParamRow name="leadSource" type="string">Source label, e.g. <code className="text-xs bg-muted px-1 rounded">"cold-email"</code>.</ParamRow>
                <ParamRow name="ccEmails" type="string[]">CC list for the follow-up reply.</ParamRow>
                <ParamRow name="bccEmails" type="string[]">BCC list for the follow-up reply.</ParamRow>
              </div>
              <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-foreground">
                <p className="font-semibold mb-1">Handled automatically — never send these:</p>
                <p className="text-muted-foreground"><code>country</code>, <code>demoUrl</code>, <code>visitorSessionId</code>, <code>demoTried</code>, <code>device</code>, <code>browser</code>, <code>utmParams</code>, country block check. Detected from the visitor's browser/IP when they open the demo URL.</p>
              </div>
            </div>

            {/* Example: with industry */}
            <div>
              <p className="text-sm font-medium text-foreground mb-2">Example — Restaurant (uses template)</p>
              <CodeBlock code={`curl -X POST '${SUPABASE_URL}/functions/v1/create-demo' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer ${ANON_KEY}' \\
  -d '{
    "business_name": "Mario\\'s Pizza",
    "website_url": "https://mariospizza.com",
    "calendar_link": "https://calendly.com/your-link",
    "industry": "restaurant"
  }'`} />
            </div>

            <div>
              <p className="text-sm font-medium text-foreground mb-2">Example — Auto-detect (dynamic AI generation)</p>
              <CodeBlock code={`curl -X POST '${SUPABASE_URL}/functions/v1/create-demo' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer ${ANON_KEY}' \\
  -d '{
    "business_name": "Sunrise Dental Clinic",
    "website_url": "https://sunrisedental.com"
  }'`} />
              <p className="mt-2 text-xs text-muted-foreground">
                No <code className="bg-muted px-1 rounded">industry</code> provided — system will analyze the website, detect the industry, and generate a tailored AI system automatically.
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-foreground mb-2">Response</p>
              <CodeBlock code={`{
  "demo_url": "https://yourdomain.com/marios-pizza",
  "lead_id": "uuid",          // only if follow-up data was sent
  "followUpReady": true       // only if follow-up data was sent
}`} />
            </div>

            {/* Industry Selection Logic */}
            <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">Template Selection Logic</p>
              </div>
              <div className="text-xs text-muted-foreground space-y-2">
                <p>The system selects the right template using this priority chain:</p>
                <ol className="list-decimal pl-5 space-y-1">
                  <li><strong>User-provided</strong> <code className="bg-muted px-1 rounded">industry</code> → loads matching template from database</li>
                  <li><strong>Auto-detected</strong> from website content via LLM analysis</li>
                  <li><strong>Fallback</strong> to <code className="bg-muted px-1 rounded">"default"</code> template</li>
                </ol>
                <div className="mt-2 pt-2 border-t border-primary/10">
                  <p className="font-medium text-foreground">Advanced behavior:</p>
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    <li>If a matching template exists in the database → uses that template's pre-configured prompt, nav items, and problem statements</li>
                    <li>If no template exists for the detected industry → AI dynamically generates all content (prompt, landing page, chatbot behavior)</li>
                    <li>Templates can be created, edited, and toggled in <strong>Admin → Templates</strong> — no code changes required</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Modular: Create Voice Agent ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              <CardTitle>Create Voice Agent</CardTitle>
            </div>
            <CardDescription>Create a VAPI voice assistant independently.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <code className="block rounded-lg bg-muted px-3 py-2 text-sm font-mono">
                POST {SUPABASE_URL}/functions/v1/create-voice-agent
              </code>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-2">Request</p>
              <CodeBlock code={`{
  "business_name": "Mario's Pizza",
  "system_prompt": "Optional custom prompt",
  "knowledge_base": "Optional knowledge base text"
}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-2">Response</p>
              <CodeBlock code={`{
  "assistant_id": "uuid",
  "vapi_public_key": "key"
}`} />
            </div>
          </CardContent>
        </Card>

        {/* ── Modular: Create Chatbot ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-accent" />
              <CardTitle>Create Chatbot</CardTitle>
            </div>
            <CardDescription>Create an AI chatbot independently.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <code className="block rounded-lg bg-muted px-3 py-2 text-sm font-mono">
                POST {SUPABASE_URL}/functions/v1/create-chatbot
              </code>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-2">Request</p>
              <CodeBlock code={`{
  "business_name": "Mario's Pizza",
  "website_url": "https://mariospizza.com",
  "system_prompt": "Optional custom prompt",
  "knowledge_base": "Optional knowledge base",
  "logo_url": "https://...",
  "industry": "restaurant",
  "demo_page_id": "optional-uuid"
}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-2">Response</p>
              <CodeBlock code={`{
  "chatbot_id": "uuid",
  "chatbot_slug": "marios-pizza-chat"
}`} />
            </div>
          </CardContent>
        </Card>

        {/* ── Modular: Generate Website ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              <CardTitle>Generate Website</CardTitle>
            </div>
            <CardDescription>Generate a personalized demo page from an existing assistant.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <code className="block rounded-lg bg-muted px-3 py-2 text-sm font-mono">
                POST {SUPABASE_URL}/functions/v1/generate-website
              </code>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-2">Request</p>
              <CodeBlock code={`{
  "business_name": "Mario's Pizza",
  "assistant_id": "vapi-assistant-uuid",
  "vapi_public_key": "optional (uses admin default)",
  "calendar_link": "https://calendly.com/...",
  "industry": "restaurant",
  "logo_url": "https://...",
  "contact_phone": "+1234567890"
}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-2">Response</p>
              <CodeBlock code={`{
  "demo_url": "https://yourdomain.com/marios-pizza",
  "demo_page_id": "uuid",
  "slug": "marios-pizza"
}`} />
            </div>
          </CardContent>
        </Card>

        {/* ── Notes ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Important Notes</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="rounded-lg border p-4 space-y-2">
              <p className="font-medium text-foreground">Prerequisites (one-time setup in Admin → Settings)</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>VAPI Public Key + Private Key</li>
                <li>Default system prompt (with {"{business_name}"} placeholder)</li>
                <li>Voice settings (provider, voice ID)</li>
                <li>Default calendar link (optional fallback)</li>
              </ul>
            </div>

            <div className="rounded-lg border p-4 space-y-2">
              <p className="font-medium text-foreground">About the <code className="bg-muted px-1 rounded">industry</code> Parameter</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><code className="bg-muted px-1 rounded">industry</code> is <strong>always optional</strong> — the system works without it</li>
                <li>Templates are managed in <strong>Admin → Templates</strong> tab — add new industries anytime</li>
                <li>New industries are supported <strong>without any API code changes</strong></li>
                <li>If no template matches, AI generates a fully dynamic, industry-specific system</li>
                <li>Backward compatible — existing API calls without <code className="bg-muted px-1 rounded">industry</code> continue to work as before</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ApiDocsPage;
