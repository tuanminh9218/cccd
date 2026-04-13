import React, { useState, useRef } from 'react';
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { motion, AnimatePresence } from "motion/react";
import * as XLSX from 'xlsx';
// @ts-ignore
import html2pdf from 'html2pdf.js';
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
  Download,
  Eye,
  Camera,
  Edit3,
  Save,
  ChevronDown,
  ChevronRight,
  Globe,
  Menu,
  Building2,
  Image as ImageIcon,
  Plus,
  Search,
  GripVertical,
  Trash2,
  Settings2
} from 'lucide-react';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CCCDInfo } from './types';
import { auth, db } from './firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  getDocFromServer,
  setDoc,
  getDoc
} from 'firebase/firestore';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CCCDInfo[]>([
    {
      fullName: 'NGUYỄN VĂN A',
      dateOfBirth: '12/12/1999',
      gender: 'Nam',
      permanentResidence: 'Hà Nội',
      idNumber: '001099012345',
      idIssueDate: '01/01/2020',
      idIssuePlace: 'Cục CS QLHC về TTXH',
      phoneNumber: '0987654321',
      email: 'nguyenvana@example.com',
      occupation: 'Kỹ sư',
      workplace: 'Công ty ABC',
      healthInsuranceNumber: 'GD4010123456789',
      medicalHistory: 'Khỏe mạnh',
      familyHistory: 'Không có bệnh lý di truyền',
      height: '170',
      weight: '65',
      bmi: '22.5',
      bloodPressure: '120/80',
      pulse: '75',
      visionLeft: '10/10',
      visionRight: '10/10',
      hearingLeft: 'Bình thường',
      hearingRight: 'Bình thường',
      generalCondition: 'Tốt',
      conclusion: 'Đủ sức khỏe làm việc',
      date: new Date().toLocaleDateString('vi-VN'),
      status: 'completed'
    }
  ]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [duplicateIds, setDuplicateIds] = useState<string[]>([]);
  const [copySuccess, setCopySuccess] = useState<number | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editData, setEditData] = useState<CCCDInfo | null>(null);
  const [isNguyenKhoiOpen, setIsNguyenKhoiOpen] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [isCty6789Open, setIsCty6789Open] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [isLogoTabOpen, setIsLogoTabOpen] = useState(false);
  const [selectedLogo, setSelectedLogo] = useState<string | null>(null);
  const [customLogo, setCustomLogo] = useState<string | null>(null);
  const [showMedicalForm, setShowMedicalForm] = useState(false);
  const [globalLogo, setGlobalLogo] = useState<string | null>(null);
  const [selectedPersonIndex, setSelectedPersonIndex] = useState<number | null>(null);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  const [isManualFormOpen, setIsManualFormOpen] = useState(false);
  const [manualFormData, setManualFormData] = useState<Partial<CCCDInfo>>({
    fullName: '',
    dateOfBirth: '',
    gender: 'Nam',
    permanentResidence: ''
  });
  const [provinceSearch, setProvinceSearch] = useState('');
  const [selectedProvince, setSelectedProvince] = useState('');
  const [isEditingForm, setIsEditingForm] = useState(false);
  
  // Firebase Auth Listener
  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Firestore Sync
  React.useEffect(() => {
    if (!user) {
      setResults([]);
      return;
    }

    const q = query(
      collection(db, 'results'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as (CCCDInfo & { id: string })[];
      
      setResults(docs);
      if (selectedPersonIndex === null && docs.length > 0) {
        setSelectedPersonIndex(0);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'results');
    });

    return () => unsubscribe();
  }, [user]);

  // Global Logo Sync
  React.useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'logo'), (snapshot) => {
      if (snapshot.exists()) {
        setGlobalLogo(snapshot.data().url);
      }
    }, (error) => {
      console.error("Global logo sync error:", error);
    });
    return () => unsubscribe();
  }, []);

  // Test Connection
  React.useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();
  }, []);

  const [formFields, setFormFields] = useState([
    { id: 'field-1', label: 'Họ và tên:', valueKey: 'fullName' as keyof CCCDInfo, isBold: true, uppercase: true, width: '70%' },
    { id: 'field-2', label: 'Giới tính:', valueKey: 'gender' as keyof CCCDInfo, defaultValue: 'Nam', isBold: true, width: '30%' },
    { id: 'field-3', label: 'Ngày tháng năm sinh:', valueKey: 'dateOfBirth' as keyof CCCDInfo, isBold: true, width: '100%' },
    { id: 'field-4', label: 'Địa chỉ:', valueKey: 'permanentResidence' as keyof CCCDInfo, isBold: true, width: '100%' },
    { id: 'field-5', label: 'Tên cơ quan tuyển dụng:', defaultValue: 'CTY NGUYÊN KHÔI', isBold: true, width: '100%' },
    { id: 'field-6', label: 'Công nhân đi lao động tại:', defaultValue: 'TRUNG QUỐC', isBold: true, width: '100%' },
  ]);
  const [tableRows, setTableRows] = useState([
    { id: 'row-1', tt: 1, label: "Chiều cao, cân nặng", result: "Cao: ........ cm. / Nặng: ........ kg", doctor: "" },
    { id: 'row-2', tt: 2, label: "Mạch, huyết áp", result: "Mạch: ........ l/p. / Huyết áp: ........ mmHg", doctor: "" },
    { id: 'row-3', tt: 3, label: "Khám Nội khoa (Tim, Phổi, NT, Bệnh Tiêu hóa, Bệnh Thận,....)", result: "", doctor: "" },
    { id: 'row-4', tt: 4, label: "Khám Ngoại khoa - Da liễu - Tâm thần kinh - Cơ xương khớp....", result: "", doctor: "" },
    { id: 'row-5', tt: 5, label: "Khám Tai - Mũi - Họng", result: "", doctor: "" },
    { id: 'row-6', tt: 6, label: "Khám về Mắt", result: "Thị lực không kính:\nA. 10/10\nB. 9/10\nC. 8/10\nD. Khác", doctor: "" },
    { id: 'row-7', tt: 7, label: "Khám Răng - Hàm - Mặt", result: "", doctor: "" },
    { id: 'row-8', tt: 8, label: "Khám Điện tâm đồ (điện tim)", result: "", doctor: "" },
    { id: 'row-9', tt: 9, label: "Kết quả X-Quang tim phổi", result: "", doctor: "" },
    { id: 'row-10', tt: 10, label: "Siêu âm ổ bụng tổng quát", result: "", doctor: "" },
    { id: 'row-11', tt: 11, label: "Kết quả XN nước tiểu (thường quy, có thai sớm)", result: "", doctor: "" },
    { id: 'row-12', tt: 12, label: "XN máu (HIV, HBsAg, VDRL...)", result: "Nhóm máu: [ ]", doctor: "" },
  ]);
  const [topProvinces, setTopProvinces] = useState(['Hà Nội', 'TP.HCM mở rộng', 'Đà Nẵng', 'Hải Phòng']);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEndFields = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setFormFields((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleDragEndRows = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setTableRows((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        // Update TT (STT) after move
        return newItems.map((item: any, idx) => ({ ...item, tt: idx + 1 }));
      });
    }
  };

  const addFormField = () => {
    const newId = `field-${Date.now()}`;
    setFormFields([...formFields, { id: newId, label: 'Trường mới:', isBold: true, width: '100%' }]);
  };

  const removeFormField = (id: string) => {
    setFormFields(formFields.filter(f => f.id !== id));
  };

  const updateFormField = (id: string, updates: any) => {
    setFormFields(formFields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const addTableRow = () => {
    const newId = `row-${Date.now()}`;
    setTableRows([...tableRows, { id: newId, tt: tableRows.length + 1, label: "Nội dung mới", result: "" }]);
  };

  const removeTableRow = (id: string) => {
    const newRows = tableRows.filter(r => r.id !== id);
    setTableRows(newRows.map((r, idx) => ({ ...r, tt: idx + 1 })));
  };

  const updateTableRow = (id: string, updates: any) => {
    setTableRows(tableRows.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const maskIdNumber = (id: string) => {
    if (!id || id.length < 7) return id;
    const cleanId = id.replace(/\s/g, '');
    return `${cleanId.substring(0, 3)}...${cleanId.substring(cleanId.length - 4)}`;
  };

  const getProvinceOnly = (address: string) => {
    if (!address) return "";
    const parts = address.split(',').map(p => p.trim());
    return parts[parts.length - 1] || address;
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file: File) => {
        processFile(file);
      });
    }
  };

  const processFile = (file: File | Blob) => {
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
  };

  const startCamera = async () => {
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera error:", err);
      setError("Không thể truy cập camera. Vui lòng kiểm tra quyền truy cập.");
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob((blob) => {
        if (blob) {
          processFile(blob);
          stopCamera();
        }
      }, 'image/jpeg', 0.8);
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

    const headers = ["STT", "Số CCCD", "Ngày cấp", "Họ và tên", "Ngày sinh", "Giới tính", "Nơi thường trú"];
    const rows = results.map((item, index) => [
      index + 1,
      item.idNumber,
      item.issueDate,
      item.fullName,
      item.dateOfBirth,
      item.gender,
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
      { wch: 10 }, // Giới tính
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
                - gender: Giới tính (Nam/Nữ).
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
                gender: { type: Type.STRING },
                permanentResidence: { type: Type.STRING },
              },
              required: ["idNumber", "issueDate", "fullName", "dateOfBirth", "gender", "permanentResidence"],
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
      
      if (user) {
        for (const result of uniqueResults) {
          try {
            await addDoc(collection(db, 'results'), {
              ...result,
              userId: user.uid,
              createdAt: serverTimestamp()
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, 'results');
          }
        }
      } else {
        setResults(prev => {
          const newResults = [...prev, ...uniqueResults];
          if (selectedPersonIndex === null && newResults.length > 0) {
            setSelectedPersonIndex(0);
          }
          return newResults;
        });
      }
      
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
    setSelectedPersonIndex(null);
    setShowMedicalForm(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login error:", error);
      setError("Đăng nhập thất bại. Vui lòng thử lại.");
    }
  };

  const formatResultLine = (item: CCCDInfo) => {
    return `${item.idNumber} (${item.issueDate}) - ${item.fullName} - ${item.dateOfBirth} - ${item.gender} - ${item.permanentResidence}`;
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

  const startEditing = (index: number) => {
    setEditingIndex(index);
    setEditData({ ...results[index] });
  };

  const cancelEditing = () => {
    setEditingIndex(null);
    setEditData(null);
  };

  const saveEdit = async () => {
    if (editingIndex !== null && editData) {
      if (user && (results[editingIndex] as any).id) {
        try {
          await updateDoc(doc(db, 'results', (results[editingIndex] as any).id), {
            ...editData
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `results/${(results[editingIndex] as any).id}`);
        }
      } else {
        const newResults = [...results];
        newResults[editingIndex] = editData;
        
        // Re-validate fields
        const newErrors = { ...fieldErrors };
        
        // Clear old errors for this index
        Object.keys(newErrors).forEach(key => {
          if (key.endsWith(`_${editingIndex}`)) {
            delete newErrors[key];
          }
        });

        const idError = validateIdNumber(editData.idNumber);
        if (idError) newErrors[`idNumber_${editingIndex}`] = idError;

        const dobError = validateDate(editData.dateOfBirth);
        if (dobError) newErrors[`dateOfBirth_${editingIndex}`] = dobError;

        const issueError = validateDate(editData.issueDate);
        if (issueError) newErrors[`issueDate_${editingIndex}`] = issueError;

        setFieldErrors(newErrors);
        setResults(newResults);
      }
      setEditingIndex(null);
      setEditData(null);
    }
  };

  const handleEditChange = (field: keyof CCCDInfo, value: string) => {
    if (editData) {
      setEditData({ ...editData, [field]: value });
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        setCustomLogo(base64);
        setSelectedLogo(null); // Clear preset selection if custom is uploaded

        // If admin, save to Firestore as global logo
        if (user && user.email === "tuanminh9218@gmail.com") {
          try {
            await setDoc(doc(db, 'settings', 'logo'), {
              url: base64,
              updatedAt: serverTimestamp(),
              updatedBy: user.uid
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, 'settings/logo');
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const deleteResult = async (index: number) => {
    if (user && (results[index] as any).id) {
      try {
        await deleteDoc(doc(db, 'results', (results[index] as any).id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `results/${(results[index] as any).id}`);
      }
    } else {
      const newResults = results.filter((_, i) => i !== index);
      setResults(newResults);
      
      // Update selected person index if necessary
      if (selectedPersonIndex === index) {
        setSelectedPersonIndex(newResults.length > 0 ? 0 : null);
      } else if (selectedPersonIndex !== null && selectedPersonIndex > index) {
        setSelectedPersonIndex(selectedPersonIndex - 1);
      }
    }
    
    setItemToDelete(null);
  };

  const PROVINCES = [
    "Hà Nội",
    "Tuyên Quang (sáp nhập Hà Giang + Tuyên Quang)",
    "Lào Cai (Yên Bái + Lào Cai)",
    "Thái Nguyên (Bắc Kạn + Thái Nguyên)",
    "Phú Thọ (Vĩnh Phúc + Hòa Bình + Phú Thọ)",
    "Bắc Ninh (Bắc Giang + Bắc Ninh)",
    "Hưng Yên (Thái Bình + Hưng Yên)",
    "Hải Phòng (Hải Dương + Hải Phòng)",
    "Ninh Bình (Hà Nam + Nam Định + Ninh Bình)",
    "Quảng Trị (Quảng Bình + Quảng Trị)",
    "Đà Nẵng (Quảng Nam + Đà Nẵng)",
    "Quảng Ngãi (Kon Tum + Quảng Ngãi)",
    "Gia Lai (Bình Định + Gia Lai)",
    "Khánh Hòa (Ninh Thuận + Khánh Hòa)",
    "Lâm Đồng (Đắk Nông + Bình Thuận + Lâm Đồng)",
    "Đắk Lắk (Phú Yên + Đắk Lắk)",
    "TP.HCM mở rộng (TP.HCM + Bình Dương + Bà Rịa–Vũng Tàu)",
    "Đồng Nai (Đồng Nai + Bình Phước)",
    "Tây Ninh (Tây Ninh + Long An)",
    "Cần Thơ (Cần Thơ + Sóc Trăng + Hậu Giang)",
    "Vĩnh Long (Bến Tre + Vĩnh Long + Trà Vinh)",
    "Đồng Tháp (Tiền Giang + Đồng Tháp)",
    "Cà Mau (Bạc Liêu + Cà Mau)",
    "An Giang (Kiên Giang + An Giang)",
    "Huế",
    "Lai Châu",
    "Điện Biên",
    "Sơn La",
    "Lạng Sơn",
    "Quảng Ninh",
    "Thanh Hóa",
    "Nghệ An",
    "Hà Tĩnh",
    "Cao Bằng"
  ];

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let fullResidence = manualFormData.permanentResidence || '';
    if (selectedProvince) {
      // Append province if not already in the string
      if (!fullResidence.toLowerCase().includes(selectedProvince.toLowerCase())) {
        fullResidence = fullResidence.trim();
        if (fullResidence && !fullResidence.endsWith(',')) fullResidence += ', ';
        fullResidence += selectedProvince;
      }
      
      // Update top provinces (simple logic: move to front)
      setTopProvinces(prev => {
        const filtered = prev.filter(p => p !== selectedProvince);
        return [selectedProvince, ...filtered].slice(0, 4);
      });
    }

    const newEntry: CCCDInfo = {
      idNumber: '',
      issueDate: '',
      fullName: manualFormData.fullName || '',
      dateOfBirth: manualFormData.dateOfBirth || '',
      gender: manualFormData.gender || 'Nam',
      permanentResidence: fullResidence
    };
    
    if (user) {
      try {
        await addDoc(collection(db, 'results'), {
          ...newEntry,
          userId: user.uid,
          createdAt: serverTimestamp()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'results');
      }
    } else {
      setResults(prev => {
        const newResults = [...prev, newEntry];
        if (selectedPersonIndex === null && newResults.length > 0) {
          setSelectedPersonIndex(0);
        }
        return newResults;
      });
    }
    
    setIsManualFormOpen(false);
    setManualFormData({
      fullName: '',
      dateOfBirth: '',
      gender: 'Nam',
      permanentResidence: ''
    });
    setSelectedProvince('');
    setProvinceSearch('');
  };

  const handleDateInput = (value: string) => {
    // Remove all non-digits
    const cleanValue = value.replace(/\D/g, '');
    let formattedValue = '';
    
    if (cleanValue.length > 0) {
      // Add DD
      formattedValue = cleanValue.substring(0, 2);
      if (cleanValue.length > 2) {
        // Add /MM
        formattedValue += '/' + cleanValue.substring(2, 4);
        if (cleanValue.length > 4) {
          // Add /YYYY
          formattedValue += '/' + cleanValue.substring(4, 8);
        }
      }
    }
    return formattedValue;
  };

  const handleDownloadPDF = () => {
    const element = document.getElementById('medical-form-to-print');
    if (!element) return;
    
    element.classList.add('pdf-mode');

    const opt = {
      margin: [15, 20, 15, 20], // Top, Left, Bottom, Right (in mm) - matches 1.5cm and 2cm
      filename: `Mau_Kham_Suc_Khoe_${selectedPersonIndex !== null ? results[selectedPersonIndex].fullName.replace(/\s+/g, '_') : 'Template'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        logging: false, 
        letterRendering: true,
        windowWidth: 800
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    // @ts-ignore
    html2pdf().set(opt).from(element).save().then(() => {
        element.classList.remove('pdf-mode');
    });
  };

  const handlePreviewPDF = async () => {
    const element = document.getElementById('medical-form-to-print');
    if (!element) return;
    
    element.classList.add('pdf-mode');

    const opt = {
      margin: [15, 20, 15, 20],
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        logging: false, 
        letterRendering: true,
        windowWidth: 800
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    // @ts-ignore
    const pdf = await html2pdf().set(opt).from(element).outputPdf('bloburl');
    window.open(pdf, '_blank');
    
    element.classList.remove('pdf-mode');
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
          <div className="flex items-center gap-4">
            <button 
              onClick={reset}
              className="text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-1.5 text-sm font-medium"
              title="Xóa tất cả dữ liệu và làm mới trang"
            >
              <RefreshCw className="w-4 h-4" />
              Làm mới
            </button>
            {user ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName || ''} className="w-8 h-8 rounded-full border border-slate-200" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                      {user.displayName?.charAt(0) || 'U'}
                    </div>
                  )}
                  <span className="text-sm font-medium text-slate-700 hidden sm:inline">{user.displayName}</span>
                </div>
                <button 
                  onClick={handleLogout}
                  className="text-slate-500 hover:text-red-600 transition-colors text-sm font-medium"
                >
                  Đăng xuất
                </button>
              </div>
            ) : (
              <button 
                onClick={handleLogin}
                className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-blue-700 transition-all shadow-sm shadow-blue-100 flex items-center gap-2"
              >
                <Globe className="w-4 h-4" />
                Đăng nhập
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto px-2 py-4" style={{ width: '960px' }}>
        <div className="flex flex-col lg:flex-row gap-2 items-start">
          {/* Sidebar */}
          <aside className="w-44 shrink-0 space-y-1.5">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <button 
                onClick={() => setIsNguyenKhoiOpen(!isNguyenKhoiOpen)}
                className="w-full flex items-center justify-between p-1.5 hover:bg-slate-50 transition-colors group"
                title={isNguyenKhoiOpen ? "Đóng tab NGUYÊN KHÔI" : "Mở tab NGUYÊN KHÔI"}
              >
                <div className="flex items-center gap-1">
                  <div className="bg-blue-100 p-0.5 rounded-lg group-hover:bg-blue-200 transition-colors">
                    <Globe className="w-2.5 h-2.5 text-blue-600" />
                  </div>
                  <span className="font-bold text-[9px] text-slate-700 uppercase tracking-wider">NGUYÊN KHÔI</span>
                </div>
                {isNguyenKhoiOpen ? (
                  <ChevronDown className="w-2.5 h-2.5 text-slate-400" />
                ) : (
                  <ChevronRight className="w-2.5 h-2.5 text-slate-400" />
                )}
              </button>
              
              <AnimatePresence>
                {isNguyenKhoiOpen && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden bg-slate-50/50"
                  >
                    <div className="p-0.5 space-y-0.5">
                      {['Tiếng Việt', 'Tiếng Trung', 'Tiếng Anh'].map((lang) => (
                        <button
                          key={lang}
                          onClick={() => {
                            setSelectedLanguage(lang);
                            if (lang === 'Tiếng Việt') {
                              setShowMedicalForm(true);
                              if (selectedPersonIndex === null && results.length > 0) {
                                setSelectedPersonIndex(0);
                              }
                            } else {
                              setShowMedicalForm(false);
                            }
                          }}
                          className={`w-full text-left px-2 py-1 rounded-lg text-[9px] font-medium transition-all ${
                            selectedLanguage === lang 
                              ? 'bg-blue-600 text-white shadow-sm' 
                              : 'text-slate-600 hover:bg-white hover:text-blue-600'
                          }`}
                        >
                          {lang}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <button 
                onClick={() => setIsCty6789Open(!isCty6789Open)}
                className="w-full flex items-center justify-between p-1.5 hover:bg-slate-50 transition-colors group"
                title={isCty6789Open ? "Đóng tab CTY 6789" : "Mở tab CTY 6789"}
              >
                <div className="flex items-center gap-1">
                  <div className="bg-blue-100 p-0.5 rounded-lg group-hover:bg-blue-200 transition-colors">
                    <Building2 className="w-2.5 h-2.5 text-blue-600" />
                  </div>
                  <span className="font-bold text-[9px] text-slate-700 uppercase tracking-wider">CTY 6789</span>
                </div>
                {isCty6789Open ? (
                  <ChevronDown className="w-2.5 h-2.5 text-slate-400" />
                ) : (
                  <ChevronRight className="w-2.5 h-2.5 text-slate-400" />
                )}
              </button>
              
              <AnimatePresence>
                {isCty6789Open && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden bg-slate-50/50"
                  >
                    <div className="p-0.5 space-y-0.5">
                      {['Mẫu A1', 'Mẫu A2', 'Mẫu A3', 'Mẫu A4', 'Mẫu A5'].map((model) => (
                        <button
                          key={model}
                          onClick={() => setSelectedModel(model)}
                          className={`w-full text-left px-2 py-1 rounded-lg text-[9px] font-medium transition-all ${
                            selectedModel === model 
                              ? 'bg-blue-600 text-white shadow-sm' 
                              : 'text-slate-600 hover:bg-white hover:text-blue-600'
                          }`}
                        >
                          {model}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <button 
                onClick={() => setIsLogoTabOpen(!isLogoTabOpen)}
                className="w-full flex items-center justify-between p-1.5 hover:bg-slate-50 transition-colors group"
                title={isLogoTabOpen ? "Đóng tab LOGO" : "Mở tab LOGO"}
              >
                <div className="flex items-center gap-1">
                  <div className="bg-blue-100 p-0.5 rounded-lg group-hover:bg-blue-200 transition-colors">
                    <ImageIcon className="w-2.5 h-2.5 text-blue-600" />
                  </div>
                  <span className="font-bold text-[9px] text-slate-700 uppercase tracking-wider">LOGO</span>
                </div>
                {isLogoTabOpen ? (
                  <ChevronDown className="w-2.5 h-2.5 text-slate-400" />
                ) : (
                  <ChevronRight className="w-2.5 h-2.5 text-slate-400" />
                )}
              </button>
              
              <AnimatePresence>
                {isLogoTabOpen && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden bg-slate-50/50"
                  >
                    <div className="p-1 space-y-1.5">
                      {/* Custom Logo Upload */}
                      <div className="space-y-0.5">
                        <label className="text-[7px] font-bold text-slate-400 uppercase tracking-widest ml-1">Tải logo tùy chỉnh</label>
                        <div 
                          onClick={() => logoInputRef.current?.click()}
                          className={`w-full border border-dashed rounded-lg p-1 flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-all group ${
                            customLogo ? 'border-blue-400 bg-blue-50/30' : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50/30'
                          }`}
                        >
                          <input 
                            type="file" 
                            ref={logoInputRef}
                            onChange={handleLogoUpload}
                            accept="image/*"
                            className="hidden"
                          />
                          {customLogo ? (
                            <div className="relative w-full aspect-square rounded overflow-hidden border border-blue-200">
                              <img src={customLogo} alt="Custom Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCustomLogo(null);
                                }}
                                className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-full shadow-sm"
                                title="Xóa logo tùy chỉnh"
                              >
                                <X className="w-1 h-1" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <Upload className="w-2.5 h-2.5 text-slate-400 group-hover:text-blue-600" />
                              <span className="text-[7px] font-semibold text-slate-500">Chọn ảnh logo</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="h-px bg-slate-200 mx-1" />

                      {/* Preset Logos */}
                      <div className="space-y-0.5">
                        <label className="text-[7px] font-bold text-slate-400 uppercase tracking-widest ml-1">Logo có sẵn</label>
                        <div className="grid grid-cols-4 gap-0.5">
                          {[
                            { id: 'logo-global', url: globalLogo, name: 'Logo Hệ Thống', isGlobal: true },
                            { id: 'logo1', url: 'https://ais-dev-l27ehl2nr5tn5nl6qkwq7y-487314014322.asia-southeast1.run.app/api/images/logo-mpuh.png', name: 'Logo MPUH' },
                            { id: 'logo2', url: 'https://picsum.photos/seed/clinic/100/100', name: 'Logo 2' },
                            { id: 'logo3', url: 'https://picsum.photos/seed/medical/100/100', name: 'Logo 3' },
                          ].map((logo) => (
                            logo.url && (
                              <button
                                key={logo.id}
                                onClick={() => {
                                  setSelectedLogo(logo.url);
                                  setCustomLogo(null); // Clear custom if preset is selected
                                }}
                                className={`relative aspect-square rounded overflow-hidden border transition-all ${
                                  selectedLogo === logo.url 
                                    ? 'border-blue-600 ring-1 ring-blue-100' 
                                    : 'border-slate-200 hover:border-blue-300'
                                } ${logo.isGlobal ? 'bg-blue-50' : ''}`}
                                title={`Chọn ${logo.name}`}
                              >
                                <img 
                                  src={logo.url} 
                                  alt={logo.name} 
                                  className="w-full h-full object-contain"
                                  referrerPolicy="no-referrer"
                                />
                                {selectedLogo === logo.url && (
                                  <div className="absolute inset-0 bg-blue-600/10 flex items-center justify-center">
                                    <div className="bg-blue-600 text-white p-0.5 rounded-full">
                                      <CheckCircle2 className="w-1 h-1" />
                                    </div>
                                  </div>
                                )}
                                {logo.isGlobal && (
                                  <div className="absolute top-0 left-0 bg-blue-600 text-white text-[5px] px-0.5 font-bold uppercase">
                                    Global
                                  </div>
                                )}
                              </button>
                            )
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </aside>

          <div className="flex flex-col lg:flex-row gap-2 items-start flex-1">
            {showMedicalForm ? (
              <section className="flex-1 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm overflow-y-auto custom-scrollbar" style={{ maxHeight: '85vh' }}>
                <div className="flex items-center justify-between mb-3 border-b pb-2">
                  <div>
                    <h2 className="text-sm font-bold text-slate-800">Mẫu Khám Sức Khỏe</h2>
                    <p className="text-[10px] text-slate-500">Chọn người từ danh sách để điền tự động</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select 
                      className="text-[10px] border border-slate-200 rounded-lg px-2 py-1 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onChange={(e) => setSelectedPersonIndex(e.target.value === "" ? null : parseInt(e.target.value))}
                      value={selectedPersonIndex ?? ""}
                    >
                      <option value="">-- Chọn người --</option>
                      {results.map((r, i) => (
                        <option key={i} value={i}>{r.fullName}</option>
                      ))}
                    </select>
                    <button 
                      onClick={() => setIsEditingForm(!isEditingForm)}
                      className={`flex items-center gap-1.5 px-3 py-1 ${isEditingForm ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-600 hover:bg-slate-700'} text-white text-[10px] font-bold rounded-lg transition-all shadow-md shadow-slate-100`}
                    >
                      <Settings2 className="w-3 h-3" />
                      {isEditingForm ? 'Lưu mẫu' : 'Chỉnh sửa mẫu'}
                    </button>
                    <button 
                      onClick={() => window.print()}
                      className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 text-white text-[10px] font-bold rounded-lg hover:bg-blue-700 transition-all shadow-md shadow-blue-100"
                    >
                      <Download className="w-3 h-3" />
                      In mẫu
                    </button>
                    <button 
                      onClick={handlePreviewPDF}
                      className="flex items-center gap-1.5 px-3 py-1 bg-green-600 text-white text-[10px] font-bold rounded-lg hover:bg-green-700 transition-all shadow-md shadow-green-100"
                    >
                      <Eye className="w-3 h-3" />
                      Xem trước
                    </button>
                    <button 
                      onClick={handleDownloadPDF}
                      className="flex items-center gap-1.5 px-3 py-1 bg-red-600 text-white text-[10px] font-bold rounded-lg hover:bg-red-700 transition-all shadow-md shadow-red-100"
                    >
                      <FileText className="w-3 h-3" />
                      Tải PDF
                    </button>
                    <button 
                      onClick={() => setShowMedicalForm(false)}
                      className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* The Form Content (Matching PDF Page 1) */}
                <div id="medical-form-to-print" className="mx-auto print:p-0 print:border-0 print:shadow-none" style={{ width: '210mm', fontFamily: '"Times New Roman", Times, serif', color: '#000' }}>
                  {/* Page 1: TÓM TẮT KẾT QUẢ KHÁM SỨC KHỎE */}
                  <div className="bg-white border border-slate-300 p-[10mm] shadow-inner relative print:border-0 print:shadow-none" style={{ width: '210mm', minHeight: '297mm' }}>
                    {/* Official Header - Using a table-like structure for stable alignment */}
                    <div className="flex justify-between items-start mb-6 w-full">
                      <div className="w-[180px] text-center">
                        <div className="flex flex-col items-center">
                          {customLogo ? (
                            <img src={customLogo} alt="Logo" className="max-w-[150px] max-h-[70px] object-contain" referrerPolicy="no-referrer" />
                          ) : selectedLogo ? (
                            <img src={selectedLogo} alt="Logo" className="max-w-[150px] max-h-[70px] object-contain" referrerPolicy="no-referrer" />
                          ) : globalLogo ? (
                            <img src={globalLogo} alt="Logo" className="max-w-[150px] max-h-[70px] object-contain" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-[130px] h-[60px] bg-blue-600 rounded flex items-center justify-center text-white font-bold text-xl">MP</div>
                          )}
                          <p className="font-bold text-[11pt] mt-1 uppercase">BỆNH VIỆN ĐHYD</p>
                          <p className="text-[10pt]">Số: .........../KHTH</p>
                        </div>
                      </div>
                      <div className="flex-1 text-center px-4">
                        <h1 className="text-[16pt] font-bold uppercase leading-tight">TÓM TẮT KẾT QUẢ KHÁM SỨC KHỎE CỦA NGƯỜI ĐI LAO ĐỘNG, HỌC TẬP VÀ CÔNG TÁC NƯỚC NGOÀI</h1>
                        <p className="text-[12pt] font-bold uppercase mt-1">MẪU SONG NGỮ</p>
                        <p className="italic text-[10pt] mt-1">Bản lưu tại BV ĐHYD</p>
                      </div>
                      <div className="w-[180px]"></div> {/* Spacer to keep title centered */}
                    </div>

                    {/* Photo Box 4x6 - Better integrated */}
                    <div className="absolute border border-black flex items-center justify-center text-center text-[10pt] h-[40mm] w-[30mm]" style={{ top: '50mm', left: '15mm' }}>
                      Ảnh 4x6
                    </div>

                    <div className="flex flex-wrap gap-y-1 text-[12pt] mb-6 w-[560px] ml-[160px]">
                      <DndContext 
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEndFields}
                      >
                        <SortableContext 
                          items={formFields.map(f => f.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {formFields.map((field) => (
                            <SortableFormField 
                              key={field.id}
                              field={field}
                              isEditing={isEditingForm}
                              onRemove={() => removeFormField(field.id)}
                              onUpdate={(updates) => updateFormField(field.id, updates)}
                              selectedPersonIndex={selectedPersonIndex}
                              results={results}
                            />
                          ))}
                        </SortableContext>
                      </DndContext>
                      
                      {isEditingForm && (
                        <button 
                          onClick={addFormField}
                          className="flex items-center gap-1 text-blue-600 text-[10pt] font-bold hover:text-blue-700 transition-colors mt-2"
                        >
                          <Plus className="w-4 h-4" />
                          Thêm trường thông tin
                        </button>
                      )}
                    </div>

                    <div className="relative">
                      <DndContext 
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEndRows}
                      >
                        <table className="w-full border-collapse border border-black text-[9pt] mt-1 pt-0">
                          <thead>
                            <tr className="bg-slate-50">
                              <th className="border border-black py-2 px-1 w-8 text-center align-middle">TT</th>
                              <th className="border border-black py-2 px-1 w-[35%] text-center align-middle">NỘI DUNG KHÁM</th>
                              <th className="border border-black py-2 px-1 text-center align-middle">KẾT QUẢ</th>
                              <th className="border border-black py-2 px-1 w-24 text-center align-middle">BS KHÁM KÝ</th>
                            </tr>
                          </thead>
                          <tbody>
                            <SortableContext 
                              items={tableRows.map(r => r.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              {tableRows.map((row) => (
                                <SortableTableRow 
                                  key={row.id}
                                  row={row}
                                  isEditing={isEditingForm}
                                  onRemove={() => removeTableRow(row.id)}
                                  onUpdate={(updates) => updateTableRow(row.id, updates)}
                                />
                              ))}
                            </SortableContext>
                          </tbody>
                        </table>
                      </DndContext>
                      
                      {isEditingForm && (
                        <button 
                          onClick={addTableRow}
                          className="flex items-center gap-1 text-blue-600 text-[10pt] font-bold hover:text-blue-700 transition-colors mt-2"
                        >
                          <Plus className="w-4 h-4" />
                          Thêm hàng mới
                        </button>
                      )}
                    </div>

                    <div className="mt-4 text-[12pt] space-y-4">
                      <div>
                        <p className="font-bold -mt-2">KẾT LUẬN: <span className="font-normal italic">Người lao động này đủ/không đủ sức khỏe để làm việc (Nếu không đủ xin nêu lý do)</span></p>
                        <p className="mt-1 flex items-baseline gap-2">Chi tiết lý do: <span className="border-b border-dotted border-black flex-1 pb-[2px]">......................................................................................................</span></p>
                      </div>
                      
                      {/* Signature Section - Using a table-like structure for right alignment */}
                      <div className="flex justify-end mt-8">
                        <div className="w-[350px] text-center space-y-1">
                          <p className="italic">BẮC NINH, Ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}</p>
                          <p className="font-bold uppercase">KT. TRƯỞNG PHÒNG KHTH</p>
                          <div className="h-24"></div> {/* Signature space */}
                          <p className="font-bold flex items-baseline gap-2 justify-center">BS. <span className="border-b border-dotted border-black w-40 pb-[2px]">&nbsp;</span></p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Page 2: PHIẾU KẾT QUẢ ĐIỆN TIM (ECG) */}
                  <div className="bg-white border border-slate-300 p-[10mm] shadow-inner relative print:border-0 print:shadow-none mt-4 print:mt-0" style={{ width: '210mm', minHeight: '297mm', pageBreakBefore: 'always' }}>
                    {/* ECG Header - Table structure for alignment */}
                    <div className="flex justify-between items-start mb-8 w-full">
                      <div className="text-left w-[250px]">
                        <p className="font-bold text-[11pt] uppercase">MPUH BỆNH VIỆN ĐẠI HỌC Y DƯỢC</p>
                        <p className="text-[10pt]">Số: .........../KHTH</p>
                      </div>
                      <div className="text-center flex-1">
                        <p className="font-bold text-[11pt] uppercase">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                        <p className="font-bold text-[10pt]">Độc lập - Tự do - Hạnh phúc</p>
                        <div className="w-32 h-[1px] bg-black mx-auto mt-1"></div>
                      </div>
                      <div className="w-[250px]"></div> {/* Spacer */}
                    </div>

                    <div className="text-center mb-8">
                      <h2 className="text-[18pt] font-bold uppercase">PHIẾU KẾT QUẢ ĐIỆN TIM (ECG)</h2>
                    </div>

                    {/* ECG Patient Info */}
                    <div className="space-y-2 mb-6 text-[12pt]">
                      <div className="flex items-baseline gap-2">
                        <span className="font-bold whitespace-nowrap">Họ và tên (Full name):</span>
                        <span className="border-b border-dotted border-black flex-1 px-2 uppercase font-bold text-blue-800">
                          {selectedPersonIndex !== null ? results[selectedPersonIndex].fullName : '..................................................................'}
                        </span>
                        <span className="font-bold whitespace-nowrap ml-4">Giới tính (Sex):</span>
                        <span className="border-b border-dotted border-black w-20 px-2">
                          {selectedPersonIndex !== null ? results[selectedPersonIndex].gender : 'Nam'}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="font-bold whitespace-nowrap">Ngày sinh (Date of birth):</span>
                        <span className="border-b border-dotted border-black flex-1 px-2">
                          {selectedPersonIndex !== null ? results[selectedPersonIndex].dateOfBirth : '..................................................................'}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="font-bold whitespace-nowrap">Địa chỉ (Address):</span>
                        <span className="border-b border-dotted border-black flex-1 px-2">
                          {selectedPersonIndex !== null ? results[selectedPersonIndex].permanentResidence : '..................................................................'}
                        </span>
                      </div>
                    </div>

                    {/* ECG Table */}
                    <table className="w-full border-collapse border border-black text-[11pt] mb-8">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="border border-black py-2 px-4 text-left w-1/2">DỊCH VỤ KHÁM (Examination services)</th>
                          <th className="border border-black py-2 px-4 text-center">KẾT QUẢ (Result)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ pageBreakInside: 'avoid' }}>
                          <td className="border border-black py-4 px-4 font-bold">1. Điện tim</td>
                          <td className="border border-black py-4 px-4 italic text-center">
                            {isEditingForm ? (
                              <input 
                                type="text" 
                                placeholder="Nhập kết quả..."
                                className="w-full bg-transparent border-b border-blue-200 focus:outline-none text-center"
                              />
                            ) : 'Bình thường / Normal'}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* ECG Footer - Right aligned */}
                    <div className="mt-8 text-[12pt]">
                      <p className="font-bold mb-2">Nhận xét khác của bác sĩ (Doctor's other comments):</p>
                      <p className="border-b border-dotted border-black w-full pb-1">&nbsp;</p>
                      <p className="border-b border-dotted border-black w-full pb-1 mt-2">&nbsp;</p>
                      
                      <div className="flex justify-end mt-10">
                        <div className="text-center w-[300px] space-y-1">
                          <p className="italic">Ngày (Date) {new Date().getDate()}/{new Date().getMonth() + 1}/{new Date().getFullYear()}</p>
                          <p className="font-bold uppercase">Bác sĩ (Doctor)</p>
                          <div className="h-24"></div>
                          <p className="font-bold">................................................</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            ) : (
              <>
                {/* Left Column: Upload & Preview (Reduced Size) */}
                <section className="shrink-0 space-y-2">
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm" style={{ width: '151px', height: '204px', paddingTop: '6px' }}>
              <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Tải ảnh lên</h2>
              
              <div className="space-y-2">
                <div className="flex flex-col gap-2">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1" style={{ paddingTop: '1px', marginTop: '13px', display: 'block' }}>Chọn tệp ảnh</label>
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                      accept="image/*"
                      multiple
                      className="hidden"
                    />
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 font-bold py-1 rounded-xl transition-all flex items-center justify-center gap-1.5 text-[9px]"
                    >
                      <Upload className="w-2.5 h-2.5" />
                      Chọn tệp
                    </button>
                  </div>
                  
                  <div 
                    onClick={startCamera}
                    className="w-full border-2 border-dashed border-slate-200 rounded-xl p-1.5 flex flex-col items-center justify-center gap-0.5 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all group"
                    style={{ height: '36px' }}
                    title="Mở camera để chụp ảnh CCCD"
                  >
                    <div className="bg-slate-100 p-0.5 rounded-full group-hover:bg-blue-100 transition-colors">
                      <Camera className="w-2.5 h-2.5 text-slate-400 group-hover:text-blue-600" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-slate-700 text-[8px]">Chụp ảnh từ Camera</p>
                    </div>
                  </div>
                </div>

                {images.length > 0 && !loading && (
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={extractInfo}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-bold py-1.5 rounded-xl shadow-md shadow-blue-200 transition-all flex items-center justify-center gap-1.5 text-[10px] border border-blue-400/30"
                    title="Bắt đầu trích xuất thông tin từ ảnh đã chọn"
                  >
                    <FileText className="w-3 h-3" />
                    Trích xuất
                  </motion.button>
                )}

                <button
                  onClick={() => setIsManualFormOpen(true)}
                  className="w-full bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 font-bold py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 text-[9px]"
                  title="Tự thêm thông tin thủ công"
                >
                  <Plus className="w-2.5 h-2.5" />
                  Thêm thủ công
                </button>

                {loading && (
                  <div className="w-full flex flex-col items-center gap-1 py-1">
                    <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                    <p className="text-[9px] font-bold text-slate-500 animate-pulse uppercase tracking-wider">Đang phân tích...</p>
                  </div>
                )}

                {error && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="w-full p-2 bg-red-50 border border-red-100 rounded-xl flex gap-2 text-red-700 text-[9px] font-medium"
                  >
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <p>{error}</p>
                  </motion.div>
                )}

                {/* Image Previews Grouped by Person (1-2 images) */}
                <div className="space-y-2 pt-1">
                  <AnimatePresence>
                    {Array.from({ length: Math.ceil(images.length / 2) }).map((_, groupIndex) => (
                      <motion.div 
                        key={groupIndex}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-1.5 border border-blue-100 bg-blue-50/10 rounded-xl space-y-1.5"
                        style={{ width: '125px' }}
                      >
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[9px] font-bold text-blue-600 uppercase tracking-tighter">NGƯỜI #{groupIndex + 1}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
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
                                  className="absolute top-0.5 right-0.5 bg-black/50 hover:bg-black/70 text-white p-0.5 rounded-full backdrop-blur-sm transition-colors opacity-0 group-hover:opacity-100"
                                  title="Xóa ảnh này"
                                >
                                  <X className="w-2 h-2" />
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
          <section className="flex-1 space-y-4 min-w-0">
            <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm h-full flex flex-col overflow-hidden" style={{ height: '188px' }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Danh sách trích xuất (Bảng Excel)</h2>
                  {results.length > 0 && (
                    <button 
                      onClick={exportToExcel}
                      className="flex items-center gap-1.5 px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold rounded-lg shadow-sm transition-all"
                      title="Xuất danh sách ra file Excel (.xlsx)"
                    >
                      <Download className="w-3 h-3" />
                      Xuất Excel (.xlsx)
                    </button>
                  )}
                </div>
                <div className="text-xs text-slate-400 font-medium">
                  Tổng cộng: {results.length}
                </div>
              </div>

              <div className="flex-1 overflow-x-auto custom-scrollbar border border-slate-100 rounded-xl" style={{ height: '155px' }}>
                <table className="w-auto text-left border-collapse table-auto">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-0.5 py-0 text-[7px] font-bold text-slate-400 uppercase tracking-tighter w-4 text-center">STT</th>
                      <th className="px-0.5 py-0 text-[7px] font-bold text-slate-400 uppercase tracking-tighter">Số CCCD</th>
                      <th className="px-0.5 py-0 text-[7px] font-bold text-slate-400 uppercase tracking-tighter">Ngày cấp</th>
                      <th className="px-0.5 py-0 text-[7px] font-bold text-slate-400 uppercase tracking-tighter">Họ và tên</th>
                      <th className="px-0.5 py-0 text-[7px] font-bold text-slate-400 uppercase tracking-tighter">Ngày sinh</th>
                      <th className="px-0.5 py-0 text-[7px] font-bold text-slate-400 uppercase tracking-tighter">Giới tính</th>
                      <th className="px-0.5 py-0 text-[7px] font-bold text-slate-400 uppercase tracking-tighter">Thường trú</th>
                      <th className="px-0.5 py-0 text-[7px] font-bold text-slate-400 uppercase tracking-tighter w-10 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    <AnimatePresence initial={false}>
                      {results.length > 0 ? (
                        results.map((item, index) => {
                          const isEditing = editingIndex === index;
                          const displayItem = isEditing && editData ? editData : item;
                          const lineText = formatResultLine(displayItem);
                          const isDuplicate = duplicateIds.includes(displayItem.idNumber);
                          
                          return (
                            <motion.tr 
                              key={index}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ 
                                opacity: 1, 
                                y: 0,
                                backgroundColor: isEditing ? "rgba(59, 130, 246, 0.05)" : (isDuplicate ? "rgba(239, 68, 68, 0.05)" : "transparent")
                              }}
                              className={`transition-all duration-500 group ${isEditing ? 'bg-blue-50/30' : (isDuplicate ? 'border-l-4 border-l-red-500 bg-red-50/50' : 'hover:bg-blue-50/30')}`}
                            >
                              <td className="px-0.5 py-0 text-[9px] font-bold text-slate-400 text-center">
                                {index + 1}
                              </td>
                              <td className="px-0.5 py-0 text-[9px] text-slate-700 font-medium whitespace-nowrap">
                                {isEditing ? (
                                  <input 
                                    type="text" 
                                    value={editData?.idNumber} 
                                    onChange={(e) => handleEditChange('idNumber', e.target.value)}
                                    className="w-full bg-white border border-blue-200 rounded px-1 py-0 text-[9px] focus:outline-none focus:border-blue-500"
                                  />
                                ) : maskIdNumber(item.idNumber)}
                                {fieldErrors[`idNumber_${index}`] && (
                                  <div className="text-[6px] text-red-500 font-bold mt-0">{fieldErrors[`idNumber_${index}`]}</div>
                                )}
                              </td>
                              <td className="px-0.5 py-0 text-[9px] text-slate-600 whitespace-nowrap">
                                {isEditing ? (
                                  <input 
                                    type="text" 
                                    value={editData?.issueDate} 
                                    onChange={(e) => handleEditChange('issueDate', e.target.value)}
                                    className="w-full bg-white border border-blue-200 rounded px-1 py-0 text-[9px] focus:outline-none focus:border-blue-500"
                                  />
                                ) : (item.issueDate || "Không có")}
                                {fieldErrors[`issueDate_${index}`] && (
                                  <div className="text-[6px] text-red-500 font-bold mt-0">
                                    {fieldErrors[`issueDate_${index}`] === "Định dạng ngày phải là DD/MM/YYYY" ? "Không có" : fieldErrors[`issueDate_${index}`]}
                                  </div>
                                )}
                              </td>
                              <td className="px-0.5 py-0 text-[9px] text-slate-900 font-bold uppercase whitespace-nowrap">
                                {isEditing ? (
                                  <input 
                                    type="text" 
                                    value={editData?.fullName} 
                                    onChange={(e) => handleEditChange('fullName', e.target.value)}
                                    className="w-full bg-white border border-blue-200 rounded px-1 py-0 text-[9px] focus:outline-none focus:border-blue-500 uppercase"
                                  />
                                ) : item.fullName}
                              </td>
                              <td className="px-0.5 py-0 text-[9px] text-slate-600 whitespace-nowrap">
                                {isEditing ? (
                                  <input 
                                    type="text" 
                                    value={editData?.dateOfBirth} 
                                    onChange={(e) => handleEditChange('dateOfBirth', e.target.value)}
                                    className="w-full bg-white border border-blue-200 rounded px-1 py-0 text-[9px] focus:outline-none focus:border-blue-500"
                                  />
                                ) : item.dateOfBirth}
                                {fieldErrors[`dateOfBirth_${index}`] && (
                                  <div className="text-[6px] text-red-500 font-bold mt-0">{fieldErrors[`dateOfBirth_${index}`]}</div>
                                )}
                              </td>
                              <td className="px-0.5 py-0 text-[9px] text-slate-600 whitespace-nowrap uppercase">
                                {isEditing ? (
                                  <select 
                                    value={editData?.gender} 
                                    onChange={(e) => handleEditChange('gender', e.target.value)}
                                    className="w-full bg-white border border-blue-200 rounded px-1 py-0 text-[9px] focus:outline-none focus:border-blue-500 uppercase"
                                  >
                                    <option value="Nam">Nam</option>
                                    <option value="Nữ">Nữ</option>
                                  </select>
                                ) : item.gender}
                              </td>
                              <td className="px-0.5 py-0 text-[9px] text-slate-600 truncate uppercase" title={displayItem.permanentResidence}>
                                {isEditing ? (
                                  <input 
                                    type="text" 
                                    value={editData?.permanentResidence} 
                                    onChange={(e) => handleEditChange('permanentResidence', e.target.value)}
                                    className="w-full bg-white border border-blue-200 rounded px-1 py-0 text-[9px] focus:outline-none focus:border-blue-500 uppercase"
                                  />
                                ) : getProvinceOnly(item.permanentResidence)}
                              </td>
                              <td className="px-0.5 py-0 text-center">
                                <div className="flex items-center justify-center gap-0.5">
                                  {isEditing ? (
                                    <>
                                      <button 
                                        onClick={saveEdit}
                                        className="p-0.5 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                                        title="Lưu"
                                      >
                                        <Save className="w-2 h-2" />
                                      </button>
                                      <button 
                                        onClick={cancelEditing}
                                        className="p-0.5 bg-slate-400 text-white rounded hover:bg-slate-500 transition-colors"
                                        title="Hủy"
                                      >
                                        <X className="w-2 h-2" />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button 
                                        onClick={() => startEditing(index)}
                                        className="p-0.5 bg-white text-slate-400 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                        title="Sửa"
                                      >
                                        <Edit3 className="w-2 h-2" />
                                      </button>
                                      <button 
                                        onClick={() => copyToClipboard(lineText, index)}
                                        className={`p-0.5 rounded-lg transition-all ${
                                          copySuccess === index 
                                            ? 'bg-green-100 text-green-600' 
                                            : 'bg-white text-slate-400 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 opacity-0 group-hover:opacity-100'
                                        }`}
                                        title="Copy hàng này"
                                      >
                                        {copySuccess === index ? (
                                          <CheckCircle2 className="w-2.5 h-2.5" />
                                        ) : (
                                          <FileText className="w-2.5 h-2.5" />
                                        )}
                                      </button>
                                      <button 
                                        onClick={() => setItemToDelete(index)}
                                        className="p-0.5 bg-white text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-200 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                        title="Xóa hàng này"
                                      >
                                        <X className="w-2.5 h-2.5" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </motion.tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={9} className="py-10 text-center">
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
        </>
      )}
    </div>
  </div>
</main>

      <footer className="max-w-4xl mx-auto px-4 py-12 text-center text-slate-400 text-xs">
        <p>© 2026 CCCD Reader AI - Powered by Gemini 3.0 Flash</p>
      </footer>

      <AnimatePresence>
        {isManualFormOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl border border-slate-200 p-3 max-w-[420px] w-full"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <div className="bg-blue-100 p-1 rounded-full">
                    <Plus className="w-4 h-4 text-blue-600" />
                  </div>
                  <h3 className="text-sm font-bold">Thêm thông tin thủ công</h3>
                </div>
                <button 
                  onClick={() => setIsManualFormOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <form onSubmit={handleManualSubmit} className="space-y-1.5">
                <div className="space-y-0.5">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider ml-1">Họ và tên</label>
                  <input 
                    type="text" 
                    required
                    onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Vui lòng điền vào trường này')}
                    onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                    value={manualFormData.fullName}
                    onChange={(e) => setManualFormData({...manualFormData, fullName: e.target.value.toUpperCase()})}
                    placeholder="NGUYỄN VĂN A"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider ml-1">Ngày sinh</label>
                    <input 
                      type="text" 
                      required
                      onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Vui lòng điền vào trường này')}
                      onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                      value={manualFormData.dateOfBirth}
                      onChange={(e) => setManualFormData({...manualFormData, dateOfBirth: handleDateInput(e.target.value)})}
                      placeholder="DD/MM/YYYY"
                      maxLength={10}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider ml-1">Giới tính</label>
                    <select 
                      value={manualFormData.gender}
                      onChange={(e) => setManualFormData({...manualFormData, gender: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Nam">Nam</option>
                      <option value="Nữ">Nữ</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="space-y-0.5" style={{ width: '140px' }}>
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider ml-1">Thường trú</label>
                    <textarea 
                      value={manualFormData.permanentResidence}
                      onChange={(e) => setManualFormData({...manualFormData, permanentResidence: e.target.value})}
                      placeholder="Số nhà, đường..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[70px] resize-none"
                    />
                  </div>
                  <div className="space-y-0.5 flex flex-col flex-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider ml-1">Tỉnh thành</label>
                    <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-1.5 flex flex-col gap-1.5" style={{ width: '200px', paddingLeft: '6px' }}>
                      {/* Top Tags */}
                      <div className="flex flex-wrap gap-1">
                        {topProvinces.map(p => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => {
                              setSelectedProvince(p);
                              setProvinceSearch(p);
                            }}
                            className={`px-1 py-0.5 rounded text-[8px] font-bold transition-all ${
                              selectedProvince === p 
                                ? 'bg-blue-600 text-white shadow-sm' 
                                : 'bg-white text-slate-500 border border-slate-200 hover:border-blue-300 hover:text-blue-600'
                            }`}
                          >
                            {p.split(' (')[0]}
                          </button>
                        ))}
                      </div>

                      {/* Search Input */}
                      <div className="relative">
                        <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-slate-400" />
                        <input 
                          type="text"
                          value={provinceSearch}
                          onChange={(e) => {
                            setProvinceSearch(e.target.value);
                            const match = PROVINCES.find(p => p.toLowerCase() === e.target.value.toLowerCase());
                            if (match) setSelectedProvince(match);
                          }}
                          placeholder="Tìm tỉnh..."
                          className="w-full bg-white border border-slate-200 rounded-md pl-5 pr-1.5 py-0.5 text-[9px] focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      {/* Filtered List */}
                      <div className="flex-1 overflow-y-auto max-h-[60px] pr-1 custom-scrollbar">
                        <div className="flex flex-col gap-0.5">
                          {PROVINCES.filter(p => 
                            p.toLowerCase().includes(provinceSearch.toLowerCase())
                          ).sort((a, b) => {
                            const aIndex = topProvinces.indexOf(a);
                            const bIndex = topProvinces.indexOf(b);
                            if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
                            if (aIndex !== -1) return -1;
                            if (bIndex !== -1) return 1;
                            return 0;
                          }).map(p => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => {
                                setSelectedProvince(p);
                                setProvinceSearch(p);
                              }}
                              className={`text-left px-1.5 py-0.5 rounded text-[9px] transition-all ${
                                selectedProvince === p
                                  ? 'bg-blue-50 text-blue-600 font-bold'
                                  : 'hover:bg-slate-100 text-slate-600'
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button 
                    type="button"
                    onClick={() => setIsManualFormOpen(false)}
                    className="flex-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-[10px] transition-colors"
                  >
                    Hủy
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-[10px] shadow-md shadow-blue-100 transition-colors flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Thêm vào danh sách
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {itemToDelete !== null && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 max-w-sm w-full"
            >
              <div className="flex items-center gap-3 mb-4 text-red-600">
                <div className="bg-red-100 p-2 rounded-full">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold">Xác nhận xóa?</h3>
              </div>
              <p className="text-slate-600 text-sm mb-6">
                Bạn có chắc chắn muốn xóa thông tin của <span className="font-bold text-slate-900">{results[itemToDelete]?.fullName}</span>? Hành động này không thể hoàn tác.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setItemToDelete(null)}
                  className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                >
                  Hủy
                </button>
                <button 
                  onClick={() => deleteResult(itemToDelete)}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md shadow-red-100 transition-colors"
                >
                  Xác nhận xóa
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCameraOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4"
          >
            <div className="relative w-full max-w-lg aspect-[3/4] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10">
              <video 
                ref={videoRef}
                autoPlay 
                playsInline 
                className="w-full h-full object-cover"
              />
              
              {/* Camera UI Overlay */}
              <div className="absolute inset-0 flex flex-col justify-between p-6">
                <div className="flex justify-end">
                  <button 
                    onClick={stopCamera}
                    className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-full backdrop-blur-md transition-all"
                    title="Đóng Camera"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                
                {/* Guide Frame */}
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-full aspect-[1.58/1] border-2 border-dashed border-white/50 rounded-2xl relative">
                    <div className="absolute -top-8 left-0 right-0 text-center">
                      <p className="text-white/80 text-xs font-medium uppercase tracking-widest">Đặt CCCD vào khung hình</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-center items-center gap-8">
                  <div className="w-12 h-12" /> {/* Spacer */}
                  <button 
                    onClick={capturePhoto}
                    className="w-20 h-20 bg-white rounded-full p-1 shadow-xl active:scale-95 transition-transform"
                    title="Chụp ảnh"
                  >
                    <div className="w-full h-full border-4 border-slate-900 rounded-full flex items-center justify-center">
                      <div className="w-14 h-14 bg-slate-900 rounded-full" />
                    </div>
                  </button>
                  <div className="w-12 h-12" /> {/* Spacer */}
                </div>
              </div>
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </motion.div>
        )}
      </AnimatePresence>
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

function SortableFormField({ 
  field, 
  isEditing, 
  onRemove, 
  onUpdate,
  selectedPersonIndex,
  results
}: { 
  field: any; 
  isEditing: boolean; 
  onRemove: () => void;
  onUpdate: (updates: any) => void;
  selectedPersonIndex: number | null;
  results: CCCDInfo[];
  key?: React.Key;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  const displayValue = field.valueKey && selectedPersonIndex !== null 
    ? results[selectedPersonIndex][field.valueKey as keyof CCCDInfo] 
    : field.defaultValue || "";

  return (
    <div 
      ref={setNodeRef} 
      className={`flex items-baseline gap-2 group relative ${isEditing ? 'hover:bg-blue-50/50 rounded p-1 -m-1' : ''}`}
      style={{ ...style, minHeight: '24px', width: field.width || '100%', pageBreakInside: 'avoid' }}
    >
      {isEditing && (
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 text-slate-300 hover:text-blue-500">
          <GripVertical className="w-3 h-3" />
        </div>
      )}
      
      {isEditing ? (
        <div className="flex items-baseline gap-2 flex-1">
          <input 
            type="text" 
            value={field.label} 
            onChange={(e) => onUpdate({ label: e.target.value })}
            className="font-bold whitespace-nowrap bg-transparent border-b border-blue-200 focus:outline-none focus:border-blue-500 text-[12pt]"
            style={{ width: 'auto', minWidth: '100px' }}
          />
          <input 
            type="text" 
            value={field.defaultValue || displayValue} 
            onChange={(e) => onUpdate({ defaultValue: e.target.value })}
            placeholder="Giá trị..."
            className="flex-1 bg-transparent border-b border-blue-200 focus:outline-none focus:border-blue-500 text-[12pt] px-2"
          />
        </div>
      ) : (
        <>
          <span className={`${field.isBold ? 'font-bold' : ''} whitespace-nowrap`}>{field.label}</span>
          <span className={`border-b border-dotted border-black flex-1 px-2 pb-[2px] ${field.uppercase ? 'uppercase' : ''} ${field.valueKey === 'fullName' ? 'text-blue-800 font-bold text-[13pt]' : ''}`}>
            {displayValue || '\u00A0'}
          </span>
        </>
      )}

      {isEditing && (
        <button 
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 transition-all"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function SortableTableRow({ 
  row, 
  isEditing, 
  onRemove, 
  onUpdate 
}: { 
  row: any; 
  isEditing: boolean; 
  onRemove: () => void;
  onUpdate: (updates: any) => void;
  key?: React.Key;
}) {
  const [tempDoctor, setTempDoctor] = useState(row.doctor || "");
  const isDoctorDirty = tempDoctor !== (row.doctor || "");

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: row.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleSaveDoctor = () => {
    onUpdate({ doctor: tempDoctor });
  };

  const handleCancelDoctor = () => {
    setTempDoctor(row.doctor || "");
  };

  // Sync tempDoctor when row.doctor changes externally (e.g. from state reset)
  React.useEffect(() => {
    setTempDoctor(row.doctor || "");
  }, [row.doctor]);

  return (
    <tr ref={setNodeRef} style={{ ...style, pageBreakInside: 'avoid' }} className={isDragging ? 'bg-blue-50' : ''}>
      <td className="border border-black py-1 px-1 text-center font-bold relative align-middle">
        {isEditing && (
          <div {...attributes} {...listeners} className="absolute left-0 top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing p-0.5 text-slate-300 hover:text-blue-500">
            <GripVertical className="w-3 h-3" />
          </div>
        )}
        {row.tt}
      </td>
      <td className="border border-black py-1 px-1 align-middle">
        {isEditing ? (
          <input 
            type="text" 
            value={row.label} 
            onChange={(e) => onUpdate({ label: e.target.value })}
            className="w-full bg-transparent border-b border-blue-200 focus:outline-none focus:border-blue-500"
          />
        ) : row.label}
      </td>
      <td className="border border-black py-1 px-1 italic text-slate-400 whitespace-pre-line align-middle">
        {isEditing ? (
          <input 
            type="text" 
            value={row.result} 
            onChange={(e) => onUpdate({ result: e.target.value })}
            className="w-full bg-transparent border-b border-blue-200 focus:outline-none focus:border-blue-500"
          />
        ) : row.result}
      </td>
      <td className="border border-black py-1 px-1 relative align-middle">
        <div className="flex flex-col gap-1">
          <input 
            type="text" 
            value={tempDoctor} 
            onChange={(e) => setTempDoctor(e.target.value)}
            placeholder="BS"
            className={`w-full bg-transparent text-[8pt] focus:outline-none ${isDoctorDirty ? 'border-b border-blue-400' : ''}`}
          />
          {isDoctorDirty && (
            <div className="flex gap-1 justify-end">
              <button 
                onClick={handleSaveDoctor}
                className="p-0.5 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                title="Lưu BS"
              >
                <CheckCircle2 className="w-2.5 h-2.5" />
              </button>
              <button 
                onClick={handleCancelDoctor}
                className="p-0.5 bg-slate-400 text-white rounded hover:bg-slate-500 transition-colors"
                title="Hủy"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          )}
        </div>
        {isEditing && (
          <button 
            onClick={onRemove}
            className="absolute -right-6 top-1/2 -translate-y-1/2 p-1 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </td>
    </tr>
  );
}
