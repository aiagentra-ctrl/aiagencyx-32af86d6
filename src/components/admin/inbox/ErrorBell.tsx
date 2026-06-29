// Bell with unread error count + dropdown of recent errors.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, AlertCircle } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

type Err = {
  id: string; source: string; message: string;
  prospect_id: string | null; message_id: string | null;
  acknowledged: boolean; created_at: string;
};

export default function ErrorBell({ onJump }: { onJump?: (prospectId: string) => void }) {
  const [errors, setErrors] = useState<Err[]>([]);
  const [seenIds] = useState<Set<string>>(new Set());

  const load = async () => {
    const { data } = await supabase.from("error_events")
      .select("*").order("created_at", { ascending: false }).limit(20);
    setErrors((data as Err[]) || []);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("error-bell")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "error_events" }, (p) => {
        const e = p.new as Err;
        if (!seenIds.has(e.id)) {
          seenIds.add(e.id);
          toast.error(`Pipeline error · ${e.source}`, { description: e.message.slice(0, 200) });
        }
        load();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "error_events" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unread = errors.filter((e) => !e.acknowledged).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className={`h-4 w-4 ${unread ? "text-red-500" : ""}`} />
          {unread > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 text-[10px] bg-red-500 hover:bg-red-500 animate-scale-in">
              {unread > 9 ? "9+" : unread}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 text-red-500" /> Recent errors
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {errors.length === 0 ? (
          <div className="px-2 py-6 text-center text-xs text-muted-foreground">No errors</div>
        ) : errors.slice(0, 10).map((e) => (
          <DropdownMenuItem key={e.id} className="flex-col items-start gap-0.5" onClick={() => e.prospect_id && onJump?.(e.prospect_id)}>
            <div className="flex items-center gap-2 w-full">
              <Badge variant="outline" className="h-4 text-[9px] capitalize">{e.source}</Badge>
              {!e.acknowledged && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
              <span className="ml-auto text-[9px] text-muted-foreground">{new Date(e.created_at).toLocaleTimeString()}</span>
            </div>
            <span className="text-[11px] truncate w-full">{e.message}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
