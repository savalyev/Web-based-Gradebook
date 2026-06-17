import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { formatDateShort } from '../lib/format';

const BRAND = '#dc2626';

export function TimelineChart({
  data,
}: {
  data: { date: string; grade: number }[];
}) {
  const chartData = data.map((d, i) => ({ ...d, label: formatDateShort(d.date), idx: i }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={chartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" />
        <XAxis dataKey="label" fontSize={12} stroke="#9ca3af" />
        <YAxis domain={[0, 100]} fontSize={12} stroke="#9ca3af" />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: '1px solid #eee', fontSize: 13 }}
          labelStyle={{ color: '#6b7280' }}
        />
        <Line
          type="monotone"
          dataKey="grade"
          name="Оценка"
          stroke={BRAND}
          strokeWidth={2.5}
          dot={{ r: 3, fill: BRAND }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function BarsChart({
  data,
  dataKey,
  nameKey,
  height = 260,
}: {
  data: any[];
  dataKey: string;
  nameKey: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" />
        <XAxis dataKey={nameKey} fontSize={11} stroke="#9ca3af" interval={0} angle={-12} textAnchor="end" height={50} />
        <YAxis fontSize={12} stroke="#9ca3af" />
        <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #eee', fontSize: 13 }} />
        <Bar dataKey={dataKey} radius={[6, 6, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={BRAND} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
