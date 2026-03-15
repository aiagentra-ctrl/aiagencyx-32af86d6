import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const API_URL = `${SUPABASE_URL}/functions/v1/create-demo-page`;

interface CreatePageDialogProps {
  onCreated: () => void;
}

const CreatePageDialog = ({ onCreated }: CreatePageDialogProps) => {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    businessName: "",
    description: "",
    assistantId: "",
    vapiKey: "",
    clientName: "",
    companyName: "",
    industry: "",
    calendlyUrl: "",
    contactEmail: "",
    contactPhone: "",
    customSubdomain: "",
  });

  const update = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleCreate = async () => {
    if (!form.businessName || !form.assistantId || !form.vapiKey) {
      toast({ title: "Missing fields", description: "Business Name, Assistant ID, and Vapi Key are required.", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assistantId: form.assistantId,
          businessName: form.businessName,
          description: form.description,
          vapiKey: form.vapiKey,
          clientName: form.clientName,
          companyName: form.companyName,
          industry: form.industry,
          calendlyUrl: form.calendlyUrl,
          contactEmail: form.contactEmail,
          contactPhone: form.contactPhone,
          customSubdomain: form.customSubdomain,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to create demo page");
      toast({ title: "Demo page created!", description: result.url });
      setOpen(false);
      setForm({ businessName: "", description: "", assistantId: "", vapiKey: "", clientName: "", companyName: "", industry: "", calendlyUrl: "", contactEmail: "", contactPhone: "", customSubdomain: "" });
      onCreated();
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" />Create Demo Page</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Demo Page</DialogTitle>
          <DialogDescription>Fill in the details to generate a personalized demo landing page.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Business Name *</Label>
              <Input value={form.businessName} onChange={(e) => update("businessName", e.target.value)} placeholder="e.g. Denat Clinic" />
            </div>
            <div>
              <Label>Company Name</Label>
              <Input value={form.companyName} onChange={(e) => update("companyName", e.target.value)} placeholder="e.g. ABC Dental" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Client Name</Label>
              <Input value={form.clientName} onChange={(e) => update("clientName", e.target.value)} placeholder="e.g. John" />
            </div>
            <div>
              <Label>Industry</Label>
              <Input value={form.industry} onChange={(e) => update("industry", e.target.value)} placeholder="e.g. Healthcare" />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="AI assistant description..." />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Assistant ID *</Label>
              <Input value={form.assistantId} onChange={(e) => update("assistantId", e.target.value)} placeholder="Vapi Assistant ID" />
            </div>
            <div>
              <Label>Vapi Key *</Label>
              <Input value={form.vapiKey} onChange={(e) => update("vapiKey", e.target.value)} placeholder="Vapi Public Key" />
            </div>
          </div>
          <div>
            <Label>Calendly URL</Label>
            <Input value={form.calendlyUrl} onChange={(e) => update("calendlyUrl", e.target.value)} placeholder="https://calendly.com/your-link" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Contact Email</Label>
              <Input value={form.contactEmail} onChange={(e) => update("contactEmail", e.target.value)} placeholder="email@example.com" />
            </div>
            <div>
              <Label>Contact Phone</Label>
              <Input value={form.contactPhone} onChange={(e) => update("contactPhone", e.target.value)} placeholder="+1234567890" />
            </div>
          </div>
          <div>
            <Label>Custom Subdomain</Label>
            <Input value={form.customSubdomain} onChange={(e) => update("customSubdomain", e.target.value)} placeholder="clientname (for clientname.yourdomain.com)" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={creating}>{creating ? "Creating..." : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreatePageDialog;
