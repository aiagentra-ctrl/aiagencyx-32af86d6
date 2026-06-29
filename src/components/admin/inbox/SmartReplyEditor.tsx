// Smart reply editor: locked {{variable}} chips inside contentEditable text.
import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Variable } from "lucide-react";

export type SmartReplyEditorHandle = {
  setValue: (raw: string) => void;
  getValue: () => string;
  focus: () => void;
};

type Props = {
  variables: string[]; // available chip names
  placeholder?: string;
  initial?: string;
  onChange?: (value: string) => void;
};

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function renderTokens(raw: string): string {
  // turn {{var}} into a chip span; everything else escaped text
  const re = /\{\{\s*([a-zA-Z_]+)\s*\}\}/g;
  let html = ""; let last = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    html += escapeHtml(raw.slice(last, m.index));
    html += `<span contenteditable="false" data-var="${m[1]}" class="inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded-md bg-primary/15 text-primary border border-primary/30 text-xs font-medium select-none align-baseline">{{${m[1]}}}</span>`;
    last = re.lastIndex;
  }
  html += escapeHtml(raw.slice(last));
  return html.replace(/\n/g, "<br/>");
}

function serialize(root: HTMLElement): string {
  let out = "";
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) { out += node.textContent || ""; return; }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    if (el.dataset.var) { out += `{{${el.dataset.var}}}`; return; }
    if (el.tagName === "BR") { out += "\n"; return; }
    if (el.tagName === "DIV" || el.tagName === "P") {
      if (out && !out.endsWith("\n")) out += "\n";
      el.childNodes.forEach(walk);
      return;
    }
    el.childNodes.forEach(walk);
  };
  root.childNodes.forEach(walk);
  return out;
}

const SmartReplyEditor = forwardRef<SmartReplyEditorHandle, Props>(function SmartReplyEditor(
  { variables, placeholder, initial = "", onChange },
  ref,
) {
  const editorRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    setValue: (raw: string) => {
      if (editorRef.current) {
        editorRef.current.innerHTML = renderTokens(raw);
        onChange?.(serialize(editorRef.current));
      }
    },
    getValue: () => (editorRef.current ? serialize(editorRef.current) : ""),
    focus: () => editorRef.current?.focus(),
  }));

  useEffect(() => {
    if (editorRef.current && initial) {
      editorRef.current.innerHTML = renderTokens(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const insertChip = (name: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      editorRef.current.innerHTML += renderTokens(`{{${name}}}`);
    } else {
      const range = sel.getRangeAt(0);
      const wrapper = document.createElement("span");
      wrapper.innerHTML = renderTokens(`{{${name}}}`);
      const chip = wrapper.firstChild!;
      range.deleteContents();
      range.insertNode(chip);
      range.setStartAfter(chip);
      range.setEndAfter(chip);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    onChange?.(serialize(editorRef.current));
  };

  return (
    <div className="space-y-2">
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder || "Type your reply…"}
        onInput={() => editorRef.current && onChange?.(serialize(editorRef.current))}
        className="min-h-[120px] max-h-[260px] overflow-auto rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground"
      />
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs">
              <Variable className="mr-1 h-3 w-3" /> Insert variable <ChevronDown className="ml-1 h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {variables.map((v) => (
              <DropdownMenuItem key={v} onClick={() => insertChip(v)}>
                {`{{${v}}}`}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="text-[10px] text-muted-foreground">Chips are locked — click and Backspace to remove whole.</span>
      </div>
    </div>
  );
});

export default SmartReplyEditor;
