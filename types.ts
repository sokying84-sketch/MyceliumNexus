

// User & Auth
export enum Role {
  ADMIN = 'ADMIN',
  WORKER = 'WORKER'
}

export enum EntityType {
  FARM = 'FARM',
  PROCESSOR = 'PROCESSOR'
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string; // New field for auth
  role: Role;
  entityId: string;
  active?: boolean; // New field
}

export interface Entity {
  id: string;
  name: string;
  type: EntityType;
  ownerId: string;
  dbUrl?: string;     // Linked Database URL
  dbSheetId?: string; // Linked Database Sheet ID
}

export interface RegistryRecord {
  entityId: string;
  entityName: string;
  accessPassword?: string; // Password to connect to this farm
  dbUrl: string;
  dbSheetId: string;
  registeredAt: string;
}

// System
export interface ActivityLog {
  id: string;
  entityId: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: string;
}

// Master Data
export enum MaterialCategory {
  GRAINS = 'GRAINS',
  SUBSTRATES = 'SUBSTRATES',
  CONSUMABLES = 'CONSUMABLES',
  CHEMICALS = 'CHEMICALS',
  SPECIES = 'SPECIES',
  PACKAGING = 'PACKAGING', // Added
  OTHER = 'OTHER',
  PETRI_DISH = 'PETRI_DISH', // Added
  AGAR = 'AGAR' // Added
}

export enum UnitOfMeasure {
  KG = 'KG',
  BAG = 'BAG',
  LITER = 'LITER',
  PCS = 'PCS',
  GRAM = 'GRAM' // Added
}

export interface Vendor {
  id: string;
  entityId: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  paymentTerms: string;
}

export interface Material {
  id: string;
  entityId: string;
  name: string;
  category: MaterialCategory;
  uom: string;
  defaultVendorId?: string;
  standardCost: number;
}

export interface InventoryRecord {
  id: string; // Added id
  materialId: string;
  entityId: string;
  quantityOnHand: number;
  location: string;
}

// Inventory Movements
export enum InventoryMovementType {
  PROCUREMENT = 'PROCUREMENT',
  CONSUMPTION = 'CONSUMPTION',
  ADJUSTMENT = 'ADJUSTMENT',
  INITIAL = 'INITIAL',
  REPLACEMENT = 'REPLACEMENT'
}

// Production & Lifecycle
export enum ProductionStage {
  CULTURE = 'CULTURE',
  SPAWN = 'SPAWN',
  SUBSTRATE = 'SUBSTRATE',
  INOCULATION = 'INOCULATION',
  INCUBATION = 'INCUBATION',
  FRUITING = 'FRUITING',
  HARVEST = 'HARVEST'
}

export interface InventoryTransaction {
  id: string;
  entityId: string;
  materialId: string;
  type: InventoryMovementType;
  quantityChange: number;
  batchId?: string; // For CONSUMPTION
  stage?: ProductionStage; // Added: To track which stage used it
  poId?: string;    // For PROCUREMENT
  reason?: string;  // For ADJUSTMENT
  date: string;
  performedBy: string;
}

export enum BatchStatus {
  PLANNING = 'PLANNING',
  CULTURE = 'CULTURE',
  SPAWN = 'SPAWN',
  SUBSTRATE = 'SUBSTRATE',
  INOCULATION = 'INOCULATION',
  INCUBATION = 'INCUBATION',
  FRUITING = 'FRUITING',
  HARVESTING = 'HARVESTING',
  COMPLETED = 'COMPLETED'
}

export interface BatchRecipeItem {
  materialId: string;
  requiredQty: number;
}

export interface Batch {
  id: string; // Format: BT-YY-MM-XXX
  entityId: string;
  
  // Planning Details
  species: string;
  location: string; // Deprecated single location, used as fallback or primary start location
  incubationLocation?: string; // New
  fruitingLocation?: string;   // New
  
  startDate: string; // Estimated Starting Date
  endDate?: string; // Actual Completion Date
  maturityDays: number; // Maturity Index in days
  targetYield: number; // kg
  
  // New Baseline Fields for Harvest Readiness
  baselineCapDiameter?: number; // cm
  baselineMaturationDays?: number; // days from pinning
  
  // New Yield Estimation Field
  estAvgWeightPerBlock?: number; // grams per block
  
  status: BatchStatus;
  recipe: BatchRecipeItem[]; // Batch Material Planning
  compositionNotes?: string; // New: Mixture ratio
  actualYield: number;
  totalCost?: number; // New: Accumulated cost for historical analysis
  notes: string;
  
