import React from 'react';
import { Database, CheckCircle, Cloud } from 'lucide-react';
import { User } from '../types';

interface Props {
  user: User;
}

export const DataManagement: React.FC<Props> = ({ user }) => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
             <Database className="text-primary-600" /> Data Management
           </h2>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="flex justify-center mb-4">
              <div className="bg-green-100 p-4 rounded-full">
                  <Cloud size={48} className="text-green-600" />
              </div>
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Cloud Sync Active</h3>
          <p className="text-gray-500 max-w-md mx-auto mb-6">
              Your application is connected to Google Firebase. Data is automatically synchronized across all devices and persisted offline.
          </p>
          
          <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto text-left">
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex items-center gap-2 mb-1 text-green-700 font-bold text-sm">
                      <CheckCircle size={16} /> Real-time Database
                  </div>
                  <p className="text-xs text-gray-500">Firestore is handling transactions.</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex items-center gap-2 mb-1 text-green-700 font-bold text-sm">
                      <CheckCircle size={16} /> Offline Persistence
                  </div>
                  <p className="text-xs text-gray-500">Local cache enabled for poor connectivity.</p>
              </div>
          </div>
      </div>
    </div>
  );
};