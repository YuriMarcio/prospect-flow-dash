import { useState } from "react";
import { NodeResizer, NodeToolbar, Position, type NodeProps, type Node } from "@xyflow/react";
import { ColorPalette } from "./colors";

export interface FrameNodeData extends Record<string, unknown> {
  label: string;
  color: string;
}

export type FrameCanvasNode = Node<FrameNodeData, "frame">;

interface FrameNodeProps extends NodeProps<FrameCanvasNode> {
  onChangeData?: (id: string, patch: Partial<FrameNodeData>) => void;
}

export function FrameNode({ id, data, selected, onChangeData }: FrameNodeProps) {
  const [editingTitle, setEditingTitle] = useState(false);

  return (
    <>
      <NodeResizer isVisible={selected} minWidth={200} minHeight={140} lineStyle={{ borderColor: data.color }} />

      <NodeToolbar isVisible={selected} position={Position.Top}>
        <ColorPalette color={data.color} onChange={(color) => onChangeData?.(id, { color })} />
      </NodeToolbar>

      <div
        className="flex h-full w-full flex-col rounded-md border-2 bg-background/30"
        style={{ borderColor: data.color }}
      >
        <div
          className="shrink-0 rounded-t-sm px-2 py-1 text-xs font-semibold text-white"
          style={{ background: data.color }}
          onDoubleClick={() => setEditingTitle(true)}
        >
          {editingTitle ? (
            <input
              autoFocus
              defaultValue={data.label}
              placeholder="Nome do frame"
              className="w-full border-none bg-transparent text-xs font-semibold text-white outline-none placeholder:text-white/70"
              onBlur={(e) => {
                setEditingTitle(false);
                onChangeData?.(id, { label: e.target.value });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
            />
          ) : (
            data.label || "Frame"
          )}
        </div>
        <div className="flex-1" />
      </div>
    </>
  );
}
