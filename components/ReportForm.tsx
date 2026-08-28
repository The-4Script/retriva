
import React, { useState, useRef, useEffect } from 'react';
import { ItemReport, ReportType, ItemCategory, User } from '../types';
import { generateSmartReport } from '../services/aiService';
import { uploadImage } from '../services/cloudinary';
import { Loader2, MapPin, X, Check, Sparkles, Box, SearchX, ShieldBan, UploadCloud, AlertCircle, Wand2, Info, LayoutTemplate, Palette, Tag, EyeOff, Edit2, ShieldAlert, Cpu, Layers } from 'lucide-react';

interface ReportFormProps {
  type: ReportType;
  user: User;
  initialData?: ItemReport;
  onSubmit: (report: ItemReport) => void;
  onCancel: () => void;
}

type AIFeedback = {
  severity: 'BLOCK' | 'CAUTION' | 'SUCCESS';
  type: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

interface ImageStatus {
  url: string; // Base64 for preview, or Cloudinary URL for existing
  file?: File; // Raw file to upload
  status: 'checking' | 'valid' | 'prank' | 'caution' | 'redacted';
  reason?: string;
}

// --- SCHEMA DEFINITIONS ---
// Defines which fields are shown for each category
const CATEGORY_SCHEMAS: Record<ItemCategory, { key: string; label: string; placeholder: string; required?: boolean }[]> = {
  [ItemCategory.ELECTRONICS]: [
    { key: 'brand', label: 'Brand', placeholder: 'e.g. Apple, Dell', required: true },
    { key: 'model', label: 'Model', placeholder: 'e.g. iPhone 13, XPS 15' },
    { key: 'serial', label: 'Serial Number / IMEI', placeholder: 'Found in settings or on back' },
    { key: 'color', label: 'Device Color', placeholder: 'e.g. Space Grey' },
  ],
  [ItemCategory.ID_CARDS]: [
    { key: 'issuer', label: 'Issuer', placeholder: 'e.g. University, Government', required: true },
    { key: 'nameOnCard', label: 'Name on Card', placeholder: 'Full Name' },
    { key: 'type', label: 'Card Type', placeholder: 'e.g. Student ID, Driver License' },
  ],
  [ItemCategory.CLOTHING]: [
    { key: 'type', label: 'Type', placeholder: 'e.g. Jacket, Hoodie', required: true },
    { key: 'brand', label: 'Brand', placeholder: 'e.g. Nike, H&M' },
    { key: 'size', label: 'Size', placeholder: 'e.g. M, L, 10' },
    { key: 'material', label: 'Material', placeholder: 'e.g. Denim, Cotton' },
  ],
  [ItemCategory.ACCESSORIES]: [
    { key: 'type', label: 'Item Type', placeholder: 'e.g. Watch, Jewelry, Bag', required: true },
    { key: 'brand', label: 'Brand', placeholder: 'e.g. Rolex, Fossil' },
    { key: 'material', label: 'Material', placeholder: 'e.g. Leather, Gold' },
  ],
  [ItemCategory.STATIONERY]: [
     { key: 'type', label: 'Item', placeholder: 'e.g. Notebook, Calculator', required: true },
     { key: 'color', label: 'Color', placeholder: 'e.g. Red' },
  ],
  [ItemCategory.BOOKS]: [
      { key: 'title', label: 'Book Title', placeholder: 'Full Title', required: true },
      { key: 'author', label: 'Author', placeholder: 'Author Name' },
      { key: 'edition', label: 'Edition', placeholder: 'e.g. 3rd Edition' }
  ],
  [ItemCategory.OTHER]: [
    { key: 'item', label: 'Item Name', placeholder: 'What is it?', required: true },
    { key: 'color', label: 'Color', placeholder: 'Dominant Color' },
    { key: 'material', label: 'Material', placeholder: 'e.g. Plastic, Metal' },
  ],
  [ItemCategory.BAGS]: [
    { key: 'type', label: 'Bag Type', placeholder: 'e.g. Backpack, Tote', required: true },
    { key: 'brand', label: 'Brand', placeholder: 'e.g. Jansport, Nike' },
    { key: 'color', label: 'Color', placeholder: 'Dominant Color' },
  ],
  [ItemCategory.KEYS]: [
    { key: 'type', label: 'Key Type', placeholder: 'e.g. Car Key, House Key', required: true },
    { key: 'identifyingFeature', label: 'Keychain / Tag', placeholder: 'e.g. Red lanyard, Batman keychain' },
  ],
  [ItemCategory.BOTTLES]: [
    { key: 'brand', label: 'Brand', placeholder: 'e.g. Hydroflask, Yeti', required: true },
    { key: 'color', label: 'Color', placeholder: 'Dominant Color' },
    { key: 'material', label: 'Material', placeholder: 'e.g. Metal, Plastic' },
  ],
  [ItemCategory.SPORTS]: [
    { key: 'type', label: 'Equipment Type', placeholder: 'e.g. Basketball, Racket', required: true },
    { key: 'brand', label: 'Brand', placeholder: 'e.g. Spalding, Wilson' },
    { key: 'color', label: 'Color', placeholder: 'Dominant Color' },
  ]
};

const ReportForm: React.FC<ReportFormProps> = ({ type: initialType, user, initialData, onSubmit, onCancel }) => {
  const [reportType, setReportType] = useState<ReportType>(initialData?.type || initialType);
  const isLost = reportType === ReportType.LOST;
  const isEdit = !!initialData;
  
  // Basic Fields
  const [date, setDate] = useState(initialData?.date ? convertDDMMtoYYYYMM(initialData.date) : new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(initialData?.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
  const [title, setTitle] = useState(initialData?.title || '');
  const [location, setLocation] = useState(initialData?.location || '');
  const [category, setCategory] = useState<ItemCategory>(initialData?.category || ItemCategory.OTHER);
  
  // Structured Specs
  const [specs, setSpecs] = useState<Record<string, string>>(initialData?.specs || {});

  // Description & Features
  const [description, setDescription] = useState(initialData?.description || '');
  const [distinguishingMarks, setDistinguishingMarks] = useState(initialData?.distinguishingFeatures?.join(', ') || '');
  const [isDescriptionGenerated, setIsDescriptionGenerated] = useState(!!initialData?.description);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [tags, setTags] = useState<string[]>(initialData?.tags || []);
  
  const [imageStatuses, setImageStatuses] = useState<ImageStatus[]>(
    initialData?.imageUrls.map(url => ({ url, status: 'valid' })) || []
  );
  
  // AI State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAutofilling, setIsAutofilling] = useState(false);
  const [isRedacting, setIsRedacting] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [isVerifyingFinal, setIsVerifyingFinal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<AIFeedback | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [crossCheckMsg, setCrossCheckMsg] = useState<string>('');
  const [securityResult, setSecurityResult] = useState<any>(null);
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null); 

  const isProcessing = isAnalyzing || isVerifyingFinal || isSubmitting || isAutofilling || isMerging || isRedacting;

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Update Specs when Category Changes (Preserve overlapping keys)
  useEffect(() => {
    // Optional: clear specs on category change if desired, or keep generic keys
  }, [category]);

  // Helper to convert DD/MM/YYYY (stored) back to YYYY-MM-DD (input)
  function convertDDMMtoYYYYMM(dateStr: string) {
    if (dateStr.includes('/')) {
        const [d, m, y] = dateStr.split('/');
        return `${y}-${m}-${d}`;
    }
    return dateStr;
  }

  // Helper to convert YYYY-MM-DD (input) to DD/MM/YYYY (storage)
  function formatToDDMMYYYY(dateStr: string) {
    if (dateStr.includes('-')) {
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}/${y}`;
    }
    return dateStr;
  }

  const handleSpecChange = (key: string, value: string) => {
      setSpecs(prev => ({ ...prev, [key]: value }));
  };

  // 1. Just Upload Image (No AI yet)
  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 512; // Force small size to save AI tokens

          if (width > height && width > maxDim) {
            height *= maxDim / width;
            width = maxDim;
          } else if (height > maxDim) {
            width *= maxDim / height;
            height = maxDim;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.6)); // 60% quality jpeg
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && !isProcessing) {
      setFormError(null);
      const file = files[0];
      
      try {
        const resizedBase64 = await resizeImage(file);
        // We still pass the original file for Cloudinary, but use resizedBase64 for AI preview
        setImageStatuses(prev => [...prev, { url: resizedBase64, file: file, status: 'valid' }]);
      } catch (err) {
        console.error("Image resize failed", err);
      }
    }
  };

  const removeImage = (index: number) => {
    if (!isProcessing) {
      setImageStatuses(prev => prev.filter((_, i) => i !== index));
    }
  };

  // 2. The ONE-SHOT AI God Prompt (Click 1)
  const handleGenerateDescription = async () => {
    if (!title && !distinguishingMarks && imageStatuses.length === 0) {
        setFormError("Please upload an image or provide some initial details first.");
        return;
    }

    setIsAnalyzing(true);
    setFormError(null);
    setCrossCheckMsg('');

    try {
      // Cloudinary upload pass BEFORE AI (because Groq Qwen does not support base64 natively)
      const uploadPromises = imageStatuses.map(async (img) => {
        if (img.file && img.url.startsWith('data:')) {
           const cloudinaryUrl = await uploadImage(img.file);
           return { ...img, url: cloudinaryUrl, file: undefined };
        }
        return img;
      });
      const uploadedStatuses = await Promise.all(uploadPromises);
      setImageStatuses(uploadedStatuses);

      const cloudUrls = uploadedStatuses.length > 0 ? uploadedStatuses.map(s => s.url) : undefined;
      const specContext = Object.entries(specs).map(([k, v]) => `${k}: ${v}`).join(', ');
      const fullContext = `${distinguishingMarks}. Details: ${specContext}`;

      const aiResult = await generateSmartReport(cloudUrls, title, fullContext);
      setSecurityResult(aiResult.security);

      // Check Security
      if (aiResult.security.isViolation || aiResult.security.isPrank) {
         setAiFeedback({ 
             severity: 'BLOCK', 
             type: aiResult.security.violationType, 
             message: aiResult.security.reason || "Image rejected by safety policy.", 
             onAction: () => {
                 setAiFeedback(null);
                 if (imageStatuses.length > 0) removeImage(0);
             } 
         });
         return;
      }

      // Autofill details
      if (aiResult.visualInsights.category) setCategory(aiResult.visualInsights.category);
      if (aiResult.visualInsights.tags.length > 0) setTags(aiResult.visualInsights.tags);
      
      setSpecs(prev => {
          const newSpecs = { ...prev };
          if (aiResult.visualInsights.specs) {
              Object.entries(aiResult.visualInsights.specs).forEach(([k, v]) => {
                  if (!newSpecs[k]) newSpecs[k] = v;
              });
          }
          if (!newSpecs['color'] && aiResult.visualInsights.color) newSpecs['color'] = aiResult.visualInsights.color;
          return newSpecs;
      });

      if (!title) setTitle(aiResult.suggestedTitle);
      setDescription(aiResult.suggestedDescription);
      setIsDescriptionGenerated(true);
      setIsEditingDescription(false); 
      
      if (aiResult.crossCheckFeedback) {
          setCrossCheckMsg(aiResult.crossCheckFeedback);
      }

    } catch (e) {
      console.error(e);
      setFormError("AI generation failed. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 3. Final Submission (Click 2 - No AI)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!title.trim() || !description.trim() || !location.trim() || !date || !time) {
      setFormError("Please fill in all required fields.");
      return;
    }

    const schema = CATEGORY_SCHEMAS[category];
    if (schema) {
      const missingSpecs = schema.filter(field => field.required && !specs[field.key]);
      if (missingSpecs.length > 0) {
          setFormError(`Missing required details: ${missingSpecs.map(f => f.label).join(', ')}`);
          return;
      }
    }

    if (!isLost && imageStatuses.length === 0) {
      setFormError("Found reports MUST include a photo.");
      return;
    }

    setIsSubmitting(true);
    
    try {
      const validImages = imageStatuses.filter(s => s.status !== 'prank');
      const uploadPromises = validImages.map(async (img) => {
        if (img.file) {
          return await uploadImage(img.file);
        }
        return img.url;
      });

      const uploadedUrls = await Promise.all(uploadPromises);

      const report: ItemReport = {
        id: initialData?.id || crypto.randomUUID(),
        type: reportType,
        title: title,
        description: description,
        summary: description.slice(0, 100),
        distinguishingFeatures: distinguishingMarks ? distinguishingMarks.split(',').map(s => s.trim()) : [],
        category: category,
        location,
        date: formatToDDMMYYYY(date),
        time,
        imageUrls: uploadedUrls, 
        tags: tags,
        status: initialData?.status || 'OPEN',
        reporterId: user.id,
        reporterName: user.name,
        createdAt: initialData?.createdAt || Date.now(),
        specs: specs,
        needsReview: !!crossCheckMsg || (securityResult && securityResult.violationType !== 'NONE'),
        violationType: securityResult?.violationType || 'NONE',
        aiFeedback: crossCheckMsg || ''
      };
      onSubmit(report);
    } catch (error) {
      console.error(error);
      setFormError("Submission failed. Check your connection or try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = "w-full h-12 px-4 bg-[#FAF8F5] dark:bg-[#2A2625] border border-[#E5E0D8] dark:border-[#49433F] rounded-xl text-sm font-bold outline-none focus:border-teal-500 transition-all";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 sm:p-4 md:p-6 bg-white dark:bg-[#302C2A] backdrop-blur-sm animate-fade-in">
      
      {/* Block Overlay */}
      {aiFeedback?.severity === 'BLOCK' && (
        <div className="absolute inset-0 z-[200] bg-white dark:bg-[#302C2A] backdrop-blur-md flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white dark:bg-[#302C2A] rounded-2xl shadow-2xl p-6 text-center border border-white/10">
            <ShieldBan className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-[#2C2724] dark:text-[#F5F1EA] mb-2">Issue Detected</h2>
            <p className="text-sm text-[#8C7A6B] dark:text-[#918982] mb-6">{aiFeedback?.message}</p>
            <button onClick={() => { if (aiFeedback?.onAction) aiFeedback.onAction(); setAiFeedback(null); }} className="px-6 py-2 bg-[#E5E0D8] dark:bg-[#373230] rounded-lg font-bold text-sm">Dismiss</button>
          </div>
        </div>
      )}

      {/* Success/Info Overlay */}
      {aiFeedback?.severity === 'SUCCESS' && (
         <div className="absolute top-10 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-top-4 fade-in">
            <div className="bg-emerald-500 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3">
               <EyeOff className="w-5 h-5" />
               <span className="font-bold text-sm">{aiFeedback.message}</span>
               <button onClick={() => setAiFeedback(null)} className="ml-2 bg-white/20 hover:bg-white/30 rounded-full p-1"><X className="w-3 h-3" /></button>
            </div>
         </div>
      )}

      <div className="relative w-full max-w-6xl h-[100dvh] sm:h-auto sm:max-h-[90vh] bg-white dark:bg-[#302C2A] rounded-none sm:rounded-[2rem] shadow-2xl flex flex-col border-0 sm:border border-[#E5E0D8] dark:border-[#49433F] overflow-hidden">
        
        {/* Loading Overlay */}
        {isProcessing && (
           <div className="absolute inset-0 z-[70] bg-white/80 dark:bg-[#302C2A] backdrop-blur-sm flex flex-col items-center justify-center">
             <Loader2 className="w-10 h-10 text-teal-600 animate-spin mb-4" />
             <p className="font-bold text-[#2C2724] dark:text-[#F5F1EA] animate-pulse">
               {isSubmitting ? "Validating & Submitting..." : isVerifyingFinal ? "Cross-referencing Data..." : isAutofilling ? "Extracting Specs..." : isRedacting ? "Scanning for Sensitive Info..." : isMerging ? "Generating Description..." : "Processing..."}
             </p>
           </div>
        )}

        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E5E0D8] dark:border-[#49433F] flex justify-between items-center bg-white dark:bg-[#302C2A] shrink-0">
          <div>
            <h2 className="text-lg font-bold text-[#2C2724] dark:text-[#F5F1EA]">{isEdit ? 'Edit Report' : 'File Report'}</h2>
            <p className="text-xs text-[#A3978E] dark:text-[#918982]">Complete the strict identification form</p>
          </div>
          <button onClick={onCancel} disabled={isProcessing} className="p-2 hover:bg-[#F5F2ED] dark:hover:bg-[#F5F2ED] dark:bg-[#373230] rounded-full"><X className="w-6 h-6 text-[#A3978E] dark:text-[#918982]" /></button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto bg-[#FAF8F5] dark:bg-[#2A2625] p-6 md:p-8">
           
           {formError && (
             <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 flex items-center gap-3 animate-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <p className="text-sm font-bold text-red-800 dark:text-red-300">{formError}</p>
             </div>
           )}

           <form ref={formRef} onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* LEFT COLUMN: Inputs */}
              <div className="space-y-6">
                 
                 {/* 1. Type Selection */}
                 <div className="bg-white dark:bg-[#302C2A] p-1.5 rounded-2xl border border-[#E5E0D8] dark:border-[#49433F] inline-flex w-full">
                    <button type="button" onClick={() => setReportType(ReportType.LOST)} className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${isLost ? 'bg-orange-50 text-orange-700 shadow-sm' : 'text-[#A3978E] dark:text-[#918982]'}`}>
                       <SearchX className="w-4 h-4" /> Lost Item
                    </button>
                    <button type="button" onClick={() => setReportType(ReportType.FOUND)} className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${!isLost ? 'bg-teal-50 text-teal-700 shadow-sm' : 'text-[#A3978E] dark:text-[#918982]'}`}>
                       <Box className="w-4 h-4" /> Found Item
                    </button>
                 </div>

                 {/* 2. Core Details Card */}
                 <div className="bg-white dark:bg-[#302C2A] rounded-3xl p-6 border border-[#E5E0D8] dark:border-[#49433F] shadow-sm space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                       <LayoutTemplate className="w-4 h-4 text-teal-600" />
                       <h3 className="text-xs font-bold text-[#A3978E] dark:text-[#918982] uppercase tracking-widest">Identification</h3>
                    </div>
                    
                    <div>
                       <label className="text-[11px] font-bold text-[#8C7A6B] dark:text-[#918982] uppercase ml-1 mb-1.5 block">Title</label>
                       <input 
                         type="text" 
                         value={title} 
                         onChange={e => setTitle(e.target.value)} 
                         placeholder="e.g. Blue Hydroflask" 
                         className={inputClass}
                         required 
                       />
                    </div>

                    <div>
                          <label className="text-[11px] font-bold text-[#8C7A6B] dark:text-[#918982] uppercase ml-1 mb-1.5 block">Category</label>
                          <select value={category} onChange={e => setCategory(e.target.value as ItemCategory)} className={inputClass} required>
                             {Object.values(ItemCategory).map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                    </div>

                    {/* DYNAMIC SPECS FIELDS */}
                    <div className="pt-2 border-t border-[#E5E0D8] dark:border-[#49433F]">
                        <h4 className="text-[10px] font-bold text-teal-600 uppercase tracking-wide mb-3 flex items-center gap-1">
                             <Cpu className="w-3 h-3" /> Technical Details
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            {CATEGORY_SCHEMAS[category].map((field) => (
                                <div key={field.key} className="col-span-2 sm:col-span-1">
                                    <label className="text-[11px] font-bold text-[#8C7A6B] dark:text-[#918982] uppercase ml-1 mb-1.5 block flex justify-between">
                                        {field.label}
                                        {field.required && <span className="text-red-500">*</span>}
                                    </label>
                                    <input 
                                        type="text" 
                                        value={specs[field.key] || ''}
                                        onChange={(e) => handleSpecChange(field.key, e.target.value)}
                                        placeholder={field.placeholder}
                                        className={`${inputClass} bg-teal-50/30 dark:bg-teal-900/10 focus:bg-white dark:focus:bg-white dark:bg-[#302C2A]`}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                 </div>

                 {/* 3. Location & Time Card */}
                 <div className="bg-white dark:bg-[#302C2A] rounded-3xl p-6 border border-[#E5E0D8] dark:border-[#49433F] shadow-sm space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                       <MapPin className="w-4 h-4 text-emerald-500" />
                       <h3 className="text-xs font-bold text-[#A3978E] dark:text-[#918982] uppercase tracking-widest">Where & When</h3>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                       <div className="col-span-2">
                          <label className="text-[11px] font-bold text-[#8C7A6B] dark:text-[#918982] uppercase ml-1 mb-1.5 block">Location</label>
                          <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Student Center" className={inputClass} required />
                       </div>
                       <div>
                          <label className="text-[11px] font-bold text-[#8C7A6B] dark:text-[#918982] uppercase ml-1 mb-1.5 block">Time</label>
                          <input type="time" value={time} onChange={e => setTime(e.target.value)} className={inputClass} required />
                       </div>
                    </div>
                    <div className="col-span-3">
                        <label className="text-[11px] font-bold text-[#8C7A6B] dark:text-[#918982] uppercase ml-1 mb-1.5 block">Date</label>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputClass} required />
                    </div>
                 </div>

              </div>

              {/* RIGHT COLUMN: Media & AI */}
              <div className="space-y-6 flex flex-col h-full">
                 
                 {/* 1. Media Upload */}
                 <div className="bg-white dark:bg-[#302C2A] rounded-3xl p-6 border border-[#E5E0D8] dark:border-[#49433F] shadow-sm relative">
                    {/* Mandatory/Optional Badge */}
                    <div className={`absolute top-4 right-4 px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${
                        !isLost 
                        ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-100 dark:border-red-900' 
                        : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900'
                    }`}>
                        {!isLost ? '* Required' : 'Optional'}
                    </div>

                    <div className="flex justify-between items-center mb-4">
                       <div className="flex items-center gap-2">
                          <UploadCloud className="w-4 h-4 text-sky-500" />
                          <h3 className="text-xs font-bold text-[#A3978E] dark:text-[#918982] uppercase tracking-widest">Evidence</h3>
                       </div>
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                       {imageStatuses.map((s, i) => (
                          <div key={i} className="aspect-square relative rounded-xl overflow-hidden border border-[#E5E0D8] dark:border-[#49433F] group">
                             <img src={s.url} className={`w-full h-full object-cover ${s.status === 'redacted' ? 'blur-[1px]' : ''}`} />
                             
                             {s.status === 'checking' && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><Loader2 className="w-5 h-5 text-white animate-spin" /></div>}
                             {s.status === 'redacted' && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                                    <EyeOff className="w-6 h-6 text-white/80" />
                                </div>
                             )}
                             
                             <button type="button" onClick={() => removeImage(i)} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5"><X className="w-3 h-3" /></button>
                          </div>
                       ))}
                       {imageStatuses.length < 3 && (
                          <button type="button" onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-xl border-2 border-dashed border-[#E5E0D8] dark:border-[#49433F] dark:border-[#49433F] flex flex-col items-center justify-center hover:bg-[#FAF8F5] dark:hover:bg-[#F5F2ED] dark:bg-[#373230] transition-colors gap-1 text-[#A3978E] dark:text-[#918982]">
                             <UploadCloud className="w-5 h-5" />
                             <span className="text-[9px] font-bold">Add</span>
                          </button>
                       )}
                    </div>
                    <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
                    
                     <p className="mt-3 text-[10px] text-[#A3978E] dark:text-[#918982] flex items-center gap-1.5">
                        <Info className="w-3 h-3" /> 
                        Photos with violence or inappropriate content are not allowed.
                     </p>
                 </div>

                 {/* 2. AI & Description Center */}
                 <div className="bg-white dark:bg-[#302C2A] rounded-3xl p-6 border border-[#E5E0D8] dark:border-[#49433F] shadow-sm flex-1 flex flex-col transition-all">
                    <div className="flex items-center gap-2 mb-4">
                       <Wand2 className="w-4 h-4 text-brand-teal" />
                       <h3 className="text-xs font-bold text-[#A3978E] dark:text-[#918982] uppercase tracking-widest">Smart Description</h3>
                    </div>

                    {/* AI Insights Panel & Cross-check */}
                    {crossCheckMsg && (
                       <div className="mb-4 p-4 bg-amber-50/80 dark:bg-amber-900/20 rounded-2xl border border-amber-200 dark:border-amber-800/50">
                          <div className="flex items-start gap-3">
                             <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                             <div>
                                <span className="text-xs font-bold text-amber-800 dark:text-amber-400 block mb-1">AI Cross-Check Insights</span>
                                <p className="text-xs text-amber-700 dark:text-amber-300 font-medium leading-relaxed">{crossCheckMsg}</p>
                             </div>
                          </div>
                       </div>
                    )}

                    <div className="space-y-4 flex-1 flex flex-col">
                       
                       {/* INPUT MODE: Show when description is NOT generated or user is editing */}
                       {(!isDescriptionGenerated || isEditingDescription) && (
                           <>
                             {/* Distinguishing Features Input */}
                             <div className="space-y-1">
                                <label className="text-[10px] font-bold text-[#A3978E] dark:text-[#918982] uppercase ml-1">Distinguishing Features or Marks</label>
                                <input 
                                   type="text"
                                   value={distinguishingMarks}
                                   onChange={e => setDistinguishingMarks(e.target.value)}
                                   placeholder="e.g. 'Has a scratch on the back', 'Batman sticker on case'"
                                   className="w-full px-4 py-3 bg-[#FAF8F5] dark:bg-[#2A2625] border border-[#E5E0D8] dark:border-[#49433F] rounded-xl text-xs font-medium outline-none focus:border-teal-500"
                                />
                             </div>

                             {isEditingDescription ? (
                                <div className="space-y-1 flex-1 flex flex-col animate-in fade-in">
                                  <label className="text-[10px] font-bold text-[#A3978E] dark:text-[#918982] uppercase ml-1">Edit Description</label>
                                  <textarea 
                                     value={description}
                                     onChange={e => setDescription(e.target.value)}
                                     className="w-full flex-1 min-h-[120px] p-4 bg-[#FAF8F5] dark:bg-[#2A2625] border border-[#E5E0D8] dark:border-[#49433F] rounded-xl text-sm font-medium resize-none outline-none focus:border-teal-500"
                                  />
                                  <button type="button" onClick={() => setIsEditingDescription(false)} className="self-end px-4 py-2 bg-[#E5E0D8] dark:bg-[#373230] rounded-lg text-xs font-bold">Done</button>
                                </div>
                             ) : (
                                /* GENERATE BUTTON - Glowing & Pulsing */
                                <button 
                                   type="button" 
                                   onClick={handleGenerateDescription}
                                   className="w-full mt-2 py-3 bg-teal-700 hover:bg-teal-600 text-white rounded-xl text-sm font-black uppercase tracking-widest shadow-[0_0_20px_rgba(15,118,110,0.4)] hover:shadow-[0_0_30px_rgba(15,118,110,0.6)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                >
                                   {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 animate-pulse" />}
                                   {isAnalyzing ? "Analyzing..." : "Generate Description & Verify"}
                                </button>
                             )}
                           </>
                       )}

                       {/* VIEW MODE: Show only after generation and NOT editing */}
                       {isDescriptionGenerated && !isEditingDescription && (
                          <div className="flex-1 flex flex-col space-y-2 animate-in slide-in-from-bottom-2 fade-in">
                             <div className="flex justify-between items-end">
                                <label className="text-[10px] font-bold text-[#A3978E] dark:text-[#918982] uppercase ml-1">Final Description</label>
                                <button 
                                  type="button" 
                                  onClick={() => setIsEditingDescription(true)}
                                  className="p-1.5 bg-[#F5F2ED] dark:bg-[#373230] hover:bg-teal-100 dark:hover:bg-teal-900/30 text-[#A3978E] dark:text-[#918982] hover:text-teal-600 rounded-lg transition-colors"
                                  title="Edit Description"
                                >
                                   <Edit2 className="w-3.5 h-3.5" />
                                </button>
                             </div>
                             
                             <div className="p-4 bg-teal-50/30 dark:bg-[#2A2625] border border-teal-100/50 dark:border-[#49433F] rounded-xl text-sm font-medium text-[#5C4A3D] dark:text-[#C8C0B8] dark:text-[#C8C0B8] leading-relaxed min-h-[100px] flex-1">
                                {description}
                             </div>
                          </div>
                       )}

                    </div>
                 </div>

              </div>
           </form>
        </div>

        {/* Footer - Submit Button Only shows if description is generated */}
        <div className="px-6 py-4 bg-white dark:bg-[#302C2A] border-t border-[#E5E0D8] dark:border-[#49433F] flex justify-end gap-3 shrink-0">
           <button onClick={onCancel} className="px-6 py-3 rounded-xl text-sm font-bold text-[#8C7A6B] dark:text-[#918982] hover:bg-[#FAF8F5] dark:hover:bg-[#F5F2ED] dark:bg-[#373230] transition-colors">Cancel</button>
           
           {isDescriptionGenerated && (
               <button 
                 onClick={() => formRef.current?.requestSubmit()} 
                 disabled={isProcessing} 
                 className="px-8 py-3 bg-brand-teal hover:bg-teal-800 text-white rounded-xl font-bold text-sm shadow-xl shadow-teal-600/30 transition-all active:scale-95 disabled:opacity-50 disabled:transform-none flex items-center gap-2 animate-in zoom-in-95"
               >
                  <Check className="w-4 h-4" /> Confirm & Publish
               </button>
           )}
        </div>

      </div>
    </div>
  );
};

export default ReportForm;