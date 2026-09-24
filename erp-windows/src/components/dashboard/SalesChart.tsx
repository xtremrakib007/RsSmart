import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { day: '01', sales: 4200, expenses: 2800 },
  { day: '05', sales: 5100, expenses: 3200 },
  { day: '10', sales: 4800, expenses: 2900 },
  { day: '15', sales: 6200, expenses: 3500 },
  { day: '20', sales: 5800, expenses: 3100 },
  { day: '25', sales: 7100, expenses: 3800 },
  { day: '30', sales: 6500, expenses: 3400 },
];

export default function SalesChart() {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="day" stroke="#9ca3af" fontSize={12} />
        <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(v) => `$${v}`} />
        <Tooltip
          formatter={(value: number) => [`$${value}`, '']}
          contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
        />
        <Area type="monotone" dataKey="sales" stroke="#1976d2" fill="#e3f2fd" strokeWidth={2} />
        <Area type="monotone" dataKey="expenses" stroke="#d32f2f" fill="#ffebee" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
