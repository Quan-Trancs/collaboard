import React, { useEffect, useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  GOOGLE_HUE_NAMES,
  GOOGLE_STANDARD_COLORS,
  GOOGLE_THEME_ACCENTS,
  GOOGLE_THEME_COLORS,
  colorsEqual,
  hexToHsv,
  hexToRgb,
  hsvToHex,
  loadRecentColors,
  normalizeHex,
  pushRecentColor,
  rgbToHex,
  type Hsv,
} from "./colorPalette";

type ColorPickerVariant = "swatch" | "text";

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  disabled?: boolean;
  variant?: ColorPickerVariant;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}

function Swatch({
  color,
  selected,
  title,
  onSelect,
}: {
  color: string;
  selected: boolean;
  title: string;
  onSelect: (color: string) => void;
}) {
  const isLight = colorsEqual(color, "#FFFFFF") || colorsEqual(color, "#F3F3F3") || colorsEqual(color, "#EFEFEF");
  return (
    <button
      type="button"
      title={title}
      aria-label={`Select color ${color}`}
      aria-pressed={selected}
      className={cn(
        "h-[18px] w-[18px] rounded-[2px] border focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
        isLight ? "border-gray-300" : "border-black/10",
        selected && "ring-2 ring-blue-600 ring-offset-1"
      )}
      style={{ backgroundColor: color }}
      onClick={() => onSelect(color)}
    />
  );
}

