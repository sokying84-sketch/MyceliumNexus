import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { Material, Vendor, MaterialCategory, UnitOfMeasure, User } from '../types';
import { StorageService } from '../services/storageService';

interface Props {
  user: User;
  refreshTrigger: number;
}

export const MasterData: React.FC<Props> = ({ user, refreshTrigger }) => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [activeTab, setActiveTab] = useState<'materials' | 'vendors'>('materials');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<any>({});
  
  const KEYS = StorageService.getKeys();

  const loadData = () => {
    setMaterials(StorageService.getAll<Material>(KEYS.MATERIALS, user.entityId));
    setVendors(StorageService.getAll<Vendor>(KEYS.VENDORS, user.entityId));
  };

  useEffect(() => {
    loadData();
  }, [user, refreshTrigger]);

  const handleOpenModal = (item?: any) => {
    setEditingId(item?.id || null);
    
    if (activeTab === 'materials') {
      setFormData(item || {
        category: MaterialCategory.GRAINS,
        uom: 'KG', // Default string
        name: '',
        standardCost: 0
      });
    } else {
      setFormData(item || {
        name: '',
        contactPerson: '',
        email: '',
        phone: '',
        paymentTerms: 'Net 30'
      });
    }
    setShowModal(true);
  };

  const handleSave = () => {
    if (activeTab === 'materials') {
      handleSaveMaterial();
    } else {
      handleSaveVendor();
    }
  };

  const handleSaveMaterial = () => {
    if (!formData.name) return alert("Please enter a material name");
    if (formData.standardCost === undefined) return alert("Please enter cost");
    if (!formData.uom) return alert("Please enter a Unit of Measure");

    const isDuplicate = materials.some(m => 
      m.name.toLowerCase() === formData.name.toLowerCase() && m.id !== editingId
    );
    if (isDuplicate) return alert("Name must be unique");

    const item: Material = {
      ...formData,
      id: editingId || `mat_${Date.now()}`,
      entityId: user.entityId,
      standardCost: Number(formData.standardCost),
      uom: formData.uom.toUpperCase() // Standardize UOM
    };

    if (editingId) {
      StorageService.update(KEYS.MATERIALS, item);
      StorageService.logActivity(user.entityId, user, 'UPDATE_MATERIAL', `Updated material: ${item.name}`);
    } else {
      StorageService.add(KEYS.MATERIALS, item);
      StorageService.logActivity(user.entityId, user, 'CREATE_MATERIAL', `Created material: ${item.name}`);
    }
    
    closeAndReload();
  };

  const handleSaveVendor = () => {
    if (!formData.name) return alert("Please enter vendor name");
    if (!formData.contactPerson) return alert("Please enter contact person");

    const item: Vendor = {
      ...formData,
      id: editingId || `ven_${Date.now()}`,
      entityId: user.entityId
    };

    if (editingId) {
      StorageService.update(KEYS.VENDORS, item);
      StorageService.logActivity(user.entityId, user, 'UPDATE_VENDOR', `Updated vendor: ${item.name}`);
    } else {
      StorageService.add(KEYS.VENDORS, item);
      StorageService.logActivity(user.entityId, user, 'CREATE_VENDOR', `Created vendor: ${item.name}`);
    }

    closeAndReload();
  };

  const closeAndReload = () => {
    setShowModal(false);
    loadData();
    setEditingId(null);
  };

  // Dynamic UOM Options: Combine standard enums + any custom UOMs already in the database
  const getUOMOptions = () => {
    const standard = Object.values(UnitOfMeasure);
    const custom = materials.map(m => m.uom);
    return Array.from(new Set([...standard, ...custom])).sort();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Master Data Registry</h2>
        <div className="flex space-x-2">
          <button 
            className={`px-4 py-2 rounded-lg ${activeTab === 'materials' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600'}`}
            onClick={() => setActiveTab('materials')}
          >Materials</button>
          <button 
             className={`px-4 py-2 rounded-lg ${activeTab === 'vendors' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600'}`}
            onClick={() => setActiveTab('vendors')}
          >Vendors</button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between mb-4">
          <h3 className="font-semibold text-lg capitalize">{activeTab} Registry</h3>
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-soil-800 text-white px-3 py-2 rounded-lg text-sm hover:bg-soil-900"
          >
            <Plus size={16} /> Add New
          </button>
        </div>

        {activeTab === 'materials' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 uppercase">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">UOM</th>
                  <th className="p-3">Std. Cost</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {materials.map(m => (
                  <tr key={m.id}>
                    <td className="p-3 font-medium">{m.name}</td>
                    <td className="p-3"><span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs">{m.category}</span></td>
                    <td className="p-3">{m.uom}</td>
                    <td className="p-3">${m.standardCost.toFixed(2)}</td>
                    <td className="p-3">
                      <button onClick={() => handleOpenModal(m)} className="text-blue-600 hover:text-blue-800">
                        <Edit2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 uppercase">
                <tr>
                  <th className="p-3">Company Name</th>
                  <th className="p-3">Contact Person</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Payment Terms</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {vendors.map(v => (
                  <tr key={v.id}>
                    <td className="p-3 font-medium">{v.name}</td>
                    <td className="p-3">{v.contactPerson}</td>
                    <td className="p-3">{v.email}</td>
                    <td className="p-3">{v.paymentTerms}</td>
                    <td className="p-3">
                      <button onClick={() => handleOpenModal(v)} className="text-blue-600 hover:text-blue-800">
                        <Edit2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                 {vendors.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-gray-400">No vendors found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">
              {editingId ? 'Edit' : 'New'} {activeTab === 'materials' ? 'Material' : 'Vendor'}
            </h3>
            
            <div className="space-y-4">
              {activeTab === 'materials' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Name</label>
                    <input 
                      type="text" 
                      className="w-full border rounded p-2"
                      value={formData.name || ''}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Category</label>
                      <select 
                        className="w-full border rounded p-2"
                        value={formData.category}
                        onChange={e => setFormData({...formData, category: e.target.value})}
                      >
                        {Object.values(MaterialCategory).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Std Cost</label>
                      <input 
                        type="number" 
                        className="w-full border rounded p-2"
                        value={formData.standardCost}
                        onChange={e => setFormData({...formData, standardCost: parseFloat(e.target.value)})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">UOM</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        list="uom-options"
                        className="w-full border rounded p-2 uppercase"
                        value={formData.uom}
                        onChange={e => setFormData({...formData, uom: e.target.value.toUpperCase()})}
                        placeholder="Select or type..."
                      />
                      <datalist id="uom-options">
                        {getUOMOptions().map(u => <option key={u} value={u} />)}
                      </datalist>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Company Name</label>
                    <input 
                      type="text" 
                      className="w-full border rounded p-2"
                      value={formData.name || ''}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Contact Person</label>
                    <input 
                      type="text" 
                      className="w-full border rounded p-2"
                      value={formData.contactPerson || ''}
                      onChange={e => setFormData({...formData, contactPerson: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                      <label className="block text-sm font-medium mb-1">Email</label>
                      <input 
                        type="email" 
                        className="w-full border rounded p-2"
                        value={formData.email || ''}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Phone</label>
                      <input 
                        type="text" 
                        className="w-full border rounded p-2"
                        value={formData.phone || ''}
                        onChange={e => setFormData({...formData, phone: e.target.value})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Payment Terms</label>
                    <select 
                      className="w-full border rounded p-2"
                      value={formData.paymentTerms}
                      onChange={e => setFormData({...formData, paymentTerms: e.target.value})}
                    >
                      <option value="Net 30">Net 30</option>
                      <option value="Net 60">Net 60</option>
                      <option value="COD">COD</option>
                      <option value="Prepaid">Prepaid</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="text-gray-500">Cancel</button>
              <button onClick={handleSave} className="bg-primary-600 text-white px-4 py-2 rounded">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};