import { Handle, NodeToolbar, Position, type NodeProps, type Node } from "@xyflow/react";
import { ColorPalette } from "./colors";
import { RichTextEditable } from "./RichTextEditable";

export interface NoteNodeData extends Record<string, unknown> {
  label: string;
  color: string;
}

export type NoteCanvasNode = Node<NoteNodeData, "note">;

interface NoteNodeProps extends NodeProps<NoteCanvasNode> {
  onChangeData?: (id: string, patch: Partial<NoteNodeData>) => void;
}

export function NoteNode({ id, data, selected, onChangeData }: NoteNodeProps) {
  return (
    <div
      className="min-w-40 max-w-64 rounded-lg border-2 bg-card px-3 py-2 shadow-sm"
      style={{ borderColor: data.color }}
    >
      <NodeToolbar isVisible={selected} position={Position.Bottom}>
        <ColorPalette color={data.color} onChange={(color) => onChangeData?.(id, { color })} />
      </NodeToolbar>

      <Handle type="target" position={Position.Left} style={{ background: data.color }} />

      <RichTextEditable
        html={data.label}
        placeholder="Clique duas vezes pra editar"
        className="text-sm"
        onChange={(label) => onChangeData?.(id, { label })}
      />

      <Handle type="source" position={Position.Right} style={{ background: data.color }} />
    </div>
  );
}
