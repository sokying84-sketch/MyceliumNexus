import React, { useState, useEffect } from 'react';
import { User, DeliveryOrder } from '../types';
import { StorageService } from '../services/storageService';
import { Truck, Mail, CheckCircle, XCircle, Clock, Calendar, Package } from 'lucide-react';
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from '../firebase';

interface Props {
  user: User;
}

export const OrderDelivery: React.FC<Props> = ({ user }) => {
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [selectedOrder, setSelectedOrder] = useState<DeliveryOrder | null>(null);

  const KEYS = StorageService.getKeys();

  // --- NEW REAL-TIME LISTENER ---
  useEffect(() => {
    // Listen to "mn_delivery_orders" specifically for this farm (user.entityId)
    const q = query(
        collection(db, "mn_delivery_orders"), 
        where("entityId", "==", user.entityId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const liveOrders: DeliveryOrder[] = [];
        snapshot.forEach((doc) => {
            // Combine ID with data (though data usually has ID, this is safe)
            liveOrders.push({ id: doc.id, ...doc.data() } as DeliveryOrder);
        });

        // Sort by newest first
        liveOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        setOrders(liveOrders);
    }, (error) => {
        console.error("Error listening to orders:", error);
    });

    // Cleanup listener when leaving page
    return () => unsubscribe();
  }, [user.entityId]);

  const updateStatus = (order: DeliveryOrder, status: DeliveryOrder['status']) => {
    let updatedOrder = { ...order, status };
    
    if (status === 'IN_TRANSIT') {
        const emailBody = `Subject: 🚚 IN TRANSIT: Fresh Mushroom Delivery Dispatched

Delivery Order #${order.id}

Dear Village C Team,

This is an automated notification that your order is now ON THE WAY.

Driver: John Doe (Simulated)
Vehicle: Truck A (Plate: WXY 1234)
Estimated Arrival: Within 2 Hours
Items: Fresh Mushrooms (${order.estimatedYield} kg)

Please ensure your receiving bay is clear.

Thank you,
${user.entityId === 'ent_001' ? 'Green Spore Co-op' : 'MyceliumNexus Farm'}`;
        
        updatedOrder.emailContent = emailBody;
        
        setSelectedOrder(updatedOrder);
        alert(`Notification Triggered: Email sent to ${order.recipient} regarding transit status.`);
        
        // --- SYNC BATCH STATUS (Critical for Processing Alert) ---
        try {
            const currentBatch = StorageService.getAll<any>(KEYS.BATCHES, user.entityId)
                                 .find((b: any) => b.id === order.batchId);     
            if (currentBatch) {
                 const batchUpdate = { ...currentBatch, status: 'IN_TRANSIT' };
                 StorageService.update(KEYS.BATCHES, batchUpdate);
            }
        } catch (e) { console.error("Batch sync error", e); }
    }

    StorageService.update(KEYS.DELIVERY_ORDERS, updatedOrder);
    StorageService.logActivity(user.entityId, user, 'UPDATE_DELIVERY', `Updated Delivery Order ${order.id} to ${status}`);
    
    // Listener will auto-update UI
    if (selectedOrder?.id === order.id && status !== 'IN_TRANSIT') setSelectedOrder(updatedOrder);
  };

  const handleDateUpdate = (order: DeliveryOrder, newDate: string) => {
      if (!newDate) return;
      const updatedOrder = { ...order, deliveryDate: new Date(newDate).toISOString() };
      StorageService.update(KEYS.DELIVERY_ORDERS, updatedOrder);
  };

  const filteredOrders = orders.filter(o => {
    if (activeTab === 'active') return ['PENDING', 'CONFIRMED', 'IN_TRANSIT'].includes(o.status);
    return ['DELIVERED', 'CANCELLED'].includes(o.status);
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'CONFIRMED': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'IN_TRANSIT': return 'bg-purple-100 text-purple-800 border-purple-200 animate-pulse';
      case 'DELIVERED': return 'bg-green-100 text-green-800 border-green-200';
      case 'CANCELLED': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
             <Truck className="text-primary-600" /> Order Delivery
           </h2>
           <p className="text-sm text-gray-500">Manage delivery alerts and logistics to Village C.</p>
        </div>
        
        <div className="flex bg-white rounded-lg p-1 border shadow-sm">
            <button 
                onClick={() => setActiveTab('active')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'active' ? 'bg-primary-100 text-primary-800' : 'text-gray-500 hover:bg-gray-50'}`}
            >
                <Clock size={16} /> Active Deliveries
            </button>
            <button 
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'history' ? 'bg-primary-100 text-primary-800' : 'text-gray-500 hover:bg-gray-50'}`}
            >
                <CheckCircle size={16} /> History
            </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600 uppercase border-b">
              <tr>
                <th className="p-4">Order ID</th>
                <th className="p-4">Batch Info</th>
                <th className="p-4">Est. Yield</th>
                <th className="p-4">Delivery Date</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredOrders.map(order => (
                <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 font-mono font-medium text-gray-700">{order.id}</td>
                  <td className="p-4">
                    <div className="font-medium text-gray-900">{order.species}</div>
                    <div className="text-xs text-gray-500">ID: {order.batchId}</div>
                    {order.flushNumber && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-800 mt-1">
                            Flush #{order.flushNumber}
                        </span>
                    )}
                  </td>
                  <td className="p-4 font-bold text-gray-800">{order.estimatedYield} kg</td>
                  <td className="p-4 text-gray-600">
                    {order.status === 'PENDING' ? (
                        <input 
                            type="date" 
                            className="border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                            value={order.deliveryDate.split('T')[0]} 
                            onChange={(e) => handleDateUpdate(order, e.target.value)}
                        />
                    ) : (
                        <div className="flex items-center gap-2">
                            <Calendar size={14} />
                            {new Date(order.deliveryDate).toLocaleDateString()}
                        </div>
                    )}
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase border ${getStatusColor(order.status)}`}>
                      {order.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-4 flex justify-center gap-2">
                    <button 
                      onClick={() => setSelectedOrder(order)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded border border-transparent hover:border-blue-100" 
                      title="View Email Alert"
                    >
                      <Mail size={16} />
                    </button>
                    
                    {activeTab === 'active' && (
                        <>
                            {(order.status === 'PENDING' || order.status === 'CONFIRMED') && (
                                <button onClick={() => updateStatus(order, 'IN_TRANSIT')} className="p-1.5 text-purple-600 hover:bg-purple-50 rounded" title="Manual Start Transit"><Truck size={16} /></button>
                            )}
                            {order.status === 'IN_TRANSIT' && (
                                <button onClick={() => updateStatus(order, 'DELIVERED')} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Mark Delivered (Manual Override)"><Package size={16} /></button>
                            )}
                            <button onClick={() => updateStatus(order, 'CANCELLED')} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Cancel"><XCircle size={16} /></button>
                        </>
                    )}
                  </td>
                </tr>
              ))}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-gray-400">
                    <Truck size={48} className="mx-auto mb-3 opacity-20" />
                    <p>No orders found in this view.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Email Viewer Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[80vh]">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center rounded-t-xl">
              <h3 className="font-bold text-gray-800 flex items-center gap-2"><Mail size={18} /> Notification Preview</h3>
              <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-600"><XCircle size={20} /></button>
            </div>
            <div className="p-6 bg-gray-100 flex-1 overflow-y-auto">
                <div className="bg-white p-6 shadow-sm border border-gray-200 rounded">
                    <div className="border-b pb-4 mb-4 text-sm text-gray-600 space-y-1">
                        <div><span className="font-bold text-gray-800">To:</span> {selectedOrder.recipient}</div>
                        <div><span className="font-bold text-gray-800">Date:</span> {new Date(selectedOrder.createdAt).toLocaleString()}</div>
                        <div><span className="font-bold text-gray-800">Status:</span> {selectedOrder.status}</div>
                    </div>
                    <div className="whitespace-pre-wrap text-gray-800 text-sm leading-relaxed font-serif">
                        {selectedOrder.emailContent}
                    </div>
                </div>
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-end">
                <button onClick={() => setSelectedOrder(null)} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-100">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};