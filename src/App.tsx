import React, { useState, useRef } from 'react';
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { motion, AnimatePresence } from "motion/react";
import * as XLSX from 'xlsx';
import { 
  Upload, 
  FileText, 
  User, 
  Calendar, 
  MapPin, 
  Home, 
  CreditCard, 
  Loader2, 
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  Download
} from 'lucide-react';
import { CCCDInfo } from './types';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function App() {
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CCCDInfo[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [duplicateIds, setDuplicateIds] = useState<string[]>([]);
  const [copySuccess, setCopySuccess] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const img = new Image();
          img.onload = () => {
            // Resize image to max 1200px width/height for faster processing while maintaining readability
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const maxDim = 1200;

            if (width > height) {
              if (width > maxDim) {
                height *= maxDim / width;
                width = maxDim;
              }
            } else {
              if (height > maxDim) {
                width *= maxDim / height;
                height = maxDim;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
            setImages(prev => [...prev, resizedDataUrl]);
            setError(null);
          };
          img.src = reader.result as string;
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const validateIdNumber = (id: string) => {
    if (!id) return "";
    const cleanId = id.replace(/\s/g, '');
    if (!/^\d+$/.test(cleanId)) return "Số CCCD chỉ được chứa chữ số";
    if (cleanId.length !== 12 && cleanId.length !== 9) return "Số CCCD phải có 9 hoặc 12 chữ số";
    return "";
  };

  const validateDate = (date: string) => {
    if (!date) return "";
    // Match DD/MM/YYYY
    const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const match = date.match(dateRegex);
    if (!match) return "Định dạng ngày phải là DD/MM/YYYY";

    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);

    const d = new Date(year, month - 1, day);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
      return "Ngày không hợp lệ";
    }
    return "";
  };

  const exportToExcel = () => {
    if (results.length === 0) return;

    const headers = ["STT", "Số CCCD", "Ngày cấp", "Họ và tên", "Ngày sinh", "Quê quán", "Nơi thường trú"];
    const rows = results.map((item, index) => [
      index + 1,
      item.idNumber,
      item.issueDate,
      item.fullName,
      item.dateOfBirth,
      item.hometown,
      item.permanentResidence
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "CCCD Data");

    // Set column widths for better readability
    const wscols = [
      { wch: 5 },  // STT
      { wch: 15 }, // Số CCCD
      { wch: 12 }, // Ngày cấp
      { wch: 25 }, // Họ và tên
      { wch: 12 }, // Ngày sinh
      { wch: 30 }, // Quê quán
      { wch: 40 }  // Nơi thường trú
    ];
    worksheet['!cols'] = wscols;

    const fileName = `CCCD_Extraction_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const extractInfo = async () => {
    if (images.length === 0) return;

    setLoading(true);
    setError(null);
    setFieldErrors({});

    try {
      const imageParts = images.map(img => ({
        inlineData: {
          mimeType: "image/jpeg",
          data: img.split(',')[1],
        },
      }));
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              ...imageParts,
              {
                text: `Trích xuất thông tin CCCD từ các ảnh được cung cấp. 
                Có thể có NHIỀU người (mỗi người 1-2 ảnh). 
                Phân loại và trích xuất thông tin cho TẤT CẢ mọi người.
                
                ĐỊNH DẠNG:
                - idNumber: Số CCCD (chỉ lấy chữ số).
                - issueDate: Ngày cấp (DD/MM/YYYY).
                - fullName: Họ tên (IN HOA).
                - dateOfBirth: Ngày sinh (DD/MM/YYYY).
                - hometown: Quê quán.
                - permanentResidence: Thường trú.`,
              },
            ],
          },
        ],
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                idNumber: { type: Type.STRING },
                issueDate: { type: Type.STRING },
                fullName: { type: Type.STRING },
                dateOfBirth: { type: Type.STRING },
                hometown: { type: Type.STRING },
                permanentResidence: { type: Type.STRING },
              },
              required: ["idNumber", "issueDate", "fullName", "dateOfBirth", "hometown", "permanentResidence"],
            },
          },
        },
      });

      const resultList = JSON.parse(response.text || "[]") as CCCDInfo[];
      
      const duplicates: string[] = [];
      const uniqueResults: CCCDInfo[] = [];

      resultList.forEach(result => {
        const isDuplicate = results.some(existing => existing.idNumber === result.idNumber);
        if (isDuplicate && result.idNumber) {
          duplicates.push(result.idNumber);
        } else {
          uniqueResults.push(result);
        }
      });

      if (duplicates.length > 0) {
        setDuplicateIds(duplicates);
        setError(`Phát hiện ${duplicates.length} thông tin đã có trong danh sách. Các hàng trùng lặp đã được làm nổi bật.`);
        // Clear highlight after 8 seconds
        setTimeout(() => setDuplicateIds([]), 8000);
      }

      if (uniqueResults.length === 0 && duplicates.length > 0) {
        setLoading(false);
        setImages([]);
        return;
      }

      // Validate fields for each person
      const newErrors: Record<string, string> = {};
      
      uniqueResults.forEach((result, idx) => {
        const idError = validateIdNumber(result.idNumber);
        if (idError) newErrors[`idNumber_${results.length + idx}`] = idError;

        const dobError = validateDate(result.dateOfBirth);
        if (dobError) newErrors[`dateOfBirth_${results.length + idx}`] = dobError;

        const issueError = validateDate(result.issueDate);
        if (issueError) newErrors[`issueDate_${results.length + idx}`] = issueError;
      });

      setFieldErrors(prev => ({ ...prev, ...newErrors }));
      setResults(prev => [...prev, ...uniqueResults]);
      setImages([]); // Clear images after successful extraction to prepare for next batch
    } catch (err) {
      console.error("Extraction error:", err);
      setError("Không thể đọc được thông tin từ ảnh. Vui lòng thử lại với ảnh rõ nét hơn.");
    } finally {
      setLoading(false);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const reset = () => {
    setImages([]);
    setResults([]);
    setFieldErrors({});
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatResultLine = (item: CCCDInfo) => {
    return `${item.idNumber} (${item.issueDate}) - ${item.fullName} - ${item.dateOfBirth} - ${item.hometown} - ${item.permanentResidence}`;
  };

  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(index);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg shadow-md shadow-blue-100">
              <CreditCard className="text-white w-5 h-5" />
            </div>
            <h1 className="font-bold text-lg tracking-tight text-slate-800">CCCD Reader AI</h1>
          </div>
          <button 
            onClick={reset}
            className="text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-1.5 text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Làm mới
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Upload & Preview (Reduced Size) */}
          <section className="lg:col-span-4 space-y-6">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm" style={{ width: '230px', minHeight: '130px', paddingTop: '9px' }}>
              <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 ml-1">Tải ảnh lên</h2>
              
              <div className="space-y-3">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all group"
                  style={{ width: '200px', height: '80px' }}
                >
                  <div className="bg-slate-100 p-2 rounded-full group-hover:bg-blue-100 transition-colors">
                    <Upload className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-slate-700 text-xs">Tải ảnh lên</p>
                    <p className="text-[9px] text-slate-400 mt-0.5 uppercase font-bold tracking-tight">Chọn nhiều ảnh</p>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    multiple
                    className="hidden"
                  />
                </div>

                {images.length > 0 && !loading && (
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={extractInfo}
                    className="w-[200px] bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-bold py-2.5 rounded-xl shadow-md shadow-blue-200 transition-all flex items-center justify-center gap-2 text-sm border border-blue-400/30"
                  >
                    <FileText className="w-4 h-4" />
                    Trích xuất ngay
                  </motion.button>
                )}

                {loading && (
                  <div className="w-[200px] flex flex-col items-center gap-2 py-2">
                    <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                    <p className="text-[10px] font-bold text-slate-500 animate-pulse uppercase tracking-wider">Đang phân tích...</p>
                  </div>
                )}

                {error && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="w-[200px] p-3 bg-red-50 border border-red-100 rounded-xl flex gap-2 text-red-700 text-[10px] font-medium"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <p>{error}</p>
                  </motion.div>
                )}

                {/* Image Previews Grouped by Person (1-2 images) */}
                <div className="space-y-3 pt-2">
                  <AnimatePresence>
                    {Array.from({ length: Math.ceil(images.length / 2) }).map((_, groupIndex) => (
                      <motion.div 
                        key={groupIndex}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-2 border border-blue-100 bg-blue-50/10 rounded-xl space-y-2"
                        style={{ width: '200px' }}
                      >
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-tighter">NGƯỜI #{groupIndex + 1}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {images.slice(groupIndex * 2, groupIndex * 2 + 2).map((img, imgIndex) => {
                            const globalIndex = groupIndex * 2 + imgIndex;
                            return (
                              <div 
                                key={globalIndex}
                                className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-100 aspect-[1.58/1] group shadow-sm"
                              >
                                <img 
                                  src={img} 
                                  alt={`CCCD Preview ${globalIndex + 1}`} 
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                                <button 
                                  onClick={() => removeImage(globalIndex)}
                                  className="absolute top-1 right-1 bg-black/50 hover:bg-black/70 text-white p-0.5 rounded-full backdrop-blur-sm transition-colors opacity-0 group-hover:opacity-100"
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </section>

          {/* Right Column: History Table */}
          <section className="lg:col-span-8 space-y-6">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm h-full flex flex-col overflow-hidden" style={{ width: '960px' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Danh sách trích xuất (Bảng Excel)</h2>
                  {results.length > 0 && (
                    <button 
                      onClick={exportToExcel}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold rounded-lg shadow-sm transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Xuất Excel (.xlsx)
                    </button>
                  )}
                </div>
                <div className="text-xs text-slate-400 font-medium">
                  Tổng cộng: {results.length}
                </div>
              </div>

              <div className="flex-1 overflow-x-auto custom-scrollbar border border-slate-100 rounded-xl">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-2 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-10 text-center">STT</th>
                      <th className="px-2 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Số CCCD</th>
                      <th className="px-2 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ngày cấp</th>
                      <th className="px-2 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Họ và tên</th>
                      <th className="px-2 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ngày sinh</th>
                      <th className="px-2 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quê quán</th>
                      <th className="px-2 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Thường trú</th>
                      <th className="px-2 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-14 text-center">Copy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    <AnimatePresence initial={false}>
                      {results.length > 0 ? (
                        results.map((item, index) => {
                          const lineText = formatResultLine(item);
                          const isDuplicate = duplicateIds.includes(item.idNumber);
                          return (
                            <motion.tr 
                              key={index}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ 
                                opacity: 1, 
                                y: 0,
                                backgroundColor: isDuplicate ? "rgba(239, 68, 68, 0.05)" : "transparent"
                              }}
                              className={`transition-all duration-500 group ${isDuplicate ? 'border-l-4 border-l-red-500 bg-red-50/50' : 'hover:bg-blue-50/30'}`}
                            >
                              <td className="px-2 py-1 text-xs font-bold text-slate-400 text-center">
                                {index + 1}
                              </td>
                              <td className="px-2 py-1 text-xs text-slate-700 font-medium whitespace-nowrap">
                                {item.idNumber}
                                {fieldErrors[`idNumber_${index}`] && (
                                  <div className="text-[8px] text-red-500 font-bold mt-0.5">{fieldErrors[`idNumber_${index}`]}</div>
                                )}
                              </td>
                              <td className="px-2 py-1 text-xs text-slate-600 whitespace-nowrap">
                                {item.issueDate}
                                {fieldErrors[`issueDate_${index}`] && (
                                  <div className="text-[8px] text-red-500 font-bold mt-0.5">{fieldErrors[`issueDate_${index}`]}</div>
                                )}
                              </td>
                              <td className="px-2 py-1 text-xs text-slate-900 font-bold uppercase whitespace-nowrap">
                                {item.fullName}
                              </td>
                              <td className="px-2 py-1 text-xs text-slate-600 whitespace-nowrap">
                                {item.dateOfBirth}
                                {fieldErrors[`dateOfBirth_${index}`] && (
                                  <div className="text-[8px] text-red-500 font-bold mt-0.5">{fieldErrors[`dateOfBirth_${index}`]}</div>
                                )}
                              </td>
                              <td className="px-2 py-1 text-xs text-slate-600 max-w-[150px] truncate" title={item.hometown}>
                                {item.hometown}
                              </td>
                              <td className="px-2 py-1 text-xs text-slate-600 max-w-[200px] truncate" title={item.permanentResidence}>
                                {item.permanentResidence}
                              </td>
                              <td className="px-2 py-1 text-center">
                                <button 
                                  onClick={() => copyToClipboard(lineText, index)}
                                  className={`p-1 rounded-lg transition-all ${
                                    copySuccess === index 
                                      ? 'bg-green-100 text-green-600' 
                                      : 'bg-white text-slate-400 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 opacity-0 group-hover:opacity-100'
                                  }`}
                                  title="Copy hàng này"
                                >
                                  {copySuccess === index ? (
                                    <CheckCircle2 className="w-3 h-3" />
                                  ) : (
                                    <FileText className="w-3 h-3" />
                                  )}
                                </button>
                              </td>
                            </motion.tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={8} className="py-10 text-center">
                            <div className="flex flex-col items-center justify-center text-slate-300 gap-2">
                              <FileText className="w-10 h-10 opacity-20" />
                              <p className="text-sm">Chưa có kết quả nào</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="max-w-4xl mx-auto px-4 py-12 text-center text-slate-400 text-xs">
        <p>© 2026 CCCD Reader AI - Powered by Gemini 3.0 Flash</p>
      </footer>
    </div>
  );
}

function Field({ 
  label, 
  value, 
  icon, 
  loading, 
  error,
  className = "" 
}: { 
  label: string; 
  value?: string; 
  icon: React.ReactNode; 
  loading: boolean;
  error?: string;
  className?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 ml-1">
        {icon}
        {label}
      </label>
      <div className={`
        min-h-[44px] px-4 py-2.5 rounded-xl border flex items-center transition-all relative
        ${loading ? 'animate-pulse bg-slate-100 border-slate-200' : ''}
        ${!loading && value && !error ? 'border-blue-100 bg-blue-50/20' : 'border-slate-100 bg-slate-50/50'}
        ${!loading && error ? 'border-red-200 bg-red-50/30' : ''}
      `}>
        <span className={`text-sm text-slate-700 ${className} ${!value && !loading ? 'text-slate-300 italic' : ''}`}>
          {loading ? '' : (value || 'Chưa có dữ liệu')}
        </span>
        
        {!loading && error && (
          <div className="absolute -bottom-5 left-1 flex items-center gap-1 text-[9px] font-bold text-red-500 animate-in fade-in slide-in-from-top-1">
            <AlertCircle className="w-2.5 h-2.5" />
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
