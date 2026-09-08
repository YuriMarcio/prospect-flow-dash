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

interface ColorPaletteProps {
  color: string;
  onChange: (color: string) => void;
}

export function ColorPalette({ color, onChange }: ColorPaletteProps) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-border bg-popover p-1 shadow-md">
      {NOTE_COLORS.map((swatch) => (
        <button
          key={swatch}
          type="button"
          onClick={() => onChange(swatch)}
          className="h-3.5 w-3.5 shrink-0 rounded-full ring-offset-1 transition-transform hover:scale-110"
          style={{ background: swatch, boxShadow: swatch === color ? `0 0 0 1.5px ${swatch}` : undefined }}
          aria-label={`Cor ${swatch}`}
        />
      ))}
    </div>
  );
}
