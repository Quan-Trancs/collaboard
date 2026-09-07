export type TextAlign = "left" | "center" | "right";

export type TextStyle = {
  fontSize: number;
  fontFamily: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  align: TextAlign;
  lineHeight: number;
};

export const TEXT_FONT_FALLBACK = "ui-sans-serif, system-ui, sans-serif";
export const TEXT_LINE_HEIGHT = 1.25;
export const TEXT_WRAP_WIDTH = 420;
export const TEXT_BOX_PADDING = 10;
export const DEFAULT_TEXT_BOX_WIDTH = 320;
export const MIN_TEXT_BOX_WIDTH = 80;
export const MIN_TEXT_BOX_HEIGHT = 36;
export const TEXT_LINE_SPACINGS = [1, 1.15, 1.25, 1.5, 2] as const;
export const MIN_FONT_SIZE = 8;
export const MAX_FONT_SIZE = 200;

export const TEXT_FONTS = [
  "Inter",
  "Arial",
  "Calibri",
  "Georgia",
  "Times New Roman",
  "Verdana",
  "Courier New",
] as const;

export const TEXT_SIZES_PX = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 96];

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontSize: 24,
  fontFamily: "Inter",
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  align: "left",
  lineHeight: TEXT_LINE_HEIGHT,
};

export function clampFontSize(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_TEXT_STYLE.fontSize;
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(value)));
}

export function clampLineHeight(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_TEXT_STYLE.lineHeight;
  return Math.min(3, Math.max(1, Math.round(value * 100) / 100));
}

export function styleFromElement(element: {
  fontSize?: number;
  fontFamily?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  align?: TextAlign;
  lineHeight?: number;
  strokeWidth?: number;
}): TextStyle {
  return {
    fontSize: clampFontSize(element.fontSize ?? Math.max(14, (element.strokeWidth || 2) * 8)),
    fontFamily: element.fontFamily || DEFAULT_TEXT_STYLE.fontFamily,
    bold: Boolean(element.bold),
    italic: Boolean(element.italic),
    underline: Boolean(element.underline),
    strikethrough: Boolean(element.strikethrough),
    align: element.align === "center" || element.align === "right" ? element.align : "left",
    lineHeight: clampLineHeight(element.lineHeight ?? TEXT_LINE_HEIGHT),
  };
}

export function cssFont(style: TextStyle) {
  const italic = style.italic ? "italic" : "normal";
  const weight = style.bold ? "700" : "400";
  return `${italic} ${weight} ${style.fontSize}px "${style.fontFamily}", ${TEXT_FONT_FALLBACK}`;
}

export function cssTextDecoration(style: TextStyle) {
  const parts: string[] = [];
  if (style.underline) parts.push("underline");
  if (style.strikethrough) parts.push("line-through");
  return parts.join(" ") || "none";
}

export function textBoxContentWidth(boxWidth: number) {
  return Math.max(24, boxWidth - TEXT_BOX_PADDING * 2);
}

export function textBoxMinHeight(style: TextStyle) {
  return Math.max(MIN_TEXT_BOX_HEIGHT, TEXT_BOX_PADDING * 2 + style.fontSize * style.lineHeight);
}

export function wrapPlainText(text: string, measure: (value: string) => number, maxWidth: number) {
  const paragraphs = text.replace(/\r/g, "").split("\n");
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    if (!paragraph) {
      lines.push("");
      continue;
    }
    const words = paragraph.split(/\s+/);
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (line && measure(next) > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
  }
  return lines.length ? lines : [""];
}