function CustomMixer({
  color,
  onChange,
}: {
  color: string;
  onChange: (color: string) => void;
}) {
  const initial = hexToHsv(color) || { h: 0, s: 0, v: 0 };
  const [hsv, setHsv] = useState<Hsv>(initial);
  const [hexDraft, setHexDraft] = useState(normalizeHex(color) || "#000000");
  const rgb = hexToRgb(hsvToHex(hsv)) || { r: 0, g: 0, b: 0 };

  useEffect(() => {
    const next = hexToHsv(color);
    const hex = normalizeHex(color);
    if (next) setHsv(next);
    if (hex) setHexDraft(hex);
  }, [color]);

  const commitHsv = (next: Hsv) => {
    const clamped = {
      h: Math.min(360, Math.max(0, next.h)),
      s: Math.min(1, Math.max(0, next.s)),
      v: Math.min(1, Math.max(0, next.v)),
    };
    setHsv(clamped);
    const hex = hsvToHex(clamped);
    setHexDraft(hex);
    onChange(hex);
  };

  const pickSaturationValue = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const s = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const v = Math.min(1, Math.max(0, 1 - (event.clientY - rect.top) / rect.height));
    commitHsv({ ...hsv, s, v });
  };

  return (
    <div className="space-y-2" aria-label="Custom color">
      <div
        className="relative h-28 w-full cursor-crosshair rounded-sm border border-gray-200"
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h}, 100%, 50%))`,
        }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          pickSaturationValue(event);
        }}
        onPointerMove={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
          pickSaturationValue(event);
        }}
        aria-label="Saturation and brightness"
      >
        <span
          className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
        />
      </div>
      <input
        type="range"
        min={0}
        max={360}
        value={Math.round(hsv.h)}
        aria-label="Hue"
        className="h-3 w-full cursor-pointer rounded-sm accent-gray-800"
        style={{
          background:
            "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
        }}
        onChange={(event) => commitHsv({ ...hsv, h: Number(event.target.value) })}
      />
      <div className="flex items-center gap-2">
        <span
          className="h-8 w-8 shrink-0 rounded border border-gray-300"
          style={{ backgroundColor: hsvToHex(hsv) }}
          aria-hidden
        />
        <label className="flex min-w-0 flex-1 items-center gap-1 text-[11px] text-gray-500">
          Hex
          <Input
            value={hexDraft}
            aria-label="Hex color"
            className="h-8 font-mono text-xs uppercase"
            onChange={(event) => {
              const value = event.target.value;
              setHexDraft(value);
              const withHash = value.trim().startsWith("#") ? value.trim() : `#${value.trim()}`;
              if (/^#[0-9a-fA-F]{6}$/.test(withHash)) onChange(withHash.toUpperCase());
            }}
            onBlur={() => {
              const normalized = normalizeHex(hexDraft);
              if (normalized) {
                setHexDraft(normalized);
                onChange(normalized);
              } else {
                setHexDraft(normalizeHex(color) || "#000000");
              }
            }}
          />
        </label>
        <input
          type="color"
          value={(normalizeHex(color) || "#000000").toLowerCase()}
          aria-label="System color picker"
          className="h-8 w-8 cursor-pointer rounded border border-gray-300 bg-white p-0"
          onChange={(event) => {
            const normalized = normalizeHex(event.target.value);
            if (normalized) onChange(normalized);
          }}
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {(["r", "g", "b"] as const).map((channel) => (
          <label key={channel} className="flex items-center gap-1 text-[11px] uppercase text-gray-500">
            {channel}
            <Input
              type="number"
              min={0}
              max={255}
              value={rgb[channel]}
              aria-label={`${channel.toUpperCase()} channel`}
              className="h-8 px-1 text-xs"
              onChange={(event) => {
                const next = { ...rgb, [channel]: Number(event.target.value) };
                onChange(rgbToHex(next.r, next.g, next.b));
              }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

export default function ColorPicker({
  color,
  onChange,
  disabled = false,
  variant = "swatch",
  side = "right",
  className,
}: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [recent, setRecent] = useState<string[]>(() => loadRecentColors());
  const current = normalizeHex(color) || "#000000";

  const pick = (next: string, close = true) => {
    const normalized = normalizeHex(next) || next;
    onChange(normalized);
    setRecent(pushRecentColor(normalized));
    if (close) setOpen(false);
  };

  const trigger = variant === "text" ? (
    <button
      type="button"
      disabled={disabled}
      aria-label="Text color"
      className={cn(
        "h-8 w-8 flex flex-col items-center justify-center rounded hover:bg-gray-100 disabled:opacity-50",
        className
      )}
    >
      <span className="text-sm font-serif leading-none" style={{ color: current }}>
        A
      </span>
      <span className="mt-0.5 h-[4px] w-4 rounded-sm" style={{ backgroundColor: current }} />
    </button>
  ) : (
    <button
      type="button"
      disabled={disabled}
      aria-label="Color picker"
      className={cn(
        "flex flex-col items-center gap-1 disabled:opacity-50",
        className
      )}
    >
      <span
        className="h-8 w-8 rounded border border-gray-300 shadow-sm"
        style={{ backgroundColor: current }}
      />
      <span className="text-[10px] leading-none text-gray-600">Color</span>
    </button>
  );

  const hueTitle = useMemo(
    () => (index: number) => GOOGLE_HUE_NAMES[index] || `Hue ${index + 1}`,
    []
  );

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setShowCustom(false);
      }}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        side={side}
        align="start"
        className="w-[272px] p-3"
        aria-label="Color palette"
      >
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">Theme</p>
        <div className="mb-1 grid grid-cols-10 gap-[3px]" aria-label="Theme colors">
          {GOOGLE_THEME_COLORS.map((swatch) => (
            <Swatch
              key={swatch}
              color={swatch}
              selected={colorsEqual(swatch, current)}
              title={swatch}
              onSelect={() => pick(swatch)}
            />
          ))}
        </div>
        <div className="mb-3 grid grid-cols-10 gap-[3px]" aria-label="Theme accents">
          {GOOGLE_THEME_ACCENTS.map((swatch, index) => (
            <Swatch
              key={swatch}
              color={swatch}
              selected={colorsEqual(swatch, current)}
              title={hueTitle(index)}
              onSelect={() => pick(swatch)}
            />
          ))}
        </div>

        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">Standard</p>
        <div className="mb-3 grid grid-cols-10 gap-[3px]" aria-label="Standard colors">
          {GOOGLE_STANDARD_COLORS.flatMap((row, rowIndex) =>
            row.map((swatch, index) => (
              <Swatch
                key={`${rowIndex}-${swatch}`}
                color={swatch}
                selected={colorsEqual(swatch, current)}
                title={`${hueTitle(index)} ${swatch}`}
                onSelect={() => pick(swatch)}
              />
            ))
          )}
        </div>

        {recent.length > 0 && (
          <>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">Recent</p>
            <div className="mb-3 flex flex-wrap gap-[3px]" aria-label="Recent colors">
              {recent.map((swatch) => (
                <Swatch
                  key={`recent-${swatch}`}
                  color={swatch}
                  selected={colorsEqual(swatch, current)}
                  title={swatch}
                  onSelect={() => pick(swatch)}
                />
              ))}
            </div>
          </>
        )}

        <Button
          type="button"
          variant={showCustom ? "secondary" : "ghost"}
          size="sm"
          className="h-7 w-full text-xs"
          aria-expanded={showCustom}
          onClick={() => setShowCustom((value) => !value)}
        >
          Custom
        </Button>
        {showCustom && (
          <div className="mt-2">
            <CustomMixer color={current} onChange={(next) => pick(next, false)} />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
