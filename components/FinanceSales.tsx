import React, { useState, useEffect } from 'react';
import { User, Batch, Material, BatchFinancials, LaborCostItem, OverheadCostItem, Role, PricingStrategy, SalesOrder, BatchStatus } from '../types';
import { StorageService } from '../services/storageService';
import { DollarSign, PieChart, TrendingUp, Users, Zap, Save, AlertCircle, Plus, Trash2, Calculator, ShoppingBag, List, ShoppingCart, CheckCircle, Tag, Package, Calendar, Printer, FileText, Mail, X, Paperclip, ExternalLink, Eye } from 'lucide-react';

interface Props {
  user: User;
}

const DEFAULT_OVERHEADS = [
  'Electricity', 'Water', 'Rent', 'Depreciation', 'Packaging', 'Logistics'
];

export const FinanceSales: React.FC<Props> = ({ user }) => {
  // --- PERSISTENT UI STATE ---
  const [activeTab, setActiveTab] = useState<'planning' | 'sales'>(() => {
      return (localStorage.getItem(`mn_finance_active_tab_${user.entityId}`) as 'planning' | 'sales') || 'planning';
  });

  const [selectedBatchId, setSelectedBatchId] = useState<string>(() => {
      return localStorage.getItem(`mn_finance_active_batch_${user.entityId}`) || '';
  });

  const [batches, setBatches] = useState<Batch[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  
  // Financial Planning State
  const [materialCosts, setMaterialCosts] = useState<{ materialId: string, qty: number, unitCost: number, totalCost: number }[]>([]);
  const [laborCosts, setLaborCosts] = useState<LaborCostItem[]>([]);
  const [overheadCosts, setOverheadCosts] = useState<OverheadCostItem[]>([]);
  const [profitMargin, setProfitMargin] = useState<number>(30);
  const [pricingStrategies, setPricingStrategies] = useState<PricingStrategy[]>([]);
  
  // Sales Execution State
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [salesForm, setSalesForm] = useState<{
      batchId: string;
      pricingStrategyId: string;
      quantityKg: number;
  }>({
      batchId: '',
      pricingStrategyId: '',
      quantityKg: 0
  });

  // Billing Alert States
  const [emailNotification, setEmailNotification] = useState<{ order: SalesOrder, content: string } | null>(null); // For Success Modal
  const [previewContent, setPreviewContent] = useState<{ order: SalesOrder, content: string } | null>(null); // For Preview Modal

  // New Labor Entry State
  const [newLaborDesc, setNewLaborDesc] = useState('');
  const [newLaborAmt, setNewLaborAmt] = useState('');

  const KEYS = StorageService.getKeys();

  // --- PERSISTENCE EFFECTS ---
  useEffect(() => {
      localStorage.setItem(`mn_finance_active_tab_${user.entityId}`, activeTab);
  }, [activeTab, user.entityId]);

  useEffect(() => {
      if (selectedBatchId) {
        localStorage.setItem(`mn_finance_active_batch_${user.entityId}`, selectedBatchId);
      }
  }, [selectedBatchId, user.entityId]);

  useEffect(() => {
    if (user.role !== Role.ADMIN) return;
    setBatches(StorageService.getAll<Batch>(KEYS.BATCHES, user.entityId));
    setMaterials(StorageService.getAll<Material>(KEYS.MATERIALS, user.entityId));
    setSalesOrders(StorageService.getAll<SalesOrder>(KEYS.SALES_ORDERS, user.entityId));
  }, [user]);

  useEffect(() => {
    if (selectedBatchId) {
      loadBatchFinancials();
      loadPricingStrategies();
    }
  }, [selectedBatchId]);

  const loadBatchFinancials = () => {
    const matCostData = StorageService.calculateBatchMaterialCost(user.entityId, selectedBatchId);
    setMaterialCosts(matCostData.items);

    const storedFin = StorageService.getBatchFinancials(user.entityId, selectedBatchId);
    
    if (storedFin) {
      setLaborCosts(storedFin.laborCosts);
      setOverheadCosts(storedFin.overheadCosts);
      setProfitMargin(storedFin.profitMarginPercent);
    } else {
      setLaborCosts([]);
      setOverheadCosts(DEFAULT_OVERHEADS.map(cat => ({ category: cat, amount: 0 })));
      setProfitMargin(30);
    }
  };

  const loadPricingStrategies = () => {
      setPricingStrategies(StorageService.getPricingStrategies(user.entityId, selectedBatchId));
  };

  const handleSaveFinancials = async () => {
    if (!selectedBatchId) return;

    const totalMaterial = materialCosts.reduce((acc, i) => acc + i.totalCost, 0);
    const totalLabor = laborCosts.reduce((acc, i) => acc + i.amount, 0);
    const totalOverhead = overheadCosts.reduce((acc, i) => acc + i.amount, 0);
    const totalCost = totalMaterial + totalLabor + totalOverhead;

    const batch = batches.find(b => b.id === selectedBatchId);
    const actualYield = batch?.actualYield || 0;
    const unitCost = actualYield > 0 ? totalCost / actualYield : 0;
    const sellingPrice = unitCost * (1 + profitMargin / 100);

    // Save Working State
    const record: BatchFinancials = {
      id: `fin_${selectedBatchId}`,
      batchId: selectedBatchId,
      entityId: user.entityId,
      laborCosts,
      overheadCosts,
      profitMarginPercent: profitMargin,
      lastUpdated: new Date().toISOString()
    };
    await StorageService.saveBatchFinancials(record);

    // Create Pricing Strategy Snapshot
    const strategy: PricingStrategy = {
        id: `PS-${Date.now().toString().slice(-6)}`,
        entityId: user.entityId,
        batchId: selectedBatchId,
        strategyName: `Strategy ${new Date().toLocaleDateString()} (${profitMargin}%)`,
        dateCreated: new Date().toISOString(),
        totalCost,
        unitCost,
        profitMargin,
        sellingPrice,
        laborCosts: [...laborCosts],
        overheadCosts: [...overheadCosts],
        notes: `Total Labor: $${totalLabor.toFixed(0)}, Total Overhead: $${totalOverhead.toFixed(0)}`
    };
    await StorageService.savePricingStrategy(strategy);
    
    StorageService.logActivity(user.entityId, user, 'UPDATE_FINANCE', `Saved pricing strategy ${strategy.id} for ${selectedBatchId}.`);
    
    alert("Financial record and pricing strategy saved successfully.");
    loadPricingStrategies(); 
  };

  // --- Sales Handlers ---
  const handleOpenSaleModal = (batchId: string) => {
      const batch = batches.find(b => b.id === batchId);
      setSalesForm({
          batchId,
          pricingStrategyId: '',
          quantityKg: batch ? batch.actualYield : 0
      });
      setShowSalesModal(true);
  };

  const handleExecuteSale = async () => {
      if (!salesForm.pricingStrategyId) return alert("Please select a pricing strategy.");
      if (salesForm.quantityKg <= 0) return alert("Quantity must be greater than 0.");

      const strategy = StorageService.getPricingStrategies(user.entityId, salesForm.batchId).find(s => s.id === salesForm.pricingStrategyId);
      if (!strategy) return alert("Strategy not found.");

      const order: SalesOrder = {
          id: `SO-${Date.now()}`,
          entityId: user.entityId,
          batchId: salesForm.batchId,
          pricingStrategyId: strategy.id,
          customerName: "Village C Processing Community",
          quantityKg: salesForm.quantityKg,
          unitPrice: strategy.sellingPrice,
          totalValue: salesForm.quantityKg * strategy.sellingPrice,
          date: new Date().toISOString(),
          status: 'COMPLETED'
      };

      await StorageService.saveSalesOrder(order);
      StorageService.logActivity(user.entityId, user, 'CREATE_SALE', `Sold ${order.quantityKg}kg from ${order.batchId} to Village C for $${order.totalValue.toFixed(2)}`);
      
      setSalesOrders(StorageService.getAll<SalesOrder>(KEYS.SALES_ORDERS, user.entityId)); 
      setShowSalesModal(false);
      alert("Sales Order executed successfully!");
  };

  // --- Helper to Generate Email Text ---
  const generateEmailBody = (order: SalesOrder) => {
    return `Subject: 🔔 Billing Alert - Invoice for Order #${order.id}

Dear Village C Processing Team,

Please find attached the invoice/sales order for the recent delivery of fresh mushrooms.

Order Summary:
- Batch: ${order.batchId}
- Quantity: ${order.quantityKg} kg
- Total Amount Due: $${order.totalValue.toFixed(2)}

Kindly process the payment within the agreed terms.

Regards,
MyceliumNexus Finance Dept.`;
  };

  // --- NEW: Preview Handler ---
  const handlePreviewBilling = (order: SalesOrder) => {
      const content = generateEmailBody(order);
      setPreviewContent({ order, content });
  };

  // --- Existing Send Handler (Fixed to use helper) ---
  const handleSendBillingAlert = async (order: SalesOrder) => {
      const emailBody = generateEmailBody(order);

      const updatedOrder = { 
          ...order, 
          emailContent: emailBody, 
          billingStatus: 'SENT'    
      };

      await StorageService.saveSalesOrder(updatedOrder);
      StorageService.logActivity(user.entityId, user, 'SEND_BILLING', `Sent billing alert for Order #${order.id}`);

      setEmailNotification({ order: updatedOrder, content: emailBody });
  };

  const handlePrintSalesOrder = (order: SalesOrder) => {
    const batch = batches.find(b => b.id === order.batchId);
    const farmName = StorageService.getConnectedFarmName();
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert("Please allow popups to print.");

    const htmlContent = `
      <html>
        <head>
          <title>Sales Order ${order.id}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; max-width: 800px; margin: 0 auto; }
            .header { display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
            .company-info h1 { margin: 0; color: #16a34a; font-size: 24px; }
            .company-info p { margin: 5px 0; font-size: 14px; color: #555; }
            .order-title { text-align: right; }
            .order-title h2 { margin: 0; font-size: 32px; color: #444; }
            .order-title p { margin: 5px 0; font-size: 14px; }
            .bill-to { margin-bottom: 40px; }
            .bill-to h3 { font-size: 12px; text-transform: uppercase; color: #999; margin-bottom: 10px; }
            .bill-to-box { background: #f9fafb; padding: 15px; border-radius: 8px; border: 1px solid #eee; }
            .bill-to-box h4 { margin: 0 0 5px 0; font-size: 16px; color: #333; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { text-align: left; background: #16a34a; color: white; padding: 12px; font-size: 12px; text-transform: uppercase; }
            td { padding: 12px; border-bottom: 1px solid #eee; font-size: 14px; }
            .totals { display: flex; justify-content: flex-end; }
            .totals-box { width: 250px; text-align: right; }
            .total-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
            .total-row.final { border-bottom: 0; font-weight: bold; font-size: 20px; color: #16a34a; margin-top: 10px; padding-top: 10px; border-top: 2px solid #eee; }
            .footer { margin-top: 60px; font-size: 12px; text-align: center; color: #999; border-top: 1px solid #eee; padding-top: 20px; }
            .signature-box { display: flex; justify-content: space-between; margin-top: 50px; }
            .sig-line { border-top: 1px solid #ccc; width: 40%; padding-top: 5px; text-align: center; font-size: 12px; font-weight: bold; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-info">
              <h1>${farmName}</h1>
              <p>123 Mushroom Lane<br>Agricultural District<br>Reg. No: 2025-FARM-01</p>
            </div>
            <div class="order-title">
              <h2>SALES ORDER</h2>
              <p><strong>Order #:</strong> ${order.id}</p>
              <p><strong>Date:</strong> ${new Date(order.date).toLocaleDateString()}</p>
            </div>
          </div>
          <div class="bill-to">
            <h3>Bill To</h3>
            <div class="bill-to-box">
              <h4>${order.customerName}</h4>
              <p style="margin:0; font-size:14px; color:#666;">Community Collection Center<br>Village C, Sector 4<br>Local Cooperative</p>
            </div>
          </div>
          <table>
            <thead><tr><th>Description</th><th>Batch Ref</th><th style="text-align:right">Quantity</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Total</th></tr></thead>
            <tbody>
              <tr>
                <td><strong>Fresh Mushrooms</strong><div style="font-size:12px; color:#666; margin-top:2px;">${batch?.species || 'Mixed Species'}</div></td>
                <td style="font-family:monospace;">${order.batchId}</td>
                <td style="text-align:right">${order.quantityKg} kg</td>
                <td style="text-align:right">$${order.unitPrice.toFixed(2)}</td>
                <td style="text-align:right">$${order.totalValue.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          <div class="totals">
            <div class="totals-box">
              <div class="total-row"><span>Subtotal:</span><span>$${order.totalValue.toFixed(2)}</span></div>
              <div class="total-row"><span>Tax (0%):</span><span>$0.00</span></div>
              <div class="total-row final"><span>Total:</span><span>$${order.totalValue.toFixed(2)}</span></div>
            </div>
          </div>
          <div class="signature-box"><div class="sig-line">Authorized Signature (Seller)</div><div class="sig-line">Received By (Buyer)</div></div>
          <div class="footer"><p>Thank you for supporting sustainable local agriculture.</p><p>System Generated Document - MyceliumNexus</p></div>
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // --- UI Helpers ---
  const addLaborItem = () => {
    if (!newLaborDesc || !newLaborAmt) return;
    setLaborCosts([...laborCosts, { id: `lab_${Date.now()}`, description: newLaborDesc, amount: Number(newLaborAmt) }]);
    setNewLaborDesc('');
    setNewLaborAmt('');
  };

  const removeLaborItem = (id: string) => {
    setLaborCosts(laborCosts.filter(l => l.id !== id));
  };

  const updateOverhead = (category: string, amount: number) => {
    setOverheadCosts(prev => prev.map(o => o.category === category ? { ...o, amount } : o));
  };

  // Live Calc for Planning View
  const totalMaterial = materialCosts.reduce((acc, i) => acc + i.totalCost, 0);
  const totalLabor = laborCosts.reduce((acc, i) => acc + i.amount, 0);
  const totalOverhead = overheadCosts.reduce((acc, i) => acc + i.amount, 0);
  const totalProductionCost = totalMaterial + totalLabor + totalOverhead;
  const selectedBatch = batches.find(b => b.id === selectedBatchId);
  const actualYield = selectedBatch?.actualYield || 0;
  const costPerKg = actualYield > 0 ? totalProductionCost / actualYield : 0;
  const sellingPrice = costPerKg * (1 + profitMargin / 100);
  const projectedRevenue = sellingPrice * actualYield;
  const projectedProfit = projectedRevenue - totalProductionCost;

  if (user.role !== Role.ADMIN) return <div className="p-10 text-center text-red-500 font-bold">Access Denied. Admins Only.</div>;

  const availableInventory = batches.filter(b => (b.status === BatchStatus.COMPLETED || b.status === BatchStatus.HARVESTING) && b.actualYield > 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
             <DollarSign className="text-green-600" /> Finance & Sales
           </h2>
           <p className="text-sm text-gray-500">Cost Analysis, Pricing Strategy & Sales Execution</p>
        </div>
        
        <div className="flex bg-white rounded-lg p-1 border shadow-sm">
            <button onClick={() => setActiveTab('planning')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'planning' ? 'bg-primary-100 text-primary-800' : 'text-gray-500 hover:bg-gray-50'}`}>
                <Calculator size={16} /> Cost & Pricing
            </button>
            <button onClick={() => setActiveTab('sales')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'sales' ? 'bg-primary-100 text-primary-800' : 'text-gray-500 hover:bg-gray-50'}`}>
                <ShoppingCart size={16} /> Sales Execution
            </button>
        </div>
      </div>

      {activeTab === 'planning' && (
      <div className="animate-in fade-in slide-in-from-left-4">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 flex items-center gap-4">
              <label className="text-sm font-bold text-gray-700 whitespace-nowrap">Select Batch for Analysis:</label>
              <div className="relative flex-1">
                <select className="w-full appearance-none bg-gray-50 border border-gray-300 text-gray-700 py-2 px-4 pr-8 rounded-lg leading-tight focus:outline-none focus:border-green-500" value={selectedBatchId} onChange={(e) => setSelectedBatchId(e.target.value)}>
                    <option value="">Select Batch...</option>
                    {batches.map(b => (
                        <option key={b.id} value={b.id}>{b.id} - {b.species} ({b.status})</option>
                    ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700"><ExternalLink size={14}/></div>
              </div>
          </div>

          {!selectedBatchId ? (
              <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                  <PieChart size={48} className="mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-500">Select a batch above to begin financial analysis</h3>
              </div>
          ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-6">
                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                          <div className="bg-blue-50 p-4 border-b border-blue-100 flex justify-between items-center">
                              <h4 className="font-bold text-blue-900 flex items-center gap-2"><ShoppingBag size={18}/> Material Cost</h4>
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Auto-Calculated from Inventory</span>
                          </div>
                          <div className="p-0">
                              <table className="w-full text-sm text-left">
                                  <thead className="bg-gray-50 text-gray-500">
                                      <tr><th className="p-3 pl-4">Material</th><th className="p-3 text-right">Consumed</th><th className="p-3 text-right">Unit Cost</th><th className="p-3 text-right pr-4">Total</th></tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                      {materialCosts.map(m => {
                                          const matName = materials.find(mat => mat.id === m.materialId)?.name || m.materialId;
                                          return (
                                              <tr key={m.materialId}>
                                                  <td className="p-3 pl-4 font-medium text-gray-700">{matName}</td>
                                                  <td className="p-3 text-right text-gray-500">{m.qty.toFixed(2)}</td>
                                                  <td className="p-3 text-right text-gray-500">${m.unitCost.toFixed(2)}</td>
                                                  <td className="p-3 text-right pr-4 font-bold text-gray-800">${m.totalCost.toFixed(2)}</td>
                                              </tr>
                                          )
                                      })}
                                      <tr className="bg-gray-50 font-bold"><td colSpan={3} className="p-3 text-right">Total Material:</td><td className="p-3 text-right pr-4 text-blue-700">${totalMaterial.toFixed(2)}</td></tr>
                                  </tbody>
                              </table>
                          </div>
                      </div>

                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                          <div className="bg-indigo-50 p-4 border-b border-indigo-100 flex justify-between items-center">
                              <h4 className="font-bold text-indigo-900 flex items-center gap-2"><Users size={18}/> Direct Labor</h4>
                              <span className="text-xs font-bold text-indigo-700">Total: ${totalLabor.toFixed(2)}</span>
                          </div>
                          <div className="p-4 space-y-3">
                              {laborCosts.map(l => (
                                  <div key={l.id} className="flex items-center justify-between bg-gray-50 p-2 rounded border border-gray-100">
                                      <span className="text-sm font-medium text-gray-700">{l.description}</span>
                                      <div className="flex items-center gap-3">
                                          <span className="font-bold text-gray-800">${l.amount.toFixed(2)}</span>
                                          <button onClick={() => removeLaborItem(l.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                                      </div>
                                  </div>
                              ))}
                              <div className="flex gap-2 pt-2">
                                  <input type="text" placeholder="Task Description" className="flex-1 border rounded p-2 text-sm" value={newLaborDesc} onChange={e => setNewLaborDesc(e.target.value)} />
                                  <input type="number" placeholder="Cost ($)" className="w-24 border rounded p-2 text-sm" value={newLaborAmt} onChange={e => setNewLaborAmt(e.target.value)} />
                                  <button onClick={addLaborItem} className="bg-indigo-600 text-white px-3 rounded hover:bg-indigo-700"><Plus size={18}/></button>
                              </div>
                          </div>
                      </div>

                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                          <div className="bg-amber-50 p-4 border-b border-amber-100 flex justify-between items-center">
                              <h4 className="font-bold text-amber-900 flex items-center gap-2"><Zap size={18}/> Overheads</h4>
                              <span className="text-xs font-bold text-amber-700">Total: ${totalOverhead.toFixed(2)}</span>
                          </div>
                          <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                              {overheadCosts.map(o => (
                                  <div key={o.category}>
                                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{o.category}</label>
                                      <div className="relative">
                                          <span className="absolute left-3 top-2 text-gray-400">$</span>
                                          <input type="number" className="w-full pl-6 pr-2 py-1.5 border rounded focus:ring-amber-500 focus:border-amber-500 text-sm font-semibold" value={o.amount} onChange={e => updateOverhead(o.category, Number(e.target.value))} onFocus={e => e.target.select()} />
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>

                  <div className="lg:col-span-1 space-y-6">
                      <div className="bg-gray-900 text-white p-6 rounded-xl shadow-lg relative overflow-hidden">
                          <div className="relative z-10">
                              <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Total Production Cost</h3>
                              <div className="text-4xl font-bold mb-4">${totalProductionCost.toFixed(2)}</div>
                              <div className="grid grid-cols-2 gap-4 text-sm border-t border-gray-700 pt-4">
                                  <div><div className="text-gray-400">Total Yield</div><div className="font-bold">{actualYield} kg</div></div>
                                  <div><div className="text-gray-400">Cost per Kg</div><div className="font-bold text-green-400">${costPerKg.toFixed(2)}</div></div>
                              </div>
                          </div>
                          <div className="absolute right-0 top-0 opacity-10 transform translate-x-1/4 -translate-y-1/4"><PieChart size={200} /></div>
                      </div>

                      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                          <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Calculator size={18} /> Pricing Strategy</h4>
                          <div className="space-y-4">
                              <div>
                                  <label className="block text-sm font-bold text-gray-700 mb-1">Target Profit Margin (%)</label>
                                  <div className="flex items-center gap-2">
                                      <input type="range" min="0" max="100" step="5" className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" value={profitMargin} onChange={e => setProfitMargin(Number(e.target.value))} />
                                      <input type="number" className="w-16 border rounded p-1 text-center font-bold" value={profitMargin} onChange={e => setProfitMargin(Number(e.target.value))} />
                                  </div>
                              </div>
                              <div className="bg-green-50 p-4 rounded-lg border border-green-200 text-center">
                                  <div className="text-xs font-bold text-green-700 uppercase mb-1">Suggested Selling Price</div>
                                  <div className="text-3xl font-bold text-green-800">${sellingPrice.toFixed(2)} <span className="text-sm font-medium text-green-600">/kg</span></div>
                              </div>
                              <div className="border-t pt-4 space-y-2 text-sm">
                                  <div className="flex justify-between"><span className="text-gray-500">Projected Revenue:</span><span className="font-bold text-gray-800">${projectedRevenue.toFixed(2)}</span></div>
                                  <div className="flex justify-between"><span className="text-gray-500">Projected Net Profit:</span><span className={`font-bold ${projectedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>${projectedProfit.toFixed(2)}</span></div>
                              </div>
                          </div>
                          <button type="button" onClick={handleSaveFinancials} className="w-full mt-6 bg-primary-600 hover:bg-primary-700 text-white py-3 rounded-lg font-bold shadow-sm flex items-center justify-center gap-2">
                              <Save size={18} /> Save Financial Record
                          </button>
                      </div>

                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                          <div className="px-4 py-3 border-b bg-gray-50 font-bold text-gray-700 text-sm flex items-center gap-2"><List size={16} /> Saved Pricing Strategies</div>
                          <div className="max-h-60 overflow-y-auto">
                              <table className="w-full text-left text-xs">
                                  <thead className="bg-gray-100 text-gray-600 sticky top-0"><tr><th className="p-2 pl-3">Strategy ID</th><th className="p-2">Margin</th><th className="p-2 text-right">Price/kg</th></tr></thead>
                                  <tbody className="divide-y divide-gray-100">
                                      {pricingStrategies.map(ps => (
                                          <tr key={ps.id}>
                                              <td className="p-2 pl-3 font-mono font-medium">{ps.id}</td>
                                              <td className="p-2">{ps.profitMargin}%</td>
                                              <td className="p-2 text-right font-bold text-green-700">${ps.sellingPrice.toFixed(2)}</td>
                                          </tr>
                                      ))}
                                      {pricingStrategies.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-gray-400 italic">No strategies saved yet.</td></tr>}
                                  </tbody>
                              </table>
                          </div>
                      </div>
                  </div>
              </div>
          )}
      </div>
      )}

      {activeTab === 'sales' && (
      <div className="animate-in fade-in slide-in-from-right-4 space-y-8">
          <div>
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><Package size={20} className="text-primary-600"/> Available Harvest Inventory</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {availableInventory.map(b => {
                      const yieldVal = b.actualYield || 0;
                      const strategies = StorageService.getPricingStrategies(user.entityId, b.id);
                      const existingOrder = salesOrders.find(o => o.batchId === b.id);
                      
                      return (
                          <div key={b.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col hover:border-primary-300 transition-all">
                              <div className="flex justify-between items-start mb-2">
                                  <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">{b.id}</span>
                                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-bold uppercase">{b.status}</span>
                              </div>
                              <h4 className="font-bold text-gray-800 text-lg mb-1">{b.species}</h4>
                              <div className="text-sm text-gray-500 mb-4 flex items-center gap-1"><Calendar size={14}/> Completed: {b.endDate ? new Date(b.endDate).toLocaleDateString() : 'N/A'}</div>
                              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                                  <div className="flex justify-between items-end">
                                      <span className="text-xs font-bold text-gray-500 uppercase">Total Yield</span>
                                      <span className="text-2xl font-bold text-gray-900">{yieldVal} <span className="text-sm font-normal text-gray-500">kg</span></span>
                                  </div>
                              </div>
                              <div className="mt-auto">
                                  {strategies.length > 0 ? (
                                      existingOrder ? (
                                          // --- MODIFIED BUTTON SECTION ---
                                          <div className="flex gap-2">
                                              <button 
                                                  onClick={() => handlePreviewBilling(existingOrder)} 
                                                  className="flex-1 bg-white border border-gray-300 text-gray-700 py-2 rounded-lg font-bold shadow-sm flex justify-center items-center gap-2 hover:bg-gray-50"
                                              >
                                                  <Eye size={16}/> Preview
                                              </button>
                                              <button 
                                                  onClick={() => handleSendBillingAlert(existingOrder)} 
                                                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-bold shadow-sm flex justify-center items-center gap-2"
                                              >
                                                  <Mail size={16}/> Send
                                              </button>
                                          </div>
                                      ) : (
                                          <button onClick={() => handleOpenSaleModal(b.id)} className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2 rounded-lg font-bold shadow-sm flex justify-center items-center gap-2">
                                              <ShoppingCart size={16}/> Sell to Village C
                                          </button>
                                      )
                                  ) : (
                                      <div className="text-center text-xs text-red-500 bg-red-50 p-2 rounded border border-red-100">Missing Pricing Strategy. <br/> Go to 'Cost & Pricing' tab first.</div>
                                  )}
                              </div>
                          </div>
                      );
                  })}
                  {availableInventory.length === 0 && (
                      <div className="col-span-full p-12 text-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 text-gray-400">
                          <Package size={48} className="mx-auto mb-3 opacity-20"/>
                          <p>No completed batches with yield available for sale.</p>
                      </div>
                  )}
              </div>
          </div>

          <div>
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><List size={20} className="text-gray-500"/> Sales History</h3>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50 text-gray-600 border-b">
                          <tr><th className="p-4">Order ID</th><th className="p-4">Date</th><th className="p-4">Customer</th><th className="p-4">Batch Ref</th><th className="p-4 text-right">Quantity</th><th className="p-4 text-right">Unit Price</th><th className="p-4 text-right">Total</th><th className="p-4 text-center">Actions</th></tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                          {salesOrders.map(order => (
                              <tr key={order.id} className="hover:bg-gray-50">
                                  <td className="p-4 font-mono font-medium">{order.id}</td>
                                  <td className="p-4 text-gray-500">{new Date(order.date).toLocaleDateString()}</td>
                                  <td className="p-4 font-medium text-gray-800">{order.customerName}</td>
                                  <td className="p-4"><span className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">{order.batchId}</span></td>
                                  <td className="p-4 text-right">{order.quantityKg} kg</td>
                                  <td className="p-4 text-right">${order.unitPrice.toFixed(2)}</td>
                                  <td className="p-4 text-right font-bold text-green-700">${order.totalValue.toFixed(2)}</td>
                                  <td className="p-4 text-center">
                                      <button onClick={() => handlePrintSalesOrder(order)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="View/Print Order"><Printer size={16} /></button>
                                  </td>
                              </tr>
                          ))}
                          {salesOrders.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-gray-400">No sales recorded.</td></tr>}
                      </tbody>
                  </table>
              </div>
          </div>
      </div>
      )}

      {/* SALES MODAL */}
      {showSalesModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl w-full max-w-md shadow-2xl p-6">
                  <h3 className="text-xl font-bold mb-1 flex items-center gap-2"><Tag size={20} className="text-primary-600"/> New Sale Entry</h3>
                  <p className="text-sm text-gray-500 mb-6">Processing Community (Village C)</p>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Batch Context</label>
                          <input type="text" disabled value={salesForm.batchId} className="w-full border bg-gray-100 rounded p-2 text-sm font-mono" />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Pricing Strategy</label>
                          <select className="w-full border rounded p-2 text-sm bg-white" value={salesForm.pricingStrategyId} onChange={e => setSalesForm({...salesForm, pricingStrategyId: e.target.value})}>
                              <option value="">-- Select Approved Pricing --</option>
                              {StorageService.getPricingStrategies(user.entityId, salesForm.batchId).map(s => (
                                  <option key={s.id} value={s.id}>{s.id}: ${s.sellingPrice.toFixed(2)}/kg (Margin: {s.profitMargin}%)</option>
                              ))}
                          </select>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Quantity (kg)</label>
                          <input type="number" className="w-full border rounded p-2 text-lg font-bold" value={salesForm.quantityKg} onChange={e => setSalesForm({...salesForm, quantityKg: Number(e.target.value)})} />
                      </div>
                      {salesForm.pricingStrategyId && (
                          <div className="bg-green-50 p-4 rounded-lg border border-green-200 mt-2">
                              <div className="flex justify-between text-sm mb-1"><span>Unit Price:</span><span className="font-bold">${StorageService.getPricingStrategies(user.entityId, salesForm.batchId).find(s => s.id === salesForm.pricingStrategyId)?.sellingPrice.toFixed(2)}</span></div>
                              <div className="flex justify-between text-lg font-bold text-green-800 border-t border-green-200 pt-1 mt-1"><span>Total Value:</span><span>${(salesForm.quantityKg * (StorageService.getPricingStrategies(user.entityId, salesForm.batchId).find(s => s.id === salesForm.pricingStrategyId)?.sellingPrice || 0)).toFixed(2)}</span></div>
                          </div>
                      )}
                  </div>
                  <div className="flex gap-3 mt-6 pt-4 border-t">
                      <button onClick={() => setShowSalesModal(false)} className="flex-1 py-2 text-gray-500 hover:bg-gray-100 rounded-lg">Cancel</button>
                      <button onClick={handleExecuteSale} className="flex-1 bg-primary-600 text-white py-2 rounded-lg font-bold hover:bg-primary-700 shadow-sm flex items-center justify-center gap-2"><CheckCircle size={18}/> Confirm Sale</button>
                  </div>
              </div>
          </div>
      )}

      {/* --- NEW: PREVIEW MODAL (READ ONLY) --- */}
      {previewContent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center rounded-t-xl">
              <h3 className="font-bold text-gray-800 flex items-center gap-2"><Eye size={18} /> Preview Billing Email</h3>
              <button onClick={() => setPreviewContent(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-6 bg-white flex-1 overflow-y-auto">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm font-serif leading-relaxed text-gray-800 whitespace-pre-wrap">
                    {previewContent.content}
                </div>
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-end">
                <button onClick={() => setPreviewContent(null)} className="px-6 py-2 bg-gray-800 text-white rounded-lg text-sm font-bold hover:bg-gray-900 shadow-sm">Close Preview</button>
            </div>
          </div>
        </div>
      )}

      {/* --- SUCCESS MODAL --- */}
      {emailNotification && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[80vh]">
            <div className="p-4 border-b bg-green-50 flex justify-between items-center rounded-t-xl">
              <h3 className="font-bold text-green-800 flex items-center gap-2"><CheckCircle size={18} /> Billing Alert Sent</h3>
              <button onClick={() => setEmailNotification(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-6 bg-gray-100 flex-1 overflow-y-auto">
                <div className="bg-white p-6 shadow-sm border border-gray-200 rounded">
                    <div className="border-b pb-4 mb-4 text-sm text-gray-600 space-y-1">
                        <div><span className="font-bold text-gray-800">To:</span> Village C Processing Community</div>
                        <div><span className="font-bold text-gray-800">Status:</span> <span className="text-green-600 font-bold">Sent to Database</span></div>
                    </div>
                    <div className="whitespace-pre-wrap text-gray-800 text-sm leading-relaxed font-serif mb-6">
                        {emailNotification.content}
                    </div>
                    
                    <div className="border-t pt-4">
                        <div className="text-xs font-bold text-gray-500 uppercase mb-2">Attachments</div>
                        <button onClick={() => handlePrintSalesOrder(emailNotification.order)} className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors w-full group">
                            <div className="bg-red-100 p-2 rounded text-red-600"><FileText size={20} /></div>
                            <div className="text-left flex-1">
                                <div className="text-sm font-bold text-gray-800 group-hover:text-blue-600 group-hover:underline">Sales_Order_{emailNotification.order.id}.pdf</div>
                                <div className="text-xs text-gray-500">128 KB</div>
                            </div>
                            <ExternalLink size={16} className="text-gray-400" />
                        </button>
                    </div>
                </div>
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-end">
                <button onClick={() => setEmailNotification(null)} className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 shadow-sm">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};