import { useState } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";

export interface NoteNodeData extends Record<string, unknown> {
  label: string;
  color: string;
}

export type NoteCanvasNode = Node<NoteNodeData, "note">;

export const NOTE_COLORS = [
  "#64748b", // slate
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#3b82f6", // blue
  "#a855f7", // purple
  "#ec4899", // pink
];

interface NoteNodeProps extends NodeProps<NoteCanvasNode> {
  onChangeData?: (id: string, patch: Partial<NoteNodeData>) => void;
}

export function NoteNode({ id, data, selected, onChangeData }: NoteNodeProps) {
  const [editing, setEditing] = useState(false);

  return (
    <div
      className="min-w-40 max-w-64 rounded-lg border-2 bg-card px-3 py-2 shadow-sm"
      style={{ borderColor: data.color }}
    >
      <Handle type="target" position={Position.Left} style={{ background: data.color }} />

      {editing ? (
        <textarea
          autoFocus
          defaultValue={data.label}
          rows={2}
          className="w-full resize-none border-none bg-transparent text-sm outline-none"
          onBlur={(e) => {
            setEditing(false);
            onChangeData?.(id, { label: e.target.value });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
        />
      ) : (
        <p
          onDoubleClick={() => setEditing(true)}
          className="min-h-[1.5rem] whitespace-pre-wrap break-words text-sm"
        >
          {data.label || <span className="text-muted-foreground">Clique duas vezes pra editar</span>}
        </p>
      )}

      {selected && (
        <div className="mt-2 flex items-center gap-1 border-t border-border pt-1.5">
          {NOTE_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onChangeData?.(id, { color })}
              className="h-3.5 w-3.5 shrink-0 rounded-full ring-offset-1 transition-transform hover:scale-110"
              style={{ background: color, boxShadow: color === data.color ? `0 0 0 1.5px ${color}` : undefined }}
              aria-label={`Cor ${color}`}
            />
          ))}
        </div>
      )}

      <Handle type="source" position={Position.Right} style={{ background: data.color }} />
    </div>
  );
}
