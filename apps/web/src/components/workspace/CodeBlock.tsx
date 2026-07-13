import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { EditableBlockText } from "./EditableBlockText";
import type { Block } from "@/lib/workspaceTypes";

const LANGUAGES = ["javascript", "typescript", "python", "sql", "bash", "json", "html", "css"];

export function CodeBlock({
  block,
  onChangeContent,
  onChangeLanguage,
  onKeyDown,
}: {
  block: Block;
  onChangeContent: (text: string) => void;
  onChangeLanguage: (lang: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(block.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800">
        <select
          value={block.language ?? "javascript"}
          onChange={(e) => onChangeLanguage(e.target.value)}
          className="bg-transparent text-xs text-zinc-400 outline-none cursor-pointer"
        >
          {LANGUAGES.map((l) => (
            <option key={l} value={l} className="bg-zinc-900">
              {l}
            </option>
          ))}
        </select>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <EditableBlockText
        blockId={block.id}
        content={block.content}
        placeholder="Cole ou escreva seu código…"
        className="font-mono text-[13px] text-zinc-200 p-3 whitespace-pre-wrap"
        onInput={onChangeContent}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}
