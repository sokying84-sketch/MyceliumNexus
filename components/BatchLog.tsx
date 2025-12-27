import React, { useState, useEffect } from 'react';
import { 
  Search, Calendar, CheckSquare, 
  AlertTriangle, ArrowRight, Save, Leaf, FlaskConical, Sprout, 
  Warehouse, Check, BoxSelect, ThermometerSun, Plus, Edit2,
  TrendingUp, Info, Package, User as UserIcon, Microscope, Beaker, Box, Clock, Trash2, XCircle, RotateCcw,
  AlertCircle, Droplets, Flame, Wind, Scissors, PieChart, Tag, Layers, Scan, CheckCircle2, ListFilter, Lock, History, BarChart3, Activity,
  Gauge, PlayCircle, Grid as GridIcon, Calculator, HelpCircle, Archive, Eye
} from 'lucide-react';
import { User, Batch, ProductionStage, Material, InventoryMovementType, MaterialCategory, SpawnLog, SubstrateLog, BatchItem, DailyObservation, BatchItemStatus, SampleRow, HarvestLog, BatchStatus, DeliveryOrder } from '../types';
import { StorageService } from '../services/storageService';
import { SmartNotes } from './SmartNotes';
import { calculateMaturityIndex, evaluateHarvestStatus, evaluateBatchStatus, aggregateSampleData, NotificationAction, SamplingInput, BatchBaseline } from '../utils/fruitingEngine';

interface Props {
  user: User;
}

const STAGES = [
  { id: ProductionStage.CULTURE, label: 'Culture', icon: FlaskConical },
  { id: ProductionStage.SPAWN, label: 'Spawn', icon: Sprout },
  { id: ProductionStage.SUBSTRATE, label: 'Substrate', icon: BoxSelect },
  { id: ProductionStage.INOCULATION, label: 'Inoculation', icon: ThermometerSun },
  { id: ProductionStage.INCUBATION, label: 'Incubation', icon: Warehouse },
  { id: ProductionStage.FRUITING, label: 'Fruiting', icon: Leaf },
  { id: ProductionStage.HARVEST, label: 'Harvest', icon: Archive },
];

