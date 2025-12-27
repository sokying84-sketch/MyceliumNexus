import { 
  User, Entity, RegistryRecord, Material, Vendor, InventoryRecord, 
  InventoryTransaction, Batch, PurchaseRequest, PurchaseOrder, GRN, 
  PaymentVoucher, ActivityLog, SmartNote, Sensor, ChamberConfig,
  BatchItem, FruitingLog, HarvestLog, DailyObservation,
  SpawnLog, SubstrateLog, InoculationLog, IncubationLog, CultureLog,
  BatchFinancials, PricingStrategy, SalesOrder, DeliveryOrder, Role, EntityType,
  InventoryMovementType, BatchStatus
} from '../types';
import { db } from '../firebase';
import { 
  collection, doc, setDoc, deleteDoc, onSnapshot, query, where, 
  writeBatch, Unsubscribe, getDocs, getDoc 
} from 'firebase/firestore';

const STORAGE_KEYS = {
  USERS: 'mn_users',
  ENTITIES: 'mn_entities',
  REGISTRY: 'mn_registry',
  MATERIALS: 'mn_materials',
  VENDORS: 'mn_vendors',
  INVENTORY: 'mn_inventory',
  TRANSACTIONS: 'mn_transactions',
  BATCHES: 'mn_batches',
  PRS: 'mn_prs',
  POS: 'mn_pos',
  GRNS: 'mn_grns',
  PAYMENTS: 'mn_payments',
  ACTIVITY: 'mn_activity',
  SMART_NOTES: 'mn_smart_notes',
  SENSORS: 'mn_sensors',
  CHAMBER_CONFIGS: 'mn_chamber_configs',
  FINANCIALS: 'mn_financials',
  PRICING_STRATEGIES: 'mn_pricing_strategies',
  SALES_ORDERS: 'mn_sales_orders',
  DELIVERY_ORDERS: 'mn_delivery_orders',
  
  LOGS_CULTURE: 'mn_logs_culture',
  LOGS_SPAWN: 'mn_logs_spawn',
  LOGS_SUBSTRATE: 'mn_logs_substrate',
  LOGS_INOCULATION: 'mn_logs_inoculation',
  LOGS_INCUBATION: 'mn_logs_incubation',
  LOGS_FRUITING: 'mn_logs_fruiting',
  LOGS_OBSERVATIONS: 'mn_logs_observations',
  LOGS_HARVEST: 'mn_logs_harvest',
  
  ITEMS_BATCH: 'mn_items_batch',
  ITEMS_FRUITING: 'mn_items_fruiting'
};

// Internal Event Emitter for UI Updates
type Listener = () => void;
const listeners: Listener[] = [];
const notifyListeners = () => listeners.forEach(l => l());

// Store active Firestore subscriptions
let activeUnsubscribes: Unsubscribe[] = [];

// Helper for local storage access (Read Cache)
const getCollection = <T>(key: string): T[] => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
};

const saveCollection = <T>(key: string, data: T[]) => {
  localStorage.setItem(key, JSON.stringify(data));
};

export class StorageService {
  static getKeys() { return STORAGE_KEYS; }

  // --- Subscription & Sync ---

  static subscribe(callback: Listener) {
    listeners.push(callback);
    return () => {
      const idx = listeners.indexOf(callback);
      if (idx > -1) listeners.splice(idx, 1);
    };
  }

  static initializeSync(entityId: string) {
    // Clear old subscriptions
    activeUnsubscribes.forEach(unsub => unsub());
    activeUnsubscribes = [];

    if (!entityId) return;

    // Subscribe to all collections relevant to this entity
    Object.values(STORAGE_KEYS).forEach(collectionName => {
      let q;

      if (collectionName === STORAGE_KEYS.ENTITIES) {
        q = query(collection(db, collectionName), where("id", "==", entityId));
      } else {
        q = query(collection(db, collectionName), where("entityId", "==", entityId));
      }
      
      const unsub = onSnapshot(q, (snapshot) => {
        const items: any[] = [];
        snapshot.forEach(doc => {
          items.push(doc.data());
        });
        saveCollection(collectionName, items);
        notifyListeners();
      }, (error) => {
        console.error(`Sync error for ${collectionName}:`, error);
      });

      activeUnsubscribes.push(unsub);
    });
  }

