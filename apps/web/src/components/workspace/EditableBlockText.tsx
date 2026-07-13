import { forwardRef, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * div contentEditable não-controlado: o DOM é a fonte da verdade enquanto o
 * usuário digita. Só sincronizamos block.content -> DOM ao trocar de bloco
 * (ou numa troca externa, ex. desfazer) — nunca a cada tecla, senão o cursor
 * salta pro início a cada re-render.
 */
export const EditableBlockText = forwardRef<
  HTMLDivElement,
  {
    blockId: string;
    content: string;
    placeholder?: string;
    className?: string;
    onInput: (text: string) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
    onFocus?: () => void;
  }
>(({ blockId, content, placeholder, className, onInput, onKeyDown, onFocus }, forwardedRef) => {
  const innerRef = useRef<HTMLDivElement>(null);
  const lastSyncedBlockId = useRef<string | null>(null);

  useEffect(() => {
    if (lastSyncedBlockId.current !== blockId && innerRef.current) {
      innerRef.current.textContent = content;
      lastSyncedBlockId.current = blockId;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockId]);

  return (
    <div
      ref={(node) => {
        innerRef.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      }}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      className={cn("outline-none min-h-[1.5em]", className)}
      onInput={(e) => onInput(e.currentTarget.textContent ?? "")}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
    />
  );
});
EditableBlockText.displayName = "EditableBlockText";
