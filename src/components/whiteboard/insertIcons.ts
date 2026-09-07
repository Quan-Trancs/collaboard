import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Brush,
  Gem,
  Globe,
  Laptop,
  Lightbulb,
  Palette,
  PartyPopper,
  Phone,
  Rocket,
  Sparkles,
  Star,
  Target,
  Tent,
  Trophy,
  VenetianMask,
  WandSparkles,
  Wrench,
  Zap,
} from "lucide-react";

export type InsertIcon = {
  id: string;
  name: string;
  Icon: LucideIcon;
};

export const INSERT_ICONS: InsertIcon[] = [
  { id: "rocket", name: "Rocket", Icon: Rocket },
  { id: "lightbulb", name: "Lightbulb", Icon: Lightbulb },
  { id: "star", name: "Star", Icon: Star },
  { id: "target", name: "Target", Icon: Target },
  { id: "chart", name: "Chart", Icon: BarChart3 },
  { id: "laptop", name: "Laptop", Icon: Laptop },
  { id: "palette", name: "Palette", Icon: Palette },
  { id: "phone", name: "Phone", Icon: Phone },
  { id: "globe", name: "Globe", Icon: Globe },
  { id: "zap", name: "Zap", Icon: Zap },
  { id: "wrench", name: "Wrench", Icon: Wrench },
  { id: "party", name: "Party", Icon: PartyPopper },
  { id: "trophy", name: "Trophy", Icon: Trophy },
  { id: "gem", name: "Gem", Icon: Gem },
  { id: "mask", name: "Mask", Icon: VenetianMask },
  { id: "sparkle", name: "Sparkle", Icon: Sparkles },
  { id: "crystal", name: "Crystal", Icon: WandSparkles },
  { id: "brush", name: "Brush", Icon: Brush },
  { id: "tent", name: "Tent", Icon: Tent },
];

export const INSERT_ICON_IDS = INSERT_ICONS.map((icon) => icon.id);

export function getInsertIcon(id: string | undefined): InsertIcon | undefined {
  if (!id) return undefined;
  return INSERT_ICONS.find((icon) => icon.id === id);
}
