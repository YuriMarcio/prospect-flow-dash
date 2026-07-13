import { useEffect, useRef, useState } from "react";
import {
  Copy,
  GripVertical,
  Link2,
  MoveDown,
  MoveUp,
  Plus,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspaceStore } from "@/store/workspace";
import type { Block, BlockType, WorkspacePage } from "@/lib/workspaceTypes";
import { MARKDOWN_SHORTCUTS, filterSlashCommands } from "./blockCommands";
import { EditableBlockText } from "./EditableBlockText";
import { SlashMenu } from "./SlashMenu";
import { CalloutBlock } from "./CalloutBlock";
import { CodeBlock } from "./CodeBlock";
import { ImageBlock } from "./ImageBlock";
import { FileBlock } from "./FileBlock";
import { TableBlock } from "./TableBlock";
import { cn } from "@/lib/utils";

interface SlashState {
  blockId: string;
  query: string;
  activeIndex: number;
}

function emptyBlock(type: BlockType = "paragraph"): Block {
  return { id: crypto.randomUUID(), type, content: "" };
}

export function BlockList({ page, onNavigate }: { page: WorkspacePage; onNavigate: (id: string) => void }) {
  const updateBlocks = useWorkspaceStore((s) => s.updateBlocks);
  const createPage = useWorkspaceStore((s) => s.createPage);
  const allPages = useWorkspaceStore((s) => s.pages);
  const [blocks, setBlocks] = useState<Block[]>(page.blocks);
  const blockRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [slash, setSlash] = useState<SlashState | null>(null);
  const pendingFocus = useRef<{ id: string; pos: "start" | "end" } | null>(null);

  useEffect(() => {
    setBlocks(page.blocks.length ? page.blocks : [emptyBlock()]);
    setSlash(null);
  }, [page.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const pending = pendingFocus.current;
    if (!pending) return;
    const el = blockRefs.current.get(pending.id);
    if (el) {
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(pending.pos === "start");
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
    pendingFocus.current = null;
  });

  function commit(next: Block[]) {
    setBlocks(next);
    updateBlocks(page.id, next);
  }

  function patchBlock(id: string, patch: Partial<Block>) {
    commit(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function insertAfter(id: string, type: BlockType = "paragraph") {
    const index = blocks.findIndex((b) => b.id === id);
    const newBlock = emptyBlock(type);
    const next = [...blocks];
    next.splice(index + 1, 0, newBlock);
    commit(next);
    pendingFocus.current = { id: newBlock.id, pos: "start" };
  }

  function removeBlock(id: string) {
    const index = blocks.findIndex((b) => b.id === id);
    if (index === -1 || blocks.length === 1) return;
    const focusId = blocks[index - 1]?.id ?? blocks[index + 1]?.id;
    commit(blocks.filter((b) => b.id !== id));
    if (focusId) pendingFocus.current = { id: focusId, pos: "end" };
  }

  function duplicateBlock(id: string) {
    const index = blocks.findIndex((b) => b.id === id);
    if (index === -1) return;
    const copy: Block = { ...blocks[index], id: crypto.randomUUID() };
    const next = [...blocks];
    next.splice(index + 1, 0, copy);
    commit(next);
  }

  function moveBlock(id: string, dir: -1 | 1) {
    const index = blocks.findIndex((b) => b.id === id);
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[newIndex]] = [next[newIndex], next[index]];
    commit(next);
  }

  function changeBlockType(id: string, type: BlockType) {
    if (type === "page") {
      // Cria uma subpágina de verdade (filha da página atual) e vincula o bloco a ela.
      const newPageId = createPage(page.id, "", "📄");
      patchBlock(id, { type: "page", content: "", pageRefId: newPageId });
    } else {
      patchBlock(id, { type, content: "" });
    }
    setSlash(null);
    pendingFocus.current = { id, pos: "start" };
  }

  function handleInput(block: Block, text: string) {
    if (text.startsWith("/")) {
      setSlash({ blockId: block.id, query: text.slice(1), activeIndex: 0 });
      patchBlock(block.id, { content: text });
      return;
    }
    if (slash?.blockId === block.id) setSlash(null);

    for (const shortcut of MARKDOWN_SHORTCUTS) {
      if (shortcut.pattern.test(text)) {
        patchBlock(block.id, { type: shortcut.type, content: "" });
        // A troca de tipo remonta o EditableBlockText (via key em BlockContent),
        // o que derruba o foco — sem isso o cursor cai pro body e o usuário
        // perde o que continuar digitando na sequência.
        pendingFocus.current = { id: block.id, pos: "start" };
        return;
      }
    }
    if (text === "```") {
      patchBlock(block.id, { type: "code", content: "", language: "javascript" });
      pendingFocus.current = { id: block.id, pos: "start" };
      return;
    }
    if (text === "---") {
      patchBlock(block.id, { type: "divider", content: "" });
      insertAfter(block.id);
      return;
    }

    patchBlock(block.id, { content: text });
  }

  function handleKeyDown(block: Block, e: React.KeyboardEvent<HTMLDivElement>) {
    if (slash?.blockId === block.id) {
      const filtered = filterSlashCommands(slash.query);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlash((s) => (s ? { ...s, activeIndex: Math.min(s.activeIndex + 1, Math.max(filtered.length - 1, 0)) } : s));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlash((s) => (s ? { ...s, activeIndex: Math.max(s.activeIndex - 1, 0) } : s));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const cmd = filtered[slash.activeIndex];
        if (cmd) changeBlockType(block.id, cmd.type);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSlash(null);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if ((block.type === "bullet" || block.type === "number" || block.type === "todo") && block.content.trim() === "") {
        patchBlock(block.id, { type: "paragraph" });
        return;
      }
      const continuationType: BlockType =
        block.type === "bullet" || block.type === "number" || block.type === "todo" ? block.type : "paragraph";
      insertAfter(block.id, continuationType);
      return;
    }

    if (e.key === "Backspace") {
      const isEmpty = (e.currentTarget.textContent ?? "") === "";
      if (isEmpty && blocks.length > 1) {
        e.preventDefault();
        removeBlock(block.id);
      }
    }
  }

  function numberIndexOf(index: number): number {
    let count = 1;
    for (let i = index - 1; i >= 0 && blocks[i].type === "number"; i--) count++;
    return count;
  }

  return (
    <div className="space-y-0.5">
      {blocks.map((block, index) => (
        <BlockRow
          key={block.id}
          onAddBelow={() => insertAfter(block.id)}
          onDuplicate={() => duplicateBlock(block.id)}
          onDelete={() => removeBlock(block.id)}
          onMoveUp={() => moveBlock(block.id, -1)}
          onMoveDown={() => moveBlock(block.id, 1)}
        >
          <BlockContent
            // Força remount ao trocar de tipo (ex.: parágrafo -> H1 via slash
            // command) — sem isso o React reaproveita o mesmo nó
            // contentEditable e o texto antigo fica preso no DOM, já que
            // EditableBlockText só resincroniza no mount.
            key={`${block.id}:${block.type}`}
            block={block}
            numberIndex={block.type === "number" ? numberIndexOf(index) : undefined}
            registerRef={(el) => {
              if (el) blockRefs.current.set(block.id, el);
              else blockRefs.current.delete(block.id);
            }}
            onInput={(text) => handleInput(block, text)}
            onKeyDown={(e) => handleKeyDown(block, e)}
            onPatch={(patch) => patchBlock(block.id, patch)}
            allPages={allPages}
            onNavigate={onNavigate}
          />
          {slash?.blockId === block.id && (
            <SlashMenu
              query={slash.query}
              activeIndex={slash.activeIndex}
              onHoverIndex={(i) => setSlash((s) => (s ? { ...s, activeIndex: i } : s))}
              onSelect={(type) => changeBlockType(block.id, type)}
            />
          )}
        </BlockRow>
      ))}
    </div>
  );
}

function BlockRow({
  children,
  onAddBelow,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  children: React.ReactNode;
  onAddBelow: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className="group/block relative flex items-start gap-1 -ml-14 pl-14">
      <div className="flex items-center gap-0.5 pt-1 opacity-0 group-hover/block:opacity-100 transition-opacity shrink-0">
        <button
          onClick={onAddBelow}
          title="Adicionar bloco abaixo"
          className="h-6 w-6 grid place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              title="Opções do bloco"
              className="h-6 w-6 grid place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground cursor-grab"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="h-3.5 w-3.5" />
              Duplicar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onMoveUp}>
              <MoveUp className="h-3.5 w-3.5" />
              Mover para cima
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onMoveDown}>
              <MoveDown className="h-3.5 w-3.5" />
              Mover para baixo
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="min-w-0 flex-1 relative">{children}</div>
    </div>
  );
}

