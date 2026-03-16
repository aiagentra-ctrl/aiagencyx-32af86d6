import { cn } from "@/lib/utils";

export interface ActionButton {
  label: string;
  value: string;
  url?: string;
  icon?: string;
}

interface ActionButtonsProps {
  buttons: ActionButton[];
  onAction: (button: ActionButton) => void;
  disabled?: boolean;
  variant?: "default" | "grid" | "compact";
}

const ActionButtons = ({ buttons, onAction, disabled, variant = "default" }: ActionButtonsProps) => {
  if (!buttons.length) return null;

  const handleClick = (btn: ActionButton) => {
    if (btn.url) {
      window.open(btn.url, "_blank", "noopener,noreferrer");
    } else {
      onAction(btn);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-wrap gap-2 pt-1",
        variant === "grid" && "grid grid-cols-2",
        variant === "compact" && "gap-1.5"
      )}
    >
      {buttons.map((btn, i) => (
        <button
          key={i}
          onClick={() => handleClick(btn)}
          disabled={disabled}
          className={cn(
            "group relative rounded-xl border border-primary/20 bg-card px-3.5 py-2.5 text-left text-sm font-medium",
            "text-foreground shadow-sm transition-all duration-200",
            "hover:border-primary/40 hover:bg-primary/5 hover:shadow-md hover:-translate-y-0.5",
            "active:translate-y-0 active:shadow-sm",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0",
            variant === "compact" && "px-3 py-2 text-xs rounded-lg"
          )}
        >
          <span className="flex items-center gap-2">
            {btn.icon && <span className="text-base">{btn.icon}</span>}
            <span>{btn.label}</span>
          </span>
          {btn.url && (
            <span className="ml-1 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">↗</span>
          )}
        </button>
      ))}
    </div>
  );
};

export default ActionButtons;
