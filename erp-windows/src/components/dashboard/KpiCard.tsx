import { ArrowUpRight, ArrowDownRight, type LucideIcon } from 'lucide-react';

interface Props {
  title: string;
  value: string;
  change: number;
  icon: LucideIcon;
  color: string;
}

export default function KpiCard({ title, value, change, icon: Icon, color }: Props) {
  const isPositive = change >= 0;
  const colorMap: Record<string, string> = {
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700',
    blue: 'bg-blue-50 text-blue-700',
    purple: 'bg-purple-50 text-purple-700',
  };

  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <div className={`p-2 rounded-lg ${colorMap[color] || colorMap.blue}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className={`flex items-center gap-1 mt-3 text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
        <span className="font-medium">{Math.abs(change)}%</span>
        <span className="text-gray-400">vs last month</span>
      </div>
    </div>
  );
}
