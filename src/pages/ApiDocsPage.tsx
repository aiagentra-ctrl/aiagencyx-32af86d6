import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Check, ArrowLeft, Bot, Phone, Layers } from "lucide-react";
import { Link } from "react-router-dom";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const CodeBlock = ({ code, language = "bash" }: { code: string; language?: string }) => {
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
        {/* Chatbot API */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <CardTitle>AI Chatbot API</CardTitle>
            </div>
            <CardDescription>Create an AI chatbot by scraping a business website.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Endpoint</p>
              <code className="block rounded-lg bg-muted px-3 py-2 text-sm font-mono">
                POST {SUPABASE_URL}/functions/v1/scrape-and-analyze
              </code>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">cURL Example</p>
              <CodeBlock code={`curl -X POST '${SUPABASE_URL}/functions/v1/scrape-and-analyze' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}' \\
  -d '{
    "businessName": "ABC Dental Clinic",
    "websiteUrl": "https://abcdental.com"
  }'`} />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Response</p>
              <CodeBlock language="json" code={`{
  "success": true,
  "chatbot_url": "https://yourdomain.com/chatbot/abc-dental-clinic",
  "slug": "abc-dental-clinic",
  "analysis": {
    "industry": "Healthcare",
    "brand_tone": "Professional and caring",
    "services": ["Dental Cleaning", "Root Canal", "Teeth Whitening"],
    "faq_topics": ["What insurance do you accept?", "How to book?"],
    "system_prompt": "You are an AI assistant for ABC Dental..."
  },
  "meta": {
    "scrape_source": "default",
    "ai_provider": "Lovable AI",
    "logo_url": "https://abcdental.com/logo.png"
  }
}`} />
            </div>
          </CardContent>
        </Card>

        {/* Voice Agent API */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              <CardTitle>AI Voice Agent API</CardTitle>
            </div>
            <CardDescription>Create a personalized landing page with an embedded AI voice agent.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Endpoint</p>
              <code className="block rounded-lg bg-muted px-3 py-2 text-sm font-mono">
                POST {SUPABASE_URL}/functions/v1/create-demo-page
              </code>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">cURL Example</p>
              <CodeBlock code={`curl -X POST '${SUPABASE_URL}/functions/v1/create-demo-page' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}' \\
  -d '{
    "assistantId": "your-vapi-assistant-id",
    "businessName": "ABC Dental Clinic",
    "clientName": "John",
    "companyName": "ABC Dental",
    "industry": "Healthcare",
    "vapiKey": "your-vapi-public-key"
  }'`} />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Response</p>
              <CodeBlock language="json" code={`{
  "success": true,
  "slug": "abc-dental-clinic",
  "url": "https://yourdomain.com/abc-dental-clinic"
}`} />
            </div>
          </CardContent>
        </Card>

        {/* Combined API */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              <CardTitle>Combined AI System</CardTitle>
            </div>
            <CardDescription>Use both APIs together to create a full AI system for any business.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-4 text-sm text-foreground space-y-2">
              <p className="font-medium">Workflow:</p>
              <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                <li>Call the <strong>Chatbot API</strong> with the business website to generate the AI chatbot</li>
                <li>Call the <strong>Voice Agent API</strong> with Vapi credentials to create the landing page</li>
                <li>Link the chatbot to the landing page via the admin panel — the widget appears automatically</li>
              </ol>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Result</p>
              <CodeBlock language="json" code={`{
  "chatbot_url": "https://yourdomain.com/chatbot/abc-dental",
  "landing_page_url": "https://yourdomain.com/abc-dental",
  "voice_agent": "Embedded on landing page"
}`} />
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ApiDocsPage;
