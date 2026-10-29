import type { ElementType } from "react";
import { Baby, CarFront, CreditCard, HandCoins, Home, Shapes, Sparkles, UtensilsCrossed } from "lucide-react";
import type { Category } from "../state/types";
import { CATEGORY_META } from "../lib/finance";

const ICONS: Record<Category, ElementType> = {
  Moradia: Home,
  Alimentação: UtensilsCrossed,
  Transporte: CarFront,
  Filhos: Baby,
  "Cuidados Pessoais": Sparkles,
  Cartão: CreditCard,
  Dízimo: HandCoins,
  Outros: Shapes,
};

export default function CategoryIcon({
  category,
  size = 18,
  boxSize = 38,
  rounded = 12,
}: {
  category: Category;
  size?: number;
  boxSize?: number;
  rounded?: number;
}) {
  const Icon = ICONS[category] ?? Shapes;
  const meta = CATEGORY_META[category] ?? CATEGORY_META.Outros;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center border"
      style={{
        width: boxSize,
        height: boxSize,
        borderRadius: rounded,
        borderColor: "var(--border)",
        backgroundColor: meta.soft,
        color: meta.color,
      }}
      aria-hidden
    >
      <Icon size={size} strokeWidth={1.9} />
    </span>
  );
}
