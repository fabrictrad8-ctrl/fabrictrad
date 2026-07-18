import React from 'react';
import Icon from '@/components/ui/AppIcon';

const activities: {
  id: number;
  time: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  title: string;
  desc: string;
  meta: string;
}[] = [];

export default function AdminActivityFeed() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-800 text-foreground">Activity Feed</h1>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
          Live updates
        </div>
      </div>

      <div className="space-y-3">
        {activities.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <Icon name="BoltIcon" size={32} className="mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-800 text-foreground">No live activity records yet</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
              Payment, seller, order, listing, and shipment events will appear here after they are
              written by the production workflows.
            </p>
          </div>
        )}
        {activities.map((activity) => (
          <div
            key={activity.id}
            className="bg-card rounded-2xl border border-border p-4 flex gap-4"
          >
            <div
              className={`w-10 h-10 rounded-xl ${activity.iconBg} flex items-center justify-center shrink-0`}
            >
              <Icon name={activity.icon as 'TruckIcon'} size={18} className={activity.iconColor} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-700 text-foreground">{activity.title}</p>
                <span className="text-xs text-muted-foreground shrink-0">{activity.time}</span>
              </div>
              <p className="text-xs text-foreground mt-0.5 leading-relaxed">{activity.desc}</p>
              <p className="text-xs text-muted-foreground mt-1 font-mono leading-relaxed">
                {activity.meta}
              </p>
            </div>
          </div>
        ))}
      </div>

      {activities.length > 0 && (
        <div className="mt-6 text-center">
          <button className="btn-secondary px-6 py-2.5 text-sm rounded-xl">
            Load More Activity
          </button>
        </div>
      )}
    </div>
  );
}
