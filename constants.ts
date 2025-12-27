
import { TranslationDictionary } from './types';

export const TRANSLATIONS: TranslationDictionary = {
  // General
  dashboard: { en: 'Dashboard', ms: 'Papan Pemuka' },
  logout: { en: 'Logout', ms: 'Log Keluar' },
  welcome: { en: 'Welcome', ms: 'Selamat Datang' },
  role: { en: 'Role', ms: 'Peranan' },
  // Modules
  masterData: { en: 'Master Data', ms: 'Data Induk' },
  production: { en: 'Production', ms: 'Pengeluaran' },
  batchLog: { en: 'Batch Log', ms: 'Log Kumpulan' }, // Added
  inventory: { en: 'Inventory', ms: 'Inventori' },
  procurement: { en: 'Procurement', ms: 'Perolehan' },
  people: { en: 'People', ms: 'Pengguna' },
  activity: { en: 'Activity Log', ms: 'Log Aktiviti' },
  connection: { en: 'DB Connection', ms: 'Sambungan Pangkalan Data' },
  environment: { en: 'Sensors & Control', ms: 'Penderia & Kawalan' }, // Added
  finance: { en: 'Finance & Sales', ms: 'Kewangan & Jualan' }, // Added
  delivery: { en: 'Order Delivery', ms: 'Penghantaran Pesanan' }, // Added
  // Actions
  create: { en: 'Create', ms: 'Cipta' },
  save: { en: 'Save', ms: 'Simpan' },
  cancel: { en: 'Cancel', ms: 'Batal' },
  approve: { en: 'Approve', ms: 'Lulus' },
  reject: { en: 'Reject', ms: 'Tolak' },
  edit: { en: 'Edit', ms: 'Sunting' },
  // Status
  pending: { en: 'Pending', ms: 'Tertunda' },
  approved: { en: 'Approved', ms: 'Diluluskan' },
  completed: { en: 'Completed', ms: 'Selesai' },
  active: { en: 'Active', ms: 'Aktif' },
  inactive: { en: 'Inactive', ms: 'Tidak Aktif' },
  // Specific
  material: { en: 'Material', ms: 'Bahan' },
  vendor: { en: 'Vendor', ms: 'Pembekal' },
  batch: { en: 'Batch', ms: 'Kumpulan' },
  purchaseRequest: { en: 'Purchase Request', ms: 'Permintaan Belian' },
  gapAnalysis: { en: 'Gap Analysis', ms: 'Analisis Jurang' },
  stockOnHand: { en: 'Stock On Hand', ms: 'Stok Di Tangan' },
  requiredQty: { en: 'Required Qty', ms: 'Kuantiti Diperlukan' },
};

export const MOCK_DELAY = 300; // Simulate network latency
