import { useState } from "react";
import { money, addDays, dayKey } from "../lib";
import type { AppState } from "../../shared/types";
export function RevenueChart({
  data,
  days = 14,
  to,
}: {
  data: AppState;
  days?: number;
  to: string;
}) {
  const [selected, setSelected] = useState<number>();
  const rows = Array.from({ length: days }, (_, i) => {
    const day = addDays(to, i - days + 1);
    return {
      day,
      value:
        data.sales
          .filter((s) => dayKey(s.createdAt) === day)
          .reduce((sum, s) => sum + s.total, 0) -
        data.returns
          .filter((s) => dayKey(s.createdAt) === day)
          .reduce((sum, s) => sum + s.total, 0),
    };
  });
  const min = Math.min(0, ...rows.map((r) => r.value));
  const max = Math.max(10000, ...rows.map((r) => r.value));
  const w = 720,
    h = 180;
  const y = (n: number) => h - ((n - min) / (max - min)) * h;
  const x = (i: number) =>
    rows.length > 1 ? (i / (rows.length - 1)) * w : w / 2;
  const points = rows.map((r, i) => `${x(i)},${y(r.value)}`);
  const selectedRow = selected !== undefined ? rows[selected] : undefined;
  return (
    <div className="chart">
      <div className="chart-legend">
        <span>
          <i />
          Выручка за вычетом возвратов
        </span>
        <strong>
          {selectedRow
            ? `${selectedRow.day.slice(8)}.${selectedRow.day.slice(5, 7)} — ${money(selectedRow.value)}`
            : "Наведите на день"}
        </strong>
      </div>
      <div className="chart-body">
        <div className="chart-y">
          <span>{money(max)}</span>
          <span>{money(Math.round((max + min) / 2))}</span>
          <span>{money(min)}</span>
        </div>
        <div className="chart-plot">
          <svg
            viewBox={`-3 -8 ${w + 6} ${h + 16}`}
            role="img"
            aria-label={`Выручка за ${days} дней. Данные доступны в таблице под графиком.`}
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#86e5b9" stopOpacity=".22" />
                <stop offset="100%" stopColor="#86e5b9" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, h / 2, h].map((v) => (
              <line
                key={v}
                x1="0"
                x2={w}
                y1={v}
                y2={v}
                stroke="#2b3e42"
                strokeDasharray="3 6"
              />
            ))}
            <path
              d={`M0,${h} L${points.join(" L")} L${w},${h} Z`}
              fill="url(#chart-fill)"
            />
            <polyline
              points={points.join(" ")}
              stroke="#86e5b9"
              strokeWidth="2.8"
              fill="none"
              vectorEffect="non-scaling-stroke"
            />
            {rows.map((r, i) => (
              <g key={r.day}>
                <rect
                  x={x(i) - w / Math.max(1, days - 1) / 2}
                  y="-8"
                  width={w / Math.max(1, days - 1)}
                  height={h + 16}
                  fill="transparent"
                  onMouseEnter={() => setSelected(i)}
                />
                <circle
                  cx={x(i)}
                  cy={y(r.value)}
                  r={selected === i ? 5 : 2.8}
                  fill="#86e5b9"
                >
                  <title>
                    {r.day}: {money(r.value)}
                  </title>
                </circle>
              </g>
            ))}
          </svg>
          <div className="chart-x">
            {rows
              .filter((_, i) => i % Math.ceil(days / 7) === 0 || i === days - 1)
              .map((r) => (
                <span key={r.day}>
                  {r.day.slice(8)}.{r.day.slice(5, 7)}
                </span>
              ))}
          </div>
        </div>
      </div>
      <details className="chart-data">
        <summary>Данные графика</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Дата</th>
                <th>Выручка</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.day}>
                  <td>{r.day}</td>
                  <td>{money(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