export const BatchLog: React.FC<Props> = ({ user }) => {
  // 1. Load Batches & Materials
  const [batches, setBatches] = useState<Batch[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  
  // 2. View State with PERSISTENCE
  const [selectedBatchId, setSelectedBatchId] = useState<string>(() => {
      return localStorage.getItem(`mn_batch_active_id_${user.entityId}`) || '';
  });
  
  const [activeStage, setActiveStage] = useState<ProductionStage>(() => {
      return (localStorage.getItem(`mn_batch_active_stage_${user.entityId}`) as ProductionStage) || ProductionStage.CULTURE;
  });
  
  const [showArchived, setShowArchived] = useState(false);
  
  // Data State
  const [logs, setLogs] = useState<any[]>([]); 
  const [formData, setFormData] = useState<any>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [originalLogData, setOriginalLogData] = useState<any>(null);
  
  // Inoculation Dashboard Data
  const [inoculationSummary, setInoculationSummary] = useState<{spawnCount: number, substrateKg: number} | null>(null);

  // Incubation State
  const [incubationItems, setIncubationItems] = useState<BatchItem[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [itemFilter, setItemFilter] = useState<string>('ALL');
  const [scanQuery, setScanQuery] = useState('');

  // Fruiting State (Stage F)
  const [fruitingItems, setFruitingItems] = useState<BatchItem[]>([]);
  const [selectedFruitingItemIds, setSelectedFruitingItemIds] = useState<Set<string>>(new Set());
  const [calculatedMaturity, setCalculatedMaturity] = useState<number>(0);
  const [currentAlert, setCurrentAlert] = useState<NotificationAction | null>(null);
  const [samplingForm, setSamplingForm] = useState<SamplingInput>({
      currentDate: new Date(),
      pinningDate: null,
      currentAvgDiameterCM: 0,
      dominantShape: 'CONVEX',
      flatPercentage: 0
  });
  const [sampleRows, setSampleRows] = useState<SampleRow[]>([]);
  
  const [manualStatus, setManualStatus] = useState<string>('');
  const [suggestedStatus, setSuggestedStatus] = useState<string>('');

  // Harvest State
  const [harvestForm, setHarvestForm] = useState<{
      date: string;
      gradeAKg: number;
      gradeBKg: number;
      action: 'NEXT_FLUSH' | 'DISPOSE';
  }>({
      date: new Date().toISOString().split('T')[0],
      gradeAKg: 0,
      gradeBKg: 0,
      action: 'NEXT_FLUSH'
  });

  // Custom Modal State
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    type: 'CONFIRM' | 'ALERT';
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({
    isOpen: false,
    type: 'ALERT',
    title: '',
    message: ''
  });

  const KEYS = StorageService.getKeys();

  // --- PERSISTENCE EFFECTS ---

  // NEW: Check for pending alerts on mount (Fixes 0.5s flash issue)
  useEffect(() => {
    const pendingAlert = localStorage.getItem(`mn_pending_alert_${user.entityId}`);
    if (pendingAlert) {
      try {
        const { title, message } = JSON.parse(pendingAlert);
        setModalConfig({ isOpen: true, type: 'ALERT', title, message });
        // Clear it once shown
        localStorage.removeItem(`mn_pending_alert_${user.entityId}`);
      } catch (e) {
        console.error("Error parsing pending alert", e);
      }
    }
  }, [user.entityId]);

  useEffect(() => {
      if (selectedBatchId) {
          localStorage.setItem(`mn_batch_active_id_${user.entityId}`, selectedBatchId);
      } else {
          localStorage.removeItem(`mn_batch_active_id_${user.entityId}`);
      }
  }, [selectedBatchId, user.entityId]);

  useEffect(() => {
      localStorage.setItem(`mn_batch_active_stage_${user.entityId}`, activeStage);
  }, [activeStage, user.entityId]);

  // Initial Data Load
  useEffect(() => {
    setBatches(StorageService.getAll<Batch>(KEYS.BATCHES, user.entityId));
    setMaterials(StorageService.getAll<Material>(KEYS.MATERIALS, user.entityId));
  }, [user]);

  // Load logs whenever Batch or Stage changes AND Listen for Updates
  useEffect(() => {
    if (selectedBatchId) {
      loadStageLogs();
      resetForm();
      
      if (activeStage === ProductionStage.INOCULATION) loadInoculationDashboard();
      if (activeStage === ProductionStage.INCUBATION) loadIncubationItems();
      if (activeStage === ProductionStage.FRUITING) loadFruitingItems();
    }

    const unsubscribe = StorageService.subscribe(() => {
      if (selectedBatchId) {
        loadStageLogs();
        if (activeStage === ProductionStage.INOCULATION) loadInoculationDashboard();
        if (activeStage === ProductionStage.INCUBATION) loadIncubationItems();
        if (activeStage === ProductionStage.FRUITING) loadFruitingItems();
      }
    });

    return () => unsubscribe();
  }, [selectedBatchId, activeStage]);

  const selectedBatch = batches.find(b => b.id === selectedBatchId);
  const isReadOnly = selectedBatch?.status === BatchStatus.COMPLETED;

  // --- DATA LOADING HELPERS ---

  const loadInoculationDashboard = () => {
      const spawnLogs = StorageService.getAll<SpawnLog>(KEYS.LOGS_SPAWN, user.entityId).filter(l => l.batchId === selectedBatchId);
      const spawnCount = spawnLogs.reduce((acc, log) => acc + (log.successCount || 0), 0);

      const subLogs = StorageService.getAll<any>(KEYS.LOGS_SUBSTRATE, user.entityId).filter(l => l.batchId === selectedBatchId);
      const substrateKg = subLogs.reduce((acc, log) => acc + (log.baseQty || 0) + (log.suppQty || 0) + (log.additiveQty || 0), 0);
      
      setInoculationSummary({ spawnCount, substrateKg });
  };

  const loadIncubationItems = () => {
      const allItems = StorageService.getAll<BatchItem>(KEYS.ITEMS_BATCH, user.entityId);
      setIncubationItems(allItems.filter(i => i.batchId === selectedBatchId));
      setSelectedItemIds(new Set()); 
  };

  const loadFruitingItems = () => {
      const allItems = StorageService.getAll<BatchItem>(KEYS.ITEMS_BATCH, user.entityId);
      const relevantItems = allItems.filter(i => 
          i.batchId === selectedBatchId && 
          (i.status === 'READY_TO_FRUIT' || i.status.startsWith('FRUITING_') || i.status === 'FAILED' || i.status === 'CONTAMINATED' || i.status === 'DISPOSED')
      );
      setFruitingItems(relevantItems);
      setSelectedFruitingItemIds(new Set());
      
      const obsLogs = StorageService.getAll<DailyObservation>(KEYS.LOGS_OBSERVATIONS, user.entityId)
          .filter(l => l.batchId === selectedBatchId && l.pinningDate)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          
      if (obsLogs.length > 0 && obsLogs[0].pinningDate) {
          setSamplingForm(prev => ({ ...prev, pinningDate: new Date(obsLogs[0].pinningDate!) }));
      }
      
      resetSamplingSession();
  };

  const resetSamplingSession = () => {
      setSampleRows([
          { id: `s_${Date.now()}_1`, diameter: 0, shape: 'CONVEX' },
          { id: `s_${Date.now()}_2`, diameter: 0, shape: 'CONVEX' },
          { id: `s_${Date.now()}_3`, diameter: 0, shape: 'CONVEX' },
          { id: `s_${Date.now()}_4`, diameter: 0, shape: 'CONVEX' },
          { id: `s_${Date.now()}_5`, diameter: 0, shape: 'CONVEX' },
      ]);
      setSamplingForm(prev => ({
          ...prev,
          currentAvgDiameterCM: 0,
          dominantShape: 'CONVEX',
          flatPercentage: 0
      }));
      setCalculatedMaturity(0);
      setManualStatus('');
      setSuggestedStatus('');
  };

  const getStageKey = (stage: ProductionStage) => {
      switch (stage) {
          case ProductionStage.CULTURE: return KEYS.LOGS_CULTURE;
          case ProductionStage.SPAWN: return KEYS.LOGS_SPAWN;
          case ProductionStage.SUBSTRATE: return KEYS.LOGS_SUBSTRATE;
          case ProductionStage.INOCULATION: return KEYS.LOGS_INOCULATION;
          case ProductionStage.INCUBATION: return KEYS.LOGS_INCUBATION;
          case ProductionStage.FRUITING: return KEYS.LOGS_OBSERVATIONS;
          case ProductionStage.HARVEST: return KEYS.LOGS_HARVEST;
          default: return '';
      }
  };

  const loadStageLogs = () => {
    const key = getStageKey(activeStage);
    if (!key) return;

    const allLogs = StorageService.getAll<any>(key, user.entityId);
    const batchLogs = allLogs
      .filter((l: any) => l.batchId === selectedBatchId)
      .sort((a: any, b: any) => new Date(b.date || b.dateStarted).getTime() - new Date(a.date || a.dateStarted).getTime());

    setLogs(batchLogs);
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setModalConfig({ isOpen: true, type: 'CONFIRM', title, message, onConfirm });
  };

  const showAlert = (title: string, message: string) => {
    setModalConfig({ isOpen: true, type: 'ALERT', title, message });
  };

  // NEW: Persistent Alert Helper (Fixes disappearing popup)
  const showPersistentAlert = (title: string, message: string) => {
      // 1. Show immediately in current state
      setModalConfig({ isOpen: true, type: 'ALERT', title, message });
      // 2. Save to local storage so it persists if the page reloads/remounts
      localStorage.setItem(`mn_pending_alert_${user.entityId}`, JSON.stringify({ title, message }));
  };

  const fruitingStats = {
      active: fruitingItems.filter(i => ['FRUITING_PINNING', 'FRUITING_MATURING', 'READY_TO_FRUIT'].includes(i.status)).length,
      ready: fruitingItems.filter(i => i.status === 'FRUITING_READY').length,
      failed: fruitingItems.filter(i => ['FAILED', 'CONTAMINATED', 'DISPOSED'].includes(i.status)).length,
      total: fruitingItems.length
  };
  const estimatedSuccessRate = fruitingStats.total > 0 
      ? ((fruitingStats.active + fruitingStats.ready) / fruitingStats.total * 100).toFixed(1) 
      : '0.0';

  const projectedTotalWeightKg = selectedBatch && selectedBatch.estAvgWeightPerBlock
      ? ((selectedBatch.estAvgWeightPerBlock * (fruitingStats.active + fruitingStats.ready)) / 1000).toFixed(1)
      : '0.0';

  // --- FORM HANDLING ---

  const resetForm = () => {
      setEditingId(null);
      setOriginalLogData(null);
      
      const defaults: any = { dateStarted: new Date().toISOString() };

      if (activeStage === ProductionStage.CULTURE && materials.length > 0) {
          const agar = materials.find(m => m.category === 'AGAR' || m.name.toLowerCase().includes('agar'));
          if (agar) defaults.agarMaterialId = agar.id;
      }
      if (activeStage === ProductionStage.SPAWN && materials.length > 0) {
          const bag = materials.find(m => m.category === 'PACKAGING' && m.name.toLowerCase().includes('bag'));
          if (bag) defaults.bagMaterialId = bag.id;
          defaults.colonizationPct = 0;
      }
      if (activeStage === ProductionStage.INOCULATION && materials.length > 0) {
           const bag = materials.find(m => (m.category === MaterialCategory.CONSUMABLES && m.name.toLowerCase().includes('bag')));
           if (bag) defaults.inoculationBagId = bag.id;
      }
      
      setFormData(defaults);
  };

  const handleEditClick = (log: any) => {
      setEditingId(log.id);
      setFormData({ ...log }); 
      setOriginalLogData({ ...log });
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getInventoryQty = (matId: string) => StorageService.getInventory(user.entityId, matId);
  const getMaterialName = (id: string) => materials.find(m => m.id === id)?.name || id;

  const getMaterialFieldForQtyField = (qtyField: string) => {
      switch(qtyField) {
          case 'cultureQty': return 'cultureMaterialId';
          case 'dishQty': return 'dishMaterialId';
          case 'agarQty': return 'agarMaterialId';
          case 'grainQty': return 'grainMaterialId';
          case 'bagQty': return 'bagMaterialId';
          case 'baseQty': return 'baseMaterialId';
          case 'suppQty': return 'supplementId';
          case 'additiveQty': return 'additiveId';
          case 'inoculationBagQty': return 'inoculationBagId';
          case 'qtyUsed': return 'materialId';
          case 'spawnQty': return 'spawnMaterialId';
          case 'subQty': return 'substrateMaterialId';
          default: return 'materialId';
      }
  };

  const getVirtualStock = (matId: string, qtyField: string) => {
    const physicalStock = getInventoryQty(matId);
    if (editingId && originalLogData) {
         const matField = getMaterialFieldForQtyField(qtyField);
         if (originalLogData[matField] === matId) {
             return physicalStock + (Number(originalLogData[qtyField]) || 0);
         }
    }
    return physicalStock;
  };

  const isStockInvalid = (matId: string, qty: number, qtyField: string) => {
     if (!matId || isReadOnly) return false;
     const max = getVirtualStock(matId, qtyField);
     return (qty || 0) > max;
  };

  const isAnyInputInvalid = () => {
     if (isReadOnly) return true;
     if (activeStage === ProductionStage.FRUITING || activeStage === ProductionStage.HARVEST) return false;
     if (activeStage === ProductionStage.CULTURE) {
         return isStockInvalid(formData.cultureMaterialId, formData.cultureQty, 'cultureQty') ||
                isStockInvalid(formData.dishMaterialId, formData.dishQty, 'dishQty') ||
                isStockInvalid(formData.agarMaterialId, formData.agarQty, 'agarQty');
     }
     if (activeStage === ProductionStage.SPAWN) {
         return isStockInvalid(formData.grainMaterialId, formData.grainQty, 'grainQty') ||
                isStockInvalid(formData.bagMaterialId, formData.bagQty, 'bagQty');
     }
     if (activeStage === ProductionStage.SUBSTRATE) {
         return isStockInvalid(formData.baseMaterialId, formData.baseQty, 'baseQty') ||
                isStockInvalid(formData.supplementId, formData.suppQty, 'suppQty') ||
                isStockInvalid(formData.additiveId, formData.additiveQty, 'additiveQty');
     }
     if (activeStage === ProductionStage.INOCULATION) {
         return isStockInvalid(formData.inoculationBagId, formData.inoculationBagQty, 'inoculationBagQty');
     }
     return false;
  };

  const renderStockBadge = (matId: string, currentQty: number, qtyField: string) => {
    if (!matId || isReadOnly) return null;
    const physicalStock = getInventoryQty(matId);
    const virtualStock = getVirtualStock(matId, qtyField);
    
    if (virtualStock === 0) return <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded border border-red-200 font-bold whitespace-nowrap">Out of Stock</span>;
    if ((currentQty || 0) > virtualStock) return <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded border border-red-200 font-bold whitespace-nowrap">Insufficient (Max: {virtualStock})</span>;
    if (editingId && virtualStock > physicalStock) return <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 font-bold whitespace-nowrap">Max Avail: {virtualStock}</span>;
    return <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 font-bold whitespace-nowrap">Stock: {physicalStock}</span>;
  };

  const calculateInventoryDeductions = (stage: ProductionStage, data: any) => {
    const deductions: { id: string, qty: number }[] = [];
    if (stage === ProductionStage.CULTURE) {
        if (data.cultureMaterialId && data.cultureQty) deductions.push({ id: data.cultureMaterialId, qty: Number(data.cultureQty) });
        if (data.dishMaterialId && data.dishQty) deductions.push({ id: data.dishMaterialId, qty: Number(data.dishQty) });
        if (data.agarMaterialId && data.agarQty) deductions.push({ id: data.agarMaterialId, qty: Number(data.agarQty) });
    } else if (stage === ProductionStage.SPAWN) {
        if (data.grainMaterialId && data.grainQty) deductions.push({ id: data.grainMaterialId, qty: Number(data.grainQty) });
        if (data.bagMaterialId && data.bagQty) deductions.push({ id: data.bagMaterialId, qty: Number(data.bagQty) });
    } else if (stage === ProductionStage.SUBSTRATE) {
        if (data.baseMaterialId && data.baseQty) deductions.push({ id: data.baseMaterialId, qty: Number(data.baseQty) });
        if (data.supplementId && data.suppQty) deductions.push({ id: data.supplementId, qty: Number(data.suppQty) });
        if (data.additiveId && data.additiveQty) deductions.push({ id: data.additiveId, qty: Number(data.additiveQty) });
    } else if (stage === ProductionStage.INOCULATION) {
        if (data.inoculationBagId && data.inoculationBagQty) deductions.push({ id: data.inoculationBagId, qty: Number(data.inoculationBagQty) });
    } else if (data.materialId && data.qtyUsed > 0) {
        deductions.push({ id: data.materialId, qty: Number(data.qtyUsed) });
    }
    return deductions;
  };

  const handleSaveLog = async () => {
    if (isReadOnly) return;
    const key = getStageKey(activeStage);
    if (!key) return;

    try {
        const fullNewDeductions = calculateInventoryDeductions(activeStage, formData);
        
        let fullOldDeductions: { id: string, qty: number }[] = [];
        let originalLog: any = null;

        if (editingId && activeStage !== ProductionStage.INCUBATION && activeStage !== ProductionStage.FRUITING && activeStage !== ProductionStage.HARVEST) {
             const allLogs = StorageService.getAll<any>(key, user.entityId);
             originalLog = allLogs.find((l: any) => l.id === editingId);
             if (originalLog) {
                 fullOldDeductions = calculateInventoryDeductions(activeStage, originalLog);
             }
        }

        const itemsToRevert: { id: string, qty: number }[] = [];
        const itemsToConsume: { id: string, qty: number }[] = [];

        const allMaterialIds = new Set([
            ...fullNewDeductions.map(i => i.id), 
            ...fullOldDeductions.map(i => i.id)
        ]);

        allMaterialIds.forEach(matId => {
            const oldItem = fullOldDeductions.find(i => i.id === matId);
            const newItem = fullNewDeductions.find(i => i.id === matId);
            
            const oldQty = oldItem ? oldItem.qty : 0;
            const newQty = newItem ? newItem.qty : 0;

            if (oldQty !== newQty) {
                if (oldQty > 0) itemsToRevert.push({ id: matId, qty: oldQty });
                if (newQty > 0) itemsToConsume.push({ id: matId, qty: newQty });
            }
        });

        // Safety Check
        if (itemsToConsume.length > 0 || itemsToRevert.length > 0) {
            const impactMap = new Map<string, number>();

            itemsToRevert.forEach(d => {
                const current = impactMap.get(d.id) || 0;
                impactMap.set(d.id, current + d.qty);
            });

            itemsToConsume.forEach(d => {
                const current = impactMap.get(d.id) || 0;
                impactMap.set(d.id, current - d.qty);
            });

            for (const [matId, netChange] of impactMap.entries()) {
                const currentStock = getInventoryQty(matId);
                const predictedStock = currentStock + netChange;
                
                if (predictedStock < 0) {
                    const matName = getMaterialName(matId);
                    alert(`Cannot save record: Insufficient Inventory for ${matName}.`);
                    return; 
                }
            }
        }

        // 1. Revert Old Amounts
        for (const d of itemsToRevert) {
            await StorageService.updateStock(user.entityId, d.id, d.qty, { 
                type: InventoryMovementType.ADJUSTMENT, 
                reason: `Log Edit Revert (${editingId})`, 
                performedBy: user.name,
                batchId: selectedBatchId 
            });
        }

        // 2. Consume New Amounts
        for (const d of itemsToConsume) {
            await StorageService.updateStock(user.entityId, d.id, -d.qty, { 
                type: InventoryMovementType.CONSUMPTION, 
                stage: activeStage, 
                reason: editingId ? `Log Edit Apply (${editingId})` : `${activeStage} Consumption`, 
                performedBy: user.name,
                batchId: selectedBatchId 
            });
        }

        // 3. Save the Log Entry
        if (editingId && originalLog) {
             const updatedLog = { ...originalLog, ...formData, lastModified: new Date().toISOString() };
             await StorageService.update(key, updatedLog);
        } else {
             const newLog = { 
                 ...formData, 
                 id: `${activeStage.toLowerCase()}_${Date.now()}`, 
                 batchId: selectedBatchId, 
                 entityId: user.entityId, 
                 dateStarted: formData.dateStarted || new Date().toISOString(), 
                 createdBy: user.name 
             };
             await StorageService.add(key, newLog);

             // --- FIX APPLIED HERE: Trigger Individual Tracking Generation ---
             if (activeStage === ProductionStage.INOCULATION && formData.bagsPacked > 0) {
                 StorageService.generateBatchItems(selectedBatchId, user.entityId, formData.bagsPacked);
                 showAlert("Success", `Inoculation Recorded. ${formData.bagsPacked} individual tracking items have been generated in Incubation.`);
             }
             // ---------------------------------------------------------------
        }

        resetForm(); 
        loadStageLogs();

    } catch (error) {
        console.error("Save Error:", error);
        alert("An error occurred while saving. Please check your internet connection.");
    }
  };

  // --- Incubation Logic ---
  const handleBulkStatusUpdate = (status: BatchItem['status']) => {
      if (isReadOnly || selectedItemIds.size === 0) return;
      const ids: string[] = Array.from(selectedItemIds);
      StorageService.bulkUpdateBatchItemStatus(ids, status);
      const updatedItems = incubationItems.map(i => selectedItemIds.has(i.id) ? { ...i, status } : i);
      setIncubationItems(updatedItems);
      setSelectedItemIds(new Set()); 
      const snapshot = {
          inoculated: updatedItems.filter(i => i.status === 'INOCULATED').length,
          incubating: updatedItems.filter(i => i.status === 'INCUBATING').length,
          ready: updatedItems.filter(i => i.status === 'READY_TO_FRUIT').length,
          contaminated: updatedItems.filter(i => i.status === 'CONTAMINATED').length,
          disposed: updatedItems.filter(i => i.status === 'DISPOSED').length
      };
      const key = getStageKey(ProductionStage.INCUBATION);
      const newLog = {
          id: `inc_snap_${Date.now()}`,
          batchId: selectedBatchId,
          entityId: user.entityId,
          roomNo: selectedBatch?.location || 'Unassigned',
          status: 'Snapshot',
          successCount: snapshot.ready,
          failCount: snapshot.contaminated + snapshot.disposed,
          dateStarted: new Date().toISOString(),
          snapshot: snapshot,
          notes: `Bulk Update: ${ids.length} items set to ${status}`
      };
      StorageService.add(key, newLog);
      loadStageLogs(); 
  };

  const toggleItemSelection = (itemId: string) => {
      if (isReadOnly) return;
      const newSet = new Set(selectedItemIds);
      if (newSet.has(itemId)) newSet.delete(itemId);
      else newSet.add(itemId);
      setSelectedItemIds(newSet);
  };

  const toggleSelectAll = () => {
      if (isReadOnly) return;
      if (selectedItemIds.size === filteredItems.length) setSelectedItemIds(new Set());
      else setSelectedItemIds(new Set(filteredItems.map(i => i.id)));
  };

// FIX: Updated logic to include 'CONTAMINATED' and 'DISPOSED' when 'FAILED' is selected
  const filteredItems = incubationItems.filter(item => {
      const matchSearch = !scanQuery || item.id.toLowerCase().includes(scanQuery.toLowerCase());
      
      if (itemFilter === 'ALL') return matchSearch;
      
      if (itemFilter === 'FAILED') {
          // This specific check fixes your issue
          return matchSearch && ['FAILED', 'CONTAMINATED', 'DISPOSED'].includes(item.status);
      }
      
      return matchSearch && item.status === itemFilter;
  });

  const currentCounts = {
      inoculated: incubationItems.filter(i => i.status === 'INOCULATED').length,
      incubating: incubationItems.filter(i => i.status === 'INCUBATING').length,
      healthy: incubationItems.filter(i => i.status === 'READY_TO_FRUIT').length,
      failed: incubationItems.filter(i => ['CONTAMINATED', 'DISPOSED'].includes(i.status)).length
  };

  const DetailItem = ({ label, value, subtext }: { label: string, value: React.ReactNode, subtext?: string }) => (
    <div className="flex flex-col">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">{label}</span>
        <span className="text-sm font-semibold text-gray-800 truncate">{value}</span>
        {subtext && <span className="text-xs text-gray-500 mt-0.5">{subtext}</span>}
    </div>
  );

  // --- FRUITING SAMPLING ENGINE ---
  
  // Real-time aggregation effect
  useEffect(() => {
      if (activeStage === ProductionStage.FRUITING) {
          // 1. Aggregate
          const agg = aggregateSampleData(sampleRows);
          
          // 2. Update Form State
          setSamplingForm(prev => ({
              ...prev,
              currentAvgDiameterCM: agg.avgDiameter,
              dominantShape: agg.dominantShape,
              flatPercentage: agg.flatPercentage // Added
          }));
      }
  }, [sampleRows, activeStage]);

  // Recalculate Maturity & Suggest Status
  useEffect(() => {
      if (activeStage === ProductionStage.FRUITING && selectedBatch) {
          const baselines: BatchBaseline = {
              targetDiameterCM: selectedBatch.baselineCapDiameter || 8.0,
              targetMaturationDays: selectedBatch.baselineMaturationDays || 5
          };
          const score = calculateMaturityIndex(samplingForm, baselines);
          setCalculatedMaturity(score);
          setCurrentAlert(evaluateHarvestStatus(score, samplingForm.flatPercentage || 0, selectedBatchId));
          
          // Calculate Suggestion
          const suggestion = evaluateBatchStatus(score, samplingForm.flatPercentage || 0, !!samplingForm.pinningDate);
          setSuggestedStatus(suggestion);
          setManualStatus(suggestion); // Pre-select the suggestion
      }
  }, [samplingForm, activeStage, selectedBatch]);

  // FRUITING: Helper to toggle selections for Exception Handling
  const toggleFruitingSelection = (itemId: string) => {
      if (isReadOnly) return;
      const newSet = new Set(selectedFruitingItemIds);
      if (newSet.has(itemId)) newSet.delete(itemId);
      else newSet.add(itemId);
      setSelectedFruitingItemIds(newSet);
  };

  const handleFruitingBulkFail = () => {
      if (isReadOnly || selectedFruitingItemIds.size === 0) return;
      const idsToUpdate: string[] = Array.from(selectedFruitingItemIds);
      
      showConfirm(
        "Confirm Failed Items",
        `Mark ${idsToUpdate.length} items as FAILED? This is irreversible for tracking purposes.`,
        () => {
           const count = StorageService.bulkUpdateBatchItemStatus(idsToUpdate, 'FAILED');
           if (count === 0) {
               showAlert("Error", "Could not update items. IDs might be mismatching.");
           }
           loadFruitingItems();
           setSelectedFruitingItemIds(new Set());
        }
      );
  };

  const handleUpdateSampleRow = (id: string, field: 'diameter' | 'shape' | 'blockId', value: any) => {
      setSampleRows(prev => prev.map(row => 
          row.id === id ? { ...row, [field]: value } : row
      ));
  };

  const handleAddSampleRow = () => {
      setSampleRows(prev => [
          ...prev,
          { id: `s_${Date.now()}`, diameter: 0, shape: 'CONVEX' }
      ]);
  };

  const handleRemoveSampleRow = (id: string) => {
      if (sampleRows.length <= 1) return; // Keep at least one
      setSampleRows(prev => prev.filter(r => r.id !== id));
  };

const handleSaveObservation = () => {
      if (isReadOnly) return;
      if (!manualStatus) {
          showAlert("Action Required", "Please select a Batch Status before saving.");
          return;
      }

      // 1. Save Log
      const observationLog: DailyObservation = {
          id: `obs_${Date.now()}`,
          batchId: selectedBatchId,
          entityId: user.entityId,
          date: samplingForm.currentDate.toISOString(),
          pinningDate: samplingForm.pinningDate ? samplingForm.pinningDate.toISOString() : undefined,
          daysSincePinning: samplingForm.pinningDate ? Math.ceil((new Date().getTime() - samplingForm.pinningDate.getTime()) / (1000 * 3600 * 24)) : 0,
          sampleSize: sampleRows.length,
          avgDiameter: samplingForm.currentAvgDiameterCM,
          shape: samplingForm.dominantShape,
          maturityIndex: calculatedMaturity,
          alertLevel: currentAlert?.level || 'INFO',
          alertMessage: currentAlert?.message || manualStatus,
          recordedBy: user.name,
          flushNumber: selectedBatch?.currentFlush || 1 // Track flush
      };
      StorageService.add(KEYS.LOGS_OBSERVATIONS, observationLog);

      // 2. Batch Update Items Status (Use Manual Selection)
      let newStatus: BatchItemStatus = 'READY_TO_FRUIT'; // Default
      const statusLabel = manualStatus; // Use User Selected Status
      
      if (statusLabel === 'Growing') newStatus = 'FRUITING_PINNING';
      else if (statusLabel === 'Approaching Maturity') newStatus = 'FRUITING_MATURING';
      else if (statusLabel === 'Ready to Harvest') newStatus = 'FRUITING_READY';
      else if (statusLabel === 'Over Mature') newStatus = 'FRUITING_OVERMATURE';
      
      // CRITICAL LOGIC: Fetch authoritative list from storage to prevent overwriting FAILED items.
      const allStoredItems = StorageService.getAll<BatchItem>(KEYS.ITEMS_BATCH, user.entityId);
      
      const exceptionStatuses = ['FAILED', 'CONTAMINATED', 'DISPOSED'];
      
      // Calculate scope
      const itemsInBatch = allStoredItems.filter(i => i.batchId === selectedBatchId);
      const itemsToUpdate = itemsInBatch.filter(i => !exceptionStatuses.includes(i.status) && (i.status === 'READY_TO_FRUIT' || i.status.startsWith('FRUITING_')));
      const idsToUpdate = itemsToUpdate.map(i => i.id);
      
      const skippedCount = itemsInBatch.length - itemsToUpdate.length;

      if (idsToUpdate.length > 0) {
          StorageService.bulkUpdateBatchItemStatus(idsToUpdate, newStatus);
          
          let alertMsg = `Batch Observation Saved.\n\nSuccessfully updated: ${idsToUpdate.length} blocks to "${statusLabel}".\nSkipped (Failed/Exception): ${skippedCount} blocks.`;

          // --- AUTOMATED TRIGGER: DELIVERY ORDER (APPROACHING MATURITY OR READY TO HARVEST) ---
          if (newStatus === 'FRUITING_MATURING' || newStatus === 'FRUITING_READY') {
              const currentFlush = selectedBatch?.currentFlush || 1;
              
              const existingOrders = StorageService.getAll<DeliveryOrder>(KEYS.DELIVERY_ORDERS, user.entityId);
              const pendingOrder = existingOrders.find(o => 
                  o.batchId === selectedBatchId && 
                  o.flushNumber === currentFlush && 
                  (o.status === 'PENDING' || o.status === 'CONFIRMED')
              );

              if (!pendingOrder) {
                  const obsDate = new Date(samplingForm.currentDate);
                  const deliveryDate = new Date(obsDate);
                  deliveryDate.setDate(deliveryDate.getDate() + 1); // +1 Day from Observation Date
                  
                  const yieldEst = Number(projectedTotalWeightKg);
                  
                  // Dynamic Subject based on status
                  const subjectAction = newStatus === 'FRUITING_MATURING' ? 'Approaching Maturity' : 'Ready for Harvest';
                  
                  const emailContent = `Subject: ${subjectAction} Alert - Batch ${selectedBatchId} (Flush #${currentFlush})

Dear Village C Processing Team,

We are pleased to inform you that our mushroom batch ${selectedBatch?.species} (ID: ${selectedBatchId}, Flush #${currentFlush}) is ${subjectAction.toLowerCase()}.

Estimated Yield: ${yieldEst} kg
Expected Delivery Date: ${deliveryDate.toLocaleDateString()}

Please prepare your facility for receiving.

Sincerely,
${user.entityId === 'ent_001' ? 'Green Spore Co-op' : 'MyceliumNexus Farm'} Manager`;

                  const deliveryOrder: DeliveryOrder = {
                      id: `DO-${Date.now()}`,
                      entityId: user.entityId,
                      batchId: selectedBatchId,
                      species: selectedBatch?.species || 'Unknown',
                      estimatedYield: yieldEst,
                      deliveryDate: deliveryDate.toISOString(),
                      recipient: 'Village C Processing Community',
                      status: 'PENDING',
                      emailContent: emailContent,
                      createdAt: new Date().toISOString(),
                      flushNumber: currentFlush
                  };
                  
                  StorageService.saveDeliveryOrder(deliveryOrder);
                  StorageService.logActivity(user.entityId, user, 'CREATE_DELIVERY', `Auto-Generated Delivery Order ${deliveryOrder.id} for Village C (${subjectAction}, Flush ${currentFlush}).`);
                  
                  alertMsg += `\n\n✅ DELIVERY ALERT SENT TO VILLAGE C\nFlush: #${currentFlush}\nEst. Yield: ${yieldEst}kg\nDelivery: ${deliveryDate.toLocaleDateString()}`;
              }
          }

          // FIX: Use persistent alert instead of standard alert
          showPersistentAlert("Success", alertMsg);
      } else {
          // FIX: Use persistent alert instead of standard alert
          showPersistentAlert("Saved", `Observation Saved. No active blocks were updated.\n(Skipped ${skippedCount} blocks marked as Failed/Exception)`);
      }

      loadStageLogs();
      loadFruitingItems(); 
      resetSamplingSession(); 
  };
  
  const handleSaveHarvest = () => {
      if (isReadOnly) return;
      if (harvestForm.gradeAKg < 0 || harvestForm.gradeBKg < 0) return showAlert("Error", "Negative yield not allowed.");
      
      const confirmMsg = harvestForm.action === 'NEXT_FLUSH' 
          ? `Record yield and reset healthy blocks for Flush #${(selectedBatch?.currentFlush || 1) + 1}?`
          : `Record final yield and ARCHIVED all blocks in this batch? This will trigger Delivery Transit Status.`;

      showConfirm("Confirm Harvest", confirmMsg, () => {
          const harvestLog: HarvestLog = {
              id: `hv_${Date.now()}`,
              batchId: selectedBatchId,
              entityId: user.entityId,
              harvestDate: harvestForm.date,
              gradeAYield: harvestForm.gradeAKg,
              gradeBYield: harvestForm.gradeBKg,
              totalYield: harvestForm.gradeAKg + harvestForm.gradeBKg,
              action: harvestForm.action === 'NEXT_FLUSH' ? 'Next Flush' : 'Dispose',
              flushNumber: selectedBatch?.currentFlush || 1
          };
          
          StorageService.processHarvest(harvestLog, harvestForm.action);
          
          // Refresh Data
          const updatedBatch = StorageService.getAll<Batch>(KEYS.BATCHES, user.entityId).find(b => b.id === selectedBatchId);
          if (updatedBatch) {
              setBatches(prev => prev.map(b => b.id === updatedBatch.id ? updatedBatch : b));
          }
          
          const currentFlush = harvestLog.flushNumber; 
          const allOrders = StorageService.getAll<DeliveryOrder>(KEYS.DELIVERY_ORDERS, user.entityId);
          
          const existingOrder = allOrders.find(o => 
              o.batchId === selectedBatchId && 
              o.flushNumber === currentFlush &&
              ['PENDING', 'CONFIRMED'].includes(o.status)
          );
          
          if (existingOrder) {
              const emailBody = `Subject: 🚚 IN TRANSIT: Fresh Mushroom Delivery Dispatched

Delivery Order #${existingOrder.id}

Dear Village C Team,

This is an automated notification that your order is now ON THE WAY following harvest completion.

Driver: John Doe (Simulated)
Vehicle: Truck A (Plate: WXY 1234)
Estimated Arrival: Within 2 Hours
Items: Fresh Mushrooms (${existingOrder.estimatedYield} kg)

Please ensure your receiving bay is clear.

Thank you,
${user.entityId === 'ent_001' ? 'Green Spore Co-op' : 'MyceliumNexus Farm'}`;

              const updatedOrder = { 
                  ...existingOrder, 
                  status: 'IN_TRANSIT' as const,
                  emailContent: emailBody
              };
              StorageService.update(KEYS.DELIVERY_ORDERS, updatedOrder);
              
              // --- [START] ADDED CODE BLOCK ---
              const batchToSync = batches.find(b => b.id === selectedBatchId);
              if (batchToSync) {
                  const syncedBatch = { ...batchToSync, status: 'IN_TRANSIT' as any }; 
                  StorageService.update(KEYS.BATCHES, syncedBatch); 
              }
              // --- [END] ADDED CODE BLOCK ---

              StorageService.logActivity(user.entityId, user, 'UPDATE_DELIVERY', `Auto-triggered In Transit for Order ${existingOrder.id} upon Harvest Record.`);
              
              alert(`System Alert: Delivery Order #${existingOrder.id} is now IN TRANSIT. Notification sent to Village C.`);
          }

          if (harvestForm.action === 'DISPOSE') {
              showAlert("Batch Completed", "Batch has been marked as Completed and moved to archive.");
              setSelectedBatchId('');
          } else {
              showAlert("Cycle Reset", `Batch is now ready for Flush #${(selectedBatch?.currentFlush || 1) + 1}. Healthy blocks have been reset.`);
          }

          setHarvestForm({
              date: new Date().toISOString().split('T')[0],
              gradeAKg: 0,
              gradeBKg: 0,
              action: 'NEXT_FLUSH'
          });
          loadStageLogs();
      });
  };

  if (!selectedBatchId) {
    return (
      <div className="max-w-xl mx-auto mt-20 text-center">
        <div className="bg-white p-10 rounded-2xl shadow-xl border border-gray-100">
          <div className="bg-primary-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
            <Search className="text-primary-600" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Batch Investigation</h2>
          <p className="text-gray-500 mb-8">Select an active batch ID to manage its production lifecycle.</p>
          <div className="relative flex gap-2">
            <select 
              className="w-full appearance-none bg-gray-50 border border-gray-300 text-gray-900 text-lg rounded-xl focus:ring-primary-500 focus:border-primary-500 block p-4 pr-10"
              onChange={(e) => setSelectedBatchId(e.target.value)}
              value={selectedBatchId}
            >
              <option value="">Select a Batch ID...</option>
              {batches.filter(b => showArchived ? true : b.status !== 'COMPLETED').map(b => (
                <option key={b.id} value={b.id}>{b.id} - {b.species} {b.status === 'COMPLETED' ? '(Archived)' : ''}</option>
              ))}
            </select>
            <button 
                onClick={() => setShowArchived(!showArchived)}
                className={`px-4 rounded-xl border flex items-center justify-center transition-colors ${showArchived ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'}`}
                title="Toggle Archived Batches"
            >
                <Archive size={24} />
            </button>
            <div className="pointer-events-none absolute inset-y-0 right-16 flex items-center px-4 text-gray-500">
              <ArrowRight />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">{showArchived ? 'Showing all batches (including completed).' : 'Showing active batches only.'}</p>
        </div>
      </div>
    );
  }

return (
    <div className="space-y-6">
      {/* 1. Header Card */}
      <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <div className="flex items-center gap-3 mb-1">
             <h2 className="text-2xl font-bold text-gray-800 font-mono">{selectedBatch?.id}</h2>
             <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${isReadOnly ? 'bg-gray-200 text-gray-700' : 'bg-blue-100 text-blue-800'}`}>{selectedBatch?.status}</span>
             {isReadOnly && <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded"><Eye size={12}/> Read Only</span>}
             {selectedBatch?.currentFlush && selectedBatch.currentFlush > 1 && (
                 <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                     <RotateCcw size={10} /> Flush #{selectedBatch.currentFlush}
                 </span>
             )}
           </div>
           <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1"><Leaf size={14} /> {selectedBatch?.species}</span>
              <span className="flex items-center gap-1"><Calendar size={14} /> Started: {new Date(selectedBatch?.startDate || '').toLocaleDateString()}</span>
           </div>
        </div>
        <button onClick={() => setSelectedBatchId('')} className="text-sm text-gray-500 hover:text-gray-800 underline">Change Batch</button>
      </div>

      {/* 2. Stage Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <div className="flex p-4 min-w-max">
          {STAGES.map((stage) => {
            const isActive = activeStage === stage.id;
            const Icon = stage.icon;
            return (
              <button
                key={stage.id}
                onClick={() => setActiveStage(stage.id)}
                className={`flex flex-col items-center min-w-[100px] px-4 py-2 rounded-lg transition-all ${
                  isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-400 hover:bg-gray-50'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
                   isActive ? 'bg-primary-600 text-white shadow-md' : 'bg-gray-100 text-gray-400'
                }`}>
                  <Icon size={20} />
                </div>
                <span className={`text-xs font-bold uppercase tracking-wider ${isActive ? 'text-primary-800' : 'text-gray-500'}`}>
                  {stage.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 3. Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: Main Interface & History */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* --- A. FRUITING STAGE UI --- */}
          {activeStage === ProductionStage.FRUITING ? (
             <div className="space-y-6">
                 {!isReadOnly && (
                 <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                     <div className="bg-purple-50 p-4 border-b border-purple-100 flex justify-between items-center">
                         <h3 className="font-bold text-purple-900 flex items-center gap-2">
                             <CheckSquare size={18}/>
                             Daily Batch Observation
                         </h3>
                         <div className="flex gap-2">
                            <span className="text-xs text-purple-700 font-bold bg-purple-100 px-2 py-1 rounded flex items-center gap-1">
                                <RotateCcw size={12}/> Active Cycle: Flush #{selectedBatch?.currentFlush || 1}
                            </span>
                         </div>
                     </div>
                     
                     <div className="p-5 space-y-6">
                         {/* Global Inputs */}
                         <div className="grid grid-cols-2 gap-6 bg-gray-50 p-4 rounded-lg">
                             <div>
                                 <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Observation Date</label>
                                 <input type="date" className="w-full border rounded p-2 text-sm" value={samplingForm.currentDate.toISOString().split('T')[0]} onChange={e => setSamplingForm({...samplingForm, currentDate: new Date(e.target.value)})} />
                             </div>
                             <div>
                                 <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Pinning Start Date</label>
                                 <input type="date" className="w-full border rounded p-2 text-sm" value={samplingForm.pinningDate ? samplingForm.pinningDate.toISOString().split('T')[0] : ''} onChange={e => setSamplingForm({...samplingForm, pinningDate: new Date(e.target.value)})} />
                             </div>
                         </div>

                         {/* Sampling Table */}
                         <div>
                             <div className="flex justify-between items-center mb-2">
                                <label className="text-sm font-bold text-gray-700">Random Sample Measurements</label>
                                <span className="text-xs text-gray-400 italic">Enter at least 5 samples</span>
                             </div>
                             <div className="border rounded-lg overflow-hidden">
                                 <table className="w-full text-sm">
                                     <thead className="bg-gray-100 text-gray-600 font-medium">
                                         <tr>
                                             <th className="p-2 w-12 text-center">#</th>
                                             <th className="p-2 text-left">Block ID (Optional)</th>
                                             <th className="p-2 w-32">Diameter (cm)</th>
                                             <th className="p-2 w-40">Shape</th>
                                             <th className="p-2 w-10"></th>
                                         </tr>
                                     </thead>
                                     <tbody className="divide-y divide-gray-100">
                                         {sampleRows.map((row, index) => (
                                             <tr key={row.id}>
                                                 <td className="p-2 text-center text-gray-400">{index + 1}</td>
                                                 <td className="p-2">
                                                     <input type="text" className="w-full border-b focus:border-purple-500 outline-none bg-transparent" placeholder="e.g. 024" value={row.blockId || ''} onChange={e => handleUpdateSampleRow(row.id, 'blockId', e.target.value)} />
                                                 </td>
                                                 <td className="p-2">
                                                     <input type="number" step="0.1" className="w-full border rounded p-1 text-center" value={row.diameter || ''} onChange={e => handleUpdateSampleRow(row.id, 'diameter', Number(e.target.value))} />
                                                 </td>
                                                 <td className="p-2">
                                                     <select className="w-full border rounded p-1 bg-white" value={row.shape} onChange={e => handleUpdateSampleRow(row.id, 'shape', e.target.value as any)}>
                                                         <option value="CONVEX">Convex</option>
                                                         <option value="FLAT">Flat</option>
                                                         <option value="UPTURNED">Upturned</option>
                                                     </select>
                                                 </td>
                                                 <td className="p-2 text-center">
                                                     <button onClick={() => handleRemoveSampleRow(row.id)} className="text-gray-400 hover:text-red-500"><XCircle size={16}/></button>
                                                 </td>
                                             </tr>
                                         ))}
                                     </tbody>
                                 </table>
                                 <button onClick={handleAddSampleRow} className="w-full py-2 text-xs font-bold text-gray-500 hover:bg-gray-50 border-t flex items-center justify-center gap-1">
                                     <Plus size={14}/> Add Row
                                 </button>
                             </div>
                         </div>
                         
                         {/* Status Selection */}
                         <div className="p-5 border-t bg-gray-50">
                            <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                               Determine Batch Status
                               <span className="text-xs font-normal text-gray-500 bg-white px-2 py-0.5 rounded border">
                                   System Suggestion: <strong className="text-primary-600">{suggestedStatus}</strong>
                               </span>
                            </label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                               {['Growing', 'Approaching Maturity', 'Ready to Harvest', 'Over Mature'].map(status => (
                                   <button 
                                       key={status}
                                       onClick={() => setManualStatus(status)}
                                       className={`py-3 px-2 rounded-lg text-sm font-bold border transition-all shadow-sm ${manualStatus === status ? 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-200' : 'border-gray-200 hover:bg-gray-100 text-gray-500 bg-white'}`}
                                   >
                                       {status}
                                   </button>
                               ))}
                            </div>
                         </div>

                        {/* --- LIVE CALCULATION DASHBOARD (Fixed: Content Clipping) --- */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6 mb-2 px-1">
                            {/* 1. Sample Size */}
                            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-center flex flex-col justify-center h-auto min-h-[80px]">
                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Sample Size</div>
                                <div className="text-2xl font-black text-gray-700 leading-none">{sampleRows.length}</div>
                            </div>

                            {/* 2. Avg Diameter */}
                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-center flex flex-col justify-center h-auto min-h-[80px]">
                                <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wide mb-1">Avg Diameter</div>
                                <div className="text-xl font-black text-blue-600 leading-none">{samplingForm.currentAvgDiameterCM.toFixed(2)} <span className="text-xs text-blue-400 font-medium">cm</span></div>
                            </div>

                            {/* 3. Dominant Shape */}
                            <div className="bg-purple-50 p-3 rounded-lg border border-purple-100 text-center flex flex-col justify-center h-auto min-h-[80px]">
                                <div className="text-[10px] font-bold text-purple-400 uppercase tracking-wide mb-1">Dominant Shape</div>
                                <div className="text-lg font-black text-purple-600 uppercase leading-tight break-words">{samplingForm.dominantShape}</div>
                            </div>

                            {/* 4. Flat Ratio */}
                            <div className="bg-orange-50 p-3 rounded-lg border border-orange-100 text-center flex flex-col justify-center h-auto min-h-[80px]">
                                <div className="text-[10px] font-bold text-orange-400 uppercase tracking-wide mb-1">Flat Ratio</div>
                                <div className="text-xl font-black text-orange-600 leading-none">{samplingForm.flatPercentage}%</div>
                            </div>

                            {/* 5. Maturity Index */}
                            <div className="bg-green-50 p-3 rounded-lg border border-green-100 text-center flex flex-col justify-center h-auto min-h-[80px] relative overflow-hidden">
                                <div className="text-[10px] font-bold text-green-500 uppercase tracking-wide mb-1 z-10 relative">Maturity Index</div>
                                <div className="text-2xl font-black text-green-700 z-10 relative leading-none">{calculatedMaturity}%</div>
                                {/* Progress Bar */}
                                <div className="absolute bottom-0 left-0 h-1.5 bg-green-200 w-full">
                                    <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${Math.min(calculatedMaturity, 100)}%` }}></div>
                                </div>
                            </div>
                        </div>
                        {/* ------------------------------------------------------- */}

                         <div className="p-4 border-t flex justify-end">
                             <button onClick={handleSaveObservation} className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-lg font-bold text-sm shadow-sm flex items-center gap-2">
                                 <Save size={18} /> Confirm & Update Batch Status
                             </button>
                         </div>
                     </div>
                 </div>
                 )}
                 {/* --- START OF MISSING GRID SECTION --- */}
                    {/* 1. Statistics Cards */}
                    <div className="grid grid-cols-4 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                            <div className="text-[10px] uppercase font-bold text-gray-400 mb-1">Total Blocks</div>
                            <div className="text-2xl font-bold text-gray-800">{fruitingStats.total}</div>
                        </div>
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 shadow-sm">
                            <div className="text-[10px] uppercase font-bold text-blue-600 mb-1">Active / Growing</div>
                            <div className="text-2xl font-bold text-blue-700">{fruitingStats.active}</div>
                        </div>
                        <div className="bg-green-50 p-4 rounded-xl border border-green-200 shadow-sm">
                            <div className="text-[10px] uppercase font-bold text-green-600 mb-1">Ready to Harvest</div>
                            <div className="text-2xl font-bold text-green-700">{fruitingStats.ready}</div>
                        </div>
                        <div className="bg-red-50 p-4 rounded-xl border border-red-200 shadow-sm">
                            <div className="text-[10px] uppercase font-bold text-red-600 mb-1">Contaminated / Failed</div>
                            <div className="text-2xl font-bold text-red-700">{fruitingStats.failed}</div>
                        </div>
                    </div>

                    {/* 2. Individual Block Tracking Grid */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <GridIcon size={18} className="text-gray-500" /> Individual Block Tracking
                            </h3>
                            {!isReadOnly && selectedFruitingItemIds.size > 0 && (
                                <button 
                                    onClick={handleFruitingBulkFail}
                                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-xs font-bold transition-colors flex items-center gap-2"
                                >
                                    <AlertTriangle size={14}/> Mark {selectedFruitingItemIds.size} Failed
                                </button>
                            )}
                        </div>
                        
                        <div className="p-4">
                            {fruitingItems.length === 0 ? (
                                <div className="text-center py-10 text-gray-400 border-2 border-dashed rounded-lg">
                                    <Leaf size={40} className="mx-auto mb-2 opacity-20" />
                                    <p>No active blocks found in Fruiting Chamber.</p>
                                    <p className="text-xs">Ensure you have moved items from Incubation.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-[500px] overflow-y-auto p-1">
                                    {fruitingItems.map(item => {
                                        const isSelected = selectedFruitingItemIds.has(item.id);
                                        let colorClass = "bg-gray-100 border-gray-200 text-gray-500"; // Default
                                        
                                        if (item.status === 'FRUITING_PINNING') colorClass = "bg-blue-50 border-blue-200 text-blue-700 ring-1 ring-blue-100";
                                        else if (item.status === 'FRUITING_MATURING') colorClass = "bg-indigo-50 border-indigo-200 text-indigo-700 ring-1 ring-indigo-100";
                                        else if (item.status === 'FRUITING_READY') colorClass = "bg-green-50 border-green-200 text-green-700 ring-1 ring-green-100 font-bold";
                                        else if (['CONTAMINATED', 'DISPOSED', 'FAILED'].includes(item.status)) colorClass = "bg-red-50 border-red-200 text-red-700 opacity-75";
                                        else if (item.status === 'READY_TO_FRUIT') colorClass = "bg-white border-gray-300 text-gray-600 border-dashed"; // New Flush State

                                        return (
                                            <div 
                                                key={item.id}
                                                onClick={() => toggleFruitingSelection(item.id)}
                                                className={`
                                                    relative p-3 rounded-lg border text-center cursor-pointer transition-all select-none
                                                    ${colorClass}
                                                    ${isSelected ? 'ring-2 ring-offset-1 ring-red-500 border-red-500' : 'hover:scale-105'}
                                                `}
                                            >
                                                <div className="text-[10px] font-mono mb-1 opacity-70 truncate">{item.id}</div>
                                                <div className="text-xs font-bold uppercase tracking-wide">
                                                    {item.status === 'READY_TO_FRUIT' ? 'New Flush' : item.status.replace('FRUITING_', '')}
                                                </div>
                                                {isSelected && (
                                                    <div className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full p-0.5 shadow-sm">
                                                        <Check size={10} />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            
                            <div className="mt-4 flex justify-between items-center text-xs text-gray-500 border-t pt-2">
                                <div className="flex gap-4">
                                    <span className="flex items-center gap-1"><div className="w-2 h-2 bg-white border border-gray-400 border-dashed rounded"></div> New Flush</span>
                                    <span className="flex items-center gap-1"><div className="w-2 h-2 bg-blue-100 border border-blue-300 rounded"></div> Growing</span>
                                    <span className="flex items-center gap-1"><div className="w-2 h-2 bg-green-100 border border-green-300 rounded"></div> Ready</span>
                                    <span className="flex items-center gap-1"><div className="w-2 h-2 bg-red-100 border border-red-300 rounded"></div> Failed</span>
                                </div>
                                <span>{selectedFruitingItemIds.size} selected</span>
                            </div>
                        </div>
                    </div>

                    {/* --- END OF MISSING GRID SECTION --- */}
             </div>

          /* --- B. INCUBATION STAGE UI --- */
          ) : activeStage === ProductionStage.INCUBATION ? (
             <div className="space-y-6">
                 
                 {/* 1. Summary Stats Cards */}
                 <div className="grid grid-cols-4 gap-4">
                     <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                         <div className="text-[10px] uppercase font-bold text-gray-400 mb-1">Total Bags</div>
                         <div className="text-2xl font-bold text-gray-800">{incubationItems.length}</div>
                     </div>
                     <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 shadow-sm">
                         <div className="text-[10px] uppercase font-bold text-blue-600 mb-1">Incubating</div>
                         <div className="text-2xl font-bold text-blue-700">{currentCounts.incubating + currentCounts.inoculated}</div>
                     </div>
                     <div className="bg-green-50 p-4 rounded-xl border border-green-200 shadow-sm">
                         <div className="text-[10px] uppercase font-bold text-green-600 mb-1">Ready</div>
                         <div className="text-2xl font-bold text-green-700">{currentCounts.healthy}</div>
                     </div>
                     <div className="bg-red-50 p-4 rounded-xl border border-red-200 shadow-sm">
                         <div className="text-[10px] uppercase font-bold text-red-600 mb-1">Failed</div>
                         <div className="text-2xl font-bold text-red-700">{currentCounts.failed}</div>
                     </div>
                 </div>

                 {/* 2. Controls & Location */}
                 <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 flex items-center gap-2 text-sm text-purple-800">
                    <Lock size={14} /> 
                    <span className="font-semibold">Location Constraint:</span> {selectedBatch?.location || 'Incubation Room 1'}
                 </div>

                 <div className="flex justify-between items-center bg-white p-2 rounded-lg border">
                     <div className="flex gap-2">
                         {['ALL', 'INOCULATED', 'INCUBATING', 'READY_TO_FRUIT', 'FAILED'].map(filter => (
                             <button 
                                key={filter} 
                                onClick={() => setItemFilter(filter)} 
                                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${itemFilter === filter ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                             >
                                {filter.replace(/_/g, ' ')}
                             </button>
                         ))}
                     </div>
                     <div className="flex items-center gap-2">
                         <Search size={16} className="text-gray-400"/>
                         <input 
                            type="text" 
                            placeholder="Scan/Search ID..." 
                            className="text-sm outline-none w-32"
                            value={scanQuery}
                            onChange={(e) => setScanQuery(e.target.value)}
                         />
                     </div>
                 </div>

                 {/* 3. The Grid / List Container */}
                 <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 relative min-h-[300px]">
                     
                     {/* Bulk Actions Toolbar */}
                     {!isReadOnly && selectedItemIds.size > 0 && (
                        <div className="bg-gray-900 text-white rounded-lg shadow-xl p-2 flex items-center justify-between mb-4 animate-in fade-in slide-in-from-top-1 sticky top-0 z-20">
                            <div className="flex items-center gap-3 pl-2">
                                <div className="bg-blue-600 w-2 h-2 rounded-full animate-pulse"></div>
                                <span className="font-bold text-sm">{selectedItemIds.size} Selected</span>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleBulkStatusUpdate('INCUBATING')} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-xs font-bold transition-colors">Set Incubating</button>
                                <button onClick={() => handleBulkStatusUpdate('READY_TO_FRUIT')} className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded text-xs font-bold transition-colors">Set Healthy</button>
                                <button onClick={() => handleBulkStatusUpdate('CONTAMINATED')} className="bg-orange-600 hover:bg-orange-500 text-white px-3 py-1.5 rounded text-xs font-bold transition-colors">Set Contaminated</button>
                                <button onClick={() => handleBulkStatusUpdate('DISPOSED')} className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded text-xs font-bold transition-colors">Set Disposed</button>
                            </div>
                        </div>
                     )}

                     {/* Table Headers */}
                     <div className="grid grid-cols-12 gap-4 text-xs font-bold text-gray-400 uppercase border-b pb-2 mb-2 px-2">
                         <div className="col-span-1"><input type="checkbox" onChange={toggleSelectAll} checked={selectedItemIds.size === filteredItems.length && filteredItems.length > 0} /></div>
                         <div className="col-span-5">Serial ID</div>
                         <div className="col-span-3">Current Status</div>
                         <div className="col-span-3 text-right">Last Updated</div>
                     </div>

                     {/* Items List */}
                     {filteredItems.length === 0 ? (
                         <div className="text-center py-10 text-gray-400">
                             <Box size={32} className="mx-auto mb-2 opacity-30" />
                             <p>No items found.</p>
                         </div>
                     ) : (
                         <div className="space-y-0 overflow-y-auto max-h-[500px]">
                             {filteredItems.map(item => {
                                 const isSelected = selectedItemIds.has(item.id);
                                 let statusColor = "bg-gray-100 text-gray-600";
                                 if(item.status === 'INOCULATED') statusColor = "bg-gray-100 text-gray-600 font-bold";
                                 if(item.status === 'INCUBATING') statusColor = "bg-blue-100 text-blue-700 font-bold";
                                 if(item.status === 'READY_TO_FRUIT') statusColor = "bg-green-100 text-green-700 font-bold";
                                 if(item.status === 'CONTAMINATED') statusColor = "bg-orange-100 text-orange-700 font-bold";
                                 if(item.status === 'DISPOSED') statusColor = "bg-red-100 text-red-700 font-bold";

                                 return (
                                     <div key={item.id} className={`grid grid-cols-12 gap-4 items-center p-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50' : ''}`}>
                                         <div className="col-span-1">
                                             <input type="checkbox" checked={isSelected} onChange={() => toggleItemSelection(item.id)} />
                                         </div>
                                         <div className="col-span-5 font-mono text-sm font-medium text-gray-700">
                                             {item.id}
                                         </div>
                                         <div className="col-span-3">
                                             <span className={`px-2 py-1 rounded text-[10px] uppercase tracking-wider ${statusColor}`}>
                                                 {item.status.replace(/_/g, ' ')}
                                             </span>
                                         </div>
                                         <div className="col-span-3 text-right text-gray-400 text-xs">
                                             {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                         </div>
                                     </div>
                                 )
                             })}
                         </div>
                     )}
                     
                     <div className="border-t pt-4 mt-4 text-xs text-gray-400 flex justify-between">
                        <span>Showing {filteredItems.length} items</span>
                        <span>Total Batch Size: {incubationItems.length}</span>
                     </div>
                 </div>

                 {/* 4. Analytics & History */}
                 <div className="space-y-6">
                    
                    {/* Growth Health Trend (History Chart) */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h4 className="font-bold text-gray-800 flex items-center gap-2 mb-2">
                            <Activity size={20} className="text-green-600" /> Growth Health Trend (History)
                        </h4>
                        
                        {/* CHART CONTAINER - with Top Padding for Tooltips */}
                        <div className="h-56 flex items-end gap-2 overflow-x-auto pb-2 pt-16 px-2">
                             {logs.filter(l => l.snapshot).reverse().map((log, idx) => {
                                 const total = (log.snapshot.inoculated || 0) + (log.snapshot.incubating || 0) + (log.snapshot.ready || 0) + (log.snapshot.contaminated || 0) + (log.snapshot.disposed || 0) || 1;
                                 
                                 return (
                                     <div key={idx} className="h-full w-12 flex flex-col justify-end group relative shrink-0">
                                         {/* Tooltip */}
                                         <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-gray-900 text-white text-[10px] p-2 rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity z-50 w-32 pointer-events-none">
                                             <div className="font-bold border-b border-gray-700 pb-1 mb-1">{new Date(log.dateStarted).toLocaleDateString()}</div>
                                             <div className="grid grid-cols-2 gap-1">
                                                <span className="text-gray-400">Inoc: {log.snapshot.inoculated}</span>
                                                <span className="text-blue-300">Inc: {log.snapshot.incubating}</span>
                                                <span className="text-green-300">Rdy: {log.snapshot.ready}</span>
                                                <span className="text-red-300">Fail: {log.snapshot.contaminated + log.snapshot.disposed}</span>
                                             </div>
                                             <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                         </div>

                                         {/* Stacked Bar Segment */}
                                         <div className="w-full bg-gray-100 rounded-t-sm overflow-hidden flex flex-col-reverse h-full hover:brightness-90 transition-all cursor-pointer ring-1 ring-black/5">
                                             <div style={{ height: `${((log.snapshot.contaminated + log.snapshot.disposed) / total) * 100}%` }} className="w-full bg-red-500"></div>
                                             <div style={{ height: `${(log.snapshot.ready / total) * 100}%` }} className="w-full bg-green-500"></div>
                                             <div style={{ height: `${(log.snapshot.incubating / total) * 100}%` }} className="w-full bg-blue-500"></div>
                                             <div style={{ height: `${(log.snapshot.inoculated / total) * 100}%` }} className="w-full bg-gray-300"></div>
                                         </div>
                                         
                                         {/* Date Label */}
                                         <div className="text-[9px] text-gray-400 text-center mt-1 truncate w-full font-medium">
                                             {new Date(log.dateStarted).getDate()}/{new Date(log.dateStarted).getMonth()+1}
                                         </div>
                                     </div>
                                 );
                             })}

                             {/* If no history */}
                             {logs.filter(l => l.snapshot).length === 0 && (
                                <div className="h-full w-12 flex flex-col justify-end group relative opacity-50 shrink-0">
                                     <div className="w-full bg-gray-100 rounded-t-sm overflow-hidden flex flex-col-reverse h-full">
                                         <div style={{ height: `${(currentCounts.failed / (incubationItems.length||1)) * 100}%` }} className="w-full bg-red-500"></div>
                                         <div style={{ height: `${(currentCounts.healthy / (incubationItems.length||1)) * 100}%` }} className="w-full bg-green-500"></div>
                                         <div style={{ height: `${(currentCounts.incubating / (incubationItems.length||1)) * 100}%` }} className="w-full bg-blue-500"></div>
                                         <div style={{ height: `${(currentCounts.inoculated / (incubationItems.length||1)) * 100}%` }} className="w-full bg-gray-300"></div>
                                     </div>
                                     <div className="text-[9px] text-gray-400 text-center mt-1">Now</div>
                                </div>
                             )}
                        </div>

                        {/* Legend */}
                        <div className="flex justify-center gap-6 mt-2 text-[10px] uppercase font-bold text-gray-400 border-t pt-4">
                             <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-gray-300"></div> Inoculated</div>
                             <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-blue-500"></div> Incubating</div>
                             <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-green-500"></div> Healthy</div>
                             <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-red-500"></div> Failed</div>
                        </div>
                    </div>

                    {/* Audit History List */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                        <h4 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
                            <History size={20} className="text-gray-600" /> Audit History
                        </h4>
                        
                        <div className="flex-1 overflow-y-auto max-h-[300px] space-y-0">
                            {logs.length === 0 ? (
                                <div className="text-center py-8 text-gray-400 italic bg-gray-50 rounded-lg border border-dashed">
                                    No activity recorded yet for this batch.
                                </div>
                            ) : (
                                logs.map((log, idx) => (
                                    <div key={log.id} className="text-sm border-b border-gray-100 py-3 last:border-0 hover:bg-gray-50 px-2 rounded transition-colors group">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-gray-400 text-xs flex items-center gap-1">
                                                <Calendar size={12}/> {new Date(log.dateStarted).toLocaleString()}
                                            </span>
                                            
                                            {/* Snapshot Badges */}
                                            {log.snapshot && (
                                                <div className="flex gap-1 opacity-80">
                                                    {log.snapshot.ready > 0 && <span className="bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded text-[10px] font-bold">H: {log.snapshot.ready}</span>}
                                                    {(log.snapshot.contaminated + log.snapshot.disposed) > 0 && <span className="bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 rounded text-[10px] font-bold">F: {log.snapshot.contaminated + log.snapshot.disposed}</span>}
                                                    {(log.snapshot.incubating) > 0 && <span className="bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded text-[10px] font-bold">I: {log.snapshot.incubating}</span>}
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-gray-700 font-medium pl-1 border-l-2 border-gray-300 group-hover:border-primary-500 transition-colors">
                                            {log.notes || 'Routine manual update'}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                 </div>
             </div>

          /* --- C. HARVEST STAGE UI (NEW) --- */
          ) : activeStage === ProductionStage.HARVEST ? (
              <div className="space-y-6">
                  {!isReadOnly && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                      <div className="bg-green-50 p-4 border-b border-green-100 flex justify-between items-center">
                          <h3 className="font-bold text-green-900 flex items-center gap-2">
                              <Archive size={18}/> Record Harvest Yield
                          </h3>
                          <span className="text-xs text-green-700 font-bold bg-green-100 px-2 py-1 rounded">
                              Current Flush: #{selectedBatch?.currentFlush || 1}
                          </span>
                      </div>
                      
                      <div className="p-6 space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              <div>
                                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Harvest Date</label>
                                  <input 
                                    type="date" 
                                    className="w-full border rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-green-500" 
                                    value={harvestForm.date} 
                                    onChange={e => setHarvestForm({...harvestForm, date: e.target.value})} 
                                  />
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Grade A (Good) - kg</label>
                                  <input 
                                    type="number" 
                                    className="w-full border rounded-lg p-2.5 text-sm font-bold text-green-700 outline-none focus:ring-2 focus:ring-green-500" 
                                    placeholder="0.00"
                                    value={harvestForm.gradeAKg || ''} 
                                    onChange={e => setHarvestForm({...harvestForm, gradeAKg: parseFloat(e.target.value) || 0})} 
                                  />
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Grade B (Damaged) - kg</label>
                                  <input 
                                    type="number" 
                                    className="w-full border rounded-lg p-2.5 text-sm font-bold text-amber-700 outline-none focus:ring-2 focus:ring-amber-500" 
                                    placeholder="0.00"
                                    value={harvestForm.gradeBKg || ''} 
                                    onChange={e => setHarvestForm({...harvestForm, gradeBKg: parseFloat(e.target.value) || 0})} 
                                  />
                              </div>
                          </div>

                          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex justify-between items-center">
                              <div>
                                  <div className="text-xs font-bold text-gray-500 uppercase mb-1">Post-Harvest Action</div>
                                  <div className="flex gap-4">
                                      <label className="flex items-center gap-2 cursor-pointer">
                                          <input 
                                            type="radio" 
                                            name="action" 
                                            checked={harvestForm.action === 'NEXT_FLUSH'} 
                                            onChange={() => setHarvestForm({...harvestForm, action: 'NEXT_FLUSH'})}
                                            className="text-green-600 focus:ring-green-500"
                                          />
                                          <span className="text-sm text-gray-700">Start Next Flush <span className="text-xs text-gray-400">(Reset blocks)</span></span>
                                      </label>
                                      <label className="flex items-center gap-2 cursor-pointer">
                                          <input 
                                            type="radio" 
                                            name="action" 
                                            checked={harvestForm.action === 'DISPOSE'} 
                                            onChange={() => setHarvestForm({...harvestForm, action: 'DISPOSE'})}
                                            className="text-red-600 focus:ring-red-500"
                                          />
                                          <span className="text-sm text-gray-700">Complete & Dispose <span className="text-xs text-gray-400">(Finish Batch)</span></span>
                                      </label>
                                  </div>
                              </div>
                              <div className="text-right">
                                  <div className="text-xs font-bold text-gray-400 uppercase">Total Yield</div>
                                  <div className="text-2xl font-black text-gray-800">
                                      {(harvestForm.gradeAKg + harvestForm.gradeBKg).toFixed(2)} <span className="text-sm font-medium text-gray-500">kg</span>
                                  </div>
                              </div>
                          </div>

                          <div className="flex justify-end">
                              <button 
                                onClick={handleSaveHarvest}
                                className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-bold shadow-md flex items-center gap-2 transition-all transform active:scale-95"
                              >
                                  <Save size={18}/> Confirm Harvest
                              </button>
                          </div>
                      </div>
                  </div>
                  )}
              </div>

          /* --- D. STANDARD FORMS (CULTURE/SPAWN/ETC) --- */
          ) : (
          !isReadOnly && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 relative transition-all">
            {/* New/Edit Entry Form */}
            <div className="flex justify-between items-center mb-6 border-b pb-4">
               <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                 <div className="bg-primary-100 p-1.5 rounded text-primary-700"><CheckSquare size={18}/></div>
                 {editingId ? 'Edit Entry' : 'New Entry'}
               </h3>
               {editingId ? (
                 <button onClick={resetForm} className="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-full flex items-center gap-1 hover:bg-red-200">
                   <XCircle size={12} /> Cancel Edit
                 </button>
               ) : (
                 <span className="text-xs bg-gray-100 text-gray-500 px-3 py-1.5 rounded-full">Creating New Record</span>
               )}
            </div>

            {/* --- STAGE A: CULTURE --- */}
            {activeStage === ProductionStage.CULTURE && (
              <div className="space-y-6">
                 {/* 3-Column Layout for Inputs */}
                 <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                    <h4 className="text-xs font-bold text-gray-800 uppercase mb-4 flex items-center gap-2">
                        <Package size={16} className="text-gray-500" />
                        Material Usage
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Column 1: Source */}
                        <div className="space-y-3">
                             <div className="flex items-center gap-2 text-primary-700 font-semibold text-sm border-b border-primary-100 pb-1">
                                <Microscope size={16} /> Source
                             </div>
                             <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Mother Culture</label>
                                <select 
                                    className="w-full border rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-primary-500 outline-none" 
                                    onChange={e => setFormData({...formData, cultureMaterialId: e.target.value})}
                                    value={formData.cultureMaterialId || ''}
                                >
                                    <option value="">Select Species...</option>
                                    {materials.filter(m => m.category === 'SPECIES').map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-xs font-bold text-gray-500">Qty Used</label>
                                    {renderStockBadge(formData.cultureMaterialId, formData.cultureQty, 'cultureQty')}
                                </div>
                                <input 
                                    type="number" 
                                    className={`w-full border rounded-lg p-2 text-sm ${isStockInvalid(formData.cultureMaterialId, formData.cultureQty, 'cultureQty') ? 'border-red-500 bg-red-50 focus:ring-red-500' : ''}`}
                                    placeholder="0"
                                    value={formData.cultureQty || ''}
                                    disabled={getInventoryQty(formData.cultureMaterialId) === 0 && !editingId}
                                    onChange={e => setFormData({...formData, cultureQty: Number(e.target.value)})} 
                                />
                            </div>
                        </div>

                        {/* Column 2: Container */}
                        <div className="space-y-3 relative">
                             <div className="hidden md:block absolute left-0 top-2 bottom-2 w-px bg-gray-200"></div>
                             
                             <div className="flex items-center gap-2 text-primary-700 font-semibold text-sm border-b border-primary-100 pb-1 pl-4">
                                <Box size={16} /> Container
                             </div>
                             <div className="pl-4">
                                <label className="block text-xs font-bold text-gray-500 mb-1">Petri Dish / Vessel</label>
                                <select 
                                    className="w-full border rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-primary-500 outline-none" 
                                    onChange={e => setFormData({...formData, dishMaterialId: e.target.value})}
                                    value={formData.dishMaterialId || ''}
                                >
                                    <option value="">Select Container...</option>
                                    {materials.filter(m => m.category === 'PETRI_DISH').map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="pl-4">
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-xs font-bold text-gray-500">Count (Pcs)</label>
                                    {renderStockBadge(formData.dishMaterialId, formData.dishQty, 'dishQty')}
                                </div>
                                <input 
                                    type="number" 
                                    className={`w-full border rounded-lg p-2 text-sm ${isStockInvalid(formData.dishMaterialId, formData.dishQty, 'dishQty') ? 'border-red-500 bg-red-50 focus:ring-red-500' : ''}`}
                                    placeholder="0"
                                    value={formData.dishQty || ''}
                                    disabled={getInventoryQty(formData.dishMaterialId) === 0 && !editingId}
                                    onChange={e => setFormData({...formData, dishQty: Number(e.target.value)})} 
                                />
                            </div>
                        </div>

                        {/* Column 3: Medium */}
                        <div className="space-y-3 relative">
                             <div className="hidden md:block absolute left-0 top-2 bottom-2 w-px bg-gray-200"></div>

                             <div className="flex items-center gap-2 text-primary-700 font-semibold text-sm border-b border-primary-100 pb-1 pl-4">
                                <Beaker size={16} /> Medium
                             </div>
                             <div className="pl-4">
                                <label className="block text-xs font-bold text-gray-500 mb-1">Growth Medium (Agar)</label>
                                <select 
                                    className="w-full border rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-primary-500 outline-none" 
                                    onChange={e => setFormData({...formData, agarMaterialId: e.target.value})}
                                    value={formData.agarMaterialId || ''}
                                >
                                    <option value="">Select Agar...</option>
                                    {materials.filter(m => m.category === 'AGAR').map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="pl-4">
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-xs font-bold text-gray-500">Weight (g)</label>
                                    {renderStockBadge(formData.agarMaterialId, formData.agarQty, 'agarQty')}
                                </div>
                                <input 
                                    type="number" 
                                    className={`w-full border rounded-lg p-2 text-sm ${isStockInvalid(formData.agarMaterialId, formData.agarQty, 'agarQty') ? 'border-red-500 bg-red-50 focus:ring-red-500' : ''}`}
                                    placeholder="0.0"
                                    value={formData.agarQty || ''}
                                    disabled={getInventoryQty(formData.agarMaterialId) === 0 && !editingId}
                                    onChange={e => setFormData({...formData, agarQty: Number(e.target.value)})} 
                                />
                            </div>
                        </div>
                    </div>
                 </div>

                 {/* Outputs */}
                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                       <label className="block text-sm font-bold text-green-800 mb-1">Total Plates Produced</label>
                       <div className="flex items-center gap-2">
                          <TrendingUp size={20} className="text-green-600"/>
                          <input type="number" className="w-full border-b-2 border-green-300 bg-transparent p-1 text-lg font-bold text-green-900 focus:outline-none focus:border-green-600" value={formData.platesProduced || ''} onChange={e => setFormData({...formData,platesProduced: Number(e.target.value)})} placeholder="0" />
                       </div>
                    </div>
                    <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                       <label className="block text-sm font-bold text-red-800 mb-1">Contamination Loss</label>
                       <div className="flex items-center gap-2">
                          <AlertTriangle size={20} className="text-red-600"/>
                          <input type="number" className="w-full border-b-2 border-red-300 bg-transparent p-1 text-lg font-bold text-red-900 focus:outline-none focus:border-red-600" value={formData.platesContaminated || ''} onChange={e => setFormData({...formData, platesContaminated: Number(e.target.value)})} placeholder="0" />
                       </div>
                    </div>
                 </div>
              </div>
            )}

            {/* --- STAGE B: SPAWN --- */}
            {activeStage === ProductionStage.SPAWN && (
              <div className="space-y-8">
                 {/* 1. Material Consumption */}
                 <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                    <h4 className="text-xs font-bold text-gray-800 uppercase mb-4 flex items-center gap-2">
                        <Package size={16} className="text-gray-500" />
                        Material Consumption
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Grain Input */}
                        <div className="space-y-3">
                             <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Grain Substrate (e.g. Rye, Wheat)</label>
                                <select 
                                    className="w-full border rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-primary-500 outline-none" 
                                    onChange={e => setFormData({...formData, grainMaterialId: e.target.value})}
                                    value={formData.grainMaterialId || ''}
                                >
                                    <option value="">Select Grain...</option>
                                    {materials.filter(m => m.category === 'GRAINS').map(m => (
                                        <option key={m.id} value={m.id}>
                                            {m.name} [Stock: {getInventoryQty(m.id)} {m.uom}]
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-xs font-bold text-gray-500">Qty Used</label>
                                    {renderStockBadge(formData.grainMaterialId, formData.grainQty, 'grainQty')}
                                </div>
                                <input 
                                    type="number" 
                                    className={`w-full border rounded-lg p-2 text-sm ${isStockInvalid(formData.grainMaterialId, formData.grainQty, 'grainQty') ? 'border-red-500 bg-red-50 focus:ring-red-500' : ''}`}
                                    placeholder="0.0"
                                    value={formData.grainQty || ''}
                                    disabled={getInventoryQty(formData.grainMaterialId) === 0 && !editingId}
                                    onChange={e => setFormData({...formData, grainQty: Number(e.target.value)})} 
                                />
                            </div>
                        </div>

                        {/* Consumable Input */}
                        <div className="space-y-3 relative">
                             <div className="hidden md:block absolute left-0 top-2 bottom-2 w-px bg-gray-200"></div>
                             
                             <div className="pl-0 md:pl-4">
                                <label className="block text-xs font-bold text-gray-500 mb-1">Consumables (Spawn Bags)</label>
                                <select 
                                    className="w-full border rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-primary-500 outline-none" 
                                    onChange={e => setFormData({...formData, bagMaterialId: e.target.value})}
                                    value={formData.bagMaterialId || ''}
                                >
                                    <option value="">Select Bags...</option>
                                    {/* CHANGE 2: Filter by PACKAGING */}
                                    {materials.filter(m => m.category === 'PACKAGING').map(m => (
                                        <option key={m.id} value={m.id}>
                                            {m.name} [Stock: {getInventoryQty(m.id)}]
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="pl-0 md:pl-4">
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-xs font-bold text-gray-500">Count Used</label>
                                    {renderStockBadge(formData.bagMaterialId, formData.bagQty, 'bagQty')}
                                </div>
                                <input 
                                    type="number" 
                                    className={`w-full border rounded-lg p-2 text-sm ${isStockInvalid(formData.bagMaterialId, formData.bagQty, 'bagQty') ? 'border-red-500 bg-red-50 focus:ring-red-500' : ''}`}
                                    placeholder="0"
                                    value={formData.bagQty || ''}
                                    disabled={getInventoryQty(formData.bagMaterialId) === 0 && !editingId}
                                    onChange={e => setFormData({...formData, bagQty: Number(e.target.value)})} 
                                />
                            </div>
                        </div>
                    </div>
                 </div>

                 {/* 2. Progress Slider */}
                 <div>
                    <div className="flex justify-between items-center mb-4">
                        <label className="block text-sm font-bold text-gray-700">Colonization Progress</label>
                        <span className="text-xs text-primary-600 font-medium bg-primary-50 px-2 py-1 rounded border border-primary-100">
                            {formData.colonizationPct || 0}% Complete
                        </span>
                    </div>
                    
                    <div className="relative pt-2 pb-6 px-2">
                        {/* Background Line */}
                        <div className="absolute top-1/2 left-0 right-0 h-1.5 bg-gray-200 -z-10 rounded-full -translate-y-1/2"></div>
                        
                        {/* Stepper Buttons */}
                        <div className="flex justify-between">
                            {[
                                { val: 0, label: '0%', color: 'bg-white' },
                                { val: 33, label: '33%', color: 'bg-yellow-50' },
                                { val: 66, label: '66%', color: 'bg-blue-50' },
                                { val: 100, label: '100%', color: 'bg-green-50' }
                            ].map((step) => {
                                const isSelected = (formData.colonizationPct || 0) >= step.val;
                                const isCurrent = (formData.colonizationPct || 0) === step.val;
                                
                                return (
                                    <button
                                       key={step.val}
                                       onClick={() => setFormData({...formData, colonizationPct: step.val})}
                                       className={`relative w-12 h-12 rounded-full flex items-center justify-center text-xs font-bold transition-all border-2 shadow-sm
                                          ${isCurrent 
                                            ? 'border-primary-600 scale-110 ring-4 ring-primary-100 z-10 text-primary-700 bg-white' 
                                            : (isSelected ? 'border-primary-400 bg-primary-50 text-primary-600' : 'border-gray-300 bg-white text-gray-400 hover:border-gray-400')}`}
                                    >
                                        {step.val === 100 ? <Check size={16} /> : step.label}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                    
                    <p className="text-xs text-gray-500 italic text-center mb-2">
                        Update progress based on daily visual observation of white mycelium coverage.
                    </p>

                    {/* Logic Trigger Alert */}
                    {formData.colonizationPct === 66 && (
                        <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3 text-amber-800 text-sm animate-in fade-in slide-in-from-top-2">
                            <AlertCircle size={20} className="flex-shrink-0" />
                            <div>
                                <strong>Alert:</strong> Prepare Substrate Stage immediately to ensure timing alignment.
                            </div>
                        </div>
                    )}
                 </div>

                 {/* 3. Outcome Metrics */}
                 <div className={`grid grid-cols-2 gap-4 transition-opacity ${formData.colonizationPct !== 100 ? 'opacity-50 grayscale' : 'opacity-100'}`}>
                    <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                       <label className="block text-sm font-bold text-green-800 mb-1">Success Count</label>
                       <div className="flex items-center gap-2">
                          <Check size={20} className="text-green-600"/>
                          <input 
                            type="number" 
                            disabled={formData.colonizationPct !== 100}
                            className="w-full border-b-2 border-green-300 bg-transparent p-1 text-lg font-bold text-green-900 focus:outline-none focus:border-green-600 disabled:cursor-not-allowed" 
                            value={formData.successCount || ''} 
                            onChange={e => setFormData({...formData, successCount: Number(e.target.value)})} 
                            placeholder="0 Bags" 
                          />
                       </div>
                    </div>
                    <div className="bg-red-50 p-4 rounded-xl border border-red-200">
                       <label className="block text-sm font-bold text-red-800 mb-1">Failed / Contaminated</label>
                       <div className="flex items-center gap-2">
                          <AlertTriangle size={20} className="text-red-600"/>
                          <input 
                            type="number" 
                            disabled={formData.colonizationPct !== 100}
                            className="w-full border-b-2 border-red-300 bg-transparent p-1 text-lg font-bold text-red-900 focus:outline-none focus:border-red-600 disabled:cursor-not-allowed" 
                            value={formData.failCount || ''} 
                            onChange={e => setFormData({...formData, failCount: Number(e.target.value)})} 
                            placeholder="0 Bags" 
                          />
                       </div>
                    </div>
                 </div>
              </div>
            )}

            {/* --- STAGE C: SUBSTRATE --- */}
            {activeStage === ProductionStage.SUBSTRATE && (
              <div className="space-y-8">
                 {/* 1. Multi-Ingredient Input */}
                 <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                    <h4 className="text-xs font-bold text-gray-800 uppercase mb-4 flex items-center gap-2">
                        <Package size={16} className="text-gray-500" />
                        Mixing Formulation
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Base Substrate */}
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-gray-500 uppercase">Base Substrate</label>
                            <select 
                                className="w-full border rounded-lg p-2 text-sm bg-white"
                                onChange={e => setFormData({...formData, baseMaterialId: e.target.value})}
                                value={formData.baseMaterialId || ''}
                            >
                                <option value="">Select Base...</option>
                                {materials.filter(m => m.category === 'SUBSTRATES').map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                            <input 
                                type="number" placeholder="Qty (kg)"
                                className={`w-full border rounded-lg p-2 text-sm ${isStockInvalid(formData.baseMaterialId, formData.baseQty, 'baseQty') ? 'border-red-500 bg-red-50' : ''}`}
                                value={formData.baseQty || ''}
                                onChange={e => setFormData({...formData, baseQty: Number(e.target.value)})}
                            />
                            {renderStockBadge(formData.baseMaterialId, formData.baseQty, 'baseQty')}
                        </div>

                        {/* Supplement */}
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-gray-500 uppercase">Supplement</label>
                            <select 
                                className="w-full border rounded-lg p-2 text-sm bg-white"
                                onChange={e => setFormData({...formData, supplementId: e.target.value})}
                                value={formData.supplementId || ''}
                            >
                                <option value="">Select Supplement...</option>
                                {materials.filter(m => m.category === 'SUBSTRATES').map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                            <input 
                                type="number" placeholder="Qty (kg)"
                                className={`w-full border rounded-lg p-2 text-sm ${isStockInvalid(formData.supplementId, formData.suppQty, 'suppQty') ? 'border-red-500 bg-red-50' : ''}`}
                                value={formData.suppQty || ''}
                                onChange={e => setFormData({...formData, suppQty: Number(e.target.value)})}
                            />
                            {renderStockBadge(formData.supplementId, formData.suppQty, 'suppQty')}
                        </div>

                        {/* Additives */}
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-gray-500 uppercase">Additives</label>
                            <select 
                                className="w-full border rounded-lg p-2 text-sm bg-white"
                                onChange={e => setFormData({...formData, additiveId: e.target.value})}
                                value={formData.additiveId || ''}
                            >
                                <option value="">Select Additive...</option>
                                {/* CHANGE 3: Filter by CONSUMABLES */}
                                {materials.filter(m => m.category === MaterialCategory.CONSUMABLES).map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                            <input 
                                type="number" placeholder="Qty (kg)"
                                className={`w-full border rounded-lg p-2 text-sm ${isStockInvalid(formData.additiveId, formData.additiveQty, 'additiveQty') ? 'border-red-500 bg-red-50' : ''}`}
                                value={formData.additiveQty || ''}
                                onChange={e => setFormData({...formData, additiveQty: Number(e.target.value)})}
                            />
                            {renderStockBadge(formData.additiveId, formData.additiveQty, 'additiveQty')}
                        </div>
                    </div>
                 </div>
                 
                 {/* 2. Process Checklist */}
                 <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                         <BoxSelect size={16} /> Process Workflow
                    </h4>
                    
                    <div className="space-y-3">
                       {[
                         { id: 'cut', label: '1. Cut / Shred Material', icon: Scissors },
                         { id: 'wash', label: '2. Wash & Clean', icon: Droplets },
                         { id: 'soak', label: '3. Soak (12-18 hrs)', icon: Clock },
                         { id: 'pasteurize', label: '4. Pasteurization (Boil/Steam)', icon: Flame },
                         { id: 'cool', label: '5. Drain & Cool', icon: Wind }
                       ].map((step) => {
                          const isChecked = formData.checklist?.[step.id] || false;
                          const StepIcon = step.icon;
                          
                          return (
                            <label key={step.id} className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${isChecked ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200 hover:border-primary-300'}`}>
                               <div className="flex items-center gap-3">
                                   <div className={`p-2 rounded-full ${isChecked ? 'bg-green-200 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                                       <StepIcon size={16} />
                                   </div>
                                   <span className={`text-sm font-medium ${isChecked ? 'text-green-900' : 'text-gray-600'}`}>{step.label}</span>
                               </div>
                               <input 
                                 type="checkbox" 
                                 className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                                 checked={isChecked}
                                 onChange={(e) => {
                                    const current = formData.checklist || {};
                                    setFormData({...formData, checklist: {...current, [step.id]: e.target.checked }});
                                 }}
                               />
                            </label>
                          )
                       })}
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-4">
                        <div className="flex justify-between text-xs font-bold text-gray-500 mb-1">
                             <span>Progress</span>
                             <span>{Math.round((Object.values(formData.checklist || {}).filter(Boolean).length / 5) * 100)}%</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                             <div 
                               className="h-full bg-green-500 transition-all duration-500" 
                               style={{ width: `${(Object.values(formData.checklist || {}).filter(Boolean).length / 5) * 100}%` }}
                             ></div>
                        </div>
                    </div>
                    
                    {/* Completion Badge */}
                    {Object.values(formData.checklist || {}).filter(Boolean).length === 5 && (
                        <div className="mt-4 p-3 bg-green-100 text-green-800 rounded-lg text-sm font-bold text-center border border-green-200 flex items-center justify-center gap-2 animate-pulse">
                            <Check size={18} /> Ready for Inoculation
                        </div>
                    )}
                 </div>
              </div>
            )}

             {/* --- STAGE D: INOCULATION --- */}
             {activeStage === ProductionStage.INOCULATION && (
                <div className="space-y-6">
                  {/* 1. Batch Composition Dashboard */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-5 rounded-xl shadow-sm">
                      <div className="flex items-center gap-2 mb-4 border-b border-blue-200 pb-2">
                          <PieChart size={18} className="text-blue-600" />
                          <h3 className="font-bold text-blue-900 text-sm uppercase tracking-wide">Batch Composition Summary</h3>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-6 text-center divide-x divide-blue-200">
                          <div>
                              <div className="text-xs font-bold text-blue-500 uppercase mb-1">Source A (Spawn)</div>
                              <div className="text-2xl font-bold text-gray-800">{inoculationSummary?.spawnCount || 0}</div>
                              <div className="text-[10px] text-gray-500">Colonzied Bags Ready</div>
                          </div>
                          <div>
                              <div className="text-xs font-bold text-blue-500 uppercase mb-1">Source B (Substrate)</div>
                              <div className="text-2xl font-bold text-gray-800">{inoculationSummary?.substrateKg || 0} <span className="text-sm font-normal text-gray-500">kg</span></div>
                              <div className="text-[10px] text-gray-500">Prepared Bulk Material</div>
                          </div>
                          <div>
                              <div className="text-xs font-bold text-blue-500 uppercase mb-1">Mixing Ratio</div>
                              <div className="text-lg font-bold text-indigo-600 mt-1">
                                  {inoculationSummary && inoculationSummary.substrateKg > 0 
                                     ? `${((inoculationSummary.spawnCount * 1.5 / (inoculationSummary.substrateKg + (inoculationSummary.spawnCount * 1.5))) * 100).toFixed(0)}% : ${((inoculationSummary.substrateKg / (inoculationSummary.substrateKg + (inoculationSummary.spawnCount * 1.5))) * 100).toFixed(0)}%`
                                     : 'N/A'
                                  }
                              </div>
                              <div className="text-[10px] text-gray-500">Spawn : Substrate</div>
                          </div>
                      </div>
                  </div>

                  {/* 2. Material Consumption (Packaging) */}
                  <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                    <h4 className="text-xs font-bold text-gray-800 uppercase mb-4 flex items-center gap-2">
                        <Package size={16} className="text-gray-500" />
                        Packaging Materials
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-gray-500 uppercase">Fruiting Bags</label>
                            <select 
                                className="w-full border rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-primary-500 outline-none" 
                                onChange={e => setFormData({...formData, inoculationBagId: e.target.value})}
                                value={formData.inoculationBagId || ''}
                            >
                                <option value="">Select Bag Type...</option>
                                {materials.filter(m => m.category === 'PACKAGING').map(m => (
                                    <option key={m.id} value={m.id}>
                                        {m.name} [Stock: {getInventoryQty(m.id)}]
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                             <div className="flex justify-between items-center mb-1">
                                <label className="block text-xs font-bold text-gray-500 uppercase">Qty Used</label>
                                {renderStockBadge(formData.inoculationBagId, formData.inoculationBagQty, 'inoculationBagQty')}
                             </div>
                             <input 
                                type="number" 
                                className={`w-full border rounded-lg p-2 text-sm ${isStockInvalid(formData.inoculationBagId, formData.inoculationBagQty, 'inoculationBagQty') ? 'border-red-500 bg-red-50' : ''}`}
                                placeholder="0"
                                value={formData.inoculationBagQty || ''}
                                onChange={e => setFormData({...formData, inoculationBagQty: Number(e.target.value)})}
                            />
                        </div>
                    </div>
                  </div>

                  {/* 3. Production Output */}
                  <div className="space-y-4">
                      <div className="p-3 bg-blue-50 border border-blue-100 rounded text-sm text-blue-800 flex items-center gap-2">
                         <Info size={16} /> 
                         <strong>Note:</strong> Spawn and Substrate usage is automatically linked from previous stages.
                      </div>
                      
                      <div className="bg-white p-6 rounded-xl border-2 border-primary-100 shadow-sm text-center">
                          <label className="block text-sm font-bold text-primary-900 uppercase mb-2">Total Mushroom Blocks Packed</label>
                          <div className="flex justify-center items-center gap-3">
                              <Layers size={32} className="text-primary-500" />
                              <input 
                                type="number" 
                                className="w-40 text-center text-3xl font-bold border-b-2 border-primary-300 focus:border-primary-600 outline-none text-gray-800" 
                                value={formData.bagsPacked || ''} 
                                onChange={e => setFormData({...formData, bagsPacked: Number(e.target.value)})} 
                                placeholder="0"
                              />
                          </div>
                          <p className="text-xs text-gray-400 mt-2">This count will generate individual tracking IDs.</p>
                      </div>
                  </div>
                </div>
             )}

            {/* Action Footer */}
            <div className="mt-8 pt-6 border-t flex justify-between items-center">
               <div className="text-xs text-gray-400 italic">
                 {editingId ? `Editing Log: ${editingId}` : 'Create new entry below to add to history'}
               </div>
               <button 
                 onClick={handleSaveLog}
                 disabled={isAnyInputInvalid()}
                 className={`px-8 py-3 rounded-lg font-bold flex items-center gap-2 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 ${
                    isAnyInputInvalid()
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-primary-600 text-white hover:bg-primary-700'
                 }`}
               >
                 <Save size={18} /> {editingId ? 'Update Record' : 'Save Record'}
               </button>
            </div>
          </div>
          )
          )}

          {/* HISTORY SECTION (Shared across all stages) */}
          <div className="space-y-4">
             <div className="flex items-center gap-2 text-gray-500 uppercase text-xs font-bold tracking-wider ml-1 mb-2">
                 <Clock size={14} /> {activeStage === ProductionStage.FRUITING ? 'Observations History' : activeStage === ProductionStage.HARVEST ? 'Harvest History' : 'Production History'}
             </div>
             
             {logs.length === 0 ? (
                 <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl text-gray-400">
                     <Clock size={40} className="mx-auto mb-3 opacity-20" />
                     <p>No history records found for this stage.</p>
                 </div>
             ) : (
                 logs.map((log) => (
                     <div key={log.id} className={`group relative bg-white rounded-xl border p-5 transition-all duration-200 ${editingId === log.id ? 'border-primary-500 shadow-md ring-1 ring-primary-500' : 'border-gray-200 hover:border-primary-300 hover:shadow-sm'}`}>
                         
                         {/* Edit Button (Absolute Top Right) */}
                         {!isReadOnly && activeStage !== ProductionStage.FRUITING && activeStage !== ProductionStage.HARVEST && (
                         <div className="absolute top-4 right-4">
                             <button 
                                 onClick={() => handleEditClick(log)}
                                 className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold ${editingId === log.id ? 'bg-primary-100 text-primary-700' : 'bg-gray-50 text-gray-500 hover:bg-white hover:text-primary-600 hover:shadow-sm border border-transparent hover:border-gray-200'}`}
                             >
                                 {editingId === log.id ? <span className="flex items-center gap-1">Editing <Edit2 size={12}/></span> : <Edit2 size={14} />}
                             </button>
                         </div>
                         )}
    
                         <div className="flex-1">
                             {/* Header: Date & ID */}
                             <div className="mb-4 pr-20"> 
                                 <div className="flex items-center gap-3">
                                     {(activeStage === ProductionStage.FRUITING || activeStage === ProductionStage.HARVEST) && (
                                        <>
                                             {log.flushNumber && (
                                                 <span className="flex items-center justify-center px-2 py-1 rounded bg-indigo-100 text-indigo-700 text-xs font-bold">
                                                     Flush {log.flushNumber}
                                                 </span>
                                             )}
                                        </>
                                     )}
                                     <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-100 text-gray-600 text-xs font-medium">
                                         <Calendar size={12} className="text-gray-400" /> 
                                         {new Date(log.dateStarted || log.date || log.harvestDate).toLocaleDateString()}
                                     </span>
                                     <span className="text-xs font-mono text-gray-300">#{log.id}</span>
                                 </div>
                             </div>
                             
                             <div className="grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-6">
                                 {/* Content tailored by Stage */}
                                 {activeStage === ProductionStage.CULTURE && (
                                     <>
                                         <DetailItem label="Source Culture" value={getMaterialName(log.cultureMaterialId)} subtext={`${log.cultureQty} units`} />
                                         <DetailItem label="Container" value={getMaterialName(log.dishMaterialId)} subtext={`${log.dishQty} pcs`} />
                                         <DetailItem label="Production" value={`${log.platesProduced} Plates`} />
                                         <DetailItem label="Health" value={<span className="text-green-600">{log.platesProduced - (log.platesContaminated||0)} Good</span>} subtext={`${log.platesContaminated||0} Contaminated`} />
                                     </>
                                 )}
                                 {activeStage === ProductionStage.SPAWN && (
                                     <>
                                         <DetailItem label="Grain" value={getMaterialName(log.grainMaterialId || log.materialId)} subtext={`${log.grainQty || 0} kg`} />
                                         <DetailItem label="Bags" value={getMaterialName(log.bagMaterialId)} subtext={`${log.bagQty || 0} pcs`} />
                                         <DetailItem label="Progress" value={`${log.colonizationPct}%`} />
                                         <div className="col-span-1 md:col-span-2 grid grid-cols-2 gap-2 mt-1">
                                             <div className="bg-green-50 text-green-700 text-xs p-1 rounded text-center border border-green-200">
                                                <strong>{log.successCount || 0}</strong> Success
                                             </div>
                                             <div className="bg-red-50 text-red-700 text-xs p-1 rounded text-center border border-red-200">
                                                <strong>{log.failCount || 0}</strong> Fail
                                             </div>
                                         </div>
                                     </>
                                 )}
                                 {activeStage === ProductionStage.SUBSTRATE && (
                                     <>
                                         <DetailItem label="Base" value={getMaterialName(log.baseMaterialId)} subtext={`${log.baseQty} kg`} />
                                         <DetailItem label="Supplement" value={getMaterialName(log.supplementId)} subtext={`${log.suppQty} kg`} />
                                         <DetailItem label="Additive" value={getMaterialName(log.additiveId)} subtext={`${log.additiveQty} kg`} />
                                         <DetailItem label="Prep Status" value={`${Math.round((Object.values(log.checklist || {}).filter(Boolean).length / 5) * 100)}% Complete`} subtext={`${Object.values(log.checklist || {}).filter(Boolean).length}/5 Steps`} />
                                     </>
                                 )}
                                 {activeStage === ProductionStage.INOCULATION && (
                                     <>
                                         <DetailItem label="Bags Used" value={getMaterialName(log.inoculationBagId)} subtext={`${log.inoculationBagQty} pcs`} />
                                         <div className="col-span-2">
                                             <DetailItem label="Total Blocks Packed" value={<span className="text-lg text-primary-700 font-bold">{log.bagsPacked} Units</span>} />
                                             <span className="text-[10px] text-gray-400">Generated IDs: {log.id} series</span>
                                         </div>
                                     </>
                                 )}
                                 {activeStage === ProductionStage.INCUBATION && (
                                     <>
                                         <DetailItem label="Room No." value={log.roomNo} />
                                         <DetailItem label="Status" value={log.status} />
                                         <DetailItem label="Outcome" value={`${log.successCount || 0} Success`} subtext={`${log.failCount || 0} Failed`} />
                                     </>
                                 )}
                                 {activeStage === ProductionStage.FRUITING && (
                                     <>
                                         <DetailItem label="Diameter" value={`${log.avgDiameter} cm`} />
                                         <DetailItem label="Shape" value={log.shape} />
                                         <DetailItem label="Maturity" value={<span className="font-bold text-gray-800">{log.maturityIndex}%</span>} />
                                         <div className="col-span-1">
                                             <DetailItem label="Sample Size" value={log.sampleSize || 1} />
                                         </div>
                                     </>
                                 )}
                                 {activeStage === ProductionStage.HARVEST && (
                                     <>
                                         <DetailItem label="Grade A" value={`${log.gradeAYield} kg`} subtext="Good" />
                                         <DetailItem label="Grade B" value={`${log.gradeBYield} kg`} subtext="Damaged" />
                                         <DetailItem label="Total Yield" value={<span className="font-bold text-green-700 text-lg">{log.totalYield} kg</span>} />
                                         <DetailItem label="Action" value={<span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs border">{log.action}</span>} />
                                     </>
                                 )}
                             </div>
                         </div>
                     </div>
                 ))
             )}
          </div>

        </div>

        {/* RIGHT COLUMN: Smart Notes */}
        <div className="lg:col-span-1">
           <div className="sticky top-6">
             <SmartNotes batchId={selectedBatchId} stage={activeStage} user={user} readOnly={isReadOnly} />
           </div>
        </div>

      </div>

      {/* --- MODAL RENDER --- */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 transform transition-all scale-100">
                <h3 className={`text-lg font-bold mb-2 ${modalConfig.type === 'CONFIRM' ? 'text-red-600' : 'text-gray-800'}`}>
                    {modalConfig.title}
                </h3>
                <p className="text-gray-600 mb-6 text-sm whitespace-pre-line">
                    {modalConfig.message}
                </p>
                <div className="flex justify-end gap-3">
                    {modalConfig.type === 'CONFIRM' && (
                        <button 
                            onClick={() => setModalConfig(prev => ({...prev, isOpen: false}))}
                            className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg font-medium text-sm"
                        >
                            Cancel
                        </button>
                    )}
                    <button 
                        onClick={() => {
                            if (modalConfig.onConfirm) modalConfig.onConfirm();
                            setModalConfig(prev => ({...prev, isOpen: false}));
                        }}
                        className={`px-4 py-2 rounded-lg font-medium text-sm text-white shadow-sm ${
                            modalConfig.type === 'CONFIRM' ? 'bg-red-600 hover:bg-red-700' : 'bg-primary-600 hover:bg-primary-700'
                        }`}
                    >
                        {modalConfig.type === 'CONFIRM' ? 'Confirm' : 'Okay'}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};