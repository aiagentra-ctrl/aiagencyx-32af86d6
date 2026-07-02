// Bell showing hot-lead + follow-up notifications from the notifications table.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Flame, BellRing } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

type Note = {
  id: string; type: string; message: string;
  prospect_id: string | null; read: boolean; created_at: string;
};

export default function NotificationBell({ onJump }: { onJump?: (prospectId: string) => void }) {
  const [notes, setNotes] = useState<Note[]>([]);

  const load = async () => {
    const { data } = await supabase.from("notifications")
      .select("*").order("created_at", { ascending: false }).limit(20);
    setNotes((data as Note[]) || []);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("notif-bell")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (p) => {
        const n = p.new as Note;
        toast(n.type === "hot_lead" ? "🔥 Hot lead" : "Notification", { description: n.message?.slice(0, 200) });
        load();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const unread = notes.filter((n) => !n.read).length;

  const markRead = async (id: string) => {
    await supabase.functions.invoke("mark-notification-read", { body: { id } });
    load();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <BellRing className={`h-4 w-4 ${unread ? "text-orange-500 animate-pulse" : ""}`} />
          {unread > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 text-[10px] bg-orange-500 hover:bg-orange-500">
              {unread > 9 ? "9+" : unread}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Flame className="h-3.5 w-3.5 text-orange-500" /> Notifications
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notes.length === 0 ? (
          <div className="px-2 py-6 text-center text-xs text-muted-foreground">No notifications</div>
        ) : notes.slice(0, 10).map((n) => (
          <DropdownMenuItem key={n.id} className="flex-col items-start gap-0.5"
            onClick={() => { if (n.prospect_id) onJump?.(n.prospect_id); markRead(n.id); }}>
            <div className="flex items-center gap-2 w-full">
              <Badge variant={n.type === "hot_lead" ? "default" : "outline"} className="h-4 text-[9px] capitalize">
                {n.type.replace("_", " ")}
              </Badge>
              {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />}
              <span className="ml-auto text-[9px] text-muted-foreground">{new Date(n.created_at).toLocaleTimeString()}</span>
            </div>
            <span className="text-[11px] truncate w-full">{n.message}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}