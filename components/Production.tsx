
import React, { useState, useEffect } from 'react';
import { Plus, Factory, Leaf, Edit2, Calendar, MapPin, Sprout, Trash2, Clock, Scale, FlaskConical, Calculator, Archive, Activity, DollarSign, AlertTriangle, TrendingUp, X, FileText, ShoppingCart, Truck, CheckCircle2, ClipboardList, ThermometerSun, Lightbulb, Info, Microscope, Beaker, Check, MessageSquareQuote, Package, Save, User as UserIcon, BarChart3, AlertCircle, RefreshCw, ArrowRight } from 'lucide-react';
import { User, Batch, Material, BatchStatus, BatchRecipeItem, InoculationLog, IncubationLog, FruitingLog, HarvestLog, Vendor } from '../types';
import { StorageService } from '../services/storageService';

interface Props {
  user: User;
}

const INCUBATION_LOCATIONS = ['Incubation Room 1', 'Incubation Room 2'];
const FRUITING_LOCATIONS = ['Fruiting Chamber A', 'Fruiting Chamber B', 'Greenhouse 1', 'Greenhouse 2'];

const SPECIES_OPTIONS = [
  'Grey Oyster (Pleurotus ostreatus)',
  'White Oyster (Pleurotus florida)',
  'Lion\'s Mane (Hericium erinaceus)',
  'Shiitake (Lentinula edodes)',
  'Reishi (Ganoderma lucidum)'
];

