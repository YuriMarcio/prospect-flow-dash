import { useCallback, useRef, useState } from "react";
import { NodeToolbar, Position } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { RichTextToolbar } from "./RichTextToolbar";

interface RichTextEditableProps {
  html: string;
  placeholder?: string;
  className?: string;
  onChange: (html: string) => void;
}

/**
 * contentEditable não-controlado (DOM é a fonte da verdade durante a edição,
 * só sincronizamos data.label -> DOM ao entrar em modo de edição) com uma
 * mini toolbar de formatação flutuante via NodeToolbar do React Flow.
 */
export function RichTextEditable({ html, placeholder, className, onChange }: RichTextEditableProps) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const commit = useCallback(() => {
    if (ref.current) onChange(ref.current.innerHTML);
  }, [onChange]);

  function startEditing() {
    setEditing(true);
    requestAnimationFrame(() => {
      const node = ref.current;
      if (!node) return;
      node.innerHTML = html;
      node.focus();
      const range = document.createRange();
      range.selectNodeContents(node);
      range.collapse(false);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    });
  }

  function runCommand(command: string, value?: string) {
    ref.current?.focus();
    document.execCommand(command, false, value);
    commit();
  }

  if (!editing) {
    return (
      <div
        onDoubleClick={startEditing}
        className={cn("min-h-[1.5rem] whitespace-pre-wrap break-words [&_ul]:list-disc [&_ul]:pl-4", className)}
        dangerouslySetInnerHTML={{
          __html: html || (placeholder ? `<span class="text-muted-foreground">${placeholder}</span>` : ""),
        }}
      />
    );
  }

  return (
    <>
      <NodeToolbar isVisible position={Position.Top}>
        <RichTextToolbar onCommand={runCommand} />
      </NodeToolbar>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className={cn(
          "min-h-[1.5rem] whitespace-pre-wrap break-words outline-none [&_ul]:list-disc [&_ul]:pl-4",
          className,
        )}
        onBlur={() => {
          setEditing(false);
          commit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            e.currentTarget.blur();
          }
          if (e.key === "Escape") e.currentTarget.blur();
        }}
        onPaste={(e) => {
          // texto colado vira sempre texto puro — assim o HTML salvo fica restrito
          // aos comandos da própria toolbar (bold/italic/list/fontSize), sem risco
          // de guardar markup arbitrário colado de fora e renderizá-lo depois.
          e.preventDefault();
          document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
        }}
      />
    </>
  );
}
