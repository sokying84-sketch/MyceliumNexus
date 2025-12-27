import React, { useState, useEffect } from 'react';
import { User, Role } from '../types';
import { StorageService } from '../services/storageService';
import { Shield, User as UserIcon, Check, X } from 'lucide-react';

interface Props {
  user: User; // Current admin user
}

export const PeopleManagement: React.FC<Props> = ({ user }) => {
  const [users, setUsers] = useState<User[]>([]);
  const KEYS = StorageService.getKeys();

  const loadData = () => {
    // Get all users for this entity
    const allUsers = StorageService.getAll<User>(KEYS.USERS, user.entityId);
    setUsers(allUsers);
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const toggleStatus = (targetUser: User) => {
    if (targetUser.id === user.id) return alert("Cannot deactive yourself");
    
    const updatedUser = { ...targetUser, active: !targetUser.active };
    StorageService.update(KEYS.USERS, updatedUser);
    StorageService.logActivity(user.entityId, user, 'UPDATE_USER', `Changed status for ${targetUser.name} to ${updatedUser.active ? 'Active' : 'Inactive'}`);
    loadData();
  };

  const changeRole = (targetUser: User, newRole: Role) => {
    const updatedUser = { ...targetUser, role: newRole };
    StorageService.update(KEYS.USERS, updatedUser);
    StorageService.logActivity(user.entityId, user, 'UPDATE_USER', `Changed role for ${targetUser.name} to ${newRole}`);
    loadData();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-bold text-gray-800">People Management</h2>
           <p className="text-sm text-gray-500">Manage user access and roles for your entity.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-600 uppercase">
            <tr>
              <th className="p-4">User</th>
              <th className="p-4">Role</th>
              <th className="p-4">Status</th>
              <th className="p-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map(u => (
              <tr key={u.id} className={u.active === false ? 'bg-gray-50 opacity-60' : ''}>
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700">
                      <UserIcon size={16} />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{u.name}</div>
                      <div className="text-gray-500 text-xs">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <select 
                    value={u.role} 
                    disabled={u.id === user.id}
                    onChange={(e) => changeRole(u, e.target.value as Role)}
                    className="border rounded px-2 py-1 text-xs"
                  >
                    <option value={Role.ADMIN}>Admin</option>
                    <option value={Role.WORKER}>Worker</option>
                  </select>
                </td>
                <td className="p-4">
                   <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                     u.active !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                   }`}>
                     {u.active !== false ? 'Active' : 'Inactive'}
                   </span>
                </td>
                <td className="p-4">
                  {u.id !== user.id && (
                     <button 
                       onClick={() => toggleStatus(u)}
                       className={`p-2 rounded hover:bg-gray-100 ${u.active !== false ? 'text-red-600' : 'text-green-600'}`}
                       title={u.active !== false ? "Deactivate User" : "Activate User"}
                     >
                       {u.active !== false ? <X size={16} /> : <Check size={16} />}
                     </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-lg text-xs text-yellow-800 flex gap-2">
         <Shield size={16} />
         <span>Only Admins can view this page. Changes to roles affect system access immediately.</span>
      </div>
    </div>
  );
};