const ViewAuditModal: React.FC<{
  batch: Batch;
  user: User;
  materials: Material[];
  vendors: Vendor[];
  onClose: () => void;
}> = ({ batch, user, materials, vendors, onClose }) => {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    const keys = [
      StorageService.getKeys().LOGS_CULTURE,
      StorageService.getKeys().LOGS_SPAWN,
      StorageService.getKeys().LOGS_SUBSTRATE,
      StorageService.getKeys().LOGS_INOCULATION,
      StorageService.getKeys().LOGS_INCUBATION,
      StorageService.getKeys().LOGS_FRUITING,
      StorageService.getKeys().LOGS_HARVEST,
      StorageService.getKeys().LOGS_OBSERVATIONS
    ];

    let allLogs: any[] = [];
    keys.forEach(key => {
      const stageLogs = StorageService.getAll(key, user.entityId);
      const batchLogs = stageLogs.filter((l: any) => l.batchId === batch.id);
      allLogs = [...allLogs, ...batchLogs];
    });

    allLogs.sort((a, b) => {
        const dateA = new Date(a.dateStarted || a.date || a.harvestDate || 0).getTime();
        const dateB = new Date(b.dateStarted || b.date || b.harvestDate || 0).getTime();
        return dateB - dateA;
    });

    setLogs(allLogs);
  }, [batch, user.entityId]);

  const getMaterialName = (id: string) => materials.find(m => m.id === id)?.name || id;

  const renderLogDetails = (log: any) => {
      let type = log.id.split('_')[0]; // cl, sp, sb, in, ic, frt, obs, hv

      // Normalize IDs from App usage (which uses full names like 'culture_') to seed format ('cl_')
      if (type === 'culture') type = 'cl';
      if (type === 'spawn') type = 'sp';
      if (type === 'substrate') type = 'sb';
      if (type === 'inoculation') type = 'in';
      if (type === 'incubation') type = 'ic';
      if (type === 'fruiting') type = 'frt';
      if (type === 'harvest') type = 'hv';

      switch(type) {
          case 'cl': // Culture
              return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 mt-2 bg-purple-50 p-3 rounded-lg border border-purple-100">
                      <div className="col-span-full text-[10px] font-bold text-purple-700 uppercase tracking-wide border-b border-purple-200 pb-1 mb-1">Culture Stage</div>
                      <div className="text-xs text-gray-600">Source: <span className="font-semibold text-gray-800">{getMaterialName(log.materialId || log.cultureMaterialId)}</span></div>
                      <div className="text-xs text-gray-600">Vessel: <span className="font-semibold text-gray-800">{getMaterialName(log.dishMaterialId)}</span></div>
                      <div className="text-xs text-gray-600">Produced: <span className="font-bold text-green-700">{log.platesProduced} Plates</span></div>
                      <div className="text-xs text-gray-600">Loss: <span className="font-bold text-red-600">{log.platesContaminated || 0}</span></div>
                      {log.agarQty > 0 && <div className="col-span-full text-xs text-gray-500 mt-1 italic">Consumed: {log.agarQty}g {getMaterialName(log.agarMaterialId)}</div>}
                  </div>
              );
          case 'sp': // Spawn
              return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 mt-2 bg-amber-50 p-3 rounded-lg border border-amber-100">
                      <div className="col-span-full text-[10px] font-bold text-amber-700 uppercase tracking-wide border-b border-amber-200 pb-1 mb-1">Spawn Stage</div>
                      <div className="text-xs text-gray-600">Substrate: <span className="font-semibold text-gray-800">{getMaterialName(log.grainMaterialId || log.materialId)}</span></div>
                      <div className="text-xs text-gray-600">Bags: <span className="font-semibold text-gray-800">{getMaterialName(log.bagMaterialId)} ({log.bagQty || 0})</span></div>
                      <div className="text-xs text-gray-600">Status: <span className="font-bold text-blue-600">{log.status}</span></div>
                      <div className="text-xs text-gray-600">Colonization: <span className="font-bold text-blue-600">{log.colonizationPct}%</span></div>
                      <div className="col-span-full flex gap-3 mt-1">
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded border border-green-200">Success: {log.successCount}</span>
                          <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded border border-red-200">Fail: {log.failCount}</span>
                      </div>
                  </div>
              );
          case 'sb': // Substrate
              const checklistCount = log.checklist ? Object.values(log.checklist).filter(Boolean).length : 0;
              return (
                  <div className="mt-2 bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wide border-b border-gray-200 pb-1 mb-2">Substrate Preparation</div>
                      <div className="flex flex-wrap gap-2 text-xs mb-3">
                          {log.baseQty > 0 && <span className="bg-white px-2 py-1 rounded border shadow-sm">Base: <strong>{log.baseQty}kg</strong> {getMaterialName(log.baseMaterialId)}</span>}
                          {log.suppQty > 0 && <span className="bg-white px-2 py-1 rounded border shadow-sm">Supp: <strong>{log.suppQty}kg</strong> {getMaterialName(log.supplementId)}</span>}
                          {log.additiveQty > 0 && <span className="bg-white px-2 py-1 rounded border shadow-sm">Add: <strong>{log.additiveQty}kg</strong> {getMaterialName(log.additiveId)}</span>}
                      </div>
                      <div className="flex items-center gap-3">
                          <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                              <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${(checklistCount/5)*100}%` }}></div>
                          </div>
                          <span className="text-[10px] font-bold text-gray-600">{checklistCount}/5 Steps</span>
                      </div>
                  </div>
              );
          case 'in': // Inoculation
              return (
                  <div className="mt-2 bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                      <div className="flex justify-between items-center mb-2 border-b border-indigo-200 pb-1">
                          <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wide">Inoculation</span>
                          <span className="text-xs font-bold text-indigo-800 bg-white px-2 py-0.5 rounded border border-indigo-200 shadow-sm">{log.bagsPacked} Units Packed</span>
                      </div>
                      <div className="text-xs text-indigo-800 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="flex items-center gap-1"><ArrowRight size={10}/> Spawn: <span className="font-mono font-bold">{log.qtySpawn}kg</span> {getMaterialName(log.spawnMaterialId)}</div>
                          <div className="flex items-center gap-1"><ArrowRight size={10}/> Substrate: <span className="font-mono font-bold">{log.qtySubstrate}kg</span> {getMaterialName(log.substrateMaterialId)}</div>
                          <div className="col-span-full flex items-center gap-1"><ArrowRight size={10}/> Bags: <span className="font-mono font-bold">{log.bagQty || log.inoculationBagQty}pcs</span> {getMaterialName(log.bagMaterialId || log.inoculationBagId)}</div>
                      </div>
                  </div>
              );
          case 'ic': // Incubation
              return (
                  <div className="mt-2 bg-blue-50 p-3 rounded-lg border border-blue-100">
                      <div className="flex justify-between items-center mb-2 border-b border-blue-200 pb-1">
                          <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wide">Incubation Log</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${log.status==='Ready'?'bg-green-100 text-green-800':'bg-blue-100 text-blue-800'}`}>{log.status}</span>
                      </div>
                      <div className="text-xs text-blue-900 mb-2">Location: <strong>{log.roomNo}</strong></div>
                      
                      {log.snapshot ? (
                          <div className="grid grid-cols-4 gap-2 text-center">
                              <div className="bg-white rounded p-1 shadow-sm border border-blue-100">
                                  <div className="font-bold text-gray-700 text-sm">{log.snapshot.inoculated}</div><div className="text-[8px] uppercase text-gray-400">New</div>
                              </div>
                              <div className="bg-white rounded p-1 shadow-sm border border-blue-100">
                                  <div className="font-bold text-blue-600 text-sm">{log.snapshot.incubating}</div><div className="text-[8px] uppercase text-blue-400">Run</div>
                              </div>
                              <div className="bg-white rounded p-1 shadow-sm border border-blue-100">
                                  <div className="font-bold text-green-600 text-sm">{log.snapshot.ready}</div><div className="text-[8px] uppercase text-green-400">Ready</div>
                              </div>
                              <div className="bg-white rounded p-1 shadow-sm border border-blue-100">
                                  <div className="font-bold text-red-600 text-sm">{log.snapshot.contaminated + log.snapshot.disposed}</div><div className="text-[8px] uppercase text-red-400">Loss</div>
                              </div>
                          </div>
                      ) : (
                          <div className="flex gap-4 text-xs font-medium">
                              <span className="text-green-700">Success: {log.successCount}</span>
                              <span className="text-red-700">Fail: {log.failCount}</span>
                          </div>
                      )}
                      {log.notes && <div className="mt-2 text-xs italic text-gray-500 bg-white p-1.5 rounded border border-blue-100">"{log.notes}"</div>}
                  </div>
              );
          case 'frt': // Fruiting (Start)
              return (
                  <div className="mt-2 p-2 bg-orange-50 border border-orange-100 rounded text-xs text-orange-900 flex items-center gap-2">
                      <ThermometerSun size={14} className="text-orange-500" />
                      <span>Moved to <strong>{log.roomNo}</strong> for fruiting induction.</span>
                  </div>
              );
          case 'obs': // Observation
              return (
                  <div className="mt-2 border-l-2 border-gray-300 pl-3">
                      <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Observation Data</div>
                      <div className="flex gap-4 text-xs mb-2">
                          <div>
                              <span className="text-gray-500">Avg Size:</span> <span className="font-bold text-gray-800">{log.avgDiameter}cm</span>
                          </div>
                          <div>
                              <span className="text-gray-500">Maturity:</span> <span className="font-bold text-gray-800">{log.maturityIndex}%</span>
                          </div>
                          <div>
                              <span className="text-gray-500">Samples:</span> <span className="font-bold text-gray-800">{log.sampleSize || 1}</span>
                          </div>
                      </div>
                      {log.alertMessage && (
                          <div className={`text-xs p-2 rounded flex items-start gap-2 ${log.alertLevel === 'CRITICAL' || log.alertLevel === 'WARNING' ? 'bg-red-50 text-red-800 font-bold' : 'bg-blue-50 text-blue-800'}`}>
                              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                              <span>{log.alertLevel}: {log.alertMessage}</span>
                          </div>
                      )}
                  </div>
              );
          case 'hv': // Harvest
              return (
                  <div className="mt-2 bg-green-50 p-4 rounded-xl border border-green-200 shadow-sm">
                      <div className="flex justify-between items-start mb-3">
                          <div className="font-bold text-green-900 flex items-center gap-2">
                              <Archive size={16} /> Harvest Recorded
                              {log.flushNumber && <span className="text-[10px] bg-green-200 text-green-800 px-2 py-0.5 rounded-full">Flush {log.flushNumber}</span>}
                          </div>
                          <div className="text-2xl font-bold text-green-700">{log.totalYield} <span className="text-sm font-normal text-green-600">kg</span></div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs bg-white/50 p-2 rounded border border-green-100">
                          <div className="flex justify-between">
                              <span className="text-green-800">Grade A (Good)</span>
                              <span className="font-bold">{log.gradeAYield} kg</span>
                          </div>
                          <div className="flex justify-between">
                              <span className="text-amber-800">Grade B (Reject)</span>
                              <span className="font-bold">{log.gradeBYield} kg</span>
                          </div>
                      </div>
                      <div className="mt-2 text-xs text-right text-green-700 italic">
                          Action Taken: {log.action}
                      </div>
                  </div>
              );
          default:
              return (
                  <div className="text-sm text-gray-600 italic mt-1">
                      Details not available for this log type.
                  </div>
              );
      }
  };

  const efficiency = batch.targetYield > 0 ? ((batch.actualYield / batch.targetYield) * 100).toFixed(1) : '0.0';
  const effNum = Number(efficiency);
  let effColor = 'bg-gray-100 text-gray-600 border-gray-200';
  if (effNum >= 100) effColor = 'bg-green-100 text-green-800 border-green-200';
  else if (effNum >= 80) effColor = 'bg-blue-100 text-blue-800 border-blue-200';
  else if (effNum > 0) effColor = 'bg-amber-100 text-amber-800 border-amber-200';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-xl sticky top-0 z-10 shadow-sm">
                <div>
                    <h3 className="text-xl font-bold text-gray-800">Audit Trail: {batch.id}</h3>
                    <p className="text-sm text-gray-500">{batch.species}</p>
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>
            
            <div className="p-6 space-y-8 flex-1 overflow-y-auto bg-gray-50/30">
                {/* 1. High Level Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <div className="text-[10px] font-bold text-blue-500 uppercase tracking-wide mb-1">Yield</div>
                        <div className="text-2xl font-bold text-gray-900">{batch.actualYield} <span className="text-sm font-normal text-gray-500">kg</span></div>
                        <div className="text-xs text-gray-400 mt-1">Target: {batch.targetYield} kg</div>
                    </div>
                     <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <div className="text-[10px] font-bold text-green-500 uppercase tracking-wide mb-1">Cycle Time</div>
                        <div className="text-2xl font-bold text-gray-900">{batch.maturityDays} <span className="text-sm font-normal text-gray-500">Days</span></div>
                        <div className="text-xs text-gray-400 mt-1">Start: {new Date(batch.startDate).toLocaleDateString()}</div>
                    </div>
                     <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Status</div>
                        <div className="text-2xl font-bold text-gray-900">{batch.status}</div>
                        <div className="text-xs text-gray-400 mt-1">End: {batch.endDate ? new Date(batch.endDate).toLocaleDateString() : '-'}</div>
                    </div>
                    <div className={`p-4 rounded-xl border shadow-sm ${effColor}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wide mb-1 opacity-70">Efficiency</div>
                        <div className="text-2xl font-bold">{efficiency}%</div>
                        <div className="text-xs opacity-70 mt-1">Performance</div>
                    </div>
                </div>

                {/* 2. Timeline */}
                <div className="relative">
                    <div className="absolute top-0 bottom-0 left-24 w-px bg-gray-200 -z-10"></div>
                    <h4 className="font-bold text-gray-800 mb-6 flex items-center gap-2 text-lg">
                        <ClipboardList className="text-primary-600"/> Production History
                    </h4>
                    
                    <div className="space-y-6">
                        {logs.map((log, idx) => {
                             let typePrefix = log.id.split('_')[0];
                             // Normalize type prefix
                             if (typePrefix === 'culture') typePrefix = 'cl';
                             if (typePrefix === 'spawn') typePrefix = 'sp';
                             if (typePrefix === 'substrate') typePrefix = 'sb';
                             if (typePrefix === 'inoculation') typePrefix = 'in';
                             if (typePrefix === 'incubation') typePrefix = 'ic';
                             if (typePrefix === 'fruiting') typePrefix = 'frt';
                             if (typePrefix === 'harvest') typePrefix = 'hv';

                             let stageLabel = 'Unknown';
                             let stageColor = 'bg-gray-100 text-gray-600 border-gray-200';
                             
                             if (typePrefix === 'cl') { stageLabel = 'Culture'; stageColor = 'bg-purple-100 text-purple-700 border-purple-200'; }
                             if (typePrefix === 'sp') { stageLabel = 'Spawn'; stageColor = 'bg-amber-100 text-amber-700 border-amber-200'; }
                             if (typePrefix === 'sb') { stageLabel = 'Substrate'; stageColor = 'bg-stone-100 text-stone-700 border-stone-200'; }
                             if (typePrefix === 'in') { stageLabel = 'Inoculation'; stageColor = 'bg-indigo-100 text-indigo-700 border-indigo-200'; }
                             if (typePrefix === 'ic') { stageLabel = 'Incubation'; stageColor = 'bg-blue-100 text-blue-700 border-blue-200'; }
                             if (typePrefix === 'frt') { stageLabel = 'Fruiting'; stageColor = 'bg-orange-100 text-orange-700 border-orange-200'; }
                             if (typePrefix === 'obs') { stageLabel = 'Observation'; stageColor = 'bg-sky-100 text-sky-700 border-sky-200'; }
                             if (typePrefix === 'hv') { stageLabel = 'Harvest'; stageColor = 'bg-green-100 text-green-700 border-green-200'; }

                             const dateObj = new Date(log.dateStarted || log.date || log.harvestDate);

                             return (
                                 <div key={idx} className="flex gap-6 group">
                                     {/* Date Column */}
                                     <div className="w-24 flex-shrink-0 text-right pt-2">
                                         <div className="text-sm font-bold text-gray-800">{dateObj.toLocaleDateString()}</div>
                                         <div className="text-xs text-gray-400 font-mono">{dateObj.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                                     </div>

                                     {/* Content Card */}
                                     <div className="flex-1 bg-white rounded-xl border border-gray-200 p-4 shadow-sm group-hover:border-primary-300 transition-colors">
                                         <div className="flex justify-between items-start mb-2">
                                             <div className="flex items-center gap-2">
                                                 <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border tracking-wider ${stageColor}`}>
                                                     {stageLabel}
                                                 </span>
                                                 <span className="text-xs text-gray-300 font-mono">{log.id}</span>
                                             </div>
                                         </div>
                                         
                                         {/* Detailed Body */}
                                         {renderLogDetails(log)}
                                     </div>
                                 </div>
                             )
                        })}
                        {logs.length === 0 && (
                            <div className="ml-24 p-8 text-center text-gray-400 border-2 border-dashed rounded-xl">
                                No logs found for this batch.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export const Production: React.FC<Props> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [batches, setBatches] = useState<Batch[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  
  // Data for Archives & Audit
  const [inoculationLogs, setInoculationLogs] = useState<InoculationLog[]>([]);
  const [fruitingLogs, setFruitingLogs] = useState<FruitingLog[]>([]);
  const [harvestLogs, setHarvestLogs] = useState<HarvestLog[]>([]);
  const [incubationLogs, setIncubationLogs] = useState<IncubationLog[]>([]);
  
  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [selectedAuditBatch, setSelectedAuditBatch] = useState<Batch | null>(null);
  
  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    species: '',
    incubationLocation: INCUBATION_LOCATIONS[0],
    fruitingLocation: FRUITING_LOCATIONS[0],
    startDate: new Date().toISOString().split('T')[0],
    maturityDays: 45,
    targetYield: 100,
    compositionNotes: '',
    baselineCapDiameter: 6, // cm (changed from 40 mm)
    baselineMaturationDays: 5,
    estAvgWeightPerBlock: '' as any 
  });
  
  // Smart Suggestion State
  const [yieldSuggestion, setYieldSuggestion] = useState<{ value: number, count: number } | null>(null);

  const [recipe, setRecipe] = useState<BatchRecipeItem[]>([]);
  const KEYS = StorageService.getKeys();

  const loadData = () => {
    setBatches(StorageService.getAll<Batch>(KEYS.BATCHES, user.entityId));
    setMaterials(StorageService.getAll<Material>(KEYS.MATERIALS, user.entityId));
    setVendors(StorageService.getAll<Vendor>(KEYS.VENDORS, user.entityId));
    
    // Load Logs for calculations
    setInoculationLogs(StorageService.getAll<InoculationLog>(KEYS.LOGS_INOCULATION, user.entityId));
    setFruitingLogs(StorageService.getAll<FruitingLog>(KEYS.LOGS_FRUITING, user.entityId));
    setHarvestLogs(StorageService.getAll<HarvestLog>(KEYS.LOGS_HARVEST, user.entityId));
    setIncubationLogs(StorageService.getAll<IncubationLog>(KEYS.LOGS_INCUBATION, user.entityId));
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Derived Data Helpers
  const activeBatches = batches.filter(b => b.status !== BatchStatus.COMPLETED);
  const historicalBatches = batches.filter(b => b.status === BatchStatus.COMPLETED);

  // --- SMART SUGGESTION LOGIC ---
  const calculateSmartYield = (species: string) => {
    if (!species) {
        setYieldSuggestion(null);
        return;
    }

    const relevantHistory = historicalBatches.filter(b => b.species === species);
    
    if (relevantHistory.length === 0) {
        setYieldSuggestion(null);
        return;
    }

    let totalYieldKg = 0;
    let totalHealthyBlocks = 0;

    relevantHistory.forEach(b => {
        // Find logs for this batch
        const inocLog = inoculationLogs.find(l => l.batchId === b.id);
        const incubLogs = incubationLogs.filter(l => l.batchId === b.id);
        
        // Calculate total failures from incubation logs
        // If multiple logs exist (e.g. snapshots), we need the max failures recorded or sum if discrete.
        // In the seed, there is one log with total failCount. We'll grab the max failCount seen.
        const maxFailures = incubLogs.reduce((max, log) => Math.max(max, log.failCount || 0), 0);
        
        const bagCount = inocLog ? inocLog.bagsPacked : 0;
        const healthyCount = Math.max(0, bagCount - maxFailures);
        
        if (healthyCount > 0 && b.actualYield > 0) {
            totalYieldKg += b.actualYield;
            totalHealthyBlocks += healthyCount;
        }
    });

    if (totalHealthyBlocks > 0) {
        const avgGrams = (totalYieldKg / totalHealthyBlocks) * 1000;
        setYieldSuggestion({ value: Math.round(avgGrams), count: relevantHistory.length });
    } else {
        setYieldSuggestion(null);
    }
  };

  const handleSpeciesChange = (species: string) => {
      setFormData(prev => ({ ...prev, species, estAvgWeightPerBlock: '' }));
      calculateSmartYield(species);
  };

  const applySuggestion = () => {
      if (yieldSuggestion) {
          setFormData(prev => ({ ...prev, estAvgWeightPerBlock: yieldSuggestion.value }));
      }
  };

  const openModal = (batch?: Batch) => {
    if (batch) {
      setEditingId(batch.id);
      setFormData({
        species: batch.species || '',
        incubationLocation: batch.incubationLocation || batch.location || INCUBATION_LOCATIONS[0],
        fruitingLocation: batch.fruitingLocation || FRUITING_LOCATIONS[0],
        startDate: batch.startDate ? new Date(batch.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        maturityDays: batch.maturityDays || 45,
        targetYield: batch.targetYield || 100,
        compositionNotes: batch.compositionNotes || '',
        baselineCapDiameter: batch.baselineCapDiameter || 6, // Default to 6cm if missing
        baselineMaturationDays: batch.baselineMaturationDays || 5,
        estAvgWeightPerBlock: batch.estAvgWeightPerBlock || 170
      });
      setRecipe(batch.recipe || []);
      calculateSmartYield(batch.species);
    } else {
      setEditingId(null);
      setFormData({
        species: '',
        incubationLocation: INCUBATION_LOCATIONS[0],
        fruitingLocation: FRUITING_LOCATIONS[0],
        startDate: new Date().toISOString().split('T')[0],
        maturityDays: 45,
        targetYield: 100,
        compositionNotes: '',
        baselineCapDiameter: 6, // Default 6cm
        baselineMaturationDays: 5,
        estAvgWeightPerBlock: '' 
      });
      setRecipe([]);
      setYieldSuggestion(null);
    }
    setShowModal(true);
  };

  const handleSaveBatch = () => {
    if (recipe.length === 0) {
      alert("Please add at least one material to the Batch Material Planning.");
      return;
    }

    if (!formData.species) {
      alert("Please select a species.");
      return;
    }

    if (!formData.estAvgWeightPerBlock || Number(formData.estAvgWeightPerBlock) <= 0) {
        alert("Estimated Average Weight per Block is mandatory. Please enter a valid value.");
        return;
    }

    const batchData: Batch = {
      id: editingId || StorageService.generateBatchId(user.entityId),
      entityId: user.entityId,
      status: editingId ? (batches.find(b => b.id === editingId)?.status || BatchStatus.PLANNING) : BatchStatus.PLANNING,
      recipe: recipe,
      actualYield: editingId ? (batches.find(b => b.id === editingId)?.actualYield || 0) : 0,
      notes: editingId ? (batches.find(b => b.id === editingId)?.notes || '') : '',
      
      species: formData.species,
      location: formData.incubationLocation, // Default/Legacy fallback to incubation loc
      incubationLocation: formData.incubationLocation,
      fruitingLocation: formData.fruitingLocation,
      startDate: new Date(formData.startDate).toISOString(),
      maturityDays: Number(formData.maturityDays),
      targetYield: Number(formData.targetYield),
      compositionNotes: formData.compositionNotes,
      baselineCapDiameter: Number(formData.baselineCapDiameter),
      baselineMaturationDays: Number(formData.baselineMaturationDays),
      estAvgWeightPerBlock: Number(formData.estAvgWeightPerBlock)
    };

    if (editingId) {
      StorageService.update(KEYS.BATCHES, batchData);
      StorageService.logActivity(user.entityId, user, 'UPDATE_BATCH', `Updated batch plan: ${batchData.id}`);
    } else {
      StorageService.add(KEYS.BATCHES, batchData);
      StorageService.logActivity(user.entityId, user, 'CREATE_BATCH', `Created new batch plan: ${batchData.id}`);
    }

    setShowModal(false);
    loadData();
  };

  const addToRecipe = (materialId: string) => {
    if (recipe.find(r => r.materialId === materialId)) return;
    setRecipe([...recipe, { materialId, requiredQty: 10 }]);
  };

  const updateRecipeQty = (materialId: string, qty: number) => {
    setRecipe(recipe.map(r => r.materialId === materialId ? { ...r, requiredQty: qty } : r));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Batch Production</h2>
        <div className="flex space-x-2 bg-white rounded-lg p-1 border shadow-sm">
            <button 
                onClick={() => setActiveTab('active')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'active' ? 'bg-primary-100 text-primary-800' : 'text-gray-500 hover:bg-gray-50'}`}
            >
                <Activity size={16} /> Active Batches
            </button>
            <button 
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'history' ? 'bg-primary-100 text-primary-800' : 'text-gray-500 hover:bg-gray-50'}`}
            >
                <Archive size={16} /> Historical Archives
            </button>
        </div>
      </div>

      {activeTab === 'active' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
            <div className="flex justify-end">
                <button onClick={() => openModal()} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 shadow-sm"><Plus size={20} /> Add New Plan</button>
            </div>
            <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {activeBatches.map(batch => (
                <div key={batch.id} className="bg-white rounded-xl shadow-sm border border-gray-200 hover:border-primary-300 transition-all overflow-hidden flex flex-col">
                    <div className="p-5 border-b bg-gray-50 flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-1 rounded-full font-bold border ${batch.status === 'COMPLETED' ? 'bg-gray-100 text-gray-600 border-gray-200' : 'bg-blue-100 text-blue-800 border-blue-200'}`}>{batch.status}</span>
                        <span className="text-xs text-gray-400 font-mono">{batch.id}</span>
                        </div>
                        <h3 className="font-bold text-gray-900 leading-tight">{batch.species || 'Unknown Species'}</h3>
                    </div>
                    <button onClick={() => openModal(batch)} className="text-gray-400 hover:text-primary-600 p-1"><Edit2 size={18} /></button>
                    </div>
                    <div className="p-5 space-y-4 flex-1 flex flex-col">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex items-start gap-2"><Calendar size={16} className="text-gray-400 mt-0.5" /><div><span className="block text-gray-500 text-xs">Est. Start</span><span className="font-medium">{new Date(batch.startDate).toLocaleDateString()}</span></div></div>
                        <div className="flex items-start gap-2"><Clock size={16} className="text-gray-400 mt-0.5" /><div><span className="block text-gray-500 text-xs">Cycle Time</span><span className="font-medium">{batch.maturityDays} Days</span></div></div>
                    </div>
                    
                    {/* Location Info */}
                    <div className="text-xs bg-gray-50 p-2 rounded border border-gray-100 space-y-1">
                        <div className="flex items-center gap-2">
                            <ThermometerSun size={12} className="text-blue-500"/>
                            <span className="text-gray-500 w-16">Incubation:</span>
                            <span className="font-medium truncate">{batch.incubationLocation || batch.location}</span>
                        </div>
                        {batch.fruitingLocation && (
                            <div className="flex items-center gap-2">
                                <Leaf size={12} className="text-green-500"/>
                                <span className="text-gray-500 w-16">Fruiting:</span>
                                <span className="font-medium truncate">{batch.fruitingLocation}</span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-start gap-2 text-sm"><Scale size={16} className="text-gray-400 mt-0.5" /><div><span className="block text-gray-500 text-xs">Target Yield</span><span className="font-medium">{batch.targetYield} kg</span></div></div>

                    {batch.estAvgWeightPerBlock && (
                        <div className="flex items-center gap-2 text-xs bg-green-50 text-green-800 p-2 rounded border border-green-100"><Calculator size={12} /><span>Est. Block Weight: <strong>{batch.estAvgWeightPerBlock}g</strong></span></div>
                    )}
                    {batch.compositionNotes && (<div className="text-xs bg-yellow-50 text-yellow-800 p-2 rounded border border-yellow-100 italic">Mix: {batch.compositionNotes}</div>)}
                    <div className="pt-2 border-t border-gray-100 flex-1">
                        <div className="flex items-center gap-2 mb-2"><FlaskConical size={14} className="text-gray-400"/><h4 className="text-xs font-bold text-gray-500 uppercase">Material Requirements</h4></div>
                        <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 max-h-32 overflow-y-auto">
                            {batch.recipe && batch.recipe.length > 0 ? (
                            batch.recipe.map((item, idx) => {
                                const mat = materials.find(m => m.id === item.materialId);
                                return (
                                <div key={idx} className="flex justify-between items-center text-sm border-b border-gray-100 last:border-0 pb-1 last:pb-0">
                                    <span className="text-gray-700 truncate pr-2">{mat ? mat.name : item.materialId}</span>
                                    <span className="font-medium whitespace-nowrap text-gray-900 bg-white px-1.5 rounded border shadow-sm text-xs py-0.5">{item.requiredQty} {mat?.uom}</span>
                                </div>
                                );
                            })) : (<div className="text-center text-xs text-gray-400 italic py-2">No materials planned</div>)}
                        </div>
                    </div>
                    </div>
                </div>
                ))}
                {activeBatches.length === 0 && (
                <div className="col-span-full py-12 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl"><Sprout size={48} className="mx-auto mb-4 opacity-20" /><p>No active batches found.</p><button onClick={() => openModal()} className="mt-2 text-primary-600 font-medium hover:underline">Start a new plan</button></div>
                )}
            </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
          
          {/* Desktop View (Table) */}
          <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 uppercase">
                <tr>
                  <th className="p-4">Batch ID</th>
                  <th className="p-4">Species</th>
                  <th className="p-4">Completion Date</th>
                  <th className="p-4">Cycle Time</th>
                  <th className="p-4 text-right">Yield</th>
                  <th className="p-4 text-right">Efficiency</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {historicalBatches.map(batch => {
                   const efficiency = batch.targetYield > 0 ? ((batch.actualYield / batch.targetYield) * 100).toFixed(1) : '0.0';
                   return (
                    <tr key={batch.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 font-mono font-medium text-gray-700">{batch.id}</td>
                      <td className="p-4 font-medium">{batch.species}</td>
                      <td className="p-4 text-gray-500">{new Date(batch.endDate || '').toLocaleDateString()}</td>
                      <td className="p-4 text-gray-500">{batch.maturityDays} Days</td>
                      <td className="p-4 text-right font-bold text-gray-800">{batch.actualYield} kg</td>
                      <td className="p-4 text-right">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${Number(efficiency) >= 100 ? 'bg-green-100 text-green-700' : Number(efficiency) >= 80 ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {efficiency}%
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <button 
                          onClick={() => setSelectedAuditBatch(batch)}
                          className="text-blue-600 hover:text-blue-800 font-medium text-xs border border-blue-200 hover:bg-blue-50 px-3 py-1.5 rounded transition-all"
                        >
                          View Audit
                        </button>
                      </td>
                    </tr>
                   )
                })}
                {historicalBatches.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-gray-400">
                      <Archive size={48} className="mx-auto mb-3 opacity-20" />
                      <p>No historical records found.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile View (Cards) */}
          <div className="md:hidden space-y-4">
            {historicalBatches.map(batch => {
                const efficiency = batch.targetYield > 0 ? ((batch.actualYield / batch.targetYield) * 100).toFixed(1) : '0.0';
                const effNum = Number(efficiency);
                const effColor = effNum >= 100 ? 'bg-green-100 text-green-700' : effNum >= 80 ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700';
                
                return (
                    <div key={batch.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <span className="text-xs font-mono font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">{batch.id}</span>
                                <h3 className="font-bold text-gray-800 mt-2 text-lg leading-tight">{batch.species}</h3>
                            </div>
                            <div className={`flex flex-col items-end`}>
                                <span className={`px-2 py-1 rounded text-xs font-bold ${effColor}`}>
                                    {efficiency}% Eff.
                                </span>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 border-t border-b border-gray-50 py-3">
                            <div>
                                <span className="text-xs text-gray-400 uppercase font-bold">Realized Yield</span>
                                <div className="text-lg font-bold text-gray-900">{batch.actualYield} <span className="text-sm font-normal text-gray-500">kg</span></div>
                            </div>
                            <div>
                                <span className="text-xs text-gray-400 uppercase font-bold">Cycle Duration</span>
                                <div className="text-lg font-bold text-gray-900">{batch.maturityDays} <span className="text-sm font-normal text-gray-500">Days</span></div>
                            </div>
                        </div>

                        <div className="flex justify-between items-center text-xs text-gray-500">
                             <div className="flex items-center gap-1">
                                <Calendar size={14} />
                                <span>Completed: {new Date(batch.endDate || '').toLocaleDateString()}</span>
                             </div>
                        </div>

                        <button 
                            onClick={() => setSelectedAuditBatch(batch)}
                            className="w-full py-2.5 bg-gray-50 text-gray-700 font-bold rounded-lg text-sm border border-gray-200 hover:bg-gray-100 flex items-center justify-center gap-2"
                        >
                            <FileText size={16} /> View Audit Log
                        </button>
                    </div>
                );
            })}
            
            {historicalBatches.length === 0 && (
                <div className="py-12 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                    <Archive size={48} className="mx-auto mb-3 opacity-20" />
                    <p>No historical records found.</p>
                </div>
            )}
          </div>
        </div>
      )}

      {selectedAuditBatch && (
          <ViewAuditModal batch={selectedAuditBatch} user={user} materials={materials} vendors={vendors} onClose={() => setSelectedAuditBatch(null)} />
      )}

      {/* CREATE/EDIT BATCH MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b bg-gray-50 flex justify-between items-center sticky top-0 z-10">
              <h3 className="text-xl font-bold text-gray-800">{editingId ? 'Edit Production Plan' : 'New Production Plan'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Section 1: Core Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-1">Species</label>
                  <select 
                    className="w-full border rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-primary-500 outline-none"
                    value={formData.species}
                    onChange={(e) => handleSpeciesChange(e.target.value)}
                  >
                    <option value="">Select Species...</option>
                    {SPECIES_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Incubation Location</label>
                  <select 
                    className="w-full border rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-primary-500 outline-none"
                    value={formData.incubationLocation}
                    onChange={(e) => setFormData({...formData, incubationLocation: e.target.value})}
                  >
                    {INCUBATION_LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Fruiting Location</label>
                  <select 
                    className="w-full border rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-primary-500 outline-none"
                    value={formData.fruitingLocation}
                    onChange={(e) => setFormData({...formData, fruitingLocation: e.target.value})}
                  >
                    {FRUITING_LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Start Date</label>
                  <input 
                    type="date" 
                    className="w-full border rounded-lg p-2.5"
                    value={formData.startDate}
                    onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Est. Cycle (Days)</label>
                  <input 
                    type="number" 
                    className="w-full border rounded-lg p-2.5"
                    value={formData.maturityDays}
                    onChange={(e) => setFormData({...formData, maturityDays: Number(e.target.value)})}
                  />
                </div>
              </div>

              {/* Section 2: Baseline Standards & Yield */}
              <div className="bg-green-50 p-4 rounded-xl border border-green-100 space-y-4">
                 <h4 className="text-sm font-bold text-green-800 uppercase flex items-center gap-2"><Calculator size={16}/> Baseline Standards & Yield</h4>
                 
                 {/* Row 1: Baselines */}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-green-700 mb-1">Avg. Cap Diameter (cm)</label>
                        <input 
                          type="number" 
                          className="w-full border border-green-200 rounded-lg p-2"
                          value={formData.baselineCapDiameter}
                          onChange={(e) => setFormData({...formData, baselineCapDiameter: Number(e.target.value)})}
                          placeholder="e.g. 6.0"
                        />
                        <p className="text-[10px] text-green-600 mt-1">Used for maturity calculation</p>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-green-700 mb-1">Maturity Days (Post-Pinning)</label>
                        <input 
                          type="number" 
                          className="w-full border border-green-200 rounded-lg p-2"
                          value={formData.baselineMaturationDays}
                          onChange={(e) => setFormData({...formData, baselineMaturationDays: Number(e.target.value)})}
                          placeholder="e.g. 5"
                        />
                    </div>
                 </div>

                 <div className="border-t border-green-200 my-2"></div>

                 {/* Row 2: Yield */}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-green-700 mb-1">Est. Weight / Block (g)</label>
                        <div className="flex gap-2">
                             <input 
                                type="number" 
                                className="w-full border border-green-200 rounded-lg p-2 font-bold"
                                value={formData.estAvgWeightPerBlock}
                                onChange={(e) => setFormData({...formData, estAvgWeightPerBlock: Number(e.target.value)})}
                                placeholder="e.g. 170"
                             />
                             {yieldSuggestion && (
                                <button 
                                  onClick={applySuggestion}
                                  className="flex-shrink-0 bg-white border border-green-300 text-green-700 text-xs px-2 rounded-lg hover:bg-green-100 flex flex-col justify-center items-center shadow-sm"
                                  title={`Based on ${yieldSuggestion.count} past batches (Healthy blocks only)`}
                                >
                                    <Lightbulb size={12} className="mb-0.5"/>
                                    Suggest: {yieldSuggestion.value}g
                                </button>
                             )}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-green-700 mb-1">Target Total Yield (kg)</label>
                        <input 
                          type="number" 
                          className="w-full border border-green-200 rounded-lg p-2 text-green-900 font-bold text-lg"
                          value={formData.targetYield}
                          onChange={(e) => setFormData({...formData, targetYield: Number(e.target.value)})}
                        />
                    </div>
                 </div>
              </div>

              {/* Section 3: Recipe / Materials */}
              <div className="border rounded-xl overflow-hidden">
                <div className="bg-gray-50 p-3 border-b flex justify-between items-center">
                    <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2"><FlaskConical size={16}/> Material Bill of Materials (BOM)</h4>
                    <select 
                        className="text-xs border rounded p-1.5 w-48"
                        onChange={(e) => {
                            if(e.target.value) {
                                addToRecipe(e.target.value);
                                e.target.value = '';
                            }
                        }}
                    >
                        <option value="">+ Add Material...</option>
                        {materials.map(m => (
                            <option key={m.id} value={m.id}>{m.name} ({m.uom})</option>
                        ))}
                    </select>
                </div>
                <div className="max-h-48 overflow-y-auto p-0">
                    {recipe.length === 0 ? (
                        <div className="p-6 text-center text-gray-400 text-sm italic">
                            No materials added. Select from dropdown to build recipe.
                        </div>
                    ) : (
                        <table className="w-full text-sm text-left">
                          <thead className="bg-gray-50 text-gray-600">
                            <tr>
                              <th className="p-2">Material</th>
                              <th className="p-2 w-20">Req Qty</th>
                              <th className="p-2 w-10"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {recipe.map((item, idx) => {
                                const mat = materials.find(m => m.id === item.materialId);
                                return (
                                <tr key={idx}>
                                    <td className="p-2 text-gray-700">{mat ? mat.name : item.materialId}</td>
                                    <td className="p-2"><input type="number" className="w-full border rounded p-1" value={item.requiredQty} onChange={(e) => updateRecipeQty(item.materialId, Number(e.target.value))} /></td>
                                    <td className="p-2 text-center"><button onClick={() => setRecipe(recipe.filter(r => r.materialId !== item.materialId))} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button></td>
                                </tr>
                                );
                            })}
                          </tbody>
                        </table>
                    )}
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-4 border-t">
                  <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">Cancel</button>
                  <button onClick={handleSaveBatch} className="bg-primary-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-primary-700">Save Plan</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
