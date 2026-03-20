import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Check, ArrowLeft, Zap, Phone, MessageCircle, Globe } from "lucide-react";
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
        {/* Full Automation API */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <CardTitle>Create Demo (Full Automation)</CardTitle>
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

            <div>
              <p className="text-sm font-medium text-foreground mb-2">Request</p>
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
              <CodeBlock code={`{ "demo_url": "https://yourdomain.com/marios-pizza" }`} />
            </div>
          </CardContent>
        </Card>

        {/* Modular: Create Voice Agent */}
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

        {/* Modular: Create Chatbot */}
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
  "industry": "Restaurant",
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

        {/* Modular: Generate Website */}
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
  "industry": "Restaurant",
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

        <div className="rounded-lg border p-4 text-sm space-y-2">
          <p className="font-medium text-foreground">Prerequisites (one-time setup in Admin → Settings)</p>
          <ul className="list-disc pl-5 text-muted-foreground space-y-1">
            <li>VAPI Public Key + Private Key</li>
            <li>Default system prompt (with {"{business_name}"} placeholder)</li>
            <li>Voice settings (provider, voice ID)</li>
            <li>Default calendar link (optional fallback)</li>
          </ul>
        </div>
      </main>
    </div>
  );
};

export default ApiDocsPage;
