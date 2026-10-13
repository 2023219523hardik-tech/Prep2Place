"use client";

const COLOR_HEX: Record<string, string> = {
  RED: "#dc2626",
  BLUE: "#2563eb",
  GREEN: "#16a34a",
  PURPLE: "#7c3aed",
  ORANGE: "#ea580c",
  TEAL: "#0d9488",
  GOLD: "#ca8a04",
};

function colorHex(color?: string) {
  return (color && COLOR_HEX[color.toUpperCase()]) || "#334155";
}

/** Returns the SVG path/geometry for a given shape name, centered in a 0-100 viewBox. */
function shapePath(shape: string): { kind: "polygon" | "circle"; points?: string; sides?: number } {
  const s = (shape || "").toUpperCase();
  switch (s) {
    case "CIRCLE":
      return { kind: "circle" };
    case "TRIANGLE":
      return { kind: "polygon", points: regularPolygon(3, -90) };
    case "SQUARE":
      return { kind: "polygon", points: regularPolygon(4, -45) };
    case "RECTANGLE":
      return { kind: "polygon", points: "15,32 85,32 85,68 15,68" };
    case "HEXAGON":
      return { kind: "polygon", points: regularPolygon(6, 0) };
    case "PENTAGON":
      return { kind: "polygon", points: regularPolygon(5, -90) };
    case "STAR":
      return { kind: "polygon", points: starPolygon() };
    case "DIAMOND":
      return { kind: "polygon", points: regularPolygon(4, 0) };
    case "CROSS":
      return { kind: "polygon", points: crossPolygon() };
    default:
      return { kind: "circle" };
  }
}

function regularPolygon(sides: number, rotationDeg: number, radius = 40, cx = 50, cy = 50) {
  const pts: string[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (Math.PI * 2 * i) / sides + (rotationDeg * Math.PI) / 180;
    pts.push(`${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`);
  }
  return pts.join(" ");
}

function starPolygon(cx = 50, cy = 50, outerR = 42, innerR = 18, points = 5) {
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI * i) / points - Math.PI / 2;
    pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return pts.join(" ");
}

function crossPolygon(cx = 50, cy = 50, arm = 16, len = 40) {
  const a = arm, l = len;
  return [
    [cx - a, cy - l], [cx + a, cy - l], [cx + a, cy - a],
    [cx + l, cy - a], [cx + l, cy + a], [cx + a, cy + a],
    [cx + a, cy + l], [cx - a, cy + l], [cx - a, cy + a],
    [cx - l, cy + a], [cx - l, cy - a], [cx - a, cy - a],
  ].map(([x, y]) => `${x},${y}`).join(" ");
}

export interface ShapeIconProps {
  shape: string;
  color?: string;
  fill?: "FILLED" | "OUTLINE" | "STRIPED" | "DOTTED" | string;
  size?: "SMALL" | "MEDIUM" | "LARGE" | string;
  rotation?: number;
  className?: string;
}

/** Renders one symbol as real, generated SVG geometry - never an emoji, never a raster image,
 *  so it always matches the current theme and never depends on external assets. */
export function ShapeIcon({ shape, color, fill = "FILLED", size = "MEDIUM", rotation = 0, className }: ShapeIconProps) {
  const hex = colorHex(color);
  const geom = shapePath(shape);
  const patternId = `pat-${shape}-${color}-${fill}`.replace(/[^a-zA-Z0-9-]/g, "");
  const scale = size === "SMALL" ? 0.72 : size === "LARGE" ? 1.15 : 1;

  const fillValue =
    fill === "OUTLINE" ? "none" :
    fill === "STRIPED" ? `url(#${patternId})` :
    fill === "DOTTED" ? `url(#${patternId})` :
    hex;
  const strokeValue = fill === "OUTLINE" ? hex : fill === "FILLED" ? "none" : hex;
  const strokeWidth = fill === "OUTLINE" ? 6 : 2;

  return (
    <svg viewBox="0 0 100 100" className={className} style={{ transform: `rotate(${rotation}deg) scale(${scale})` }}>
      <defs>
        <pattern id={patternId} width="10" height="10" patternTransform={`rotate(45)`} patternUnits="userSpaceOnUse">
          {fill === "STRIPED" ? (
            <rect width="5" height="10" fill={hex} />
          ) : (
            <circle cx="3" cy="3" r="2" fill={hex} />
          )}
        </pattern>
      </defs>
      {geom.kind === "circle" ? (
        <circle cx="50" cy="50" r="40" fill={fillValue} stroke={strokeValue} strokeWidth={strokeWidth} />
      ) : (
        <polygon points={geom.points} fill={fillValue} stroke={strokeValue} strokeWidth={strokeWidth} strokeLinejoin="round" />
      )}
    </svg>
  );
}
