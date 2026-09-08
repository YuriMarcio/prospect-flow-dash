import { Bold, Italic, List } from "lucide-react";

const FONT_SIZES = [
  { label: "P", execValue: "2", title: "Texto pequeno" },
  { label: "M", execValue: "3", title: "Texto médio" },
  { label: "G", execValue: "5", title: "Texto grande" },
];

interface RichTextToolbarProps {
  onCommand: (command: string, value?: string) => void;
}

const buttonClass =
  "flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-medium text-popover-foreground hover:bg-accent hover:text-accent-foreground";

export function RichTextToolbar({ onCommand }: RichTextToolbarProps) {
  return (
    <div
      className="flex items-center gap-0.5 rounded-md border border-border bg-popover p-1 shadow-md"
      onMouseDown={(e) => e.preventDefault()}
    >
      <button type="button" title="Negrito" className={buttonClass} onClick={() => onCommand("bold")}>
        <Bold className="h-3.5 w-3.5" />
      </button>
      <button type="button" title="Itálico" className={buttonClass} onClick={() => onCommand("italic")}>
        <Italic className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title="Lista"
        className={buttonClass}
        onClick={() => onCommand("insertUnorderedList")}
      >
        <List className="h-3.5 w-3.5" />
      </button>
      <div className="mx-0.5 h-4 w-px bg-border" />
      {FONT_SIZES.map((size) => (
        <button
          key={size.execValue}
          type="button"
          title={size.title}
          className={buttonClass}
          onClick={() => onCommand("fontSize", size.execValue)}
        >
          {size.label}
        </button>
      ))}
    </div>
  );
}
