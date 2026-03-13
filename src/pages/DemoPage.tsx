import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Phone } from "lucide-react";

interface DemoPageData {
  id: string;
  slug: string;
  assistant_id: string;
  business_name: string;
  description: string | null;
  vapi_key: string;
}

const DemoPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<DemoPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vapiStarted, setVapiStarted] = useState(false);

  useEffect(() => {
    const fetchPage = async () => {
      if (!slug) return;
      const { data, error: fetchError } = await supabase
        .from("demo_pages")
        .select("*")
        .eq("slug", slug)
        .single();

      if (fetchError || !data) {
        setError("Demo page not found");
        setLoading(false);
        return;
      }

      setPage(data);
      setLoading(false);

      // Increment views
      await supabase
        .from("demo_pages")
        .update({ views: (data.views ?? 0) + 1 })
        .eq("id", data.id);

      // Auto-start Vapi assistant
      try {
        const { default: Vapi } = await import("@vapi-ai/web");
        const vapi = new Vapi(data.vapi_key);
        vapi.start(data.assistant_id);
        setVapiStarted(true);
        console.log("Vapi started with assistantId:", data.assistant_id);
      } catch (err) {
        console.error("Vapi initialization failed:", err);
      }
    };

    fetchPage();
  }, [slug]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold text-foreground">Page Not Found</h1>
          <p className="text-muted-foreground">This demo page doesn't exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="rounded-2xl border bg-card p-8 shadow-lg">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Phone className="h-8 w-8 text-primary" />
            </div>
            <h1 className="mb-2 text-2xl font-bold text-card-foreground">
              {page.business_name}
            </h1>
            {page.description && (
              <p className="text-muted-foreground">{page.description}</p>
            )}
          </div>

          <div
            className="w-full rounded-xl bg-primary px-6 py-4 text-center text-lg font-semibold text-primary-foreground shadow-md transition-all disabled:opacity-60"
          >
            {vapiStarted ? "Assistant is listening..." : "Starting assistant..."}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Powered by AI Voice Technology
        </p>
      </div>
    </div>
  );
};

export default DemoPage;