  // --- CRUD Operations (Write to Firestore) ---

  static getAll<T>(key: string, entityId?: string): T[] {
    const all = getCollection<T & { entityId: string }>(key);
    if (entityId) {
      return all.filter(item => item.entityId === entityId);
    }
    return all;
  }

  static async add<T extends { id: string }>(key: string, item: T) {
    try {
      await setDoc(doc(db, key, item.id), item);
    } catch (e) {
      console.error("Error adding document:", e);
      throw e;
    }
  }

  static async update<T extends { id: string }>(key: string, item: T) {
    try {
      await setDoc(doc(db, key, item.id), item, { merge: true });
    } catch (e) {
      console.error("Error updating document:", e);
      throw e;
    }
  }

  static async remove(key: string, id: string) {
    try {
      await deleteDoc(doc(db, key, id));
    } catch (e) {
      console.error("Error deleting document:", e);
      throw e;
    }
  }

  // --- Specialized Methods ---

  static getInventory(entityId: string, materialId: string): number {
    const inv = this.getAll<InventoryRecord>(STORAGE_KEYS.INVENTORY, entityId);
    const item = inv.find(i => i.materialId === materialId);
    return item ? item.quantityOnHand : 0;
  }
  
  static getTransactions(entityId: string): InventoryTransaction[] {
      return this.getAll<InventoryTransaction>(STORAGE_KEYS.TRANSACTIONS, entityId).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  static getActivities(entityId: string): ActivityLog[] {
      return this.getAll<ActivityLog>(STORAGE_KEYS.ACTIVITY, entityId).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
  
  static logActivity(entityId: string, user: User, action: string, details: string) {
      this.add(STORAGE_KEYS.ACTIVITY, {
          id: `log_${Date.now()}`,
          entityId,
          userId: user.id,
          userName: user.name,
          action,
          details,
          timestamp: new Date().toISOString()
      });
  }

  // --- Auth & Setup ---

  static async createWorkspace(data: { entityName: string, accessPassword: string }) {
      const newEntityId = `ent_${Date.now()}`;
      const newEntity: Entity = {
          id: newEntityId,
          name: data.entityName,
          type: EntityType.FARM,
          ownerId: 'pending' 
      };
      
      const registry: RegistryRecord = {
          entityId: newEntityId,
          entityName: data.entityName,
          accessPassword: data.accessPassword,
          dbUrl: 'firebase',
          dbSheetId: 'firebase',
          registeredAt: new Date().toISOString()
      };
      
      await setDoc(doc(db, STORAGE_KEYS.ENTITIES, newEntity.id), newEntity);
      await setDoc(doc(db, STORAGE_KEYS.REGISTRY, registry.entityId), registry);

      localStorage.setItem('mn_pending_creation_id', newEntityId);

      await this.seedDefaultData(newEntityId);
      
      return newEntity;
  }

  // --- UPDATED REGISTER USER METHOD ---
// --- ROBUST REGISTER USER METHOD ---
  static async registerUser(data: any): Promise<User> {
      const userId = `usr_${Date.now()}`;
      
      // LOGGING: Check your browser console to see exactly what is being passed!
      console.log("Registering User Payload:", data);

      let finalEntityId = null;

      // 1. SCENARIO A: The user just created a farm (Owner)
      const cachedId = localStorage.getItem('mn_pending_creation_id');
      if (cachedId) {
          finalEntityId = cachedId;
      }

      // 2. SCENARIO B: The user is joining an existing farm (Employee)
      // flexible check for field names (entityName OR farmName)
      const targetFarmName = (data.entityName || data.farmName || "").trim(); 
      const targetFarmPass = (data.accessPassword || data.farmPassword || "").trim();

      if (!finalEntityId && targetFarmName && targetFarmPass) {
          console.log(`Searching for farm: '${targetFarmName}' with pass: '${targetFarmPass}'`);
          
          // Query ONLY by name first to debug easier (and handle case issues better)
          const registryQuery = query(
              collection(db, STORAGE_KEYS.REGISTRY),
              where("entityName", "==", targetFarmName)
          );

          const snapshot = await getDocs(registryQuery);

          if (!snapshot.empty) {
              const registryData = snapshot.docs[0].data() as RegistryRecord;
              
              // Now check password manually
              // Note: In production, passwords should be hashed, but for this prototype strict string match is fine
              if (String(registryData.accessPassword).trim() === targetFarmPass) {
                  finalEntityId = registryData.entityId;
                  console.log("Farm Match Found:", finalEntityId);
              } else {
                  throw new Error("Registration Failed: Incorrect Farm Password.");
              }
          } else {
              throw new Error(`Registration Failed: Farm '${targetFarmName}' not found. Check spelling exactly.`);
          }
      }

      // 3. FALLBACK CHECK
      if (!finalEntityId) {
          // If we are here, it means we aren't creating a farm, 
          // AND we failed to find a farm to join.
          // Do NOT proceed.
          throw new Error("Registration Failed: No valid Farm ID linked. Please ensure you entered the correct Farm Name and Password.");
      }

      // 4. Create the User
      const newUser: User = {
          id: userId,
          name: data.name,
          email: data.email,
          password: data.password,
          role: Role.WORKER, // Default to WORKER for joiners. Change to ADMIN manually in DB if needed.
          entityId: finalEntityId, 
          active: true
      };
      
      await this.add(STORAGE_KEYS.USERS, newUser);

      // 5. If this was an Owner registration (cached ID), make them ADMIN and Owner
      if (cachedId === finalEntityId) {
          newUser.role = Role.ADMIN;
          // Update the user record we just wrote to be Admin
          await setDoc(doc(db, STORAGE_KEYS.USERS, newUser.id), newUser);
          
          try {
              const entityRef = doc(db, STORAGE_KEYS.ENTITIES, finalEntityId);
              await setDoc(entityRef, { ownerId: userId }, { merge: true });
              localStorage.removeItem('mn_pending_creation_id');
          } catch (e) {
              console.warn("Could not update entity owner:", e);
          }
      }
      
      localStorage.setItem('mn_session', JSON.stringify(newUser));
      return newUser;
  }
  
  static async login(email: string, pass: string): Promise<User | null> {
      try {
          const q = query(
            collection(db, STORAGE_KEYS.USERS), 
            where("email", "==", email), 
            where("password", "==", pass)
          );
          
          const snapshot = await getDocs(q);

          if (!snapshot.empty) {
              const user = snapshot.docs[0].data() as User;
              // Validate that the entity still exists
              const entityRef = doc(db, STORAGE_KEYS.ENTITIES, user.entityId);
              const entitySnap = await getDoc(entityRef);
              
              if (!entitySnap.exists()) {
                 console.warn("Farm entity not found for this user.");
                 // You might want to throw an error here or handle it specifically
              }

              localStorage.setItem('mn_session', JSON.stringify(user));
              this.initializeSync(user.entityId);
              return user;
          }
          
          return null;
      } catch (error) {
          console.error("Login failed", error);
          return null;
      }
  }
  
  static disconnectFarm() {
      localStorage.removeItem('mn_session');
      localStorage.removeItem('mn_pending_creation_id');
      activeUnsubscribes.forEach(u => u());
      activeUnsubscribes = [];
  }
  
  static getConnectedFarmName(): string {
      const session = localStorage.getItem('mn_session');
      if (session) {
          const user = JSON.parse(session);
          const entities = getCollection<Entity>(STORAGE_KEYS.ENTITIES) || []; 
          const ent = entities.find(e => String(e.id) === String(user.entityId));
          return ent ? ent.name : 'Unknown Farm'; 
      }
      return 'Not Connected';
  }

  // --- Business Logic Helpers ---
  
  static generateBatchId(entityId: string): string {
      const date = new Date();
      const yy = date.getFullYear().toString().slice(-2);
      const mm = (date.getMonth() + 1).toString().padStart(2, '0');
      const prefix = `BT-${yy}-${mm}`;
      
      const batches = this.getAll<Batch>(STORAGE_KEYS.BATCHES, entityId);
      const count = batches.filter(b => b.id.startsWith(prefix)).length;
      
      return `${prefix}-${(count + 1).toString().padStart(3, '0')}`;
  }

  static getReservedStockDetails(entityId: string, materialId: string, excludePrId?: string) {
      const prs = this.getAll<PurchaseRequest>(STORAGE_KEYS.PRS, entityId);
      return prs
          .filter(pr => pr.materialId === materialId && pr.status === 'STOCK_ALLOCATED' && pr.id !== excludePrId)
          .map(pr => ({ batchId: pr.batchId, qty: pr.requestedQty }));
  }

  static async updateStock(entityId: string, materialId: string, delta: number, transactionDetails: Partial<InventoryTransaction>) {
      const inventory = this.getAll<InventoryRecord>(STORAGE_KEYS.INVENTORY, entityId);
      let record = inventory.find(i => i.materialId === materialId);
      
      if (record) {
          await this.update(STORAGE_KEYS.INVENTORY, { ...record, quantityOnHand: record.quantityOnHand + delta });
      } else {
          await this.add(STORAGE_KEYS.INVENTORY, { 
              id: `${entityId}_${materialId}`, 
              entityId, 
              materialId, 
              quantityOnHand: delta, 
              location: 'Default' 
          });
      }
      
      await this.add(STORAGE_KEYS.TRANSACTIONS, {
          id: `tx_${Date.now()}_${Math.random().toString(36).substr(2,5)}`,
          entityId,
          materialId,
          quantityChange: delta,
          date: new Date().toISOString(),
          type: transactionDetails.type || InventoryMovementType.ADJUSTMENT,
          ...transactionDetails
      });
  }

  // --- Procurement Helpers ---
  
  static async createGRN(grn: GRN, user: User) {
      await this.add(STORAGE_KEYS.GRNS, grn);
      
      for (const item of grn.items) {
          if (item.acceptedQty > 0) {
              await this.updateStock(user.entityId, item.materialId, item.acceptedQty, {
                  type: InventoryMovementType.PROCUREMENT,
                  poId: grn.poId,
                  performedBy: user.name,
                  reason: `GRN: ${grn.id}`
              });
          }
      }

      const po = this.getAll<PurchaseOrder>(STORAGE_KEYS.POS, user.entityId).find(p => p.id === grn.poId);
      if (po) {
          await this.update(STORAGE_KEYS.POS, { ...po, status: 'RECEIVED' });
      }
  }

  static async processReplacement(grnId: string, itemIndex: number, qty: number, user: User) {
      const grns = this.getAll<GRN>(STORAGE_KEYS.GRNS, user.entityId);
      const grn = grns.find(g => g.id === grnId);
      if (!grn) throw new Error("GRN not found");
      
      grn.items[itemIndex].replacementReceived = true;
      await this.update(STORAGE_KEYS.GRNS, grn);
      
      await this.updateStock(user.entityId, grn.items[itemIndex].materialId, qty, {
          type: InventoryMovementType.REPLACEMENT,
          poId: grn.poId,
          performedBy: user.name,
          reason: `Replacement for GRN ${grnId}`
      });
  }
  
  static async createPayment(payment: PaymentVoucher, user: User) {
      await this.add(STORAGE_KEYS.PAYMENTS, payment);
      
      const po = this.getAll<PurchaseOrder>(STORAGE_KEYS.POS, user.entityId).find(p => p.id === payment.poId);
      if (po) {
          const newStatus = payment.amount >= po.totalAmount ? 'PAID' : 'PARTIAL_PAID';
          await this.update(STORAGE_KEYS.POS, { ...po, status: newStatus });
      }
  }

  // --- Production Logic ---
  
  static async addSmartNote(note: SmartNote) {
      await this.add(STORAGE_KEYS.SMART_NOTES, note);
  }
  
  static getSmartNotes(batchId: string, stage: string): SmartNote[] {
      return this.getAll<SmartNote>(STORAGE_KEYS.SMART_NOTES).filter(n => n.batchId === batchId && n.stage === stage);
  }

  static generateBatchItems(batchId: string, entityId: string, count: number): number {
      const batchWrite = writeBatch(db);
      
      for (let i = 0; i < count; i++) {
          const seq = (i + 1).toString().padStart(3, '0');
          const id = `${batchId}-${seq}`;
          const ref = doc(db, STORAGE_KEYS.ITEMS_BATCH, id);
          batchWrite.set(ref, {
              id,
              batchId,
              entityId,
              status: 'INOCULATED',
              dateCreated: new Date().toISOString()
          });
      }
      
      batchWrite.commit();
      return count;
  }
  
  static bulkUpdateBatchItemStatus(ids: string[], status: BatchItem['status']): number {
      const batchWrite = writeBatch(db);
      ids.forEach(id => {
          const ref = doc(db, STORAGE_KEYS.ITEMS_BATCH, id);
          batchWrite.update(ref, { status });
      });
      batchWrite.commit();
      return ids.length;
  }

  static async startFruitingFlush(batchId: string, entityId: string, roomNo: string, bagCount: number) {
      const log: FruitingLog = {
          id: `frt_${batchId}_${Date.now()}`,
          batchId,
          entityId,
          roomNo,
          dateStarted: new Date().toISOString()
      };
      await this.add(STORAGE_KEYS.LOGS_FRUITING, log);
  }

  static async updateBatchStatus(batchId: string, status: string) {
      const batch = this.getAll<Batch>(STORAGE_KEYS.BATCHES).find(b => b.id === batchId);
      if (batch) {
          await this.update(STORAGE_KEYS.BATCHES, { ...batch, status: status as any });
      }
  }
  
  static async processHarvest(log: HarvestLog, action: 'NEXT_FLUSH' | 'DISPOSE') {
      await this.add(STORAGE_KEYS.LOGS_HARVEST, log);
      
      const batch = this.getAll<Batch>(STORAGE_KEYS.BATCHES).find(b => b.id === log.batchId);
      if (batch) {
          const updates: Partial<Batch> = {
              actualYield: (batch.actualYield || 0) + log.totalYield
          };
          
          if (action === 'DISPOSE') {
              updates.status = BatchStatus.COMPLETED;
              updates.endDate = log.harvestDate;
          } else {
              updates.currentFlush = (batch.currentFlush || 1) + 1;
              const items = this.getAll<BatchItem>(STORAGE_KEYS.ITEMS_BATCH).filter(i => i.batchId === batch.id && i.status.startsWith('FRUITING'));
              const ids = items.map(i => i.id);
              this.bulkUpdateBatchItemStatus(ids, 'READY_TO_FRUIT');
          }
          await this.update(STORAGE_KEYS.BATCHES, { ...batch, ...updates });
      }
  }

  // --- Financials ---

  static getBatchFinancials(entityId: string, batchId: string): BatchFinancials | undefined {
      return this.getAll<BatchFinancials>(STORAGE_KEYS.FINANCIALS, entityId).find(f => f.batchId === batchId);
  }

  static async saveBatchFinancials(financials: BatchFinancials) {
      const exists = this.getBatchFinancials(financials.entityId, financials.batchId);
      if (exists) {
          await this.update(STORAGE_KEYS.FINANCIALS, financials);
      } else {
          await this.add(STORAGE_KEYS.FINANCIALS, financials);
      }
  }

  static async savePricingStrategy(strategy: PricingStrategy) {
      await this.add(STORAGE_KEYS.PRICING_STRATEGIES, strategy);
  }

  static getPricingStrategies(entityId: string, batchId?: string): PricingStrategy[] {
      const strategies = this.getAll<PricingStrategy>(STORAGE_KEYS.PRICING_STRATEGIES, entityId);
      return batchId ? strategies.filter(s => s.batchId === batchId) : strategies;
  }

  static async saveSalesOrder(order: SalesOrder) {
      await this.add(STORAGE_KEYS.SALES_ORDERS, order);
  }

  static async saveDeliveryOrder(order: DeliveryOrder) {
      await this.add(STORAGE_KEYS.DELIVERY_ORDERS, order);
  }

  static calculateBatchMaterialCost(entityId: string, batchId: string) {
      const transactions = this.getAll<InventoryTransaction>(STORAGE_KEYS.TRANSACTIONS, entityId);
      const materials = this.getAll<Material>(STORAGE_KEYS.MATERIALS, entityId);
      
      const batchTx = transactions.filter(t => 
          t.batchId === batchId && 
          (t.type === InventoryMovementType.CONSUMPTION || t.type === InventoryMovementType.ADJUSTMENT)
      );

      const summary: Record<string, number> = {};
      
      batchTx.forEach(t => {
          summary[t.materialId] = (summary[t.materialId] || 0) + t.quantityChange;
      });

      const items = Object.entries(summary)
          .map(([matId, netQty]) => {
              const qty = netQty < 0 ? Math.abs(netQty) : 0;
              if (qty === 0) return null; 
              const mat = materials.find(m => m.id === matId);
              const unitCost = mat ? mat.standardCost : 0;
              return { materialId: matId, qty, unitCost, totalCost: qty * unitCost };
          })
          .filter((item): item is { materialId: string, qty: number, unitCost: number, totalCost: number } => item !== null);

      return { items, total: items.reduce((sum, i) => sum + i.totalCost, 0) };
  }

  // --- IoT & Config ---

  static getSensors(entityId: string): Sensor[] {
      return this.getAll<Sensor>(STORAGE_KEYS.SENSORS, entityId);
  }
  
  static async saveSensor(sensor: Sensor) {
      const list = this.getSensors(sensor.entityId);
      if (list.find(s => s.id === sensor.id)) {
          await this.update(STORAGE_KEYS.SENSORS, sensor);
      } else {
          await this.add(STORAGE_KEYS.SENSORS, sensor);
      }
  }

  static getChamberConfig(entityId: string, room: string): ChamberConfig | undefined {
      return this.getAll<ChamberConfig>(STORAGE_KEYS.CHAMBER_CONFIGS, entityId).find(c => c.room === room);
  }

  static async saveChamberConfig(config: ChamberConfig) {
      const id = `cfg_${config.entityId}_${config.room.replace(/\s/g, '')}`;
      await setDoc(doc(db, STORAGE_KEYS.CHAMBER_CONFIGS, id), { ...config, id });
  }

  // --- Seeder ---
  private static async seedDefaultData(newEntityId: string) {
      const v1 = { id: `ven_1_${newEntityId}`, entityId: newEntityId, name: 'Global Ag Supplies', contactPerson: 'John Smith', email: 'sales@globalag.com', phone: '555-0101', paymentTerms: 'Net 30' };
      await this.add(STORAGE_KEYS.VENDORS, v1);
      
      const matRye = { id: `mat_1_${newEntityId}`, entityId: newEntityId, name: 'Organic Rye Grain', category: 'GRAINS', uom: 'KG', standardCost: 1.50, defaultVendorId: v1.id };
      await this.add(STORAGE_KEYS.MATERIALS, matRye as any);
      
      return true;
  }
}