function BlockContent({
  block,
  numberIndex,
  registerRef,
  onInput,
  onKeyDown,
  onPatch,
  allPages,
  onNavigate,
}: {
  block: Block;
  numberIndex?: number;
  registerRef: (el: HTMLDivElement | null) => void;
  onInput: (text: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onPatch: (patch: Partial<Block>) => void;
  allPages: Record<string, WorkspacePage>;
  onNavigate: (id: string) => void;
}) {
  switch (block.type) {
    case "h1":
      return (
        <EditableBlockText
          ref={registerRef}
          blockId={block.id}
          content={block.content}
          placeholder="Título 1"
          className="text-3xl font-bold tracking-tight pt-2"
          onInput={onInput}
          onKeyDown={onKeyDown}
        />
      );
    case "h2":
      return (
        <EditableBlockText
          ref={registerRef}
          blockId={block.id}
          content={block.content}
          placeholder="Título 2"
          className="text-2xl font-semibold tracking-tight pt-1.5"
          onInput={onInput}
          onKeyDown={onKeyDown}
        />
      );
    case "h3":
      return (
        <EditableBlockText
          ref={registerRef}
          blockId={block.id}
          content={block.content}
          placeholder="Título 3"
          className="text-xl font-semibold tracking-tight pt-1"
          onInput={onInput}
          onKeyDown={onKeyDown}
        />
      );
    case "bullet":
      return (
        <div className="flex items-start gap-2">
          <span className="mt-2.5 h-1.5 w-1.5 rounded-full bg-foreground shrink-0" />
          <EditableBlockText
            ref={registerRef}
            blockId={block.id}
            content={block.content}
            placeholder="Item da lista"
            className="flex-1 text-base"
            onInput={onInput}
            onKeyDown={onKeyDown}
          />
        </div>
      );
    case "number":
      return (
        <div className="flex items-start gap-2">
          <span className="mt-0.5 text-sm text-muted-foreground tabular-nums shrink-0 w-4 text-right">
            {numberIndex}.
          </span>
          <EditableBlockText
            ref={registerRef}
            blockId={block.id}
            content={block.content}
            placeholder="Item da lista"
            className="flex-1 text-base"
            onInput={onInput}
            onKeyDown={onKeyDown}
          />
        </div>
      );
    case "todo":
      return (
        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={Boolean(block.checked)}
            onChange={(e) => onPatch({ checked: e.target.checked })}
            className="mt-1.5 h-3.5 w-3.5 rounded border-border shrink-0 accent-primary cursor-pointer"
          />
          <EditableBlockText
            ref={registerRef}
            blockId={block.id}
            content={block.content}
            placeholder="Tarefa"
            className={cn("flex-1 text-base", block.checked && "line-through text-muted-foreground")}
            onInput={onInput}
            onKeyDown={onKeyDown}
          />
        </div>
      );
    case "quote":
      return (
        <div className="border-l-2 border-primary pl-3">
          <EditableBlockText
            ref={registerRef}
            blockId={block.id}
            content={block.content}
            placeholder="Citação"
            className="text-base italic text-muted-foreground"
            onInput={onInput}
            onKeyDown={onKeyDown}
          />
        </div>
      );
    case "divider":
      return <hr className="border-border my-2" />;
    case "link":
      return (
        <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
          <Link2 className="h-3.5 w-3.5 text-primary shrink-0" />
          <EditableBlockText
            ref={registerRef}
            blockId={block.id}
            content={block.content}
            placeholder="Cole um link…"
            className="flex-1 text-sm text-primary"
            onInput={onInput}
            onKeyDown={onKeyDown}
          />
        </div>
      );
    case "callout":
      return (
        <CalloutBlock
          block={block}
          onChangeTitle={(text) => onPatch({ title: text })}
          onChangeBody={(text) => onPatch({ content: text })}
          onChangeKind={(kind) => onPatch({ calloutKind: kind })}
          onKeyDown={onKeyDown}
        />
      );
    case "code":
      return (
        <CodeBlock
          block={block}
          onChangeContent={(text) => onPatch({ content: text })}
          onChangeLanguage={(language) => onPatch({ language })}
          onKeyDown={onKeyDown}
        />
      );
    case "image":
      return (
        <ImageBlock
          block={block}
          onSetImage={(url) => onPatch({ imageUrl: url })}
          onSetSize={(size) => onPatch({ imageSize: size })}
          onSetCaption={(text) => onPatch({ caption: text })}
          onRemoveImage={() => onPatch({ imageUrl: undefined, caption: undefined })}
          onCaptionKeyDown={onKeyDown}
        />
      );
    case "file":
      return (
        <FileBlock
          block={block}
          onSetFile={(meta) => onPatch({ fileMeta: meta })}
          onRemove={() => onPatch({ fileMeta: undefined })}
        />
      );
    case "table":
      return <TableBlock table={block.table} onChange={(table) => onPatch({ table })} />;
    case "page": {
      const linked = block.pageRefId ? allPages[block.pageRefId] : undefined;
      return (
        <button
          onClick={() => linked && onNavigate(linked.id)}
          className="w-full flex items-center gap-2 rounded-md border border-border px-3 py-2 hover:bg-accent/40 hover:border-primary/30 transition-colors text-left"
        >
          <span className="text-base leading-none">{linked?.icon ?? "📄"}</span>
          <span className={cn("text-sm font-medium underline-offset-2", !linked?.title && "italic text-muted-foreground")}>
            {linked?.title || "Sem título"}
          </span>
        </button>
      );
    }
    case "paragraph":
    default:
      return (
        <EditableBlockText
          ref={registerRef}
          blockId={block.id}
          content={block.content}
          placeholder='Escreva alguma coisa, ou digite "/" para comandos'
          className="text-base leading-relaxed"
          onInput={onInput}
          onKeyDown={onKeyDown}
        />
      );
  }
}
