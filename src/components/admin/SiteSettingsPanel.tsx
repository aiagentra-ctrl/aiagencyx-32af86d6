import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Save, Calendar, Building2, Phone, Bot, Mic, Brain } from "lucide-react";

const DEFAULT_SYSTEM_PROMPT = `## Role & Identity
You are the AI assistant for {business_name}. You are friendly, professional, and speak naturally.

## Core Tasks
A. Food Ordering:
   - Ask what items they'd like to order
   - Confirm quantities
   - Ask if delivery or pickup
   - If delivery, collect address
   - Repeat the order back for confirmation

B. Table Reservation:
   - Ask for preferred date
   - Ask for preferred time
   - Ask how many guests
   - Collect name and phone number
   - Confirm all details back

C. General Inquiry:
   - Answer questions using the knowledge base
   - Keep responses concise
   - If you don't have the info, offer to connect with staff

## Conversation Style
- Speak naturally and warmly
- Keep responses concise (2-3 sentences for voice)
- Confirm details by repeating them back
- Be patient — if caller is unsure, offer suggestions

## Do's & Don'ts
DO: Stay in character, confirm before finalizing, offer alternatives, be proactive
DON'T: Make up information, discuss competitors, share internal data, rush the caller`;

const SiteSettingsPanel = () => {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = async () => {
    const { data } = await supabase.from("site_settings").select("*");
    if (data) {
      const map: Record<string, string> = {};
      for (const row of data) {
        map[(row as any).key] = (row as any).value || "";
      }
      setSettings(map);
    }
    setLoading(false);
  };

  useEffect(() => { fetchSettings(); }, []);

  const updateSetting = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(settings)) {
        await supabase
          .from("site_settings")
          .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
      }
      toast({ title: "✅ Settings saved!" });
    } catch (err) {
      toast({ title: "Error saving settings", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const loadDefaultPrompt = () => {
    updateSetting("default_system_prompt", DEFAULT_SYSTEM_PROMPT);
    toast({ title: "Default prompt loaded — remember to save!" });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* VAPI Keys */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">VAPI Configuration</CardTitle>
          </div>
          <CardDescription>
            Your VAPI keys for voice agent creation. The public key is used on demo pages, the private key creates assistants.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>VAPI Public Key</Label>
            <Input
              value={settings.vapi_public_key || ""}
              onChange={e => updateSetting("vapi_public_key", e.target.value)}
              placeholder="pk_..."
            />
            <p className="mt-1 text-xs text-muted-foreground">Used on demo pages for the web call widget.</p>
          </div>
          <div>
            <Label>VAPI Private Key</Label>
            <Input
              type="password"
              value={settings.vapi_private_key || ""}
              onChange={e => updateSetting("vapi_private_key", e.target.value)}
              placeholder="sk_..."
            />
            <p className="mt-1 text-xs text-muted-foreground">Used server-side to create voice assistants. Stored securely.</p>
          </div>
        </CardContent>
      </Card>

      {/* Voice Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Voice Agent Settings</CardTitle>
          </div>
          <CardDescription>Default voice configuration for all created voice agents.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Voice Provider</Label>
              <Select value={settings.voice_provider || "azure"} onValueChange={v => updateSetting("voice_provider", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="azure">Azure</SelectItem>
                  <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Voice ID</Label>
              <Input
                value={settings.voice_id || ""}
                onChange={e => updateSetting("voice_id", e.target.value)}
                placeholder="andrew"
              />
            </div>
            <div>
              <Label>Language</Label>
              <Input
                value={settings.voice_language || ""}
                onChange={e => updateSetting("voice_language", e.target.value)}
                placeholder="en"
              />
            </div>
          </div>
          <div>
            <Label>First Message Template</Label>
            <Input
              value={settings.default_first_message || ""}
              onChange={e => updateSetting("default_first_message", e.target.value)}
              placeholder="Hi, thank you for calling {business_name}!"
            />
            <p className="mt-1 text-xs text-muted-foreground">Use {"{business_name}"} as placeholder.</p>
          </div>
          <div>
            <Label>End Call Message Template</Label>
            <Input
              value={settings.default_end_call_message || ""}
              onChange={e => updateSetting("default_end_call_message", e.target.value)}
              placeholder="Thank you for calling {business_name}. Have a great day!"
            />
          </div>
        </CardContent>
      </Card>

      {/* AI Model */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">AI Model</CardTitle>
          </div>
          <CardDescription>The AI model used by the voice agent for conversations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Model Provider</Label>
              <Select value={settings.ai_model_provider || "openai"} onValueChange={v => updateSetting("ai_model_provider", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="google">Google</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Model</Label>
              <Input
                value={settings.ai_model || ""}
                onChange={e => updateSetting("ai_model", e.target.value)}
                placeholder="gpt-4o"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Prompt */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Default System Prompt</CardTitle>
          </div>
          <CardDescription>
            Shared by voice agent and chatbot. Use {"{business_name}"}, {"{calendar_url}"} as placeholders.
            The knowledge base (menu, hours, etc.) is auto-appended from scraped data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            rows={16}
            value={settings.default_system_prompt || ""}
            onChange={e => updateSetting("default_system_prompt", e.target.value)}
            placeholder="Enter your system prompt..."
            className="font-mono text-xs"
          />
          <Button variant="outline" size="sm" onClick={loadDefaultPrompt}>Load Default Restaurant Prompt</Button>
        </CardContent>
      </Card>

      {/* Chatbot Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Chatbot Defaults</CardTitle>
          </div>
          <CardDescription>Default chatbot widget configuration.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Greeting Message Template</Label>
            <Input
              value={settings.chatbot_greeting || ""}
              onChange={e => updateSetting("chatbot_greeting", e.target.value)}
              placeholder="Welcome to {business_name}! How can I help you today?"
            />
          </div>
          <div>
            <Label>Widget Position</Label>
            <Select value={settings.chatbot_position || "bottom-right"} onValueChange={v => updateSetting("chatbot_position", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bottom-right">Bottom Right</SelectItem>
                <SelectItem value="bottom-left">Bottom Left</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Calendar / Booking */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Booking / Calendar</CardTitle>
          </div>
          <CardDescription>Default booking link used across all generated pages.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Default Booking URL</Label>
            <Input
              value={settings.calendar_url || ""}
              onChange={e => updateSetting("calendar_url", e.target.value)}
              placeholder="https://calendly.com/yourname/ai-demo"
            />
          </div>
          <div>
            <Label>CTA Button Text</Label>
            <Input
              value={settings.default_cta_text || ""}
              onChange={e => updateSetting("default_cta_text", e.target.value)}
              placeholder="Book a 10-min Setup Call"
            />
          </div>
        </CardContent>
      </Card>

      {/* Branding */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Agency Branding</CardTitle>
          </div>
          <CardDescription>Your agency name shown in footers of generated pages.</CardDescription>
        </CardHeader>
        <CardContent>
          <div>
            <Label>Agency / Site Name</Label>
            <Input
              value={settings.site_name || ""}
              onChange={e => updateSetting("site_name", e.target.value)}
              placeholder="AI Agency"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save All Settings"}
        </Button>
      </div>
    </div>
  );
};

export default SiteSettingsPanel;
