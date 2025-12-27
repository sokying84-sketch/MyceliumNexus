import React, { useEffect, useState } from 'react';
import { User, ActivityLog as LogType } from '../types';
import { StorageService } from '../services/storageService';
import { Clock, Activity } from 'lucide-react';

interface Props {
  user: User;
}

export const ActivityLog: React.FC<Props> = ({ user }) => {
  const [logs, setLogs] = useState<LogType[]>([]);

  useEffect(() => {
    setLogs(StorageService.getActivities(user.entityId));
  }, [user]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
        <Activity className="text-primary-600" />
        Activity Log
      </h2>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-600">Recent System Events</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {logs.map(log => (
            <div key={log.id} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex justify-between items-start">
                <div>
                   <span className="font-semibold text-sm text-gray-900">{log.userName}</span>
                   <span className="mx-2 text-gray-400">•</span>
                   <span className="text-xs px-2 py-0.5 bg-gray-100 rounded border uppercase tracking-wide text-gray-500">
                     {log.action.replace('_', ' ')}
                   </span>
                </div>
                <div className="flex items-center text-xs text-gray-400 gap-1">
                  <Clock size={12} />
                  {new Date(log.timestamp).toLocaleString()}
                </div>
              </div>
              <p className="mt-1 text-sm text-gray-600">{log.details}</p>
            </div>
          ))}
          
          {logs.length === 0 && (
            <div className="p-8 text-center text-gray-400">
              No activity recorded yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};