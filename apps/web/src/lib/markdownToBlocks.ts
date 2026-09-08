import type { Block, BlockType } from "@/lib/workspaceTypes";

// Parser propositalmente simples: cobre a sintaxe mais comum de Markdown
// (headings, listas, citação, código, divisor) e joga o resto como
// parágrafo. O editor de blocos não tem formatação inline (negrito/itálico
// viram texto puro dentro de um EditableBlockText), então marcadores inline
// (**, *, `) são removidos em vez de preservados quebrados.
function stripInlineMarkers(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(?<!\*)\*(?!\*)(.+?)\*(?!\*)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[(.+?)\]\((.+?)\)/g, "$1 ($2)");
}

function newBlock(type: BlockType, content = ""): Block {
  return { id: crypto.randomUUID(), type, content };
}

export function markdownToBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let inCodeFence = false;
  let codeLines: string[] = [];
  let codeLanguage = "";

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    const fenceMatch = line.match(/^```(\w*)\s*$/);
    if (fenceMatch) {
      if (inCodeFence) {
        const block = newBlock("code", codeLines.join("\n"));
        block.language = codeLanguage || "text";
        blocks.push(block);
        codeLines = [];
        codeLanguage = "";
        inCodeFence = false;
      } else {
        inCodeFence = true;
        codeLanguage = fenceMatch[1] ?? "";
      }
      continue;
    }
    if (inCodeFence) {
      codeLines.push(rawLine);
      continue;
    }

    if (!line.trim()) continue;

    const h1 = line.match(/^#\s+(.*)/);
    const h2 = line.match(/^##\s+(.*)/);
    const h3 = line.match(/^###+\s+(.*)/);
    const bullet = line.match(/^[-*]\s+(.*)/);
    const number = line.match(/^\d+\.\s+(.*)/);
    const quote = line.match(/^>\s?(.*)/);
    const divider = /^(-{3,}|\*{3,}|_{3,})$/.test(line.trim());

    if (divider) {
      blocks.push(newBlock("divider"));
    } else if (h1) {
      blocks.push(newBlock("h1", stripInlineMarkers(h1[1])));
    } else if (h2) {
      blocks.push(newBlock("h2", stripInlineMarkers(h2[1])));
    } else if (h3) {
      blocks.push(newBlock("h3", stripInlineMarkers(h3[1])));
    } else if (bullet) {
      blocks.push(newBlock("bullet", stripInlineMarkers(bullet[1])));
    } else if (number) {
      blocks.push(newBlock("number", stripInlineMarkers(number[1])));
    } else if (quote) {
      blocks.push(newBlock("quote", stripInlineMarkers(quote[1])));
    } else {
      blocks.push(newBlock("paragraph", stripInlineMarkers(line)));
    }
  }

  // Fence deixado aberto (arquivo mal formado) — ainda assim salva o que veio.
  if (inCodeFence && codeLines.length) {
    const block = newBlock("code", codeLines.join("\n"));
    block.language = codeLanguage || "text";
    blocks.push(block);
  }

  return blocks.length ? blocks : [newBlock("paragraph")];
}
