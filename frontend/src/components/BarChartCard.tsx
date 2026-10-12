import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface Props {
  data: { label: string; value: number }[];
  valueName: string;
  height?: number;
}

/**
 * The one chart shape used on the dashboard: single-series horizontal bars,
 * value labelled at the bar end, one accent hue (identity never depends on color).
 */
export function BarChartCard({ data, valueName, height }: Props) {
  const h = height ?? Math.max(120, data.length * 34 + 30);
  return (
    <div style={{ width: "100%", height: h }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 36, bottom: 4, left: 8 }}>
          <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="2 4" />
          <XAxis type="number" allowDecimals={false} tick={{ fill: "var(--muted)", fontSize: 12 }} stroke="var(--border)" />
          <YAxis
            type="category"
            dataKey="label"
            width={130}
            tick={{ fill: "var(--text)", fontSize: 12 }}
            stroke="var(--border)"
          />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}
            formatter={(v: number) => [v, valueName]}
          />
          <Bar dataKey="value" name={valueName} fill="var(--accent)" radius={[0, 4, 4, 0]} barSize={18}>
            <LabelList dataKey="value" position="right" style={{ fill: "var(--text)", fontSize: 12 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
