import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import ActionButtons, { type ActionButton } from "./ActionButtons";
import RecommendationCards, { type RecommendationItem } from "./RecommendationCards";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  onAction?: (btn: ActionButton) => void;
  isLatest?: boolean;
}

/** Parse <!--recommendations:[...]-->  from AI content */
function parseRecommendations(content: string): { text: string; items: RecommendationItem[] } {
  const match = content.match(/<!--recommendations:(\[[\s\S]*?\])-->/);
  if (!match) return { text: content, items: [] };

  try {
    const items = JSON.parse(match[1]) as RecommendationItem[];
    const text = content.slice(0, match.index) + content.slice(match.index! + match[0].length);
    return { text: text.trim(), items };
  } catch {
    return { text: content, items: [] };
  }
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
  let text = content;
  let buttons: ActionButton[] = [];
  let recommendations: RecommendationItem[] = [];

  if (role === "assistant") {
    const recResult = parseRecommendations(text);
    text = recResult.text;
    recommendations = recResult.items;

    const actResult = parseActions(text);
    text = actResult.text;
    buttons = actResult.buttons;
  }

  return (
    <div className={cn("flex w-full", role === "user" ? "justify-end" : "justify-start")}>
      <div className="max-w-[85%] space-y-2">
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm leading-relaxed",
            role === "user"
              ? "bg-primary text-primary-foreground rounded-br-md shadow-sm"
              : "bg-muted text-foreground rounded-bl-md"
          )}
        >
          {role === "assistant" ? (
            <div className="prose prose-sm max-w-none dark:prose-invert [&>p]:m-0 [&>ul]:my-1 [&>ol]:my-1 [&>p:not(:last-child)]:mb-2 [&>h3]:mt-2 [&>h3]:mb-1 [&>h3]:text-sm [&>h3]:font-semibold">
              <ReactMarkdown>{text}</ReactMarkdown>
            </div>
          ) : (
            <p className="whitespace-pre-wrap">{content}</p>
          )}
        </div>

        {/* Recommendation cards */}
        {recommendations.length > 0 && onAction && (
          <RecommendationCards
            items={recommendations}
            onAction={onAction}
            disabled={!isLatest}
          />
        )}

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
