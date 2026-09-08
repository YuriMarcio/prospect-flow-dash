import { Handle, NodeResizer, NodeToolbar, Position, type NodeProps, type Node } from "@xyflow/react";
import { ColorPalette } from "./colors";
import { RichTextEditable } from "./RichTextEditable";

export type ShapeKind = "rectangle" | "circle" | "diamond";

export interface ShapeNodeData extends Record<string, unknown> {
  label: string;
  color: string;
  shapeKind: ShapeKind;
}

export type ShapeCanvasNode = Node<ShapeNodeData, "shape">;

const SHAPE_CLASS: Record<ShapeKind, string> = {
  rectangle: "rounded-md",
  circle: "rounded-full",
  diamond: "",
};

const SHAPE_STYLE: Record<ShapeKind, React.CSSProperties> = {
  rectangle: {},
  circle: {},
  diamond: { clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" },
};

interface ShapeNodeProps extends NodeProps<ShapeCanvasNode> {
  onChangeData?: (id: string, patch: Partial<ShapeNodeData>) => void;
}

export function ShapeNode({ id, data, selected, onChangeData }: ShapeNodeProps) {
  return (
    <>
      <NodeResizer isVisible={selected} minWidth={60} minHeight={60} lineStyle={{ borderColor: data.color }} />

      <NodeToolbar isVisible={selected} position={Position.Bottom}>
        <ColorPalette color={data.color} onChange={(color) => onChangeData?.(id, { color })} />
      </NodeToolbar>

      <Handle type="target" position={Position.Left} style={{ background: data.color }} />

      <div
        className={`flex h-full w-full items-center justify-center border-2 px-3 py-2 ${SHAPE_CLASS[data.shapeKind]}`}
        style={{ borderColor: data.color, background: `${data.color}22`, ...SHAPE_STYLE[data.shapeKind] }}
      >
        <RichTextEditable
          html={data.label}
          className="text-center text-sm"
          onChange={(label) => onChangeData?.(id, { label })}
        />
      </div>

      <Handle type="source" position={Position.Right} style={{ background: data.color }} />
    </>
  );
}
