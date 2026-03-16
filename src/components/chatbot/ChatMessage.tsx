import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import ActionButtons, { type ActionButton } from "./ActionButtons";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  onAction?: (btn: ActionButton) => void;
  isLatest?: boolean;
}

/** Parse <!--actions:[...]-->  from the end of AI content */
function parseActions(content: string): { text: string; buttons: ActionButton[] } {
  const match = content.match(/<!--actions:(\[[\s\S]*?\])-->\s*$/);
  if (!match) return { text: content, buttons: [] };

  try {
    const buttons = JSON.parse(match[1]) as ActionButton[];
    const text = content.slice(0, match.index).trimEnd();
    return { text, buttons };
  } catch {
    return { text: content, buttons: [] };
  }
}

const ChatMessage = ({ role, content, onAction, isLatest }: ChatMessageProps) => {
  const { text, buttons } = role === "assistant" ? parseActions(content) : { text: content, buttons: [] };

  return (
    <div className={cn("flex w-full animate-fade-in", role === "user" ? "justify-end" : "justify-start")}>
      <div className="max-w-[85%] space-y-2">
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            role === "user"
              ? "bg-primary text-primary-foreground rounded-br-md shadow-sm"
              : "bg-muted text-foreground rounded-bl-md"
          )}
        >
          {role === "assistant" ? (
            <div className="prose prose-sm max-w-none dark:prose-invert [&>p]:m-0 [&>ul]:my-1 [&>ol]:my-1 [&>p:not(:last-child)]:mb-2">
              <ReactMarkdown>{text}</ReactMarkdown>
            </div>
          ) : (
            <p className="whitespace-pre-wrap">{content}</p>
          )}
        </div>

        {/* Action buttons rendered below the message bubble */}
        {buttons.length > 0 && onAction && (
          <ActionButtons
            buttons={buttons}
            onAction={onAction}
            disabled={!isLatest}
            variant="default"
          />
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
