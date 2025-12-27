import React, { useState, useEffect } from 'react';
import { ShoppingCart, AlertCircle, CheckCircle, FileText, Upload, Plus, Trash2, Edit, Check, X, MessageSquare, ThumbsUp, ThumbsDown, Lock, PackageCheck, DollarSign, ExternalLink, RefreshCw, Printer, Mail, Eye, Loader2 } from 'lucide-react';
import { User, Role, PurchaseRequest, PurchaseOrder, RequestStatus, Batch, Material, POStatus, Vendor, POLineItem, GRN, GRNItem, PaymentVoucher } from '../types';
import { StorageService } from '../services/storageService';
// 1. New Imports for Storage
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface Props {
  user: User;
}

export const Procurement: React.FC<Props> = ({ user }) => {
  // 1. Tab Persistence
  const [activeTab, setActiveTab] = useState<'pr' | 'po' | 'receive' | 'pay'>(() => {
    return (localStorage.getItem('mn_procurement_tab') as any) || 'pr';
  });

  useEffect(() => {
    localStorage.setItem('mn_procurement_tab', activeTab);
  }, [activeTab]);

  const [prs, setPrs] = useState<PurchaseRequest[]>([]);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [grns, setGrns] = useState<GRN[]>([]);
  const [payments, setPayments] = useState<PaymentVoucher[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  
  // New Loading State for Uploads
  const [isUploading, setIsUploading] = useState(false);

  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; action: () => void; }>({ isOpen: false, title: '', message: '', action: () => {} });

  const [showPrModal, setShowPrModal] = useState(false);
  const [editingPrId, setEditingPrId] = useState<string | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  
  const [gapAnalysis, setGapAnalysis] = useState<{ required: number, physicalStock: number, reservedStock: number, reservedBreakdown: { batchId: string, qty: number }[], availableStock: number, suggestedRequest: number, requestInput: number } | null>(null);

  const [reviewPr, setReviewPr] = useState<PurchaseRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');

  const [showPoModal, setShowPoModal] = useState(false);
  const [selectedPrIds, setSelectedPrIds] = useState<string[]>([]);
  const [poForm, setPoForm] = useState<{ id?: string; vendorId: string; prIds: string[]; items: POLineItem[]; quotationFile: string | null; }>({ vendorId: '', prIds: [], items: [], quotationFile: null });

  const [showGrnModal, setShowGrnModal] = useState(false);
  const [grnForm, setGrnForm] = useState<{ poId: string; supplierRef: string; proofUrl: string | null; items: GRNItem[]; }>({ poId: '', supplierRef: '', proofUrl: null, items: [] });

  const [showPayModal, setShowPayModal] = useState(false);
  const [payForm, setPayForm] = useState<{ poId: string; amount: number; method: string; reference: string; proofUrl: string | null; }>({ poId: '', amount: 0, method: 'Bank Transfer', reference: '', proofUrl: null });

  const KEYS = StorageService.getKeys();

  const loadData = () => {
    setPrs(StorageService.getAll<PurchaseRequest>(KEYS.PRS, user.entityId));
    setPos(StorageService.getAll<PurchaseOrder>(KEYS.POS, user.entityId));
    setGrns(StorageService.getAll<GRN>(KEYS.GRNS, user.entityId));
    setPayments(StorageService.getAll<PaymentVoucher>(KEYS.PAYMENTS, user.entityId));
    setBatches(StorageService.getAll<Batch>(KEYS.BATCHES, user.entityId));
    setMaterials(StorageService.getAll<Material>(KEYS.MATERIALS, user.entityId));
    setVendors(StorageService.getAll<Vendor>(KEYS.VENDORS, user.entityId));
  };

  useEffect(() => { loadData(); }, [user]);
  useEffect(() => {
    const unsubscribe = StorageService.subscribe(() => { loadData(); });
    return () => unsubscribe();
  }, []);

  const pendingReplacements = grns.flatMap(grn => grn.items.map((item, index) => ({ ...item, grnId: grn.id, itemIndex: index, poId: grn.poId, date: grn.dateReceived })).filter(item => item.rejectedQty > 0 && !item.replacementReceived));

  const requestConfirmation = (title: string, message: string, action: () => void) => { setConfirmModal({ isOpen: true, title, message, action }); };
  const executeConfirmation = () => { confirmModal.action(); setConfirmModal({ ...confirmModal, isOpen: false }); };
  
  const openDocument = (url: string | null) => {
      if (!url) return alert("No document attached.");
      const win = window.open();
      if (win) {
         // Handle both old Base64 and new Storage URLs
         if (url.startsWith('http')) {
            win.location.href = url;
         } else if (url.startsWith('data:')) {
            win.document.write(`<iframe src="${url}" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
         }
      }
  };

  // --- SMART RESERVATION LOGIC (PRESERVED) ---
  useEffect(() => {
    if (selectedBatchId && selectedMaterialId) {
      const batch = batches.find(b => b.id === selectedBatchId);
      const recipeItem = batch?.recipe.find(r => r.materialId === selectedMaterialId);
      const physicalStock = StorageService.getInventory(user.entityId, selectedMaterialId);
      const reservedDetails = StorageService.getReservedStockDetails(user.entityId, selectedMaterialId, editingPrId || undefined);
      const reservedStock = reservedDetails.reduce((acc, item) => acc + item.qty, 0);
      const availableStock = Math.max(0, physicalStock - reservedStock);
      const required = recipeItem ? recipeItem.requiredQty : 0;
      const suggestedRequest = Math.max(0, required - availableStock);
      setGapAnalysis({ required, physicalStock, reservedStock, reservedBreakdown: reservedDetails, availableStock, suggestedRequest, requestInput: suggestedRequest });
    } else { setGapAnalysis(null); }
  }, [selectedBatchId, selectedMaterialId, batches]); 

  const handleOpenNewPR = () => { setEditingPrId(null); setSelectedBatchId(''); setSelectedMaterialId(''); setShowPrModal(true); };
  const handleEditPR = (pr: PurchaseRequest) => {
    setEditingPrId(pr.id); setSelectedBatchId(pr.batchId); setSelectedMaterialId(pr.materialId); setShowPrModal(true);
    setTimeout(() => { setGapAnalysis(prev => prev ? { ...prev, requestInput: pr.requestedQty } : null); }, 100);
  };
  const handleDeletePR = (pr: PurchaseRequest) => {
    if (pr.status === RequestStatus.APPROVED || pr.status === RequestStatus.ORDERED) return alert("Approved or Ordered requests cannot be deleted.");
    requestConfirmation("Delete Purchase Request", "Are you sure you want to delete this PR? It will release any stock reservations.", () => {
        StorageService.remove(KEYS.PRS, pr.id);
        StorageService.logActivity(user.entityId, user, 'DELETE_PR', `Deleted PR ${pr.id}`);
        loadData();
    });
  };

  const handleSubmitPR = () => {
    if (!gapAnalysis || !selectedBatchId) return;
    
    // Split Logic: Buy vs Reserve
    const qtyToBuy = gapAnalysis.requestInput;
    const qtyToReserve = Math.max(0, gapAnalysis.required - qtyToBuy);

    // 1. External PR
    if (qtyToBuy > 0 || qtyToReserve === 0) {
        const prData: PurchaseRequest = {
            id: editingPrId || `PR-${Date.now()}`, 
            entityId: user.entityId, requesterId: user.id, batchId: selectedBatchId, materialId: selectedMaterialId, 
            requestedQty: qtyToBuy, status: RequestStatus.PENDING, dateCreated: new Date().toISOString()
        };
        if (editingPrId) { 
            StorageService.update(KEYS.PRS, prData); 
            StorageService.logActivity(user.entityId, user, 'UPDATE_PR', `Updated PR ${prData.id}`);
        } else { 
            StorageService.add(KEYS.PRS, prData); 
            StorageService.logActivity(user.entityId, user, 'CREATE_PR', `Created PR ${prData.id} for ${qtyToBuy} units`);
        }
    }

    // 2. Internal Reservation
    if (qtyToReserve > 0) {
        const reservationData: PurchaseRequest = {
            id: `RES-${Date.now()}`, entityId: user.entityId, requesterId: user.id, batchId: selectedBatchId, materialId: selectedMaterialId, 
            requestedQty: qtyToReserve, status: RequestStatus.STOCK_ALLOCATED, dateCreated: new Date().toISOString(),
            adminNotes: 'Auto-Reserved by System based on Batch Requirement Gap.'
        };
        StorageService.add(KEYS.PRS, reservationData); 
        StorageService.logActivity(user.entityId, user, 'AUTO_RESERVE', `Reserved ${qtyToReserve} units for Batch ${selectedBatchId}`);
        
        if (qtyToBuy > 0) {
            alert(`System Notice:\n\n1. Created Purchase Request for ${qtyToBuy} units.\n2. Automatically Reserved ${qtyToReserve} units from internal stock.`);
        }
    }

    setShowPrModal(false); loadData(); setSelectedBatchId(''); setSelectedMaterialId(''); setEditingPrId(null);
  };

  // ... (Rest of existing handler functions remain unchanged)
  const openReviewModal = (pr: PurchaseRequest) => { setReviewPr(pr); setReviewNotes(''); };
  const handleProcessReview = (status: RequestStatus) => {
    if (!reviewPr) return;
    const updatedPr = { ...reviewPr, status: status, adminNotes: reviewNotes };
    StorageService.update(KEYS.PRS, updatedPr);
    const actionVerb = status === RequestStatus.APPROVED ? 'APPROVED' : 'REJECTED';
    StorageService.logActivity(user.entityId, user, `${actionVerb}_PR`, `${actionVerb} PR ${reviewPr.id}`);
    setReviewPr(null); loadData();
  };

  const getApprovedPendingPrs = () => {
    const linkedPrIds = pos.flatMap(po => po.prIds);
    return prs.filter(pr => pr.status === RequestStatus.APPROVED && !linkedPrIds.includes(pr.id));
  };
  const togglePrSelection = (prId: string) => {
    if (selectedPrIds.includes(prId)) setSelectedPrIds(selectedPrIds.filter(id => id !== prId)); else setSelectedPrIds([...selectedPrIds, prId]);
  };
  const handleInitPoCreation = () => {
    if (selectedPrIds.length === 0) return alert("Please select at least one Approved PR.");
    const selectedPrs = prs.filter(p => selectedPrIds.includes(p.id));
    const items: POLineItem[] = selectedPrs.map(pr => {
       const mat = materials.find(m => m.id === pr.materialId);
       return { materialId: pr.materialId, quantity: pr.requestedQty, unitPrice: mat?.standardCost || 0, total: (mat?.standardCost || 0) * pr.requestedQty };
    });
    setPoForm({ vendorId: '', prIds: selectedPrIds, items: items, quotationFile: null });
    setShowPoModal(true);
  };
  const handleEditPo = (po: PurchaseOrder) => {
    setPoForm({ id: po.id, vendorId: po.vendorId, prIds: po.prIds, items: po.items, quotationFile: po.quotationUrl || null });
    setShowPoModal(true);
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'quotation' | 'grn' | 'payment') => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      // Create a unique path: procurement/{entityId}/{type}/{timestamp}_{filename}
      const storagePath = `procurement/${user.entityId}/${field}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, storagePath);

      // Upload the file
      await uploadBytes(storageRef, file);

      // Get the URL
      const url = await getDownloadURL(storageRef);

      // Update the correct state with the URL
      if (field === 'quotation') setPoForm(prev => ({ ...prev, quotationFile: url }));
      if (field === 'grn') setGrnForm(prev => ({ ...prev, proofUrl: url }));
      if (field === 'payment') setPayForm(prev => ({ ...prev, proofUrl: url }));

    } catch (error) {
      console.error("Upload failed", error);
      alert("Failed to upload document. Please check console.");
    } finally {
      setIsUploading(false);
    }
  };

  const calculateTotal = () => poForm.items.reduce((sum, item) => sum + item.total, 0);
  
  const handleSavePO = () => {
    if (isUploading) return alert("Please wait for file upload to complete.");
    if (!poForm.vendorId) return alert("Please select a vendor.");
    if (poForm.items.some(i => i.quantity <= 0)) return alert("Qty must be > 0.");
    if (!poForm.quotationFile) return alert("Quotation file is mandatory.");
    
    const poData: PurchaseOrder = {
      id: poForm.id || `PO-${Date.now()}`, entityId: user.entityId, vendorId: poForm.vendorId, 
      prIds: poForm.prIds, items: poForm.items, totalAmount: calculateTotal(), status: POStatus.PENDING_APPROVAL, dateIssued: new Date().toISOString(), quotationUrl: poForm.quotationFile, createdBy: user.name
    };

    if (poForm.id) { StorageService.update(KEYS.POS, poData); StorageService.logActivity(user.entityId, user, 'UPDATE_PO', `Updated PO ${poData.id}`); } 
    else { StorageService.add(KEYS.POS, poData); StorageService.logActivity(user.entityId, user, 'CREATE_PO', `Created PO ${poData.id}`); }
    
    setShowPoModal(false); setSelectedPrIds([]); loadData();
  };

  const handleApprovePO = (po: PurchaseOrder) => {
    if (user.role !== Role.ADMIN) return alert("Only admins can approve POs.");
    const updatedPO = { ...po, status: POStatus.ISSUED };
    StorageService.update(KEYS.POS, updatedPO);
    StorageService.logActivity(user.entityId, user, 'APPROVE_PO', `Approved PO ${po.id}`);
    loadData();
  };

  const handlePrintPO = (po: PurchaseOrder) => {
    const vendor = vendors.find(v => v.id === po.vendorId);
    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert("Popup blocked. Please allow popups to print.");
    const htmlContent = `<html><head><title>PO ${po.id}</title></head><body><h1>Purchase Order ${po.id}</h1><p>Vendor: ${vendor?.name}</p><p>Total: $${po.totalAmount}</p><script>window.print()</script></body></html>`;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleDeletePO = (po: PurchaseOrder) => {
    if (po.status !== POStatus.PENDING_APPROVAL && user.role !== Role.ADMIN) return alert("Only Admins can delete approved POs.");
    requestConfirmation("Delete PO", "Delete Purchase Order?", () => {
        StorageService.remove(KEYS.POS, po.id);
        StorageService.logActivity(user.entityId, user, 'DELETE_PO', `Deleted PO ${po.id}`);
        loadData();
    });
  };
  const updatePoItem = (index: number, field: 'quantity' | 'unitPrice', value: number) => {
    setPoForm(prev => {
      const newItems = [...prev.items]; newItems[index] = { ...newItems[index], [field]: value };
      newItems[index].total = newItems[index].quantity * newItems[index].unitPrice;
      return { ...prev, items: newItems };
    });
  };

  const handleOpenGRN = (po: PurchaseOrder) => {
    setGrnForm({ poId: po.id, supplierRef: '', proofUrl: null, items: po.items.map(i => ({ materialId: i.materialId, poQty: i.quantity, acceptedQty: i.quantity, rejectedQty: 0 })) });
    setShowGrnModal(true);
  };
  
  const handleSaveGRN = () => {
    if (isUploading) return alert("Please wait for file upload to complete.");
    if (!grnForm.supplierRef) return alert("Enter Supplier DO/Invoice No.");
    if (!grnForm.proofUrl) return alert("Proof of Document is mandatory.");
    for (let item of grnForm.items) { if (item.acceptedQty + item.rejectedQty !== item.poQty) return alert("Total Qty must match Order Qty."); }
    const grn: GRN = { id: `GRN-${Date.now()}`, entityId: user.entityId, poId: grnForm.poId, supplierRef: grnForm.supplierRef, proofUrl: grnForm.proofUrl, dateReceived: new Date().toISOString(), receivedBy: user.name, items: grnForm.items };
    StorageService.createGRN(grn, user);
    StorageService.logActivity(user.entityId, user, 'CREATE_GRN', `Created GRN ${grn.id}`);

    const po = pos.find(p => p.id === grnForm.poId);
    if (po) {
        const updatedPo = { ...po, status: POStatus.RECEIVED };
        StorageService.update(KEYS.POS, updatedPo);
    }

    setShowGrnModal(false); loadData();
  };

  const updateGrnItem = (index: number, field: 'acceptedQty' | 'rejectedQty', val: number) => {
      setGrnForm(prev => {
          const newItems = [...prev.items]; const item = { ...newItems[index] }; const max = item.poQty;
          let newValue = Math.min(Math.max(val, 0), max);
          if (field === 'acceptedQty') { item.acceptedQty = newValue; item.rejectedQty = max - newValue; } 
          else { item.rejectedQty = newValue; item.acceptedQty = max - newValue; }
          newItems[index] = item; return { ...prev, items: newItems };
      });
  };
  const handleConfirmReplacement = (grn: GRN, itemIndex: number, e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    const item = grn.items[itemIndex];
    requestConfirmation("Confirm Replacement", `Confirm receipt of ${item.rejectedQty} units?`, () => {
        StorageService.processReplacement(grn.id, itemIndex, item.rejectedQty, user);
        StorageService.logActivity(user.entityId, user, 'RECEIVE_REPLACEMENT', `Received replacements for GRN ${grn.id}`);
        loadData();
    });
  };

  const handleOpenPay = (po: PurchaseOrder) => { setPayForm({ poId: po.id, amount: po.totalAmount, method: 'Bank Transfer', reference: '', proofUrl: null }); setShowPayModal(true); };
  
  const handleSavePayment = () => {
      if (isUploading) return alert("Please wait for file upload to complete.");
      if (!payForm.reference || !payForm.proofUrl) return alert("Reference and Receipt are mandatory.");
      const payment: PaymentVoucher = { id: `PAY-${Date.now()}`, entityId: user.entityId, poId: payForm.poId, amount: payForm.amount, date: new Date().toISOString(), method: payForm.method, reference: payForm.reference, proofUrl: payForm.proofUrl || undefined };
      StorageService.createPayment(payment, user);
      StorageService.logActivity(user.entityId, user, 'CREATE_PAYMENT', `Payment for PO ${payForm.poId}`);

      const po = pos.find(p => p.id === payForm.poId);
      if (po) {
          const updatedPo = { ...po, status: POStatus.PAID };
          StorageService.update(KEYS.POS, updatedPo);
      }

      setShowPayModal(false); loadData();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Procurement</h2>
        <div className="flex bg-white rounded-lg p-1 border shadow-sm">
          {['pr','po','receive','pay'].map((t) => (
             <button key={t} className={`px-4 py-1.5 text-sm rounded-md transition-all ${activeTab === t ? 'bg-primary-100 text-primary-800 font-bold' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveTab(t as any)}>
                {t === 'pr' ? 'Requests' : t === 'po' ? 'Orders' : t === 'receive' ? 'Receiving (GRN)' : 'Payments'}
             </button>
          ))}
        </div>
      </div>

      {activeTab === 'pr' && (
        <>
          <div className="flex justify-end"><button onClick={handleOpenNewPR} className="bg-primary-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-primary-700"><ShoppingCart size={18} /> Create Request</button></div>
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="w-full text-left text-sm"><thead className="bg-gray-50 border-b"><tr><th className="p-4">ID</th><th className="p-4">Batch</th><th className="p-4">Material</th><th className="p-4">Qty</th><th className="p-4">Status</th><th className="p-4 text-right">Action</th></tr></thead>
              <tbody className="divide-y">
                {prs.map(pr => (
                    <tr key={pr.id}>
                        <td className="p-4 font-mono text-xs">{pr.id}</td><td className="p-4 text-xs">{pr.batchId}</td><td className="p-4">{materials.find(m=>m.id===pr.materialId)?.name}</td><td className="p-4">{pr.requestedQty}</td>
                        <td className="p-4"><span className={`px-2 py-1 rounded text-xs ${pr.status==='APPROVED'?'bg-green-100 text-green-800':pr.status==='REJECTED'?'bg-red-100':pr.status==='PENDING'?'bg-yellow-100':'bg-indigo-100 text-indigo-700'}`}>{pr.status}</span></td>
                        <td className="p-4 flex justify-end gap-2">
                            {(pr.status === 'PENDING' || pr.status === 'REJECTED') && <button onClick={() => handleEditPR(pr)}><Edit size={16} className="text-blue-500"/></button>}
                            {(pr.status !== 'APPROVED' && pr.status !== 'ORDERED') && <button onClick={() => handleDeletePR(pr)}><Trash2 size={16} className="text-red-500"/></button>}
                            {user.role === Role.ADMIN && pr.status === 'PENDING' && <button onClick={() => openReviewModal(pr)} className="bg-gray-800 text-white px-2 py-1 rounded text-xs">Review</button>}
                        </td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ... Other Tabs (PO, Receive, Pay) Content Logic (Identical to before) ... */}
      {activeTab === 'po' && (
        <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                <div className="flex justify-between mb-4">
                    <h3 className="font-bold text-blue-900">Ready for Ordering</h3>
                    {selectedPrIds.length > 0 && <button onClick={handleInitPoCreation} className="bg-blue-700 text-white px-4 py-2 rounded text-sm font-bold">Generate PO ({selectedPrIds.length})</button>}
                </div>
                <div className="bg-white rounded border overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-blue-100 text-blue-800"><tr><th className="p-3"></th><th className="p-3">ID</th><th className="p-3">Material</th><th className="p-3">Qty</th></tr></thead>
                        <tbody>
                            {getApprovedPendingPrs().map(pr => (
                                <tr key={pr.id}><td className="p-3"><input type="checkbox" checked={selectedPrIds.includes(pr.id)} onChange={() => togglePrSelection(pr.id)}/></td><td className="p-3">{pr.id}</td><td className="p-3">{materials.find(m=>m.id===pr.materialId)?.name}</td><td className="p-3">{pr.requestedQty}</td></tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <div>
                <h3 className="font-bold mb-4">Purchase Orders</h3>
                <div className="bg-white rounded shadow-sm border overflow-hidden">
                    <table className="w-full text-sm text-left"><thead className="bg-gray-50"><tr><th className="p-4">PO ID</th><th className="p-4">Vendor</th><th className="p-4">Total</th><th className="p-4">Status</th><th className="p-4 text-right">Actions</th></tr></thead>
                    <tbody className="divide-y">{pos.map(po => (
                        <tr key={po.id}>
                            <td className="p-4 font-mono">{po.id}</td><td className="p-4">{vendors.find(v=>v.id===po.vendorId)?.name}</td><td className="p-4">${po.totalAmount.toFixed(2)}</td><td className="p-4">{po.status}</td>
                            <td className="p-4 flex justify-end gap-2">
                                {po.status === POStatus.PENDING_APPROVAL && user.role === Role.ADMIN && <button onClick={()=>handleApprovePO(po)}><Check size={16} className="text-green-500"/></button>}
                                {po.status === POStatus.PENDING_APPROVAL && <button onClick={()=>handleEditPo(po)}><Edit size={16} className="text-blue-500"/></button>}
                                {po.status === POStatus.PENDING_APPROVAL && <button onClick={()=>handleDeletePO(po)}><Trash2 size={16} className="text-red-500"/></button>}
                                {po.quotationUrl && <button onClick={()=>openDocument(po.quotationUrl)}><Eye size={16} className="text-indigo-500"/></button>}
                                {(po.status === POStatus.ISSUED || po.status === POStatus.RECEIVED || po.status === POStatus.PAID) && <button onClick={()=>handlePrintPO(po)}><Printer size={16} className="text-gray-600"/></button>}
                            </td>
                        </tr>
                    ))}</tbody></table>
                </div>
            </div>
        </div>
      )}

      {activeTab === 'receive' && (
        <div className="space-y-6">
             <div className="bg-orange-50 border border-orange-200 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                    <PackageCheck className="text-orange-600" />
                    <h3 className="font-bold text-orange-900">Pending Receipt</h3>
                </div>
                <div className="bg-white rounded border overflow-hidden shadow-sm">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-orange-100 text-orange-800">
                            <tr>
                                <th className="p-3">PO ID</th>
                                <th className="p-3">Vendor</th>
                                <th className="p-3">Date Issued</th>
                                <th className="p-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-orange-100">
                        {pos.filter(p => p.status === POStatus.ISSUED).map(po => (
                            <tr key={po.id} className="hover:bg-orange-50/50 transition-colors">
                                <td className="p-3 font-mono font-medium text-gray-700">{po.id}</td>
                                <td className="p-3">{vendors.find(v=>v.id===po.vendorId)?.name}</td>
                                <td className="p-3">{new Date(po.dateIssued).toLocaleDateString()}</td>
                                <td className="p-3 text-right">
                                    <button onClick={()=>handleOpenGRN(po)} className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all">
                                        Receive Goods
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {pos.filter(p => p.status === POStatus.ISSUED).length === 0 && (
                            <tr><td colSpan={4} className="p-6 text-center text-gray-400 italic">No pending orders to receive.</td></tr>
                        )}
                    </tbody></table>
                </div>
             </div>

             {pendingReplacements.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-6 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-2 mb-4">
                        <RefreshCw className="text-red-600" />
                        <h3 className="font-bold text-red-900">Pending Replacements</h3>
                    </div>
                    <div className="bg-white rounded border border-red-100 overflow-hidden shadow-sm">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-red-100 text-red-800">
                                <tr>
                                    <th className="p-3">PO Ref</th>
                                    <th className="p-3">Item</th>
                                    <th className="p-3">Vendor</th>
                                    <th className="p-3 text-center">Qty Rejected</th>
                                    <th className="p-3">Status</th>
                                    <th className="p-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-red-100">
                            {pendingReplacements.map((item, i) => {
                                 const grn = grns.find(g => g.id === item.grnId);
                                 const vendor = vendors.find(v => pos.find(p => p.id === item.poId)?.vendorId === v.id);
                                 return (
                                    <tr key={i} className="hover:bg-red-50/50">
                                            <td className="p-3 font-mono text-xs text-gray-600">{item.poId}</td>
                                            <td className="p-3 font-medium">{materials.find(m=>m.id===item.materialId)?.name}</td>
                                            <td className="p-3 text-gray-600">{vendor?.name || 'Unknown'}</td>
                                            <td className="p-3 text-center"><span className="bg-red-100 text-red-700 font-bold px-2 py-1 rounded">{item.rejectedQty}</span></td>
                                            <td className="p-3"><span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full border">Awaiting Delivery</span></td>
                                            <td className="p-3 text-right">
                                                {grn && (
                                                    <button onClick={(e)=>handleConfirmReplacement(grn, item.itemIndex, e)} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ml-auto shadow-sm">
                                                        <RefreshCw size={12} /> Receive Replacement
                                                    </button>
                                                )}
                                            </td>
                                    </tr>
                                 )
                            })}
                            </tbody>
                        </table>
                    </div>
                </div>
             )}

             <div className="mt-8">
                 <h3 className="font-bold text-gray-700 mb-3 ml-1">Received History (GRN)</h3>
                 <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="p-3">GRN ID</th>
                                <th className="p-3">PO Ref</th>
                                <th className="p-3">Supplier Ref</th>
                                <th className="p-3">Items Status</th>
                                <th className="p-3">Date</th>
                                <th className="p-3">Docs</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                        {grns.map(g => (
                            <tr key={g.id} className="hover:bg-gray-50">
                                <td className="p-3 font-mono text-xs font-bold text-gray-700">{g.id}</td>
                                <td className="p-3 font-mono text-xs text-gray-500">{g.poId}</td>
                                <td className="p-3 text-gray-700">{g.supplierRef}</td>
                                <td className="p-3">
                                    <div className="space-y-1">
                                        {g.items.map((item, idx) => {
                                            const matName = materials.find(m => m.id === item.materialId)?.name;
                                            return (
                                                <div key={idx} className="text-xs flex justify-between gap-4">
                                                    <span className="font-medium text-gray-700">{matName}</span>
                                                    <div className="flex gap-2">
                                                        {item.acceptedQty > 0 && <span className="text-green-600">Accepted: {item.acceptedQty}</span>}
                                                        {item.rejectedQty > 0 && <span className={item.replacementReceived ? "text-gray-400 line-through" : "text-red-600 font-bold"}>Rejected: {item.rejectedQty}</span>}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </td>
                                <td className="p-3 text-gray-500">{new Date(g.dateReceived).toLocaleDateString()}</td>
                                <td className="p-3"><button onClick={() => openDocument(g.proofUrl)} className="text-blue-600 hover:underline text-xs font-medium">View DO</button></td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                 </div>
             </div>
        </div>
      )}

      {activeTab === 'pay' && (
         <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4"><DollarSign className="text-green-700" /><h3 className="font-bold text-green-900">Pending Payment</h3></div>
                <div className="bg-white rounded-lg border border-green-100 overflow-hidden shadow-sm">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-green-100 text-green-800 uppercase text-xs font-bold tracking-wider">
                            <tr>
                                <th className="p-4">PO ID</th>
                                <th className="p-4">Vendor</th>
                                <th className="p-4">Total Amount</th>
                                <th className="p-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-green-50">
                            {pos.filter(p => p.status === POStatus.RECEIVED).map(po => (
                                <tr key={po.id} className="hover:bg-green-50/50 transition-colors">
                                    <td className="p-4 font-mono font-medium text-gray-700">{po.id}</td>
                                    <td className="p-4 text-gray-900 font-medium">{vendors.find(v=>v.id===po.vendorId)?.name}</td>
                                    <td className="p-4 font-bold text-gray-900">${po.totalAmount.toFixed(2)}</td>
                                    <td className="p-4 text-right">
                                        <button onClick={()=>handleOpenPay(po)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md transform active:scale-95 transition-all flex items-center gap-2 ml-auto">
                                            Make Payment
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {pos.filter(p => p.status === POStatus.RECEIVED).length === 0 && <tr><td colSpan={4} className="p-8 text-center text-gray-400 italic">No pending payments.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="mt-8">
                 <h3 className="font-bold text-gray-700 mb-3 ml-1 text-lg">Payment History</h3>
                 <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 border-b text-gray-600 uppercase text-xs font-bold tracking-wider">
                            <tr>
                                <th className="p-4">Payment ID</th>
                                <th className="p-4">PO Ref</th>
                                <th className="p-4">Reference</th>
                                <th className="p-4">Method</th>
                                <th className="p-4 text-right">Amount</th>
                                <th className="p-4 text-center">Docs</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                        {payments.map(p => (
                            <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                <td className="p-4 font-mono text-xs text-gray-500">{p.id}</td>
                                <td className="p-4 font-mono text-xs text-gray-400 line-through decoration-gray-300">{p.poId}</td>
                                <td className="p-4 font-medium text-gray-800">{p.reference}</td>
                                <td className="p-4"><span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs border border-gray-200 font-medium">{p.method}</span></td>
                                <td className="p-4 text-right font-bold text-green-700">${p.amount.toFixed(2)}</td>
                                <td className="p-4 text-center">{p.proofUrl ? <button onClick={() => openDocument(p.proofUrl || null)} className="text-blue-600 hover:text-blue-800 hover:underline text-xs font-bold flex items-center justify-center gap-1 mx-auto"><FileText size={14} /> View</button> : <span className="text-gray-300 italic text-xs">N/A</span>}</td>
                            </tr>
                        ))}
                        {payments.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-gray-400">No payment history found.</td></tr>}
                        </tbody>
                    </table>
                 </div>
            </div>
         </div>
      )}

      {/* --- MODALS --- */}
      {confirmModal.isOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"><div className="bg-white p-6 rounded max-w-sm"><h3 className="font-bold mb-2">{confirmModal.title}</h3><p className="mb-4">{confirmModal.message}</p><div className="flex justify-end gap-2"><button onClick={()=>setConfirmModal({...confirmModal,isOpen:false})}>Cancel</button><button onClick={executeConfirmation} className="bg-primary-600 text-white px-3 py-1 rounded">Confirm</button></div></div></div>
      )}
      
      {reviewPr && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-xl w-full max-w-md shadow-xl relative">
                <div className="flex justify-between items-start mb-4"><h3 className="font-bold text-xl text-gray-800">Review Request</h3><button onClick={() => setReviewPr(null)} className="p-1 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"><X size={24} /></button></div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 mb-4 text-sm space-y-2">
                    <div className="flex justify-between"><span className="text-gray-500">Request ID:</span><span className="font-mono font-bold text-gray-700">{reviewPr.id}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Target Batch:</span><span className="font-medium text-blue-700">{reviewPr.batchId}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Material:</span><span className="font-medium">{materials.find(m => m.id === reviewPr.materialId)?.name || reviewPr.materialId}</span></div>
                    <div className="flex justify-between border-t pt-2 mt-2"><span className="text-gray-500 font-bold">Requested Qty:</span><span className="font-bold text-lg text-green-700">{reviewPr.requestedQty} Units</span></div>
                </div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin Notes / Remarks</label>
                <textarea className="w-full border rounded-lg p-3 mb-6 focus:ring-2 focus:ring-primary-500 outline-none text-sm" placeholder="Enter reason for rejection or approval notes..." rows={3} value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} />
                <div className="flex gap-3"><button onClick={() => handleProcessReview(RequestStatus.REJECTED)} className="flex-1 bg-white border border-red-200 text-red-600 py-2.5 rounded-lg hover:bg-red-50 font-medium transition-colors">Reject</button><button onClick={() => handleProcessReview(RequestStatus.APPROVED)} className="flex-1 bg-green-600 text-white py-2.5 rounded-lg hover:bg-green-700 font-medium shadow-sm transition-colors">Approve Request</button></div>
            </div>
        </div>
      )}

      {/* MISSING MODAL RESTORED: Create/Edit PR Modal */}
      {showPrModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl p-6 animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-gray-800 mb-4">{editingPrId ? 'Edit Purchase Request' : 'New Purchase Request'}</h3>
            
            <div className="space-y-4">
              {/* Batch Selection */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Target Batch</label>
                <select 
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-primary-500 outline-none"
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  disabled={!!editingPrId}
                >
                  <option value="">Select Batch...</option>
                  {batches.filter(b => b.status !== 'COMPLETED').map(b => (
                    <option key={b.id} value={b.id}>{b.id} ({b.species})</option>
                  ))}
                </select>
              </div>

              {/* Material Selection */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Material Needed</label>
                <select 
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-primary-500 outline-none"
                  value={selectedMaterialId}
                  onChange={(e) => setSelectedMaterialId(e.target.value)}
                  disabled={!selectedBatchId || !!editingPrId}
                >
                  <option value="">Select Material...</option>
                  {selectedBatchId && batches.find(b => b.id === selectedBatchId)?.recipe.map(r => {
                     const mat = materials.find(m => m.id === r.materialId);
                     return <option key={r.materialId} value={r.materialId}>{mat?.name || r.materialId}</option>
                  })}
                </select>
              </div>

              {/* Gap Analysis / Stock Info */}
              {gapAnalysis && (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm space-y-2">
                   <div className="flex justify-between text-gray-600">
                      <span>Required for Batch:</span> 
                      <span className="font-medium">{gapAnalysis.required}</span>
                   </div>
                   <div className="flex justify-between text-gray-600">
                      <span>Physical Stock:</span> 
                      <span className="font-medium">{gapAnalysis.physicalStock}</span>
                   </div>
                   <div className="flex justify-between text-orange-600">
                      <span>Reserved (Other Batches):</span> 
                      <span className="font-medium">-{gapAnalysis.reservedStock}</span>
                   </div>
                   <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-gray-800">
                      <span>Net Available:</span> 
                      <span>{gapAnalysis.availableStock}</span>
                   </div>
                   
                   {gapAnalysis.suggestedRequest > 0 ? (
                       <div className="mt-2 text-xs bg-blue-50 text-blue-700 p-2 rounded border border-blue-100">
                           <AlertCircle className="inline w-3 h-3 mr-1"/>
                           Suggested Request: <strong>{gapAnalysis.suggestedRequest}</strong> (Deficit)
                       </div>
                   ) : (
                       <div className="mt-2 text-xs bg-green-50 text-green-700 p-2 rounded border border-green-100">
                           <CheckCircle className="inline w-3 h-3 mr-1"/>
                           Stock sufficient for this batch.
                       </div>
                   )}
                </div>
              )}

              {/* Request Qty Input */}
              <div>
                 <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Request Quantity</label>
                 <input 
                    type="number" 
                    className="w-full border border-gray-300 rounded-lg p-2.5 font-bold text-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    value={gapAnalysis ? gapAnalysis.requestInput : ''}
                    onChange={(e) => setGapAnalysis(prev => prev ? ({...prev, requestInput: parseFloat(e.target.value)}) : null)}
                    disabled={!gapAnalysis}
                    min="0"
                 />
                 <p className="text-xs text-gray-400 mt-1">Enter 0 to only reserve from existing stock.</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8 border-t border-gray-100 pt-4">
              <button 
                onClick={() => setShowPrModal(false)} 
                className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg font-medium text-sm transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSubmitPR} 
                disabled={!selectedBatchId || !selectedMaterialId || !gapAnalysis}
                className="bg-primary-600 text-white px-6 py-2 rounded-lg font-bold shadow-sm hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors"
              >
                {editingPrId ? 'Update Request' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

    {/* Create PO Modal (Responsive Split + PO Number) */}
    {showPoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-0 lg:p-4 backdrop-blur-sm">
            {/* Main Container */}
            <div className="bg-white lg:rounded-xl w-full max-w-7xl shadow-2xl overflow-hidden flex flex-col h-full lg:h-[95vh]">
                
                {/* 1. Modal Header */}
                <div className="bg-gray-50 border-b p-4 flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="font-bold text-xl text-gray-800 flex items-center gap-2">
                            <FileText className="text-blue-600" /> Generate Purchase Order
                        </h3>
                        <p className="text-xs text-gray-500 mt-1 hidden sm:block">Adjust quantities & prices below. Review the preview on the right.</p>
                    </div>
                    <button 
                        onClick={() => setShowPoModal(false)} 
                        className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* 2. Modal Body: Responsive Split View */}
                <div className="flex flex-col lg:flex-row flex-1 overflow-hidden relative">
                    
                    {/* --- LEFT COLUMN: Controls (Inputs & Editing) --- */}
                    <div className="w-full lg:w-1/3 p-4 lg:p-6 border-r bg-white flex flex-col gap-6 overflow-y-auto shadow-lg z-10 order-1">
                        
                        {/* Section 1: Vendor Selection */}
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                            <label className="block text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
                                <span className="bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">1</span> 
                                Select Vendor
                            </label>
                            <select 
                                className="w-full border border-blue-200 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium text-gray-700"
                                value={poForm.vendorId} 
                                onChange={e => setPoForm({...poForm, vendorId: e.target.value})}
                            >
                                <option value="">-- Choose Vendor --</option>
                                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                            </select>
                        </div>

                        {/* Section 2: EDITABLE LINE ITEMS (The requested feature) */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                <span className="bg-gray-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">2</span> 
                                Edit Items
                            </label>
                            
                            <div className="space-y-3">
                                {poForm.items.map((item, idx) => {
                                    const mat = materials.find(m => m.id === item.materialId);
                                    return (
                                        <div key={idx} className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow bg-white">
                                            {/* Item Name Header */}
                                            <div className="flex justify-between items-start mb-3">
                                                <span className="font-bold text-gray-800 text-sm">{mat?.name || item.materialId}</span>
                                                <button 
                                                    onClick={() => {
                                                        const newItems = poForm.items.filter((_, i) => i !== idx);
                                                        setPoForm({ ...poForm, items: newItems });
                                                    }}
                                                    className="text-red-400 hover:text-red-600"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>

                                            {/* Editable Inputs Row */}
                                            <div className="flex gap-3">
                                                {/* Quantity Input */}
                                                <div className="flex-1">
                                                    <label className="text-[10px] text-gray-500 font-bold uppercase block mb-1">Qty</label>
                                                    <input 
                                                        type="number" 
                                                        min="1"
                                                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition-all"
                                                        value={item.quantity}
                                                        onChange={(e) => {
                                                            const val = parseFloat(e.target.value) || 0;
                                                            const newItems = [...poForm.items];
                                                            newItems[idx].quantity = val;
                                                            newItems[idx].total = val * newItems[idx].unitPrice;
                                                            setPoForm({ ...poForm, items: newItems });
                                                        }}
                                                    />
                                                </div>

                                                {/* Price Input */}
                                                <div className="flex-1">
                                                    <label className="text-[10px] text-gray-500 font-bold uppercase block mb-1">Price ($)</label>
                                                    <input 
                                                        type="number" 
                                                        min="0.01"
                                                        step="0.01"
                                                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition-all"
                                                        value={item.unitPrice}
                                                        onChange={(e) => {
                                                            const val = parseFloat(e.target.value) || 0;
                                                            const newItems = [...poForm.items];
                                                            newItems[idx].unitPrice = val;
                                                            newItems[idx].total = newItems[idx].quantity * val;
                                                            setPoForm({ ...poForm, items: newItems });
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                            
                                            {/* Row Total (Calculated) */}
                                            <div className="mt-2 text-right text-xs font-bold text-gray-500 border-t pt-2 border-dashed">
                                                Total: <span className="text-gray-900">${(item.quantity * item.unitPrice).toFixed(2)}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                                
                                {poForm.items.length === 0 && (
                                    <div className="text-center p-4 border-2 border-dashed rounded-lg text-gray-400 text-sm">
                                        No items selected.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Section 3: Upload */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                <span className="bg-gray-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">3</span>
                                Attach Quotation
                            </label>
                            <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${poForm.quotationFile ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:bg-gray-50'}`}>
                                <label className={`cursor-pointer block group ${isUploading ? 'pointer-events-none opacity-50' : ''}`}>
                                    {isUploading ? (
                                        <Loader2 className="mx-auto mb-2 animate-spin text-blue-500" size={24} />
                                    ) : (
                                        <Upload className={`mx-auto mb-2 ${poForm.quotationFile ? 'text-green-600' : 'text-gray-400 group-hover:text-blue-500'}`} size={24} />
                                    )}
                                    <span className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-md text-xs font-medium group-hover:bg-blue-50 group-hover:border-blue-200 transition-all shadow-sm">
                                        {isUploading ? 'Uploading...' : 'Browse Files'}
                                    </span>
                                    <input type="file" onChange={(e) => handleFileUpload(e, 'quotation')} className="hidden" accept="image/*,.pdf" disabled={isUploading} />
                                </label>
                                {poForm.quotationFile && !isUploading ? (
                                    <div className="mt-2 text-xs text-green-700 font-bold flex items-center justify-center gap-1">
                                        <CheckCircle size={12}/> File Attached
                                    </div>
                                ) : (
                                    <p className="text-[10px] text-gray-400 mt-2">Required (PDF/JPG)</p>
                                )}
                            </div>
                        </div>

                    </div>

                    {/* --- RIGHT COLUMN: Live Document Preview (Read Only) --- */}
                    <div className="w-full lg:w-2/3 p-4 lg:p-8 bg-gray-100 overflow-y-auto flex justify-center order-2">
                        <div className="bg-white shadow-xl p-6 lg:p-10 min-h-[600px] lg:min-h-[800px] w-full max-w-3xl text-sm relative border border-gray-200">
                            
                            {/* Document Header */}
                            <div className="flex flex-col sm:flex-row justify-between items-start mb-8 border-b-2 border-gray-800 pb-6 gap-4">
                                <div>
                                    <h1 className="text-2xl lg:text-3xl font-extrabold text-gray-900 mb-2 tracking-tight">MyceliumNexus</h1>
                                    <div className="text-gray-500 text-xs leading-relaxed">
                                        <p>123 Mushroom Lane</p>
                                        <p>Fungi Valley, AG 54321</p>
                                        <p>Reg No: 2024-MYC-001</p>
                                    </div>
                                </div>
                                <div className="text-left sm:text-right w-full sm:w-auto">
                                    <h2 className="text-xl lg:text-2xl font-bold text-blue-600 uppercase tracking-widest">Purchase Order</h2>
                                    <p className="text-gray-800 font-mono mt-1 text-lg font-bold">
                                        # {poForm.id || `PO-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}${String(new Date().getDate()).padStart(2,'0')}-REF`}
                                    </p>
                                    <p className="text-gray-500 font-bold mt-1 text-xs">{new Date().toLocaleDateString()}</p>
                                </div>
                            </div>

                            {/* Vendor & Ship To Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-8">
                                <div>
                                    <h3 className="font-bold text-gray-400 text-xs uppercase tracking-widest mb-3 border-b w-full pb-1">Vendor Details</h3>
                                    {poForm.vendorId ? (
                                        (() => {
                                            const v = vendors.find(ven => ven.id === poForm.vendorId);
                                            return (
                                                <div className="text-gray-700 space-y-1">
                                                    <p className="font-bold text-lg text-black">{v?.name}</p>
                                                    <p className="flex items-center gap-2">{v?.email}</p>
                                                    <p>{v?.phone}</p>
                                                </div>
                                            )
                                        })()
                                    ) : (
                                        <div className="text-red-400 italic text-xs">⚠ Select vendor on the left</div>
                                    )}
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-400 text-xs uppercase tracking-widest mb-3 border-b w-full pb-1">Ship To</h3>
                                    <div className="text-gray-700 space-y-1">
                                        <p className="font-bold text-black">{user.entityId} Farm</p>
                                        <p>Attn: Receiving Department</p>
                                        <p>123 Mushroom Lane</p>
                                    </div>
                                </div>
                            </div>

                            {/* Line Items Table (Preview Only) */}
                            <div className="border rounded-lg overflow-hidden mb-8">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-gray-800 text-white text-xs uppercase tracking-wider">
                                            <th className="py-2 px-3 text-left font-medium">Item</th>
                                            <th className="py-2 px-3 text-right font-medium">Qty</th>
                                            <th className="py-2 px-3 text-right font-medium">Price</th>
                                            <th className="py-2 px-3 text-right font-medium">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {poForm.items.map((item, idx) => {
                                        const mat = materials.find(m => m.id === item.materialId);
                                        return (
                                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                <td className="py-3 px-3 font-medium text-gray-800">{mat?.name || item.materialId}</td>
                                                <td className="py-3 px-3 text-right text-gray-600">{item.quantity}</td>
                                                <td className="py-3 px-3 text-right text-gray-600">${item.unitPrice.toFixed(2)}</td>
                                                <td className="py-3 px-3 text-right font-bold text-gray-900">${(item.quantity * item.unitPrice).toFixed(2)}</td>
                                            </tr>
                                        );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Totals */}
                            <div className="flex justify-end">
                                <div className="w-full sm:w-1/2 bg-gray-50 p-4 rounded-lg border border-gray-100">
                                    <div className="flex justify-between font-extrabold text-xl text-blue-900">
                                        <span>Total:</span>
                                        <span>${poForm.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Signature */}
                            <div className="mt-12 pt-8 border-t-2 border-dotted border-gray-300 grid grid-cols-2 gap-10">
                                <div>
                                    <p className="h-8"></p>
                                    <p className="border-t border-gray-400 pt-2 text-[10px] uppercase tracking-wider text-gray-500">Authorized Signature</p>
                                </div>
                                <div>
                                    <p className="h-8"></p>
                                    <p className="border-t border-gray-400 pt-2 text-[10px] uppercase tracking-wider text-gray-500">Date</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Footer Actions */}
                <div className="bg-white border-t p-4 flex justify-between items-center shrink-0 z-20">
                    <div className="hidden sm:block">
                        <span className="font-bold text-lg text-blue-900 mr-2">
                            Total: ${poForm.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0).toFixed(2)}
                        </span>
                    </div>
                    <div className="flex gap-3 w-full sm:w-auto">
                        <button 
                            onClick={() => setShowPoModal(false)} 
                            className="flex-1 sm:flex-none px-6 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSavePO} 
                            disabled={isUploading}
                            className={`flex-1 sm:flex-none px-8 py-2.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 flex items-center justify-center gap-2 shadow-lg ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {isUploading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
                            {isUploading ? 'Uploading...' : 'Generate PO'}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    )}

      {/* GRN Modal (Auto-Calculation + Split Input) */}
      {showGrnModal && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
                
                {/* Header */}
                <div className="bg-white p-6 border-b flex justify-between items-center">
                    <div>
                        <h3 className="font-bold text-lg text-gray-800">Goods Receipt (GRN)</h3>
                        <p className="text-xs text-gray-500">Verify items against Supplier Delivery Order.</p>
                    </div>
                    <button onClick={()=>setShowGrnModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
                </div>

                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                     {/* Reference Inputs */}
                     <div className="grid grid-cols-2 gap-4">
                         <div>
                             <label className="block text-xs font-bold text-gray-500 uppercase mb-1">PO Reference</label>
                             <div className="bg-gray-100 border border-gray-200 rounded p-2 text-sm font-mono text-gray-600">{grnForm.poId}</div>
                         </div>
                         <div>
                             <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Supplier DO/Invoice No <span className="text-red-500">*</span></label>
                             <input 
                                className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" 
                                placeholder="e.g. DO-1234"
                                value={grnForm.supplierRef} 
                                onChange={e=>setGrnForm({...grnForm, supplierRef: e.target.value})}
                             />
                         </div>
                     </div>

                     {/* Item Inspection Table (Split Logic) */}
                     <div>
                        <h4 className="text-sm font-bold text-gray-700 mb-2">Item Inspection</h4>
                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                                    <tr>
                                        <th className="p-3 text-left">Material</th>
                                        <th className="p-3 text-center w-24">Ordered</th>
                                        <th className="p-3 text-center w-32 text-green-600">Good</th>
                                        <th className="p-3 text-center w-32 text-red-600">Reject</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {grnForm.items.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="p-3 font-medium text-gray-800">
                                                {materials.find(m => m.id === item.materialId)?.name}
                                            </td>
                                            <td className="p-3 text-center font-bold text-gray-500">
                                                {item.poQty}
                                            </td>
                                            {/* GOOD QTY INPUT */}
                                            <td className="p-3">
                                                <input 
                                                    type="number" 
                                                    className="w-full border border-green-200 bg-green-50 rounded p-1 text-center font-bold text-green-700 focus:ring-2 focus:ring-green-500 outline-none"
                                                    value={item.acceptedQty}
                                                    min={0}
                                                    max={item.poQty}
                                                    onChange={(e) => updateGrnItem(idx, 'acceptedQty', parseInt(e.target.value) || 0)}
                                                />
                                            </td>
                                            {/* REJECT QTY INPUT */}
                                            <td className="p-3">
                                                 <input 
                                                    type="number" 
                                                    className="w-full border border-red-200 bg-red-50 rounded p-1 text-center font-bold text-red-700 focus:ring-2 focus:ring-red-500 outline-none"
                                                    value={item.rejectedQty}
                                                    min={0}
                                                    max={item.poQty}
                                                    onChange={(e) => updateGrnItem(idx, 'rejectedQty', parseInt(e.target.value) || 0)}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="text-xs text-gray-400 mt-2 italic">* Accepted Qty will be added to stock immediately. Rejected Qty will be flagged for replacement.</p>
                     </div>

                     {/* Upload */}
                     <div>
                         <label className="block text-xs font-bold text-gray-700 uppercase mb-2">Upload Proof (DO/Invoice) <span className="text-red-500">*</span></label>
                         <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${grnForm.proofUrl ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:bg-gray-50'}`}>
                            <label className={`cursor-pointer block ${isUploading ? 'pointer-events-none opacity-50' : ''}`}>
                                {isUploading ? (
                                    <Loader2 className="mx-auto mb-2 animate-spin text-orange-500" size={24} />
                                ) : (
                                    <Upload className={`mx-auto mb-2 ${grnForm.proofUrl ? 'text-green-600' : 'text-gray-400'}`} size={24} />
                                )}
                                <span className="text-xs font-bold text-gray-500">{isUploading ? 'Uploading...' : 'Click to Upload Document'}</span>
                                <input type="file" onChange={(e)=>handleFileUpload(e, 'grn')} className="hidden" disabled={isUploading}/>
                            </label>
                            {grnForm.proofUrl && !isUploading && <p className="text-xs text-green-700 font-bold mt-2">Document Attached ✓</p>}
                         </div>
                     </div>
                </div>

                <div className="bg-gray-50 p-4 border-t flex justify-end gap-3">
                    <button onClick={()=>setShowGrnModal(false)} className="px-5 py-2 rounded-lg text-gray-600 hover:bg-gray-200 font-medium">Cancel</button>
                    <button onClick={handleSaveGRN} disabled={isUploading} className={`bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg font-bold shadow-lg transform active:scale-95 transition-all ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>Confirm Receipt</button>
                </div>
            </div>
          </div>
      )}

      {/* Pay Modal (Redesigned: Clean Card Layout) */}
      {showPayModal && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[70] p-4 backdrop-blur-sm transition-all">
            <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl transform scale-100 animate-in fade-in zoom-in-95">
                
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-100">
                    <h3 className="text-xl font-bold text-gray-800">Process Payment</h3>
                    <button 
                        onClick={()=>setShowPayModal(false)} 
                        className="p-1 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
                
                {/* Body Form */}
                <div className="p-6 space-y-5">
                    
                    {/* 1. PO Reference (Read-Only) */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">PO Reference</label>
                        <div className="w-full bg-gray-50 border border-gray-200 text-gray-700 px-4 py-3 rounded-lg font-mono text-sm shadow-inner">
                            {payForm.poId}
                        </div>
                    </div>

                    {/* 2. Amount Input */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Amount ($)</label>
                        <input 
                            type="number" 
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none font-bold text-gray-900 text-lg shadow-sm transition-all"
                            value={payForm.amount}
                            onChange={(e) => setPayForm({...payForm, amount: parseFloat(e.target.value) || 0})}
                        />
                    </div>

                    {/* 3. Payment Method Dropdown (New Types Added) */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Payment Method</label>
                        <div className="relative">
                            <select 
                                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-green-500 outline-none bg-white text-gray-700 font-medium appearance-none shadow-sm cursor-pointer"
                                value={payForm.method}
                                onChange={(e) => setPayForm({...payForm, method: e.target.value})}
                            >
                                <option value="Bank Transfer">Bank Transfer</option>
                                <option value="Cash">Cash</option>
                                <option value="Credit Card">Credit Card</option>
                                <option value="E-Wallet">E-Wallet</option>
                                <option value="Cheque">Cheque</option>
                            </select>
                            {/* Custom Arrow Icon */}
                            <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-500">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </div>
                        </div>
                    </div>

                    {/* 4. Reference / Transaction ID */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Reference / Transaction ID <span className="text-red-500">*</span></label>
                        <input 
                            type="text" 
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-green-500 outline-none transition-all placeholder-gray-400 text-gray-800 shadow-sm"
                            placeholder="e.g. MBB-123456-TRX"
                            value={payForm.reference}
                            onChange={(e) => setPayForm({...payForm, reference: e.target.value})}
                        />
                    </div>

                    {/* 5. Upload Receipt */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Upload Receipt (Mandatory)</label>
                        <div className="flex items-center gap-3 p-3 border border-dashed border-gray-300 rounded-lg bg-gray-50">
                            <label className={`cursor-pointer bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 hover:border-green-300 px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 shadow-sm ${isUploading ? 'pointer-events-none opacity-50' : ''}`}>
                                {isUploading ? <Loader2 className="animate-spin" size={16} /> : 'Choose File'}
                                <input 
                                    type="file" 
                                    className="hidden" 
                                    onChange={(e)=>handleFileUpload(e, 'payment')} 
                                    accept="image/*,.pdf"
                                    disabled={isUploading}
                                />
                            </label>
                            {payForm.proofUrl && !isUploading ? (
                                <div className="flex items-center gap-2 text-sm text-gray-700">
                                    <FileText size={16} className="text-red-500"/>
                                    <span className="font-medium truncate max-w-[200px]">Receipt_Attached</span>
                                    <CheckCircle size={14} className="text-green-500" />
                                </div>
                            ) : (
                                <span className="text-xs text-gray-400 italic">{isUploading ? 'Uploading...' : 'No file chosen'}</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end gap-3">
                    <button 
                        onClick={()=>setShowPayModal(false)} 
                        className="px-6 py-2.5 text-gray-500 hover:text-gray-700 font-bold hover:bg-gray-200 rounded-lg transition-colors text-sm"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSavePayment} 
                        disabled={isUploading}
                        className={`bg-green-600 hover:bg-green-700 text-white px-8 py-2.5 rounded-lg font-bold shadow-lg transform active:scale-95 transition-all text-sm flex items-center gap-2 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        Confirm Payment
                    </button>
                </div>

            </div>
          </div>
      )}

    </div>
  );
};