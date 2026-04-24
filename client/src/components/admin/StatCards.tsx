import { Users, Clock, CalendarCheck, Ban } from 'lucide-react';
import { cn } from '../../lib/cn';
import type { AdminStats } from '../../services/api';

interface StatCardProps {
  icon:  React.ElementType;
  label: string;
  value: number;
  color: string;
}

function StatCard({ icon: Icon, label, value, color }: StatCardProps) {
  return (
    <div className="form-card flex items-center gap-4 p-5">
      <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0', color)}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{value}</p>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export function StatCards({ stats }: { stats: AdminStats }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <StatCard
        icon={Users}
        label="Toplam"
        value={stats.total}
        color="bg-blue-500/15 text-blue-600 dark:text-blue-400"
      />
      <StatCard
        icon={Clock}
        label="Bekleyen"
        value={stats.pending}
        color="bg-amber-500/15 text-amber-600 dark:text-amber-400"
      />
      <StatCard
        icon={CalendarCheck}
        label="Onaylanan"
        value={stats.approved}
        color="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
      />
      <StatCard
        icon={Ban}
        label="İptal/Red"
        value={stats.rejected + stats.cancelled}
        color="bg-red-500/15 text-red-600 dark:text-red-400"
      />
    </div>
  );
}
