import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Save, Calendar, Globe, Building2 } from "lucide-react";

const SiteSettingsPanel = () => {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = async () => {
    const { data } = await supabase
      .from("site_settings")
      .select("*");
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
          .update({ value, updated_at: new Date().toISOString() })
          .eq("key", key);
      }
      toast({ title: "✅ Settings saved!" });
    } catch (err) {
      toast({ title: "Error saving settings", variant: "destructive" });
    } finally {
      setSaving(false);
    }
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
      {/* Calendar / Booking */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Booking / Calendar Integration</CardTitle>
          </div>
          <CardDescription>
            Add your calendar booking link once — it will be used across all generated landing pages and chatbot pages.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Booking URL</Label>
            <Input
              value={settings.calendar_url || ""}
              onChange={e => updateSetting("calendar_url", e.target.value)}
              placeholder="https://calendly.com/yourname/ai-demo"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Supports Calendly, Cal.com, Google Calendar, or any booking URL.
            </p>
          </div>
          <div>
            <Label>CTA Button Text</Label>
            <Input
              value={settings.default_cta_text || ""}
              onChange={e => updateSetting("default_cta_text", e.target.value)}
              placeholder="Book a Call"
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
          <CardDescription>
            Your agency name shown in footers and headers of generated pages.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
};

export default SiteSettingsPanel;
