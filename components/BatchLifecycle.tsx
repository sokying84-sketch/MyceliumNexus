
import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, FlaskConical, Sprout, BoxSelect, ThermometerSun, Leaf, Warehouse, 
  CheckSquare, AlertTriangle, Plus, Save
} from 'lucide-react';
import { 
  User, Batch, ProductionStage, BatchStatus, CultureLog, SpawnLog, SubstrateLog, 
  SpawnStatus, InoculationLog, IncubationLog, FruitingLog, FruitingItem, HarvestLog, Material 
} from '../types';
import { StorageService } from '../services/storageService';
import { SmartNotes } from './SmartNotes';

interface Props {
  user: User;
  batch: Batch;
  onBack: () => void;
}

export const BatchLifecycle: React.FC<Props> = ({ user, batch, onBack }) => {
  const [activeStage, setActiveStage] = useState<ProductionStage>(ProductionStage.CULTURE);
  const [logs, setLogs] = useState<any[]>([]); // Generic holder for current stage logs
  const [materials, setMaterials] = useState<Material[]>([]);
  const KEYS = StorageService.getKeys();

  // Form States (Generic)
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<any>({});

  // Fruiting Items State
  const [fruitingItems, setFruitingItems] = useState<FruitingItem[]>([]);
  const [selectedFruitingId, setSelectedFruitingId] = useState<string | null>(null);

  useEffect(() => {
    loadStageData();
    setMaterials(StorageService.getAll<Material>(KEYS.MATERIALS, user.entityId));
  }, [activeStage, batch.id]);

  const loadStageData = () => {
    let data: any[] = [];
    switch (activeStage) {
      case ProductionStage.CULTURE: data = StorageService.getAll(KEYS.LOGS_CULTURE, user.entityId); break;
      case ProductionStage.SPAWN: data = StorageService.getAll(KEYS.LOGS_SPAWN, user.entityId); break;
      case ProductionStage.SUBSTRATE: data = StorageService.getAll(KEYS.LOGS_SUBSTRATE, user.entityId); break;
      case ProductionStage.INOCULATION: data = StorageService.getAll(KEYS.LOGS_INOCULATION, user.entityId); break;
      case ProductionStage.INCUBATION: data = StorageService.getAll(KEYS.LOGS_INCUBATION, user.entityId); break;
      case ProductionStage.FRUITING: data = StorageService.getAll(KEYS.LOGS_FRUITING, user.entityId); break;
      case ProductionStage.HARVEST: data = StorageService.getAll(KEYS.LOGS_HARVEST, user.entityId); break;
    }
    // Filter by Batch
    setLogs(data.filter(l => l.batchId === batch.id));
    setShowForm(false);
  };

  const handleStageChange = (stage: ProductionStage) => {
    setActiveStage(stage);
    setSelectedFruitingId(null);
  };

  const saveLog = (data: any) => {
    // 1. Save Log
    let key = '';
    let statusUpdate: BatchStatus | null = null;

    switch (activeStage) {
      case ProductionStage.CULTURE: 
        key = KEYS.LOGS_CULTURE; 
        statusUpdate = BatchStatus.CULTURE;
        break;
      case ProductionStage.SPAWN: 
        key = KEYS.LOGS_SPAWN; 
        statusUpdate = BatchStatus.SPAWN;
        break;
      case ProductionStage.SUBSTRATE: 
        key = KEYS.LOGS_SUBSTRATE; 
        statusUpdate = BatchStatus.SUBSTRATE;
        break;
      case ProductionStage.INOCULATION: 
        key = KEYS.LOGS_INOCULATION; 
        statusUpdate = BatchStatus.INOCULATION;
        break;
      case ProductionStage.INCUBATION: 
        key = KEYS.LOGS_INCUBATION; 
        statusUpdate = BatchStatus.INCUBATION;
        break;
      case ProductionStage.HARVEST:
        key = KEYS.LOGS_HARVEST;
        statusUpdate = BatchStatus.HARVESTING;
        break;
    }

    if (key) {
      StorageService.add(key, { 
        ...data, 
        id: `${activeStage.toLowerCase()}_${Date.now()}`,
        batchId: batch.id,
        entityId: user.entityId
      });
      
      if (statusUpdate) {
        StorageService.updateBatchStatus(batch.id, statusUpdate);
      }
      
      loadStageData();
    }
  };

  const handleStartFruiting = (roomNo: string, bagCount: number) => {
    StorageService.startFruitingFlush(batch.id, user.entityId, roomNo, bagCount);
    StorageService.updateBatchStatus(batch.id, BatchStatus.FRUITING);
    loadStageData();
  };

  const loadFruitingItems = (fruitingId: string) => {
    setSelectedFruitingId(fruitingId);
    const allItems = StorageService.getAll<FruitingItem>(KEYS.ITEMS_FRUITING, user.entityId);
    setFruitingItems(allItems.filter(i => i.fruitingId === fruitingId));
  };

  const renderStageContent = () => {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Transactional Data */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Header & Add Button */}
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold text-gray-800 capitalize">{activeStage.toLowerCase().replace('_', ' ')} Logs</h3>
            {activeStage !== ProductionStage.FRUITING && (
              <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-primary-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-primary-700">
                <Plus size={16} /> Add Record
              </button>
            )}
          </div>

          {/* Dynamic Form */}
          {showForm && (
            <div className="bg-white p-4 rounded-xl border border-primary-200 shadow-sm animate-in fade-in slide-in-from-top-4">
               {/* 1. CULTURE FORM */}
               {activeStage === ProductionStage.CULTURE && (
                 <div className="space-y-3">
                   <select className="w-full border p-2 rounded" onChange={e => setFormData({...formData, materialId: e.target.value})}>
                     <option value="">Select Mother Culture...</option>
                     {materials.filter(m => m.category === 'SPECIES').map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                   </select>
                   <div className="grid grid-cols-2 gap-3">
                     <input type="number" placeholder="Qty Used" className="border p-2 rounded" onChange={e => setFormData({...formData, qtyUsed: Number(e.target.value)})}/>
                     <input type="date" className="border p-2 rounded" onChange={e => setFormData({...formData, dateStarted: e.target.value})}/>
                   </div>
                   <div className="grid grid-cols-2 gap-3">
                     <input type="number" placeholder="Plates Produced" className="border p-2 rounded" onChange={e => setFormData({...formData, platesProduced: Number(e.target.value)})}/>
                     <input type="number" placeholder="Contaminated" className="border p-2 rounded" onChange={e => setFormData({...formData, platesContaminated: Number(e.target.value)})}/>
                   </div>
                   <button onClick={() => saveLog(formData)} className="w-full bg-primary-600 text-white p-2 rounded">Save Culture Log</button>
                 </div>
               )}

               {/* 2. SPAWN FORM */}
               {activeStage === ProductionStage.SPAWN && (
                 <div className="space-y-3">
                   <select className="w-full border p-2 rounded" onChange={e => setFormData({...formData, materialId: e.target.value})}>
                     <option value="">Select Grain/Agar...</option>
                     {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                   </select>
                   <select className="w-full border p-2 rounded" onChange={e => setFormData({...formData, status: e.target.value})}>
                     {Object.values(SpawnStatus).map(s => <option key={s} value={s}>{s}</option>)}
                   </select>
                   <div className="grid grid-cols-2 gap-3">
                     <input type="number" placeholder="Success Bags" className="border p-2 rounded" onChange={e => setFormData({...formData, successCount: Number(e.target.value)})}/>
                     <input type="number" placeholder="Failed Bags" className="border p-2 rounded" onChange={e => setFormData({...formData, failCount: Number(e.target.value)})}/>
                   </div>
                   <button onClick={() => saveLog(formData)} className="w-full bg-primary-600 text-white p-2 rounded">Save Spawn Log</button>
                 </div>
               )}

               {/* 3. SUBSTRATE FORM */}
               {activeStage === ProductionStage.SUBSTRATE && (
                 <div className="space-y-3">
                   <select className="w-full border p-2 rounded" onChange={e => setFormData({...formData, materialId: e.target.value})}>
                     <option value="">Select Bulk Substrate...</option>
                     {materials.filter(m => m.category === 'SUBSTRATES').map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                   </select>
                   <div className="space-y-2 border p-3 rounded bg-gray-50">
                     <p className="font-bold text-xs text-gray-500 uppercase">Process Checklist</p>
                     {['cutStraw', 'wash', 'soak', 'boilSteam', 'drainCool'].map(item => (
                       <label key={item} className="flex items-center gap-2 text-sm">
                         <input type="checkbox" onChange={e => {
                           const cl = formData.checklist || {};
                           cl[item] = e.target.checked;
                           // Calculate %
                           const count = Object.values(cl).filter(Boolean).length;
                           setFormData({...formData, checklist: cl, statusPercentage: count * 20});
                         }} />
                         {item.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                       </label>
                     ))}
                   </div>
                   <button onClick={() => saveLog(formData)} className="w-full bg-primary-600 text-white p-2 rounded">Save Substrate Log</button>
                 </div>
               )}
               
               {/* 4. INOCULATION FORM */}
               {activeStage === ProductionStage.INOCULATION && (
                 <div className="space-y-3">
                   <div className="bg-blue-50 p-2 text-xs text-blue-800 rounded">
                     Target Composition: {batch.compositionNotes || 'Not specified'}
                   </div>
                   <div className="grid grid-cols-2 gap-3">
                      <select className="border p-2 rounded text-sm" onChange={e => setFormData({...formData, spawnMaterialId: e.target.value})}>
                        <option value="">Select Spawn...</option>
                        {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                      <input type="number" placeholder="Spawn Qty" className="border p-2 rounded text-sm" onChange={e => setFormData({...formData, qtySpawn: Number(e.target.value)})}/>
                   </div>
                   <div className="grid grid-cols-2 gap-3">
                      <select className="border p-2 rounded text-sm" onChange={e => setFormData({...formData, substrateMaterialId: e.target.value})}>
                        <option value="">Select Substrate...</option>
                        {materials.filter(m => m.category === 'SUBSTRATES').map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                      <input type="number" placeholder="Substrate Qty" className="border p-2 rounded text-sm" onChange={e => setFormData({...formData, qtySubstrate: Number(e.target.value)})}/>
                   </div>
                   <input type="number" placeholder="Total Bags Packed" className="border p-2 rounded w-full" onChange={e => setFormData({...formData, bagsPacked: Number(e.target.value)})}/>
                   <button onClick={() => saveLog(formData)} className="w-full bg-primary-600 text-white p-2 rounded">Save Inoculation</button>
                 </div>
               )}

               {/* 5. INCUBATION FORM */}
               {activeStage === ProductionStage.INCUBATION && (
                 <div className="space-y-3">
                    <input type="text" placeholder="Room Number" className="border p-2 rounded w-full" onChange={e => setFormData({...formData, roomNo: e.target.value})}/>
                    <select className="w-full border p-2 rounded" onChange={e => setFormData({...formData, status: e.target.value})}>
                      <option value="In-Progress">In-Progress</option>
                      <option value="Ready">Ready for Fruiting</option>
                    </select>
                    <div className="grid grid-cols-2 gap-3">
                     <input type="number" placeholder="Success Bags" className="border p-2 rounded" onChange={e => setFormData({...formData, successCount: Number(e.target.value)})}/>
                     <input type="number" placeholder="Failed Bags" className="border p-2 rounded" onChange={e => setFormData({...formData, failCount: Number(e.target.value)})}/>
                   </div>
                   <button onClick={() => saveLog(formData)} className="w-full bg-primary-600 text-white p-2 rounded">Save Incubation Log</button>
                 </div>
               )}

               {/* 6. HARVEST FORM */}
               {activeStage === ProductionStage.HARVEST && (
                 <div className="space-y-3">
                    <input type="date" className="border p-2 rounded w-full" onChange={e => setFormData({...formData, harvestDate: e.target.value})}/>
                    <div className="grid grid-cols-2 gap-3">
                      <input type="number" placeholder="Grade A (kg)" className="border p-2 rounded" onChange={e => setFormData({...formData, gradeAYield: Number(e.target.value)})}/>
                      <input type="number" placeholder="Grade B (kg)" className="border p-2 rounded" onChange={e => setFormData({...formData, gradeBYield: Number(e.target.value)})}/>
                    </div>
                    <select className="w-full border p-2 rounded" onChange={e => setFormData({...formData, action: e.target.value})}>
                      <option value="Next Flush">Continue to Next Flush</option>
                      <option value="Dispose">Dispose Batch</option>
                    </select>
                    <button onClick={() => saveLog({...formData, totalYield: (formData.gradeAYield || 0) + (formData.gradeBYield || 0)})} className="w-full bg-primary-600 text-white p-2 rounded">Save Harvest Record</button>
                 </div>
               )}
            </div>
          )}

          {/* List of Logs */}
          <div className="space-y-3">
            {activeStage === ProductionStage.FRUITING ? (
              // Special Layout for Fruiting
              <div className="space-y-6">
                <div className="bg-orange-50 p-4 rounded-xl border border-orange-200">
                  <h4 className="font-bold text-orange-900 mb-2">Start New Flush</h4>
                  <div className="flex gap-3">
                    <input type="text" id="frt-room" placeholder="Room No" className="border p-2 rounded text-sm"/>
                    <input type="number" id="frt-bags" placeholder="Count of Bags" className="border p-2 rounded text-sm"/>
                    <button 
                      onClick={() => {
                        const r = (document.getElementById('frt-room') as HTMLInputElement).value;
                        const c = (document.getElementById('frt-bags') as HTMLInputElement).value;
                        if(r && c) handleStartFruiting(r, Number(c));
                      }}
                      className="bg-orange-600 text-white px-4 rounded text-sm font-bold"
                    >
                      Generate IDs
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {logs.map((log: FruitingLog) => (
                    <div key={log.id} onClick={() => loadFruitingItems(log.id)} className={`p-4 rounded-xl border cursor-pointer transition-colors ${selectedFruitingId === log.id ? 'bg-primary-50 border-primary-500 ring-1 ring-primary-500' : 'bg-white hover:border-gray-400'}`}>
                      <div className="flex justify-between mb-1">
                        <span className="font-mono font-bold">{log.id}</span>
                        <span className="text-xs text-gray-500">{new Date(log.dateStarted).toLocaleDateString()}</span>
                      </div>
                      <div className="text-sm">Room: {log.roomNo}</div>
                    </div>
                  ))}
                </div>

                {selectedFruitingId && (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="p-3 bg-gray-50 font-bold border-b text-sm">Individual Items ({fruitingItems.length})</div>
                    <div className="max-h-60 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-100 sticky top-0"><tr><th className="p-2">Serial ID</th><th className="p-2">Status</th><th className="p-2">Maturity</th></tr></thead>
                        <tbody>
                          {fruitingItems.map(item => (
                            <tr key={item.id} className="border-b hover:bg-gray-50">
                              <td className="p-2 font-mono">{item.id}</td>
                              <td className="p-2">
                                <span className={`px-1 rounded ${item.status === 'Good' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{item.status}</span>
                              </td>
                              <td className="p-2 italic">{item.maturityIndex}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Generic Log List
              logs.map((log, idx) => (
                <div key={idx} className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm flex justify-between items-center">
                   <div>
                     <div className="text-xs text-gray-400 font-mono mb-1">{log.id}</div>
                     {/* Dynamic Details based on stage */}
                     {activeStage === ProductionStage.SPAWN && (
                       <div className="text-sm">
                         Status: <span className="font-bold text-primary-600">{log.status}</span> • Success: {log.successCount}
                         {log.status === SpawnStatus.STAGE_3 && <span className="ml-2 text-red-500 text-xs font-bold animate-pulse"><AlertTriangle size={10} className="inline"/> Alert: Prep Substrate!</span>}
                       </div>
                     )}
                     {activeStage === ProductionStage.SUBSTRATE && (
                       <div className="text-sm">Progress: {log.statusPercentage}%</div>
                     )}
                     {/* Add other specific details here */}
                   </div>
                   <div className="text-right text-xs text-gray-400">
                     {log.dateStarted ? new Date(log.dateStarted).toLocaleDateString() : (log.date ? new Date(log.date).toLocaleDateString() : '')}
                   </div>
                </div>
              ))
            )}
            {logs.length === 0 && activeStage !== ProductionStage.FRUITING && (
              <div className="text-center text-gray-400 p-8 border-2 border-dashed rounded-xl">No logs found.</div>
            )}
          </div>
        </div>

        {/* Right: Smart Notes & Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
            <h4 className="font-bold text-blue-900 mb-2 text-sm">Batch Context</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-blue-700">ID:</span> <span className="font-mono">{batch.id}</span></div>
              <div className="flex justify-between"><span className="text-blue-700">Status:</span> <span className="font-bold">{batch.status}</span></div>
              <div className="flex justify-between"><span className="text-blue-700">Location:</span> <span>{batch.location}</span></div>
            </div>
          </div>

          <SmartNotes 
            batchId={batch.id} 
            stage={activeStage} 
            user={user} 
          />
        </div>
      </div>
    );
  };

  const StageButton = ({ id, label, icon: Icon }: any) => (
    <button
      onClick={() => handleStageChange(id)}
      className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all ${activeStage === id ? 'bg-primary-600 text-white shadow-md scale-105' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100'}`}
    >
      <Icon size={24} className="mb-1" />
      <span className="text-[10px] uppercase font-bold tracking-wide">{label}</span>
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="bg-white p-2 rounded-full border hover:bg-gray-50"><ArrowLeft size={20} /></button>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Batch Lifecycle Manager</h2>
          <p className="text-sm text-gray-500">{batch.species} • Started: {new Date(batch.startDate).toLocaleDateString()}</p>
        </div>
      </div>

      {/* Stage Navigation */}
      <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
        <StageButton id={ProductionStage.CULTURE} label="Culture" icon={FlaskConical} />
        <StageButton id={ProductionStage.SPAWN} label="Spawn" icon={Sprout} />
        <StageButton id={ProductionStage.SUBSTRATE} label="Substrate" icon={BoxSelect} />
        <StageButton id={ProductionStage.INOCULATION} label="Inoculation" icon={ThermometerSun} />
        <StageButton id={ProductionStage.INCUBATION} label="Incubation" icon={Warehouse} />
        <StageButton id={ProductionStage.FRUITING} label="Fruiting" icon={Leaf} />
        <StageButton id={ProductionStage.HARVEST} label="Harvest" icon={CheckSquare} />
      </div>

      {/* Main Content Area */}
      <div className="mt-6">
        {renderStageContent()}
      </div>
    </div>
  );
};
