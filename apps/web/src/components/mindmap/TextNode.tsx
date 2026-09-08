import { NodeResizer, NodeToolbar, Position, type NodeProps, type Node } from "@xyflow/react";
import { ColorPalette } from "./colors";
import { RichTextEditable } from "./RichTextEditable";

export interface TextNodeData extends Record<string, unknown> {
  label: string;
  color: string;
}

export type TextCanvasNode = Node<TextNodeData, "text">;

interface TextNodeProps extends NodeProps<TextCanvasNode> {
  onChangeData?: (id: string, patch: Partial<TextNodeData>) => void;
}

export function TextNode({ id, data, selected, onChangeData }: TextNodeProps) {
  return (
    <>
      <NodeResizer isVisible={selected} minWidth={80} minHeight={30} handleStyle={{ opacity: 0 }} lineStyle={{ borderColor: "transparent" }} />

      <NodeToolbar isVisible={selected} position={Position.Bottom}>
        <ColorPalette color={data.color} onChange={(color) => onChangeData?.(id, { color })} />
      </NodeToolbar>

      <div className="h-full min-w-20 px-1 py-0.5" style={{ color: data.color }}>
        <RichTextEditable
          html={data.label}
          placeholder="Clique duas vezes pra editar"
          className="text-base font-medium"
          onChange={(label) => onChangeData?.(id, { label })}
        />
      </div>
    </>
  );
}
