import React, { useState, useEffect, useRef } from 'react';
import { Camera, Send, User, MessageSquareQuote, ClipboardList, Trash2, Loader2 } from 'lucide-react';
import { ProductionStage, User as UserType } from '../types';
import { StorageService } from '../services/storageService';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface Props {
  batchId: string;
  stage: ProductionStage;
  user: UserType;
  readOnly?: boolean;
}

export const SmartNotes: React.FC<Props> = ({ batchId, stage, user, readOnly = false }) => {
  const [notes, setNotes] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      if (!batchId) return;

      const loadData = () => {
          // 1. Fetch ONLY from 'mn_smart_notes' collection
          const allNotes = StorageService.getAll<any>('mn_smart_notes', user.entityId);
          
          // 2. Filter for current Batch and Stage
          const filteredNotes = allNotes.filter(n => 
              n.batchId === batchId && 
              n.stage === stage
          );

          // 3. Sort by Timestamp (Oldest top, Newest bottom)
          const sortedNotes = filteredNotes.sort((a, b) => {
              const dateA = new Date(a.timestamp || a.date || 0).getTime();
              const dateB = new Date(b.timestamp || b.date || 0).getTime();
              return dateA - dateB;
          });

          setNotes(sortedNotes);
      };

      loadData();
      const unsub = StorageService.subscribe(loadData);
      return () => unsub();
  }, [batchId, stage, user.entityId]);

  // Auto-scroll to bottom
  useEffect(() => {
      if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
  }, [notes]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPhotoUrl(URL.createObjectURL(file));
    }
  };

  const handleClearAttachment = () => {
    setPhotoUrl(null);
    setSelectedFile(null);
  };

  const handleSend = async () => {
    if ((!inputText.trim() && !selectedFile) || isUploading) return;

    try {
      setIsUploading(true);
      let downloadUrl = undefined;

      if (selectedFile) {
        // Upload to Firebase Storage
        const storagePath = `smart_notes/${user.entityId}/${batchId}/${Date.now()}_${selectedFile.name}`;
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, selectedFile);
        downloadUrl = await getDownloadURL(storageRef);
      }

      // Create New Note
      const newNote = {
        id: `note_${Date.now()}`,
        batchId,
        stage,
        entityId: user.entityId, 
        content: inputText,
        photoUrl: downloadUrl, // Store the Storage URL
        userName: user.name,      
        userId: user.id,          
        timestamp: new Date().toISOString()
      };

      await StorageService.add('mn_smart_notes', newNote);
      
      setInputText('');
      handleClearAttachment();
    } catch (error) {
      console.error("Error saving note:", error);
      alert("Failed to save note. Please check your connection.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[600px] sticky top-6">
      {/* Header */}
      <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
        <h4 className="font-bold text-gray-700 flex items-center gap-2 text-sm uppercase">
           <ClipboardList size={16}/> Smart Notes & Photos
        </h4>
        <span className="text-[10px] text-gray-500 bg-white border px-2 py-0.5 rounded-full">{notes.length} Notes</span>
      </div>

      {/* Notes List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/30" ref={scrollRef}>
        {notes.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 text-xs italic">
            <MessageSquareQuote size={32} className="mb-2 opacity-20"/>
            <p>No notes recorded yet.</p>
            <p className="text-[10px] mt-1">Share observations or upload photos.</p>
          </div>
        )}
        
        {notes.map((note) => {
          // Normalize field access & Logic
          const noteUser = note.userName || note.user || 'Unknown';
          const noteDate = note.timestamp || note.date || new Date().toISOString();
          
          // Case-insensitive check for user ownership
          const isMe = note.userId === user.id || noteUser.toLowerCase() === user.name.toLowerCase();
          const dateObj = new Date(noteDate);

          return (
            <div key={note.id} className={`flex gap-3 animate-in fade-in slide-in-from-bottom-2 ${isMe ? 'flex-row-reverse' : ''}`}>
               
               {/* Avatar */}
               <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-sm ${isMe ? 'bg-primary-100 text-primary-600' : 'bg-white border border-gray-200 text-gray-500'}`}>
                 <User size={14} />
               </div>
               
               {/* Bubble */}
               <div className={`flex-1 min-w-0 max-w-[85%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                  <div className={`flex items-center gap-2 mb-1 px-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <span className="font-bold text-xs text-gray-700">{noteUser}</span>
                    <span className="text-[10px] text-gray-400">
                      {dateObj.toLocaleDateString()} {dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                  
                  <div className={`text-sm p-3 shadow-sm border ${isMe ? 'bg-primary-50 border-primary-100 rounded-tr-none rounded-l-xl rounded-br-xl' : 'bg-white border-gray-200 rounded-tl-none rounded-r-xl rounded-bl-xl'}`}>
                     {note.content && <p className="whitespace-pre-wrap text-gray-800">{note.content}</p>}
                     
                     {/* FIXED: Image Rendering Logic */}
                     {note.photoUrl && (
                       <div className="mt-2">
                         <img 
                            src={note.photoUrl} 
                            alt="Attachment" 
                            className="max-w-full h-auto max-h-48 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-95" 
                            onClick={() => {
                                const w = window.open('about:blank');
                                if(w) {
                                    const img = new Image();
                                    img.src = note.photoUrl;
                                    setTimeout(() => w.document.write(img.outerHTML), 0);
                                }
                            }} 
                         />
                       </div>
                     )}
                  </div>
               </div>
            </div>
          );
        })}
      </div>

      {/* Input Area */}
      {!readOnly && (
        <div className="p-3 bg-white border-t">
           {photoUrl && (
             <div className="mb-2 relative inline-block group">
                <img src={photoUrl} className="h-16 w-16 object-cover rounded-lg border border-gray-200" />
                <button onClick={handleClearAttachment} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors">
                    <Trash2 size={10} />
                </button>
             </div>
           )}
           <div className="flex gap-2 items-center">
              <label className={`cursor-pointer p-2 rounded-lg transition-colors ${isUploading ? 'text-gray-300' : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50'}`} title="Attach Photo">
                <Camera size={20} />
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={isUploading} />
              </label>
              <div className="flex-1 relative">
                  <input 
                    type="text" 
                    className="w-full border border-gray-300 rounded-full pl-4 pr-10 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all shadow-inner bg-gray-50 focus:bg-white"
                    placeholder="Type your observations..."
                    value={inputText}
                    disabled={isUploading}
                    onChange={e => setInputText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                  />
              </div>
              <button 
                onClick={handleSend}
                disabled={(!inputText && !photoUrl) || isUploading}
                className={`bg-primary-600 text-white p-2.5 rounded-full shadow-md transition-transform flex items-center justify-center ${isUploading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-primary-700 active:scale-95'}`}
              >
                {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="ml-0.5" />}
              </button>
           </div>
        </div>
      )}
    </div>
  );
};