  // Flush Tracking
  currentFlush?: number; // Default 1
}

// Procurement
export enum RequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  ORDERED = 'ORDERED',
  STOCK_ALLOCATED = 'STOCK_ALLOCATED'
}

export interface PurchaseRequest {
  id: string;
  entityId: string;
  requesterId: string;
  batchId: string;
  materialId: string;
  requestedQty: number; // Calculated: Target - Current Stock
  status: RequestStatus;
  dateCreated: string;
  adminNotes?: string;
}

export enum POStatus {
  PENDING_APPROVAL = 'PENDING_APPROVAL', 
  ISSUED = 'ISSUED', 
  RECEIVED = 'RECEIVED', 
  PAID = 'PAID',
  PARTIAL_PAID = 'PARTIAL_PAID'
}

export interface POLineItem {
  materialId: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface PurchaseOrder {
  id: string;
  entityId: string;
  vendorId: string;
  prIds: string[]; // Linked PRs
  items: POLineItem[]; // Snapshot of items
  totalAmount: number;
  status: POStatus;
  dateIssued: string;
  quotationUrl?: string; // URL or Base64 of the uploaded file
  paymentProofUrl?: string;
  createdBy: string;
}

export interface GRNItem {
  materialId: string;
  poQty: number;
  acceptedQty: number; // Good condition, added to stock
  rejectedQty: number; // Default/Damaged, not added to stock
  replacementReceived?: boolean; // New: Tracks if rejected items were replaced
}

export interface GRN {
  id: string;
  entityId: string;
  poId: string;
  supplierRef: string; // Supplier DO or Invoice Number
  proofUrl: string; // Uploaded DO/Invoice
  dateReceived: string;
  receivedBy: string;
  items: GRNItem[];
}

export interface PaymentVoucher {
  id: string;
  entityId: string;
  poId: string;
  grnId?: string; // Optional link if payment per delivery
  amount: number;
  date: string;
  method: string;
  reference: string; // Check no, transaction ID
  proofUrl?: string;
}

export type Language = 'en' | 'ms';

export interface TranslationDictionary {
  [key: string]: {
    en: string;
    ms: string;
  };
}

// --- New Production Types ---

export interface SmartNote {
  id: string;
  batchId: string;
  stage: ProductionStage;
  content: string;
  photoUrl?: string;
  userId: string;
  userName: string;
  timestamp: string;
}

export enum SpawnStatus {
  IN_PROGRESS = 'In-Progress',
  STAGE_1 = 'Stage 1 (Colonization)',
  STAGE_2 = 'Stage 2 (Maturation)',
  STAGE_3 = 'Stage 3 (Ready)'
}

export interface CultureLog {
  id: string;
  batchId: string;
  entityId: string;
  materialId: string; // Mother Culture (Primary Source)
  qtyUsed: number;
  platesProduced: number;
  platesContaminated: number;
  dateStarted: string;
  // Consumption Detail
  cultureMaterialId?: string;
  cultureQty?: number;
  dishMaterialId?: string;
  dishQty?: number;
  agarMaterialId?: string;
  agarQty?: number;
}

export interface SpawnLog {
  id: string;
  batchId: string;
  entityId: string;
  materialId: string; // Grain/Agar (Primary)
  status: string;
  successCount: number;
  failCount: number;
  dateStarted: string;
  colonizationPct?: number; // Added progress field
  // Consumption Detail
  grainMaterialId?: string;
  grainQty?: number;
  bagMaterialId?: string;
  bagQty?: number;
}

export interface SubstrateLog {
  id: string;
  batchId: string;
  entityId: string;
  materialId: string;
  checklist: Record<string, boolean>;
  statusPercentage: number;
  dateStarted: string;
  // Consumption Detail
  baseMaterialId?: string;
  baseQty?: number;
  supplementId?: string;
  suppQty?: number;
  additiveId?: string;
  additiveQty?: number;
}

export interface InoculationLog {
  id: string;
  batchId: string;
  entityId: string;
  spawnMaterialId: string;
  qtySpawn: number;
  substrateMaterialId: string;
  qtySubstrate: number;
  bagMaterialId?: string; // Consumable Bag
  bagQty?: number;
  bagsPacked: number;
  dateStarted: string;
}

export interface IncubationLog {
  id: string;
  batchId: string;
  entityId: string;
  roomNo: string;
  status: string;
  successCount: number; // Derived Healthy
  failCount: number;    // Derived Failed
  dateStarted: string;
  notes?: string;       // Delta description
  snapshot?: {          // Detailed breakdown
    inoculated: number;
    incubating: number;
    ready: number;
    contaminated: number;
    disposed: number;
  };
}

export interface FruitingLog {
  id: string;
  batchId: string;
  entityId: string;
  roomNo: string;
  dateStarted: string;
}

export interface FruitingItem {
  id: string;
  fruitingId: string;
  entityId: string;
  status: 'Good' | 'Contaminated' | 'Spent';
  maturityIndex: number;
}

export interface DailyObservation {
  id: string;
  batchId: string;
  entityId: string;
  date: string;
  pinningDate?: string;
  daysSincePinning: number;
  sampleSize: number; // Added
  avgDiameter: number;
  shape: 'CONVEX' | 'FLAT' | 'UPTURNED';
  maturityIndex: number;
  alertLevel: 'INFO' | 'WARNING' | 'CRITICAL';
  alertMessage: string;
  recordedBy: string;
  flushNumber?: number; // New: Track which flush
}

export interface HarvestLog {
  id: string;
  batchId: string;
  entityId: string;
  harvestDate: string;
  gradeAYield: number;
  gradeBYield: number;
  totalYield: number;
  action: string;
  flushNumber?: number; // New: Track which flush
}

// Track Individual Bags/Blocks
export type BatchItemStatus = 
  | 'INOCULATED' 
  | 'INCUBATING' 
  | 'READY_TO_FRUIT' 
  | 'FRUITING_PINNING' 
  | 'FRUITING_MATURING' 
  | 'FRUITING_READY' 
  | 'FRUITING_OVERMATURE' 
  | 'CONTAMINATED' 
  | 'DISPOSED'
  | 'FAILED'; // Added Exception Status

export interface BatchItem {
  id: string; // e.g., BT-2501-001
  batchId: string;
  entityId: string;
  status: BatchItemStatus;
  dateCreated: string;
  notes?: string;
}

// UI Type for Sampling
export interface SampleRow {
  id: string;
  blockId?: string;
  diameter: number;
  shape: 'CONVEX' | 'FLAT' | 'UPTURNED';
}

// --- IoT / Sensor Module Types ---

export type SensorType = 'DHT22 (Temp/Hum)' | 'CO2 Sensor' | 'Soil Moisture';
export type ChamberID = 'Chamber A' | 'Chamber B' | 'Unassigned';

export interface Sensor {
  id: string;
  entityId: string;
  type: SensorType;
  version: string;
  room: ChamberID;
  info?: string;
  registeredAt: string;
}

export interface ChamberConfig {
  entityId: string;
  room: ChamberID;
  targetTempMin: number;
  targetTempMax: number;
  targetHumMin: number;
  targetHumMax: number;
}

// --- Finance Module Types ---

export interface LaborCostItem {
  id: string;
  description: string; // e.g. "Harvester Wages"
  amount: number;
}

export interface OverheadCostItem {
  category: string; // e.g. "Electricity"
  amount: number;
}

export interface BatchFinancials {
  id: string; // Usually "fin_<batchId>"
  batchId: string;
  entityId: string;
  laborCosts: LaborCostItem[];
  overheadCosts: OverheadCostItem[];
  profitMarginPercent: number; // e.g. 30 for 30%
  lastUpdated: string;
}

// New: Individual Pricing Strategy Record
export interface PricingStrategy {
  id: string;
  entityId: string;
  batchId: string;
  strategyName: string; // e.g. "Standard Markup"
  dateCreated: string;
  totalCost: number;
  unitCost: number;
  profitMargin: number;
  sellingPrice: number;
  notes?: string;
  laborCosts?: LaborCostItem[];
  overheadCosts?: OverheadCostItem[];
}

// inside types.ts

export interface SalesOrder {
  id: string;
  entityId: string;
  batchId: string;
  pricingStrategyId: string;
  customerName: string;
  quantityKg: number;
  unitPrice: number;
  totalValue: number;
  date: string;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  
  // --- ADD THESE TWO LINES ---
  emailContent?: string;   // Optional field to store the email text
  billingStatus?: string;  // Optional field to track if sent
}

// --- Order Delivery (Logistics) ---
export type DeliveryStatus = 'PENDING' | 'CONFIRMED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';

export interface DeliveryOrder {
  id: string;
  entityId: string;
  batchId: string;
  species: string;
  estimatedYield: number; // Projected yield from system
  deliveryDate: string; // ISO String
  recipient: string; // "Village C Processing Community"
  status: DeliveryStatus;
  emailContent: string; // The stimulated email body
  createdAt: string;
  flushNumber?: number; // Added: Track which flush this order is for
}