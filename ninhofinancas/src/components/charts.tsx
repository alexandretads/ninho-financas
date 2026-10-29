import React from "react";
import { formatBRL } from "../lib/money";

export type FlowPoint = {
  label: string;
  incomeCents: number;
  expenseCents: number;
  plannedIncomeCents?: number;
  plannedExpenseCents?: number;
  isFuture?: boolean;
  isCurrent?: boolean;
  pendingCents?: number;
};

function niceMaximum(value: number) {
  if (value <= 0) return 100;
  const exponent = Math.floor(Math.log10(value));
  const magnitude = Math.pow(10, exponent);
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

function axisLabel(cents: number) {
  const value = cents / 100;
  if (value >= 1000) {
    return `${(value / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`;
  }
  return `${Math.round(value)}`;
}

export function CashflowChart({ data }: { data: FlowPoint[] }) {
  const [hovered, setHovered] = React.useState<number | null>(null);
  const width = 760;
  const height = 264;
  const padding = { top: 16, right: 8, bottom: 32, left: 44 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(
    1,
    ...data.map((point) =>
      Math.max(
        point.incomeCents,
        point.expenseCents,
        point.isFuture ? point.plannedIncomeCents ?? 0 : 0,
        point.isFuture ? point.plannedExpenseCents ?? 0 : 0
      )
    )
  );
  const top = niceMaximum(maxValue);
  const groupWidth = plotWidth / Math.max(1, data.length);
  const barWidth = Math.min(15, Math.max(5, groupWidth * 0.23));
  const gap = Math.max(2, groupWidth * 0.04);
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const hoveredPoint = hovered !== null ? data[hovered] : null;
  const tooltipLeft = hovered !== null
    ? Math.min(86, Math.max(14, ((padding.left + groupWidth * (hovered + 0.5)) / width) * 100))
    : 0;

  return (
    <div className="relative w-full">
      {hoveredPoint ? (
        <div
          className="pointer-events-none absolute top-0 z-10 w-[148px] -translate-x-1/2 rounded-xl border p-2.5 shadow-xl"
          style={{
            left: `${tooltipLeft}%`,
            borderColor: "var(--border-strong)",
            background: "var(--surface)",
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
            {hoveredPoint.label}
          </p>
          <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
            <span className="flex items-center gap-1.5 text-[var(--muted)]">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent)" }} />
              {hoveredPoint.isFuture ? "Previsto" : "Entradas"}
            </span>
            <span className="num font-semibold text-[var(--text)]">
              {formatBRL(hoveredPoint.isFuture ? hoveredPoint.plannedIncomeCents ?? 0 : hoveredPoint.incomeCents)}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
            <span className="flex items-center gap-1.5 text-[var(--muted)]">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--coral)" }} />
              Saídas
            </span>
            <span className="num font-semibold text-[var(--text)]">
              {formatBRL(hoveredPoint.isFuture ? hoveredPoint.plannedExpenseCents ?? 0 : hoveredPoint.expenseCents)}
            </span>
          </div>
          <div
            className="mt-2 border-t pt-1.5 text-[11px] font-bold"
            style={{ borderColor: "var(--border)", color: "var(--text-soft)" }}
          >
            Saldo{" "}
            {formatBRL(
              hoveredPoint.isFuture
                ? (hoveredPoint.plannedIncomeCents ?? 0) - (hoveredPoint.plannedExpenseCents ?? 0)
                : hoveredPoint.incomeCents - hoveredPoint.expenseCents
            )}
          </div>
        </div>
      ) : null}

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label="Gráfico de entradas e saídas por mês"
        onMouseLeave={() => setHovered(null)}
      >
        <defs>
          <linearGradient id="income-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="1" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.45" />
          </linearGradient>
          <linearGradient id="expense-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--coral)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="var(--coral)" stopOpacity="0.36" />
          </linearGradient>
        </defs>

        {ticks.map((tick) => {
          const y = padding.top + plotHeight - tick * plotHeight;
          return (
            <g key={tick}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                stroke="var(--chart-grid)"
                strokeWidth="1"
                strokeDasharray={tick === 0 ? undefined : "3 5"}
              />
              <text
                x={padding.left - 9}
                y={y + 5}
                textAnchor="end"
                fill="var(--chart-label)"
                fontSize="13.5"
                fontFamily="Sora, sans-serif"
              >
                {axisLabel(tick * top)}
              </text>
            </g>
          );
        })}

        {data.map((point, index) => {
          const x = padding.left + groupWidth * index;
          const incomeHeight = (point.incomeCents / top) * plotHeight;
          const expenseHeight = (point.expenseCents / top) * plotHeight;
          const center = x + groupWidth / 2;
          const isHovered = hovered === index;
          const future = point.isFuture;

          return (
            <g
              key={`${point.label}-${index}`}
              onMouseEnter={() => setHovered(index)}
              onFocus={() => setHovered(index)}
              tabIndex={0}
              style={{ outline: "none" }}
            >
              <title>
                {point.label}: entradas {formatBRL(point.incomeCents)}, saídas{" "}
                {formatBRL(point.expenseCents)}
              </title>
              {isHovered ? (
                <rect
                  x={x + 1}
                  y={padding.top - 5}
                  width={groupWidth - 2}
                  height={plotHeight + 5}
                  rx="8"
                  fill="var(--surface-2)"
                />
              ) : null}
              {!future ? (
                <>
                  <rect
                    x={center - barWidth - gap / 2}
                    y={padding.top + plotHeight - Math.max(incomeHeight, 2)}
                    width={barWidth}
                    height={Math.max(incomeHeight, 2)}
                    rx={barWidth / 2}
                    fill="url(#income-gradient)"
                    opacity={hovered === null || isHovered ? 1 : 0.5}
                  />
                  <rect
                    x={center + gap / 2}
                    y={padding.top + plotHeight - Math.max(expenseHeight, 2)}
                    width={barWidth}
                    height={Math.max(expenseHeight, 2)}
                    rx={barWidth / 2}
                    fill="url(#expense-gradient)"
                    opacity={hovered === null || isHovered ? 1 : 0.5}
                  />
                </>
              ) : (
                <>
                  {(point.plannedIncomeCents ?? 0) > 0 ? (
                    <rect
                      x={center - barWidth - gap / 2}
                      y={(padding.top + plotHeight) - ((point.plannedIncomeCents ?? 0) / top) * plotHeight}
                      width={barWidth}
                      height={Math.max(((point.plannedIncomeCents ?? 0) / top) * plotHeight, 2)}
                      rx={barWidth / 2}
                      fill="var(--accent)"
                      fillOpacity="0.08"
                      stroke="var(--accent)"
                      strokeOpacity="0.38"
                      strokeWidth="1.2"
                      strokeDasharray="3 3"
                    />
                  ) : null}
                  {(point.plannedExpenseCents ?? 0) > 0 ? (
                    <rect
                      x={center + gap / 2}
                      y={(padding.top + plotHeight) - ((point.plannedExpenseCents ?? 0) / top) * plotHeight}
                      width={barWidth}
                      height={Math.max(((point.plannedExpenseCents ?? 0) / top) * plotHeight, 2)}
                      rx={barWidth / 2}
                      fill="var(--coral)"
                      fillOpacity="0.06"
                      stroke="var(--coral)"
                      strokeOpacity="0.32"
                      strokeWidth="1.2"
                      strokeDasharray="3 3"
                    />
                  ) : null}
                </>
              )}
              {point.isCurrent ? (
                <circle cx={center} cy={padding.top + plotHeight + 14} r="2" fill="var(--accent)" />
              ) : null}
              <text
                x={center}
                y={height - 7}
                textAnchor="middle"
                fill={point.isCurrent ? "var(--text)" : "var(--chart-label)"}
                fontSize="14"
                fontWeight={point.isCurrent ? "700" : "500"}
                fontFamily="Sora, sans-serif"
              >
                {point.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export type DonutSlice = { label: string; valueCents: number; color: string };

export function DonutChart({
  data,
  centerLabel = "Gastos do mês",
  emptyLabel = "Sem gastos",
}: {
  data: DonutSlice[];
  centerLabel?: string;
  emptyLabel?: string;
}) {
  const [hovered, setHovered] = React.useState<number | null>(null);
  const total = data.reduce((sum, item) => sum + item.valueCents, 0);
  const size = 200;
  const stroke = 22;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = data.length > 1 ? 3.4 : 0;
  let offset = 0;
  const active = hovered !== null ? data[hovered] : null;

  React.useEffect(() => {
    if (hovered !== null && hovered >= data.length) setHovered(null);
  }, [data.length, hovered]);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[214px]">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90" role="img" aria-label="Distribuição dos gastos por categoria">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth={stroke}
        />
        {data.map((slice, index) => {
          const segment = total > 0 ? (slice.valueCents / total) * circumference : 0;
          const dash = Math.max(0, segment - gap);
          const circle = (
            <circle
              key={slice.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={slice.color}
              strokeWidth={hovered === index ? stroke + 4 : stroke}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap={data.length > 1 ? "round" : "butt"}
              opacity={hovered === null || hovered === index ? 1 : 0.35}
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
              style={{ transition: "stroke-width 180ms ease, opacity 180ms ease", cursor: "pointer" }}
            />
          );
          offset += segment;
          return circle;
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <span
          className="text-[9px] font-extrabold uppercase tracking-[0.12em]"
          style={{ color: active ? active.color : "var(--muted)" }}
        >
          {active ? active.label : total > 0 ? centerLabel : emptyLabel}
        </span>
        <span className="num mt-1 text-[20px] font-semibold leading-none text-[var(--text)]">
          {formatBRL(active ? active.valueCents : total)}
        </span>
        <span className="mt-1.5 text-[10px] font-medium text-[var(--faint)]">
          {active ? `${((active.valueCents / total) * 100).toFixed(0)}% do total` : "no período"}
        </span>
      </div>
    </div>
  );
}

export function MiniTrend({ values, color = "var(--accent)" }: { values: number[]; color?: string }) {
  const width = 74;
  const height = 26;
  const max = Math.max(1, ...values);
  const min = Math.min(...values);
  const span = Math.max(1, max - min);
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * width;
      const y = height - 3 - ((value - min) / span) * (height - 7);
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" opacity="0.85" />
    </svg>
  );
}
