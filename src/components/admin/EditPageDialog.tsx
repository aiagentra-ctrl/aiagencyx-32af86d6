import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

interface DemoPage {
  id: string;
  slug: string;
  assistant_id: string;
  business_name: string;
  description: string | null;
  vapi_key: string;
  client_name: string | null;
  company_name: string | null;
  industry: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  calendly_url: string | null;
  cta_text: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  custom_subdomain: string | null;
}

interface EditPageDialogProps {
  page: DemoPage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

const EditPageDialog = ({ page, open, onOpenChange, onUpdated }: EditPageDialogProps) => {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    if (page) {
      setForm({
        business_name: page.business_name || "",
        company_name: page.company_name || "",
        client_name: page.client_name || "",
        industry: page.industry || "",
        description: page.description || "",
        assistant_id: page.assistant_id || "",
        vapi_key: page.vapi_key || "",
        hero_title: page.hero_title || "",
        hero_subtitle: page.hero_subtitle || "",
        calendly_url: page.calendly_url || "",
        cta_text: page.cta_text || "",
        contact_email: page.contact_email || "",
        contact_phone: page.contact_phone || "",
        custom_subdomain: page.custom_subdomain || "",
      });
    }
  }, [page]);

  const update = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    if (!page) return;
    setSaving(true);
    const { error } = await supabase
      .from("demo_pages")
      .update({
        business_name: form.business_name,
        company_name: form.company_name || null,
        client_name: form.client_name || null,
        industry: form.industry || null,
        description: form.description || null,
        assistant_id: form.assistant_id,
        vapi_key: form.vapi_key,
        hero_title: form.hero_title || null,
        hero_subtitle: form.hero_subtitle || null,
        calendly_url: form.calendly_url || null,
        cta_text: form.cta_text || null,
        contact_email: form.contact_email || null,
        contact_phone: form.contact_phone || null,
        custom_subdomain: form.custom_subdomain || null,
      })
      .eq("id", page.id);

    if (error) {
      toast({ title: "Error saving", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Page updated!" });
      onOpenChange(false);
      onUpdated();
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Demo Page</DialogTitle>
          <DialogDescription>Update the content and personalization for this demo page.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Business Name</Label>
              <Input value={form.business_name || ""} onChange={(e) => update("business_name", e.target.value)} />
            </div>
            <div>
              <Label>Company Name</Label>
              <Input value={form.company_name || ""} onChange={(e) => update("company_name", e.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Client Name</Label>
              <Input value={form.client_name || ""} onChange={(e) => update("client_name", e.target.value)} />
            </div>
            <div>
              <Label>Industry</Label>
              <Input value={form.industry || ""} onChange={(e) => update("industry", e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={form.description || ""} onChange={(e) => update("description", e.target.value)} />
          </div>
          <div>
            <Label>Hero Title</Label>
            <Input value={form.hero_title || ""} onChange={(e) => update("hero_title", e.target.value)} placeholder="Custom hero headline" />
          </div>
          <div>
            <Label>Hero Subtitle</Label>
            <Textarea value={form.hero_subtitle || ""} onChange={(e) => update("hero_subtitle", e.target.value)} placeholder="Custom hero description" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Assistant ID</Label>
              <Input value={form.assistant_id || ""} onChange={(e) => update("assistant_id", e.target.value)} />
            </div>
            <div>
              <Label>Vapi Key</Label>
              <Input value={form.vapi_key || ""} onChange={(e) => update("vapi_key", e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Calendly URL</Label>
            <Input value={form.calendly_url || ""} onChange={(e) => update("calendly_url", e.target.value)} />
          </div>
          <div>
            <Label>CTA Text</Label>
            <Input value={form.cta_text || ""} onChange={(e) => update("cta_text", e.target.value)} placeholder="Custom call-to-action text" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Contact Email</Label>
              <Input value={form.contact_email || ""} onChange={(e) => update("contact_email", e.target.value)} />
            </div>
            <div>
              <Label>Contact Phone</Label>
              <Input value={form.contact_phone || ""} onChange={(e) => update("contact_phone", e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Custom Subdomain</Label>
            <Input value={form.custom_subdomain || ""} onChange={(e) => update("custom_subdomain", e.target.value)} placeholder="clientname" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditPageDialog;
