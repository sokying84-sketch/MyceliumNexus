import React, { useState, useEffect, useMemo } from 'react';
import { Package, RefreshCw, X, Save, History, ArrowUpRight, ArrowDownLeft, AlertCircle, Clock, User as UserIcon, Layers, FileText, Tag, Filter, Search } from 'lucide-react';
import { User, InventoryRecord, Material, Role, InventoryTransaction, InventoryMovementType } from '../types';
import { StorageService } from '../services/storageService';

interface Props {
  user: User;
}

export const Inventory: React.FC<Props> = ({ user }) => {
  const [inventory, setInventory] = useState<InventoryRecord[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const KEYS = StorageService.getKeys();

  // Filter State
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    materialId: '',
    type: '',
    batchId: '',
    user: ''
  });

  // Adjustment Modal State
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustForm, setAdjustForm] = useState({
    materialId: '',
    actualQty: 0,
    reason: ''
  });

  const loadData = () => {
    const inv = StorageService.getAll<InventoryRecord>(KEYS.INVENTORY, user.entityId);
    setInventory(inv);
    setMaterials(StorageService.getAll<Material>(KEYS.MATERIALS, user.entityId));
    setTransactions(StorageService.getTransactions(user.entityId));
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // --- Filter Logic ---

  // Get unique users from history for the dropdown
  const uniqueUsers = useMemo(() => {
    return Array.from(new Set(transactions.map(t => t.performedBy))).filter(Boolean).sort();
  }, [transactions]);

  const filteredTransactions = transactions.filter(tx => {
    const matchMat = !filters.materialId || tx.materialId === filters.materialId;
    const matchType = !filters.type || tx.type === filters.type;
    // Partial case-insensitive match for Batch ID
    const matchBatch = !filters.batchId || (tx.batchId && tx.batchId.toLowerCase().includes(filters.batchId.toLowerCase()));
    const matchUser = !filters.user || tx.performedBy === filters.user;

    return matchMat && matchType && matchBatch && matchUser;
  });

  const clearFilters = () => {
    setFilters({ materialId: '', type: '', batchId: '', user: '' });
  };

  const hasActiveFilters = filters.materialId || filters.type || filters.batchId || filters.user;

  // --- Adjustment Logic ---

  const openAdjustModal = () => {
    if (materials.length === 0) {
      alert("No materials defined in Master Data yet.");
      return;
    }
    setAdjustForm({
      materialId: materials[0].id,
      actualQty: 0,
      reason: 'Periodic Stocktake'
    });
    // Set initial quantity for the first item
    const currentQty = StorageService.getInventory(user.entityId, materials[0].id);
    setAdjustForm(prev => ({ ...prev, actualQty: currentQty }));
    
    setShowAdjustModal(true);
  };

  const handleMaterialChange = (matId: string) => {
    const currentQty = StorageService.getInventory(user.entityId, matId);
    setAdjustForm({
      ...adjustForm,
      materialId: matId,
      actualQty: currentQty
    });
  };

  const handleSaveAdjustment = () => {
    if (!adjustForm.materialId) return;

    const currentQty = StorageService.getInventory(user.entityId, adjustForm.materialId);
    const delta = adjustForm.actualQty - currentQty;

    if (delta === 0) {
      setShowAdjustModal(false);
      return;
    }

    const matName = materials.find(m => m.id === adjustForm.materialId)?.name || 'Unknown Item';

    StorageService.updateStock(
      user.entityId, 
      adjustForm.materialId, 
      delta,
      {
        type: InventoryMovementType.ADJUSTMENT,
        reason: adjustForm.reason,
        performedBy: user.name
      }
    );
    
    StorageService.logActivity(
      user.entityId, 
      user, 
      'ADJUST_STOCK', 
      `Manual adjustment for ${matName}: Changed ${currentQty} to ${adjustForm.actualQty} (${delta > 0 ? '+' : ''}${delta}).`
    );

    setShowAdjustModal(false);
    loadData();
  };

  return (
    <div className="space-y-8">
       <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Inventory Management</h2>
        {user.role === Role.ADMIN && (
             <button 
               onClick={openAdjustModal}
               className="text-sm bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg shadow-sm hover:bg-gray-50 flex items-center gap-2 font-medium"
             >
                 <RefreshCw size={16} /> Adjust Stock (Admin)
             </button>
        )}
      </div>

      {/* Stock Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {materials.map(mat => {
            const stock = inventory.find(i => i.materialId === mat.id);
            const qty = stock ? stock.quantityOnHand : 0;
            const isLow = qty < 10; // Demo threshold

            return (
                <div key={mat.id} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div>
                        <h4 className="font-semibold text-gray-800">{mat.name}</h4>
                        <span className="text-xs text-gray-500">{mat.category} • {mat.uom}</span>
                    </div>
                    <div className="text-right">
                        <span className={`text-2xl font-bold block ${isLow ? 'text-red-600' : 'text-gray-800'}`}>
                            {qty}
                        </span>
                        <span className="text-xs text-gray-400">On Hand</span>
                    </div>
                </div>
            );
        })}
        {materials.length === 0 && (
          <div className="col-span-full p-8 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
             No materials found. Please go to Master Data to define materials first.
          </div>
        )}
      </div>
      
      {/* SECTION HEADER & FILTERS */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
                <History size={20} className="text-gray-500" />
                <h3 className="font-bold text-gray-700 text-lg">Inventory Movement History</h3>
            </div>
            <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${showFilters || hasActiveFilters ? 'bg-primary-50 border-primary-200 text-primary-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
                <Filter size={16} />
                Filters
                {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-primary-500"></span>}
            </button>
        </div>

        {/* Filter Bar */}
        {(showFilters || hasActiveFilters) && (
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm animate-in fade-in slide-in-from-top-2">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Material Filter */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Material</label>
                        <select 
                            className="w-full border rounded-lg p-2 text-sm bg-gray-50 focus:bg-white transition-colors"
                            value={filters.materialId}
                            onChange={(e) => setFilters({...filters, materialId: e.target.value})}
                        >
                            <option value="">All Materials</option>
                            {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                    </div>

                    {/* Type Filter */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Movement Type</label>
                        <select 
                            className="w-full border rounded-lg p-2 text-sm bg-gray-50 focus:bg-white transition-colors"
                            value={filters.type}
                            onChange={(e) => setFilters({...filters, type: e.target.value})}
                        >
                            <option value="">All Types</option>
                            {Object.values(InventoryMovementType).map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>

                    {/* Batch Filter */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Batch ID</label>
                        <div className="relative">
                            <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                            <input 
                                type="text"
                                placeholder="Search Batch..."
                                className="w-full border rounded-lg pl-8 p-2 text-sm bg-gray-50 focus:bg-white transition-colors"
                                value={filters.batchId}
                                onChange={(e) => setFilters({...filters, batchId: e.target.value})}
                            />
                        </div>
                    </div>

                    {/* User Filter */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Performed By</label>
                        <select 
                            className="w-full border rounded-lg p-2 text-sm bg-gray-50 focus:bg-white transition-colors"
                            value={filters.user}
                            onChange={(e) => setFilters({...filters, user: e.target.value})}
                        >
                            <option value="">All Users</option>
                            {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                    </div>
                </div>
                
                {hasActiveFilters && (
                    <div className="mt-4 flex justify-end">
                        <button 
                            onClick={clearFilters}
                            className="text-xs text-red-600 font-bold hover:underline flex items-center gap-1"
                        >
                            <X size={12} /> Clear Filters
                        </button>
                    </div>
                )}
            </div>
        )}
      </div>

      {/* MOBILE VIEW (CARDS) */}
      <div className="md:hidden space-y-4">
        {filteredTransactions.map(tx => {
            const mat = materials.find(m => m.id === tx.materialId);
            const isPositive = tx.quantityChange > 0;
            
            let badgeColor = 'bg-gray-100 text-gray-600';
            if (tx.type === InventoryMovementType.PROCUREMENT) badgeColor = 'bg-blue-100 text-blue-700';
            if (tx.type === InventoryMovementType.CONSUMPTION) badgeColor = 'bg-amber-100 text-amber-700';
            if (tx.type === InventoryMovementType.ADJUSTMENT) badgeColor = 'bg-purple-100 text-purple-700';
            if (tx.type === InventoryMovementType.REPLACEMENT) badgeColor = 'bg-teal-100 text-teal-700';

            return (
              <div key={tx.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  {/* Row 1: Date & Badge */}
                  <div className="flex justify-between items-start mb-3">
                      <div className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock size={12} />
                          <span>{new Date(tx.date).toLocaleDateString()}</span>
                          <span className="opacity-50">|</span>
                          <span>{new Date(tx.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${badgeColor}`}>
                          {tx.type}
                      </span>
                  </div>

                  {/* Row 2: Main Info */}
                  <div className="flex justify-between items-center mb-4">
                      <div>
                          <div className="font-bold text-gray-900 text-lg">{mat?.name || tx.materialId}</div>
                          <div className="text-xs text-gray-500">{mat?.uom || 'Unit'}</div>
                      </div>
                      <div className={`text-xl font-mono font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                          {isPositive ? '+' : ''}{tx.quantityChange}
                      </div>
                  </div>

                  {/* Row 3: Context Chips */}
                  <div className="flex flex-wrap gap-2 mb-3">
                      {tx.batchId && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-100 rounded text-xs text-blue-700 font-medium">
                              <Layers size={10} />
                              <span>{tx.batchId}</span>
                          </div>
                      )}
                      
                      {tx.stage && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 border border-gray-200 rounded text-xs text-gray-600">
                              <Tag size={10} />
                              <span>{tx.stage}</span>
                          </div>
                      )}

                      {(tx.poId) && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-orange-50 border border-orange-100 rounded text-xs text-orange-700">
                              <FileText size={10} />
                              <span>{tx.poId}</span>
                          </div>
                      )}
                  </div>

                  {/* Row 4: Reason/User */}
                  <div className="pt-3 border-t border-gray-50 flex justify-between items-center text-xs text-gray-500">
                      <div className="truncate max-w-[60%] italic">
                          {tx.reason || (tx.type === InventoryMovementType.INITIAL ? 'System Init' : '')}
                      </div>
                      <div className="flex items-center gap-1 font-medium text-gray-400">
                          <UserIcon size={10} /> {tx.performedBy}
                      </div>
                  </div>
              </div>
            );
        })}
        {filteredTransactions.length === 0 && (
            <div className="p-8 text-center text-gray-400 border-2 border-dashed rounded-xl bg-gray-50">
                {hasActiveFilters ? 'No results found matching your filters.' : 'No movements recorded yet.'}
            </div>
        )}
      </div>

{/* DESKTOP VIEW (TABLE) */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-600 uppercase border-b text-xs font-bold tracking-wider">
                    <tr>
                        <th className="p-4 w-32">Date</th>
                        <th className="p-4">Material</th>
                        <th className="p-4">Type</th>
                        <th className="p-4">Stage Used</th>
                        <th className="p-4">Details</th>
                        <th className="p-4 text-right">Qty Change</th>
                        <th className="p-4 text-right">User</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {filteredTransactions.map(tx => {
                        const mat = materials.find(m => m.id === tx.materialId);
                        const isPositive = tx.quantityChange > 0;
                        
                        let badgeColor = 'bg-gray-100 text-gray-600';
                        if (tx.type === InventoryMovementType.PROCUREMENT) badgeColor = 'bg-blue-100 text-blue-700 border border-blue-200';
                        if (tx.type === InventoryMovementType.CONSUMPTION) badgeColor = 'bg-amber-100 text-amber-700 border border-amber-200';
                        if (tx.type === InventoryMovementType.ADJUSTMENT) badgeColor = 'bg-purple-100 text-purple-700 border border-purple-200';
                        if (tx.type === InventoryMovementType.REPLACEMENT) badgeColor = 'bg-red-50 text-red-700 border border-red-200';

                        return (
                            <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                                <td className="p-4 text-gray-500 font-mono text-xs">
                                    <div className="font-bold">{new Date(tx.date).toLocaleDateString()}</div>
                                    <div className="text-[10px]">{new Date(tx.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                </td>
                                <td className="p-4 font-medium text-gray-900">
                                    {mat?.name || tx.materialId}
                                    <span className="block text-xs text-gray-400 font-normal">{mat?.uom}</span>
                                </td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide ${badgeColor}`}>
                                        {tx.type}
                                    </span>
                                </td>
                                <td className="p-4 text-xs">
                                    {tx.stage ? (
                                        <span className="px-2 py-1 bg-gray-100 border rounded text-gray-600 font-medium">{tx.stage}</span>
                                    ) : (
                                        <span className="text-gray-300 italic">N/A</span>
                                    )}
                                </td>
                                
                                {/* --- COMBINED DETAILS COLUMN (FIXED) --- */}
                                <td className="p-4 text-gray-600 text-xs">
                                    <div className="flex flex-col gap-1 items-start">
                                        
                                        {/* 1. Show PO Number if exists */}
                                        {tx.poId && (
                                            <div className="flex items-center gap-1">
                                                <span className="text-gray-400">PO:</span> 
                                                <span className="font-mono text-gray-700 font-medium">{tx.poId}</span>
                                            </div>
                                        )}

                                        {/* 2. Show Batch ID (REMOVED TYPE RESTRICTION) */}
                                        {/* Now, if a batchId exists in the DB, it WILL show here */}
                                        {tx.batchId && (
                                            <div className="flex items-center gap-1">
                                                <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Batch</span>
                                                <span className="font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100 font-bold text-[10px]">
                                                    {tx.batchId}
                                                </span>
                                            </div>
                                        )}

                                        {/* 3. Show Reason for Adjustments */}
                                        {tx.type === InventoryMovementType.ADJUSTMENT && (
                                            <span className="italic text-gray-500">{tx.reason}</span>
                                        )}
                                        
                                        {/* Fallback: Only show -- if literally nothing else exists */}
                                        {!tx.poId && !tx.batchId && !tx.reason && (
                                            <span className="text-gray-300 italic">--</span>
                                        )}
                                    </div>
                                </td>

                                <td className={`p-4 text-right font-mono font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                    {isPositive ? '+' : ''}{tx.quantityChange}
                                </td>
                                <td className="p-4 text-right text-gray-500 text-xs">
                                    {tx.performedBy}
                                </td>
                            </tr>
                        );
                    })}
                    {filteredTransactions.length === 0 && (
                        <tr><td colSpan={8} className="p-8 text-center text-gray-400 italic">
                            {hasActiveFilters ? 'No results found matching your filters.' : 'No movements recorded yet.'}
                        </td></tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>
            
      {/* Adjustment Modal */}
      {showAdjustModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-lg">Adjust Stock Level</h3>
              <button onClick={() => setShowAdjustModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            
            <div className="p-6 space-y-4">
               <div>
                 <label className="block text-sm font-medium mb-1 text-gray-700">Select Material</label>
                 <select 
                   className="w-full border rounded-lg p-2.5 bg-gray-50"
                   value={adjustForm.materialId}
                   onChange={e => handleMaterialChange(e.target.value)}
                 >
                   {materials.map(m => (
                     <option key={m.id} value={m.id}>{m.name} ({m.uom})</option>
                   ))}
                 </select>
               </div>

               <div>
                 <label className="block text-sm font-medium mb-1 text-gray-700">Actual Quantity (Physical Count)</label>
                 <input 
                    type="number" 
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-lg font-bold"
                    value={adjustForm.actualQty}
                    onChange={e => setAdjustForm({...adjustForm, actualQty: Number(e.target.value)})}
                 />
                 <p className="text-xs text-gray-500 mt-1">
                   System will calculate the adjustment automatically based on current stock.
                 </p>
               </div>

               <div>
                 <label className="block text-sm font-medium mb-1 text-gray-700">Reason</label>
                 <input 
                    type="text" 
                    className="w-full border border-gray-300 rounded-lg p-2.5"
                    placeholder="e.g. Broken bag, Monthly Stocktake"
                    value={adjustForm.reason}
                    onChange={e => setAdjustForm({...adjustForm, reason: e.target.value})}
                 />
               </div>
            </div>

            <div className="p-4 bg-gray-50 border-t rounded-b-xl flex justify-end gap-3">
               <button onClick={() => setShowAdjustModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
               <button 
                 onClick={handleSaveAdjustment} 
                 className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2"
               >
                 <Save size={16} /> Save Adjustment
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};