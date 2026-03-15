import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

interface Chatbot {
  id: string;
  business_name: string;
  website_url: string | null;
  slug: string;
  system_prompt: string;
  ai_provider: string;
  ai_model: string;
  api_key_encrypted: string | null;
  industry: string | null;
  brand_tone: string | null;
  status: string;
}

interface EditChatbotDialogProps {
  chatbot: Chatbot | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

const EditChatbotDialog = ({ chatbot, open, onOpenChange, onUpdated }: EditChatbotDialogProps) => {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    system_prompt: "",
    ai_provider: "lovable",
    ai_model: "google/gemini-3-flash-preview",
    api_key_encrypted: "",
    status: "active",
  });

  useEffect(() => {
    if (chatbot) {
      setForm({
        system_prompt: chatbot.system_prompt || "",
        ai_provider: chatbot.ai_provider || "lovable",
        ai_model: chatbot.ai_model || "google/gemini-3-flash-preview",
        api_key_encrypted: chatbot.api_key_encrypted || "",
        status: chatbot.status || "active",
      });
    }
  }, [chatbot]);

  const handleSave = async () => {
    if (!chatbot) return;
    setSaving(true);

    const { error } = await supabase
      .from("chatbots")
      .update({
        system_prompt: form.system_prompt,
        ai_provider: form.ai_provider,
        ai_model: form.ai_model,
        api_key_encrypted: form.api_key_encrypted || null,
        status: form.status,
      })
      .eq("id", chatbot.id);

    if (error) {
      toast({ title: "Error saving", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Chatbot updated!" });
      onOpenChange(false);
      onUpdated();
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Chatbot — {chatbot?.business_name}</DialogTitle>
          <DialogDescription>Update the chatbot configuration, prompt, and AI provider.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>System Prompt</Label>
            <Textarea
              value={form.system_prompt}
              onChange={(e) => setForm((f) => ({ ...f, system_prompt: e.target.value }))}
              rows={6}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>AI Provider</Label>
              <Select value={form.ai_provider} onValueChange={(v) => setForm((f) => ({ ...f, ai_provider: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lovable">Lovable AI (default)</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="openrouter">OpenRouter</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Model</Label>
              <Input
                value={form.ai_model}
                onChange={(e) => setForm((f) => ({ ...f, ai_model: e.target.value }))}
                placeholder="google/gemini-3-flash-preview"
              />
            </div>
          </div>
          {form.ai_provider !== "lovable" && (
            <div>
              <Label>API Key</Label>
              <Input
                type="password"
                value={form.api_key_encrypted}
                onChange={(e) => setForm((f) => ({ ...f, api_key_encrypted: e.target.value }))}
                placeholder="Enter API key for custom provider"
              />
            </div>
          )}
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditChatbotDialog;
