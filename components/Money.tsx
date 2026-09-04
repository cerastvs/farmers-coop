import React from "react";

export function Money({
  value,
  className,
}: {
  value: string | number;
  className?: string;
}) {
  const num = Number(value);
  const formatted =
    Number.isFinite(num) && value !== null && value !== undefined
      ? num.toLocaleString("en-PH", {
          style: "currency",
          currency: "PHP",
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : "—";
  const match = formatted.match(/^([^\d]*)([\d,]+)(\.\d+)?$/);

  if (!match) return <span className={className}>{formatted}</span>;

  const [, prefix, integer, decimal] = match;
  return (
    <span className={className}>
      {prefix}
      {integer}
      {decimal && (
        <span style={{ opacity: 0.5 }}>{decimal}</span>
      )}
    </span>
  );
}
