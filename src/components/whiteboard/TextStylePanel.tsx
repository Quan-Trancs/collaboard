import { AlignCenter, AlignLeft, AlignRight, Bold, Frame, Italic, Strikethrough, Underline } from "lucide-react";
import { Button } from "@/components/ui/button";
import ColorPicker from "./ColorPicker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  TEXT_FONTS,
  TEXT_LINE_SPACINGS,
  TEXT_SIZES_PX,
  clampFontSize,
  clampLineHeight,
  type TextAlign,
  type TextStyle,
} from "./textStyle";

interface TextStylePanelProps {
  style: TextStyle;
  onChange: (next: TextStyle) => void;
  color?: string;
  onColorChange?: (color: string) => void;
  highlightLayout?: boolean;
  onToggleHighlightLayout?: () => void;
}

export default function TextStylePanel({
  style,
  onChange,
  color,
  onColorChange,
  highlightLayout = false,
  onToggleHighlightLayout,
}: TextStylePanelProps) {
  const set = (patch: Partial<TextStyle>) => onChange({ ...style, ...patch });
  const sizeOptions = TEXT_SIZES_PX.includes(style.fontSize)
    ? TEXT_SIZES_PX
    : [...TEXT_SIZES_PX, style.fontSize].sort((a, b) => a - b);
  const spacingOptions = TEXT_LINE_SPACINGS.includes(style.lineHeight as (typeof TEXT_LINE_SPACINGS)[number])
    ? TEXT_LINE_SPACINGS
    : [...TEXT_LINE_SPACINGS, style.lineHeight].sort((a, b) => a - b);

  return (
    <div
      className="h-11 bg-white border-b border-gray-200 flex items-center gap-2 px-4 overflow-x-auto shrink-0"
      aria-label="Text style"
    >
      <Select value={style.fontFamily} onValueChange={(fontFamily) => set({ fontFamily })}>
        <SelectTrigger className="w-40 h-8" aria-label="Font family">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TEXT_FONTS.map((font) => (
            <SelectItem key={font} value={font}>
              <span style={{ fontFamily: font }}>{font}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={String(style.fontSize)}
        onValueChange={(value) => set({ fontSize: clampFontSize(Number(value)) })}
      >
        <SelectTrigger className="w-24 h-8" aria-label="Font size">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sizeOptions.map((size) => (
            <SelectItem key={size} value={String(size)}>
              {size} px
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="number"
        min={MIN_FONT_SIZE}
        max={MAX_FONT_SIZE}
        value={style.fontSize}
        aria-label="Font size in pixels"
        className="w-16 h-8 px-2"
        onChange={(event) => set({ fontSize: clampFontSize(Number(event.target.value)) })}
      />
      <span className="text-xs text-gray-500">px</span>
      <input
        type="range"
        min={MIN_FONT_SIZE}
        max={MAX_FONT_SIZE}
        step={1}
        value={style.fontSize}
        aria-label="Font size slider"
        className="w-36 accent-gray-800"
        onChange={(event) => set({ fontSize: clampFontSize(Number(event.target.value)) })}
      />

      {onColorChange && color && (
        <>
          <div className="w-px h-6 bg-gray-200 mx-1" />
          <ColorPicker
            variant="text"
            color={color}
            onChange={onColorChange}
            side="bottom"
          />
        </>
      )}

      <div className="w-px h-6 bg-gray-200 mx-1" />

      <Button
        type="button"
        size="icon"
        variant={style.bold ? "default" : "ghost"}
        className="h-8 w-8"
        aria-label="Bold"
        aria-pressed={style.bold}
        onClick={() => set({ bold: !style.bold })}
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant={style.italic ? "default" : "ghost"}
        className="h-8 w-8"
        aria-label="Italic"
        aria-pressed={style.italic}
        onClick={() => set({ italic: !style.italic })}
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant={style.underline ? "default" : "ghost"}
        className="h-8 w-8"
        aria-label="Underline"
        aria-pressed={style.underline}
        onClick={() => set({ underline: !style.underline })}
      >
        <Underline className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant={style.strikethrough ? "default" : "ghost"}
        className="h-8 w-8"
        aria-label="Strikethrough"
        aria-pressed={style.strikethrough}
        onClick={() => set({ strikethrough: !style.strikethrough })}
      >
        <Strikethrough className="h-4 w-4" />
      </Button>

      <div className="w-px h-6 bg-gray-200 mx-1" />

      {([
        ["left", AlignLeft, "Align left"],
        ["center", AlignCenter, "Align center"],
        ["right", AlignRight, "Align right"],
      ] as const).map(([align, Icon, label]) => (
        <Button
          key={align}
          type="button"
          size="icon"
          variant={style.align === align ? "default" : "ghost"}
          className="h-8 w-8"
          aria-label={label}
          aria-pressed={style.align === align}
          onClick={() => set({ align: align as TextAlign })}
        >
          <Icon className="h-4 w-4" />
        </Button>
      ))}

      <div className="w-px h-6 bg-gray-200 mx-1" />

      <Select
        value={String(style.lineHeight)}
        onValueChange={(value) => set({ lineHeight: clampLineHeight(Number(value)) })}
      >
        <SelectTrigger className="w-28 h-8" aria-label="Line spacing">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {spacingOptions.map((spacing) => (
            <SelectItem key={spacing} value={String(spacing)}>
              {spacing === 1 ? "Single" : spacing === 2 ? "Double" : `${spacing} line`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {onToggleHighlightLayout && (
        <>
          <div className="w-px h-6 bg-gray-200 mx-1" />
          <Button
            type="button"
            size="sm"
            variant={highlightLayout ? "default" : "ghost"}
            className="h-8 px-2 gap-1"
            aria-label="Highlight layout"
            aria-pressed={highlightLayout}
            onClick={onToggleHighlightLayout}
          >
            <Frame className="h-4 w-4" />
            <span className="text-xs">Layout</span>
          </Button>
        </>
      )}
    </div>
  );
}
