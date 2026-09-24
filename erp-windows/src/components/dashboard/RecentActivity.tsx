import { Clock, Package, DollarSign, UserPlus, FileText } from 'lucide-react';

const activities = [
  { icon: DollarSign, text: 'New sale recorded', time: '2 min ago', color: 'text-green-600 bg-green-50' },
  { icon: Package, text: 'Inventory adjusted: Widget-A', time: '15 min ago', color: 'text-blue-600 bg-blue-50' },
  { icon: FileText, text: 'PO #2024-001 approved', time: '1 hour ago', color: 'text-purple-600 bg-purple-50' },
  { icon: UserPlus, text: 'New user created: John D.', time: '3 hours ago', color: 'text-orange-600 bg-orange-50' },
];

export default function RecentActivity() {
  return (
    <div className="card">
      <h3 className="font-semibold mb-3">Recent Activity</h3>
      <div className="space-y-3">
        {activities.map((a, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className={`p-1.5 rounded-lg ${a.color}`}>
              <a.icon className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{a.text}</p>
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3" /> {a.time}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
