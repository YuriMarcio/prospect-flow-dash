export type BlockType =
  | "paragraph"
  | "h1"
  | "h2"
  | "h3"
  | "bullet"
  | "number"
  | "todo"
  | "quote"
  | "divider"
  | "image"
  | "file"
  | "link"
  | "code"
  | "callout"
  | "table"
  | "page";

export type CalloutKind = "info" | "warning" | "success" | "error" | "idea";

export interface TableData {
  headers: string[];
  rows: string[][];
}

export interface Block {
  id: string;
  type: BlockType;
  content: string;
  /** Linha em destaque opcional (usada pelo callout). */
  title?: string;
  checked?: boolean;
  language?: string;
  calloutKind?: CalloutKind;
  imageUrl?: string;
  imageSize?: "small" | "medium" | "full";
  caption?: string;
  fileMeta?: { name: string; sizeLabel: string };
  table?: TableData;
  /** Usado pelo bloco "page" — id da subpágina criada e vinculada a esse bloco. */
  pageRefId?: string;
}

export interface WorkspacePage {
  id: string;
  icon: string;
  title: string;
  description: string;
  parentId: string | null;
  favorite: boolean;
  order: number;
  blocks: Block[];
  /** Mapa mental vinculado a essa página (ver /mapas-mentais). */
  linkedBoardId?: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export const CURRENT_USER = { initials: "YU", name: "yurei" };
export const OTHER_USER = { initials: "IR", name: "Irmão" };
