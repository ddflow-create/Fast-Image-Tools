/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent, useCallback } from 'react';
import { Upload, Settings2, Download, Image as ImageIcon, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, Crop, Maximize, ZoomIn, ZoomOut, Search, PanelLeftClose, PanelLeftOpen, Trash2, ChevronUp, ChevronDown, Minimize } from 'lucide-react';
import { RatioPreset, FormatOption, AppMode, CropMode, ProcessedFile, CropBox } from './types';
import CropperWorkspace from './components/CropperWorkspace';

export default function App() {
  const [appMode, setAppMode] = useState<AppMode>('expander');
  const [expanderZoom, setExpanderZoom] = useState<number>(1);
  const [expanderPan, setExpanderPan] = useState<{x: number, y: number}>({ x: 0, y: 0 });
  const [isExpanderPanning, setIsExpanderPanning] = useState<boolean>(false);
  const lastExpanderPanPoint = useRef<{x: number, y: number}>({ x: 0, y: 0 });
  const expanderContainerRef = useRef<HTMLDivElement>(null);

  const handleExpanderWheel = (e: React.WheelEvent) => {
    const zoomIntensity = 0.05;
    const wheel = e.deltaY < 0 ? 1 : -1;
    const zoomFactor = Math.pow(1 + zoomIntensity, wheel);
    const nextZoom = expanderZoom * zoomFactor;
    const clampedZoom = Math.max(0.01, Math.min(nextZoom, 20));

    if (clampedZoom === expanderZoom) return;

    const rect = expanderContainerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const cx = mouseX - rect.width / 2;
    const cy = mouseY - rect.height / 2;
    const relativeX = cx - expanderPan.x;
    const relativeY = cy - expanderPan.y;
    const ratio = clampedZoom / expanderZoom;
    const newPanX = cx - relativeX * ratio;
    const newPanY = cy - relativeY * ratio;

    setExpanderZoom(clampedZoom);
    setExpanderPan({ x: newPanX, y: newPanY });
  };

  const handleExpanderPointerDown = (e: React.PointerEvent) => {
    if (e.button === 2) {
      setIsExpanderPanning(true);
      lastExpanderPanPoint.current = { x: e.clientX, y: e.clientY };
      expanderContainerRef.current?.setPointerCapture(e.pointerId);
    }
  };

  const handleExpanderPointerMove = (e: React.PointerEvent) => {
    if (isExpanderPanning) {
      const dx = e.clientX - lastExpanderPanPoint.current.x;
      const dy = e.clientY - lastExpanderPanPoint.current.y;
      setExpanderPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      lastExpanderPanPoint.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleExpanderPointerUp = (e: React.PointerEvent) => {
    if (e.button === 2) {
      setIsExpanderPanning(false);
      expanderContainerRef.current?.releasePointerCapture(e.pointerId);
    }
  };

  // Expander Settings
  const [ratioPreset, setRatioPreset] = useState<RatioPreset>('16:9');
  const [customW, setCustomW] = useState<number>(1920);
  const [customH, setCustomH] = useState<number>(1080);
  const [bgColor, setBgColor] = useState<string>('#ffffff');
  const [hasAlpha, setHasAlpha] = useState<boolean>(false);
  const [useTransparentBg, setUseTransparentBg] = useState<boolean>(false);

  // Cropper Settings
  const [cropMode, setCropMode] = useState<CropMode>('free');
  const [cropRatioPreset, setCropRatioPreset] = useState<RatioPreset>('16:9');
  const [cropRatioCustomW, setCropRatioCustomW] = useState<number>(16);
  const [cropRatioCustomH, setCropRatioCustomH] = useState<number>(9);
  const [cropFixedW, setCropFixedW] = useState<number>(1080);
  const [cropFixedH, setCropFixedH] = useState<number>(1080);
  const [snapToEdge, setSnapToEdge] = useState<boolean>(true);
  const [cropBox, setCropBox] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  const [cropRotation, setCropRotation] = useState<number>(0);

  // Resizer settings
  const [resizePreset, setResizePreset] = useState<'75' | '50' | '25' | '10' | 'custom'>('50');
  const [resizeW, setResizeW] = useState<number>(0);
  const [resizeH, setResizeH] = useState<number>(0);
  const [resizeUnit, setResizeUnit] = useState<'px' | '%'>('%');
  const [resizerAutoDownload, setResizerAutoDownload] = useState<boolean>(true);

  const handleAlignCropBox = (pos: string) => {
    if (!cropBox || !previewImg) return;
    const rad = cropRotation * Math.PI / 180;
    const absCos = Math.abs(Math.cos(rad));
    const absSin = Math.abs(Math.sin(rad));
    const boundW = previewImg.width * absCos + previewImg.height * absSin;
    const boundH = previewImg.width * absSin + previewImg.height * absCos;
    const minX = (previewImg.width - boundW) / 2;
    const minY = (previewImg.height - boundH) / 2;
    const maxX = minX + boundW;
    const maxY = minY + boundH;

    let { w, h } = cropBox;
    let newX = cropBox.x;
    let newY = cropBox.y;

    if (pos.includes('w')) newX = minX;
    if (pos.includes('e')) newX = maxX - w;
    if (pos === 'n' || pos === 'c' || pos === 's') newX = minX + (boundW - w) / 2;

    if (pos.includes('n')) newY = minY;
    if (pos.includes('s')) newY = maxY - h;
    if (pos === 'w' || pos === 'c' || pos === 'e') newY = minY + (boundH - h) / 2;

    setCropBox({ x: newX, y: newY, w, h });
  };

  // General Settings
  const [format, setFormat] = useState<FormatOption>('original');
  const [quality, setQuality] = useState<number>(0.92);
  const [autoDownload, setAutoDownload] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [activeFile, setActiveFile] = useState<File | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [previewImg, setPreviewImg] = useState<HTMLImageElement | null>(null);
  const [status, setStatus] = useState<'idle' | 'ready'>('idle');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [historyPage, setHistoryPage] = useState(0);
  
  useEffect(() => {
    setHistoryPage(0);
  }, [processedFiles.length]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Global drag/drop prevention to avoid opening images in a new tab when dropping outside container
  useEffect(() => {
    const handleGlobalDragOver = (e: DragEvent) => e.preventDefault();
    const handleGlobalDrop = (e: DragEvent) => e.preventDefault();
    window.addEventListener('dragover', handleGlobalDragOver);
    window.addEventListener('drop', handleGlobalDrop);
    return () => {
      window.removeEventListener('dragover', handleGlobalDragOver);
      window.removeEventListener('drop', handleGlobalDrop);
    };
  }, []);

  useEffect(() => {
    if (!activeFile) {
      setPreviewImg(null);
      setHasAlpha(false);
      return;
    }
    const url = URL.createObjectURL(activeFile);
    const img = new Image();
    img.onload = () => {
      const isJpeg = activeFile.type === 'image/jpeg';
      let alpha = false;
      if (!isJpeg) {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 100 / Math.max(img.width, img.height));
        canvas.width = Math.max(1, img.width * scale);
        canvas.height = Math.max(1, img.height * scale);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          for (let i = 3; i < data.length; i += 4) {
            if (data[i] < 255) {
              alpha = true;
              break;
            }
          }
        }
      }
      setHasAlpha(alpha);
      setUseTransparentBg(alpha);
      setExpanderZoom(1);
      setExpanderPan({ x: 0, y: 0 });
      setPreviewImg(img);
      
      setResizePreset('50');
      setResizeW(Math.round(img.width * 0.5));
      setResizeH(Math.round(img.height * 0.5));
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [activeFile]);

  useEffect(() => {
    if (!previewImg || !previewCanvasRef.current) return;
    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let targetRatio = 16 / 9;
    if (ratioPreset === 'custom') {
      if (customW > 0 && customH > 0) targetRatio = customW / customH;
    } else {
      const [w, h] = ratioPreset.split(':').map(Number);
      targetRatio = w / h;
    }

    const originalRatio = previewImg.width / previewImg.height;
    let newWidth = previewImg.width;
    let newHeight = previewImg.height;

    if (originalRatio < targetRatio) {
      newWidth = Math.round(previewImg.height * targetRatio);
    } else if (originalRatio > targetRatio) {
      newHeight = Math.round(previewImg.width / targetRatio);
    }

    canvas.width = newWidth;
    canvas.height = newHeight;

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, newWidth, newHeight);

    const dx = (newWidth - previewImg.width) / 2;
    const dy = (newHeight - previewImg.height) / 2;
    ctx.drawImage(previewImg, dx, dy);
  }, [previewImg, ratioPreset, customW, customH, bgColor]);

  const processFile = (file: File): Promise<ProcessedFile> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        let targetRatio = 16 / 9;
        
        if (ratioPreset === 'custom') {
          if (!customW || !customH || customW <= 0 || customH <= 0) {
            reject(new Error("Некорректные параметрыカスタム пропорций."));
            return;
          }
          targetRatio = customW / customH;
        } else {
          const [w, h] = ratioPreset.split(':').map(Number);
          targetRatio = w / h;
        }

        const originalRatio = img.width / img.height;
        let newWidth = img.width;
        let newHeight = img.height;

        if (originalRatio < targetRatio) {
          newWidth = Math.round(img.height * targetRatio);
        } else if (originalRatio > targetRatio) {
          newHeight = Math.round(img.width / targetRatio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = newWidth;
        canvas.height = newHeight;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error("Canvas не поддерживается."));
          return;
        }

        if (useTransparentBg) {
          ctx.clearRect(0, 0, newWidth, newHeight);
        } else {
          ctx.fillStyle = bgColor;
          ctx.fillRect(0, 0, newWidth, newHeight);
        }

        const dx = (newWidth - img.width) / 2;
        const dy = (newHeight - img.height) / 2;
        ctx.drawImage(img, dx, dy);

        let finalMimeType = format;
        if (finalMimeType === 'original') {
          finalMimeType = file.type as FormatOption;
          if (!['image/jpeg', 'image/png', 'image/webp'].includes(finalMimeType)) {
            finalMimeType = 'image/png';
          }
        }

        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("Ошибка при создании Blob."));
            return;
          }
          const ext = finalMimeType.split('/')[1] || 'png';
          const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
          const newName = `${nameWithoutExt}-padded.${ext}`;
          
          resolve({
            id: Math.random().toString(36).substr(2, 9),
            originalName: file.name,
            blob,
            url: URL.createObjectURL(blob),
            name: newName
          });
        }, finalMimeType, quality);
      };

      img.onerror = () => reject(new Error("Ошибка загрузки изображения. Убедитесь, что это картинка."));
      img.src = objectUrl;
    });
  };

  const processCropFile = (file: File, box: {x: number, y: number, w: number, h: number}, rotation: number, bg: string): Promise<ProcessedFile> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(box.w);
        canvas.height = Math.round(box.h);
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error("Canvas не поддерживается."));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        if (useTransparentBg) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        } else {
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.translate(-box.x, -box.y);
        
        const cx = img.width / 2;
        const cy = img.height / 2;
        
        ctx.translate(cx, cy);
        ctx.rotate(rotation * Math.PI / 180);
        ctx.translate(-cx, -cy);

        ctx.drawImage(img, 0, 0);

        let finalMimeType = format;
        if (finalMimeType === 'original') {
          finalMimeType = file.type as FormatOption;
          if (!['image/jpeg', 'image/png', 'image/webp'].includes(finalMimeType)) {
            finalMimeType = 'image/png';
          }
        }

        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("Ошибка при создании Blob."));
            return;
          }
          const ext = finalMimeType.split('/')[1] || 'png';
          const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
          const newName = `${nameWithoutExt}-cropped.${ext}`;
          
          resolve({
            id: Math.random().toString(36).substr(2, 9),
            originalName: file.name,
            blob,
            url: URL.createObjectURL(blob),
            name: newName
          });
        }, finalMimeType, quality);
      };

      img.onerror = () => reject(new Error("Ошибка загрузки изображения. Убедитесь, что это картинка."));
      img.src = objectUrl;
    });
  };

  const processResizeFile = (file: File): Promise<ProcessedFile> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        let finalW = resizeW;
        let finalH = resizeH;
        
        if (resizePreset !== 'custom') {
           const percent = parseInt(resizePreset, 10) / 100;
           finalW = Math.round(img.width * percent);
           finalH = Math.round(img.height * percent);
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, finalW);
        canvas.height = Math.max(1, finalH);
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error("Canvas не поддерживается."));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, finalW, finalH);

        let finalMimeType = format;
        if (finalMimeType === 'original') {
          finalMimeType = file.type as FormatOption;
          if (!['image/jpeg', 'image/png', 'image/webp'].includes(finalMimeType)) {
            finalMimeType = 'image/png';
          }
        }

        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("Ошибка при создании Blob."));
            return;
          }
          const ext = finalMimeType.split('/')[1] || 'png';
          const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
          const newName = `${nameWithoutExt}-resized.${ext}`;
          
          resolve({
            id: Math.random().toString(36).substr(2, 9),
            originalName: file.name,
            blob,
            url: URL.createObjectURL(blob),
            name: newName
          });
        }, finalMimeType, quality);
      };

      img.onerror = () => reject(new Error("Ошибка загрузки изображения. Убедитесь, что это картинка."));
      img.src = objectUrl;
    });
  };

  const processAll = async (files: File[]) => {
    const newProcessed: ProcessedFile[] = [];
    for (const file of files) {
      try {
        let processed: ProcessedFile;
        if (appMode === 'cropper' && cropBox) {
          processed = await processCropFile(file, cropBox, cropRotation, bgColor);
        } else if (appMode === 'resizer') {
          processed = await processResizeFile(file);
        } else {
          processed = await processFile(file);
        }
        newProcessed.push(processed);
        if ((appMode === 'resizer' && resizerAutoDownload) || (appMode !== 'resizer' && autoDownload)) {
          downloadFile(processed.url, processed.name);
        }
      } catch (err: any) {
        setError(err.message || "Ошибка обработки");
      }
    }
    setProcessedFiles(prev => [...newProcessed, ...prev]);
  };

  const handleFiles = async (files: FileList | File[]) => {
    setError(null);
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      setError("Пожалуйста, выберите изображения (PNG, JPEG, WEBP).");
      return;
    }

    const newOriginals: ProcessedFile[] = imageFiles.map(f => ({
      id: Math.random().toString(36).substr(2, 9),
      originalName: f.name,
      blob: f,
      url: URL.createObjectURL(f),
      name: `original_${f.name}`,
      isOriginal: true
    }));
    setProcessedFiles(prev => [...newOriginals, ...prev]);

    setActiveFile(imageFiles[0]);
    setPendingFiles(imageFiles);

    if (autoDownload && appMode === 'expander') {
      setStatus('ready');
      await processAll(imageFiles);
    } else if (resizerAutoDownload && appMode === 'resizer') {
      setStatus('ready');
      await processAll(imageFiles);
    } else {
      setStatus('idle');
    }
  };

  const handleConfirm = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setError(null);
    if (!activeFile) return;

    try {
        setStatus('ready');
        let processed: ProcessedFile;
        // Process only the active file on the canvas
        if (appMode === 'cropper' && cropBox) {
          processed = await processCropFile(activeFile, cropBox, cropRotation, bgColor);
        } else if (appMode === 'resizer') {
          processed = await processResizeFile(activeFile);
        } else {
          processed = await processFile(activeFile);
        }
        
        setProcessedFiles(prev => [processed, ...prev]);
        
        if ((appMode === 'resizer' && resizerAutoDownload) || (appMode !== 'resizer' && autoDownload)) {
          downloadFile(processed.url, processed.name);
        }

        // Применить изменения обратно к холсту
        const newFile = new File([processed.blob], processed.name, { type: processed.blob.type });
        setActiveFile(newFile);
        if (pendingFiles.length <= 1) {
             setPendingFiles([newFile]);
        }
    } catch (err: any) {
        setError(err.message || "Ошибка обработки");
    } finally {
        setTimeout(() => setStatus('idle'), 500); 
    }
  };

  const handleDownloadCurrent = async () => {
    if (!activeFile) return;
    try {
        let processed: ProcessedFile;
        if (appMode === 'cropper' && cropBox) {
          processed = await processCropFile(activeFile, cropBox, cropRotation, bgColor);
        } else if (appMode === 'resizer') {
          processed = await processResizeFile(activeFile);
        } else {
          processed = await processFile(activeFile);
        }
        downloadFile(processed.url, processed.name);
    } catch (err: any) {
        setError(err.message || "Ошибка при скачивании");
    }
  };

  const handleClear = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setActiveFile(null);
    setPendingFiles([]);
    setPreviewImg(null);
    setCropBox(null);
    setStatus('idle');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadFile = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const dragCounter = useRef(0);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const removeFile = (id: string) => {
    setProcessedFiles(prev => {
      const idx = prev.findIndex(f => f.id === id);
      if (idx !== -1) {
        URL.revokeObjectURL(prev[idx].url);
        const next = [...prev];
        next.splice(idx, 1);
        return next;
      }
      return prev;
    });
  };

  return (
    <div className="h-[100dvh] w-full bg-slate-50 text-slate-800 font-sans flex flex-col overflow-hidden">
      {/* Header / Nav Section */}
      <div className="w-full flex-none flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200 z-50 shadow-sm relative">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-2 text-slate-400 hover:text-blue-500 hover:bg-slate-50 rounded-lg transition-colors border border-slate-200 shadow-sm"
            title={isSidebarCollapsed ? "Открыть панель" : "Свернуть панель"}
          >
            {isSidebarCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>
          <div 
            className="flex items-center gap-2 cursor-pointer select-none group" 
            onClick={() => setAppMode(prev => prev === 'expander' ? 'cropper' : prev === 'cropper' ? 'resizer' : 'expander')}
          >
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white shadow-md">
              {appMode === 'expander' ? <Maximize className="w-5 h-5" /> : appMode === 'cropper' ? <Crop className="w-5 h-5" /> : <Minimize className="w-5 h-5" />}
            </div>
            <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
              {appMode === 'expander' ? 'CanvasExpander' : appMode === 'cropper' ? 'ImageCropper' : 'ImageResizer'}
              <span className="text-[10px] bg-slate-100 text-slate-500 py-0.5 px-1.5 rounded uppercase tracking-widest font-bold border border-slate-200">v1.2</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden lg:flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button 
              onClick={() => setAppMode('expander')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${appMode === 'expander' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Expansion
            </button>
            <button 
              onClick={() => setAppMode('cropper')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${appMode === 'cropper' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Cropping
            </button>
            <button 
              onClick={() => setAppMode('resizer')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${appMode === 'resizer' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Resizing
            </button>
          </div>
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20"
          >
            <Upload className="w-4 h-4" />
            Upload
          </button>
        </div>
      </div>

      <div className={`flex-1 w-full flex flex-col-reverse lg:flex-row transition-all duration-300 ease-in-out p-4 gap-4 overflow-hidden max-w-[1600px] mx-auto`}>
        
        {/* Settings Panel */}
        <aside className={`flex-shrink-0 transition-all duration-300 overflow-hidden bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col relative z-20 ${isSidebarCollapsed ? 'lg:w-0 h-0 lg:h-full opacity-0 -translate-y-10 lg:translate-y-0 lg:-translate-x-10 pointer-events-none' : 'h-1/3 lg:h-full lg:w-80 xl:w-96 opacity-100'}`}>
          <div className="p-5 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 flex flex-col gap-6">
            <div className="flex flex-none items-center justify-between border-b border-slate-100 pb-4 mb-2">
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Workspace Settings</span>
              </div>
            </div>
            
            {appMode === 'expander' && (
              <>
                <div>
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Настройки пропорций</div>
                  <select 
                    value={ratioPreset} 
                    onChange={e => setRatioPreset(e.target.value as RatioPreset)}
                    className="bg-slate-50 border border-slate-200 text-slate-800 text-[13px] rounded-lg p-2.5 w-full outline-none focus:border-blue-500 focus:bg-white transition-colors cursor-pointer"
                  >
                    <option value="16:9">16:9 (Широкоэкранный)</option>
                    <option value="4:3">4:3 (Стандартный)</option>
                    <option value="1:1">1:1 (Квадрат)</option>
                    <option value="9:16">9:16 (Вертикальный)</option>
                    <option value="21:9">21:9 (Ультраширокий)</option>
                    <option value="custom">Пользовательские...</option>
                  </select>
                </div>

                {ratioPreset === 'custom' && (
                  <div>
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Размеры (px)</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[12px] text-slate-500 block">Ширина</label>
                        <input type="number" value={customW} onChange={e => setCustomW(Number(e.target.value))} className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-[13px] outline-none focus:border-blue-500 focus:bg-white transition-colors w-full box-border" min="1" />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[12px] text-slate-500 block">Высота</label>
                        <input type="number" value={customH} onChange={e => setCustomH(Number(e.target.value))} className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-[13px] outline-none focus:border-blue-500 focus:bg-white transition-colors w-full box-border" min="1" />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {appMode === 'cropper' && (
              <>
                <div>
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Режим обрезки</div>
                  <select 
                    value={cropMode} 
                    onChange={e => setCropMode(e.target.value as CropMode)}
                    className="bg-slate-50 border border-slate-200 text-slate-800 text-[13px] rounded-lg p-2.5 w-full outline-none focus:border-blue-500 focus:bg-white transition-colors cursor-pointer mb-4"
                  >
                    <option value="free">Произвольно</option>
                    <option value="ratio">Соотношение сторон</option>
                    <option value="size">Фиксированный размер</option>
                  </select>

                  {cropMode === 'ratio' && (
                    <div className="mb-4">
                      <select 
                        value={cropRatioPreset} 
                        onChange={e => {
                          setCropRatioPreset(e.target.value as RatioPreset);
                          if (e.target.value !== 'custom') {
                            const [w, h] = e.target.value.split(':').map(Number);
                            setCropRatioCustomW(w);
                            setCropRatioCustomH(h);
                          }
                        }}
                        className="bg-slate-50 border border-slate-200 text-slate-800 text-[13px] rounded-lg p-2.5 w-full outline-none focus:border-blue-500 focus:bg-white transition-colors cursor-pointer mb-3"
                      >
                        <option value="16:9">16:9 (Широкоэкранный)</option>
                        <option value="4:3">4:3 (Стандартный)</option>
                        <option value="1:1">1:1 (Квадрат)</option>
                        <option value="9:16">9:16 (Вертикальный)</option>
                        <option value="21:9">21:9 (Ультраширокий)</option>
                        <option value="custom">Пользовательские...</option>
                      </select>

                      {cropRatioPreset === 'custom' && (
                        <div className="grid grid-cols-2 gap-3 mb-2">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[12px] text-slate-500 block">Ширина (Доли)</label>
                            <input type="number" value={cropRatioCustomW} onChange={e => setCropRatioCustomW(Number(e.target.value))} className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-[13px] outline-none focus:border-blue-500 focus:bg-white transition-colors w-full box-border" min="1" />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[12px] text-slate-500 block">Высота (Доли)</label>
                            <input type="number" value={cropRatioCustomH} onChange={e => setCropRatioCustomH(Number(e.target.value))} className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-[13px] outline-none focus:border-blue-500 focus:bg-white transition-colors w-full box-border" min="1" />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {cropMode === 'size' && (
                    <div className="mb-4">
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[12px] text-slate-500 block">Ширина (px)</label>
                          <input type="number" value={cropFixedW} onChange={e => setCropFixedW(Number(e.target.value))} className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-[13px] outline-none focus:border-blue-500 focus:bg-white transition-colors w-full box-border" min="1" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[12px] text-slate-500 block">Высота (px)</label>
                          <input type="number" value={cropFixedH} onChange={e => setCropFixedH(Number(e.target.value))} className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-[13px] outline-none focus:border-blue-500 focus:bg-white transition-colors w-full box-border" min="1" />
                        </div>
                      </div>
                      
                      <div>
                        <label className="text-[12px] text-slate-500 block mb-2 text-center">Выравнивание рамки</label>
                        <div className="grid grid-cols-3 gap-1 w-[88px] mx-auto p-1 bg-slate-100 rounded-lg border border-slate-200">
                           {['nw', 'n', 'ne', 'w', 'c', 'e', 'sw', 's', 'se'].map(pos => (
                              <button 
                                 key={pos}
                                 onClick={() => handleAlignCropBox(pos)}
                                 className="w-full aspect-square bg-white hover:bg-blue-50 hover:border-blue-300 border border-transparent rounded shadow-sm flex items-center justify-center transition-colors"
                                 title={`Выровнять: ${pos.toUpperCase()}`}
                              >
                                 <div className={`w-2 h-2 rounded-[2px] bg-slate-400 ${pos === 'c' ? 'bg-blue-500' : ''}`} />
                              </button>
                           ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3 mb-4">
                    <input 
                      type="checkbox" 
                      id="snapToEdge"
                      checked={snapToEdge}
                      onChange={e => setSnapToEdge(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-500 border-slate-300 accent-blue-500 cursor-pointer"
                    />
                    <label htmlFor="snapToEdge" className="text-[13px] text-slate-700 cursor-pointer select-none">
                      Привязка к краям изображения
                    </label>
                  </div>
                  
                  <div>
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Вращение кадра</div>
                    <div className="flex items-center gap-3">
                      <input type="range" min="-180" max="180" step="0.01" value={cropRotation} onChange={e => setCropRotation(Number(e.target.value))} className="flex-1 accent-blue-500" />
                      <input type="number" min="-180" max="180" step="0.01" value={cropRotation} onChange={e => setCropRotation(Number(e.target.value))} className="w-20 bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-[13px] outline-none focus:border-blue-500 text-center" />
                    </div>
                  </div>
                </div>
              </>
            )}

            {appMode === 'resizer' && (
              <>
                <div className="flex flex-col gap-4">
                  <div>
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Масштаб (%)</div>
                    <select 
                      value={resizePreset} 
                      onChange={e => {
                         setResizePreset(e.target.value as '75'|'50'|'25'|'10'|'custom');
                         if (e.target.value !== 'custom' && previewImg) {
                             const percent = parseInt(e.target.value, 10) / 100;
                             setResizeW(Math.round(previewImg.width * percent));
                             setResizeH(Math.round(previewImg.height * percent));
                         }
                      }}
                      className="bg-slate-50 border border-slate-200 text-slate-800 text-[13px] rounded-lg p-2.5 w-full outline-none focus:border-blue-500 focus:bg-white transition-colors cursor-pointer"
                    >
                      <option value="75">75%</option>
                      <option value="50">50%</option>
                      <option value="25">25%</option>
                      <option value="10">10%</option>
                      <option value="custom">Пользовательский (px)</option>
                    </select>
                  </div>

                  {resizePreset === 'custom' && (
                    <div className="flex flex-col gap-3">
                      <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                        <button 
                          onClick={() => setResizeUnit('%')}
                          className={`flex-1 py-1 rounded-lg text-[11px] font-bold transition-all ${resizeUnit === '%' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          Проценты
                        </button>
                        <button 
                          onClick={() => setResizeUnit('px')}
                          className={`flex-1 py-1 rounded-lg text-[11px] font-bold transition-all ${resizeUnit === 'px' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          Пиксели
                        </button>
                      </div>

                      <div className="flex gap-3">
                        <div className="flex flex-col gap-1.5 flex-1">
                          <label className="text-[12px] text-slate-500 block">Ширина ({resizeUnit})</label>
                          <input 
                            type="number" 
                            step={resizeUnit === '%' ? "0.01" : "1"}
                            value={resizeUnit === '%' ? (previewImg ? (resizeW / previewImg.width * 100).toFixed(2) : 100) : (resizeW || 1)} 
                            onChange={e => {
                               if (!previewImg) return;
                               let val = Number(e.target.value);
                               if (resizeUnit === '%') {
                                 val = Math.max(0.01, Math.min(100, val));
                                 setResizeW(Math.round(previewImg.width * (val / 100)));
                                 setResizeH(Math.round(previewImg.height * (val / 100)));
                               } else {
                                 val = Math.max(1, Math.min(previewImg.width, val));
                                 setResizeW(val);
                                 setResizeH(Math.round(val * previewImg.height / previewImg.width));
                               }
                            }} 
                            className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-[13px] outline-none focus:border-blue-500 focus:bg-white transition-colors w-full box-border" 
                            min="0.01" 
                          />
                        </div>
                        <div className="flex items-center pt-5">
                          <span className="text-slate-300">×</span>
                        </div>
                        <div className="flex flex-col gap-1.5 flex-1">
                          <label className="text-[12px] text-slate-500 block">Высота ({resizeUnit})</label>
                          <input 
                            type="number" 
                            step={resizeUnit === '%' ? "0.01" : "1"}
                            value={resizeUnit === '%' ? (previewImg ? (resizeH / previewImg.height * 100).toFixed(2) : 100) : (resizeH || 1)} 
                            onChange={e => {
                               if (!previewImg) return;
                               let val = Number(e.target.value);
                               if (resizeUnit === '%') {
                                 val = Math.max(0.01, Math.min(100, val));
                                 setResizeH(Math.round(previewImg.height * (val / 100)));
                                 setResizeW(Math.round(previewImg.width * (val / 100)));
                               } else {
                                 val = Math.max(1, Math.min(previewImg.height, val));
                                 setResizeH(val);
                                 setResizeW(Math.round(val * previewImg.width / previewImg.height));
                               }
                            }} 
                            className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-[13px] outline-none focus:border-blue-500 focus:bg-white transition-colors w-full box-border" 
                            min="0.01" 
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      id="resizerAutoDownload"
                      checked={resizerAutoDownload}
                      onChange={e => setResizerAutoDownload(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-500 border-slate-300 accent-blue-500 cursor-pointer"
                    />
                    <label htmlFor="resizerAutoDownload" className="text-[13px] text-slate-700 cursor-pointer select-none">
                      Автоскачивание
                    </label>
                  </div>
                </div>
              </>
            )}

            <div className="h-px bg-slate-100 my-1"></div>

            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center justify-between">
                <span>Заливка фона</span>
                <span className="normal-case tracking-normal font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{bgColor}</span>
              </div>
              {hasAlpha && (
                <label className="flex items-center gap-2 mb-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={useTransparentBg} 
                    onChange={e => setUseTransparentBg(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-[13px] text-slate-700">Прозрачный фон</span>
                </label>
              )}
              {!useTransparentBg && (
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-2 rounded-lg">
                  <input 
                    type="color" 
                    value={bgColor} 
                    onChange={e => setBgColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border-0 p-0 shadow-sm"
                  />
                  <button 
                    onClick={() => setBgColor('#ffffff')}
                    className="text-[12px] font-medium text-slate-600 hover:text-slate-900 px-3 py-1.5 bg-white border border-slate-200 rounded-md transition-colors shadow-sm ml-auto"
                  >
                    Белый по умолч.
                  </button>
                </div>
              )}
            </div>

            <div className="h-px bg-slate-100 my-1"></div>

            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center justify-between">
                <span>Формат вывода</span>
              </div>
              <select 
                value={format} 
                onChange={e => setFormat(e.target.value as FormatOption)}
                className="bg-slate-50 border border-slate-200 text-slate-800 text-[13px] rounded-lg p-2.5 w-full outline-none focus:border-blue-500 focus:bg-white transition-colors cursor-pointer"
              >
                <option value="original">Исходный формат</option>
                <option value="image/png">PNG</option>
                <option value="image/jpeg">JPEG</option>
                <option value="image/webp">WEBP</option>
              </select>
            </div>

            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3 flex justify-between">
                <span>Сжатие / Качество</span>
                <span className="normal-case">{Math.round(quality * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="0.1" 
                max="1.0" 
                step="0.01" 
                value={quality} 
                onChange={e => setQuality(Number(e.target.value))}
                className="w-full accent-blue-500 focus:outline-none"
              />
              <div className="flex justify-between text-[11px] text-slate-400 mt-2">
                <span>Меньший размер</span>
                <span>Лучшее качество</span>
              </div>
            </div>

            <div className="mt-auto pt-4 border-t border-slate-100 flex items-center gap-3">
              <input 
                type="checkbox" 
                id="autoDownload"
                checked={autoDownload}
                onChange={e => setAutoDownload(e.target.checked)}
                className="w-4 h-4 rounded text-blue-500 border-slate-300 accent-blue-500 cursor-pointer"
              />
              <label htmlFor="autoDownload" className="text-[13px] text-slate-700 cursor-pointer select-none">
                Автоскачивание
              </label>
            </div>
          </div>
        </aside>

        {/* Main Work Area */}
        <main className="flex-1 flex flex-col md:flex-row min-w-0 min-h-0 gap-4 h-full relative">
           {/* Canvas Container */}
           <div className={`flex-1 relative min-h-0 border-2 rounded-2xl flex flex-col items-center justify-center p-3 transition-all duration-300 overflow-hidden group shadow-sm z-10 ${
              activeFile ? 'border-solid border-slate-200 bg-slate-50' : 'border-dashed border-slate-200 bg-white hover:border-blue-500 cursor-pointer'
            } ${isDragging ? '!bg-blue-50/80 !border-blue-400' : ''}`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => !activeFile && fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              multiple 
              accept="image/png, image/jpeg, image/webp" 
              className="hidden" 
              ref={fileInputRef}
              onDragOver={e => e.preventDefault()}
              onChange={e => {
                if (e.target.files) handleFiles(e.target.files);
                e.target.value = '';
              }}
            />
            
            {activeFile ? (
              <div className="w-full h-full flex flex-col relative z-10 p-2">
                {isDragging && (
                  <div className="absolute inset-0 bg-blue-50/90 flex flex-col items-center justify-center rounded-lg z-30 transition-opacity backdrop-blur-sm pointer-events-none">
                     <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-3">
                       <Upload className="w-6 h-6" />
                     </div>
                     <span className="text-blue-600 font-semibold uppercase tracking-widest text-xs">Drop images to process</span>
                  </div>
                )}

                <div className="flex items-center justify-between mb-4 flex-shrink-0 z-20">
                   <div className="flex gap-2">
                     <button
                       onClick={handleConfirm}
                       disabled={autoDownload && appMode === 'expander'}
                       className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${(autoDownload && appMode === 'expander') ? 'bg-slate-100 text-slate-400 opacity-50 cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600 shadow-lg shadow-blue-500/20'}`}
                     >
                       <CheckCircle2 className="w-4 h-4" />
                       Confirm Changes
                     </button>
                     <button
                       onClick={handleClear}
                       disabled={autoDownload && appMode === 'expander'}
                       className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${(autoDownload && appMode === 'expander') ? 'bg-slate-50 text-slate-400 opacity-40 cursor-not-allowed border border-transparent' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm'}`}
                     >
                       Clear
                     </button>
                   </div>
                   
                   {autoDownload && appMode === 'expander' && status === 'ready' && (
                     <div className="bg-green-50 text-green-600 px-3 py-1 rounded-full font-bold flex items-center gap-1.5 text-[11px] uppercase tracking-wider border border-green-100">
                       <CheckCircle2 className="w-4 h-4" />
                       Success
                     </div>
                   )}
                </div>
                
                <div 
                  className="flex-1 min-h-0 w-full flex items-center justify-center pattern-checkerboard rounded-2xl border border-slate-200/60 p-1 relative bg-white overflow-hidden shadow-inner-xl cursor-crosshair"
                  onClick={(e) => { 
                    e.stopPropagation();
                  }}
                >
                   {appMode === 'expander' ? (
                     <div 
                        ref={expanderContainerRef}
                        className="relative w-full h-full flex items-center justify-center overflow-hidden bg-[#1e1e1e] scrollbar-none"
                        onWheel={handleExpanderWheel}
                        onContextMenu={e => e.preventDefault()}
                        onPointerDown={handleExpanderPointerDown}
                        onPointerMove={handleExpanderPointerMove}
                        onPointerUp={handleExpanderPointerUp}
                        style={{ cursor: isExpanderPanning ? 'grabbing' : 'grab' }}
                     >
                       <div className="absolute top-4 right-4 z-[60] flex flex-col gap-2 pointer-events-auto">
                          <div className="bg-black/60 backdrop-blur-md rounded-lg border border-white/10 p-1 flex flex-col shadow-xl overflow-hidden">
                            <button 
                              onClick={(e) => { e.stopPropagation(); setExpanderZoom(prev => Math.min(prev * 1.05, 20)); }}
                              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                              title="Приблизить"
                            >
                              <ZoomIn className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setExpanderZoom(prev => Math.max(prev / 1.05, 0.01)); }}
                              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                              title="Отдалить"
                            >
                              <ZoomOut className="w-5 h-5" />
                            </button>
                            <div className="h-px bg-white/10 mx-2 my-1" />
                            <button 
                              onClick={(e) => { e.stopPropagation(); setExpanderZoom(1); setExpanderPan({x: 0, y:0}); }}
                              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors flex flex-col items-center"
                              title="Сбросить масштаб и положение"
                            >
                              <Search className="w-5 h-5 mb-0.5" />
                              <span className="text-[9px] font-bold leading-none">100%</span>
                            </button>
                          </div>
                        </div>
                        <div style={{ transform: `translate(${expanderPan.x}px, ${expanderPan.y}px) scale(${expanderZoom})` }}>
                          <canvas ref={previewCanvasRef} className="max-w-none object-contain pointer-events-none drop-shadow-2xl" />
                        </div>
                     </div>
                   ) : appMode === 'cropper' ? (
                     previewImg && (
                       <div className="w-full h-full cursor-default" onClick={e => e.stopPropagation()}>
                         <CropperWorkspace 
                           key={activeFile.name + activeFile.size}
                           previewImg={previewImg}
                           cropMode={cropMode}
                           cropRatioW={cropRatioCustomW}
                           cropRatioH={cropRatioCustomH}
                           cropFixedW={cropFixedW}
                           cropFixedH={cropFixedH}
                           snapToEdge={snapToEdge}
                            cropRotation={cropRotation}
                            onCropRotationChange={setCropRotation}
                            bgColor={bgColor}
                            transparentBg={useTransparentBg}
                            cropBox={cropBox}
                            onCropBoxChange={setCropBox}
                         />
                       </div>
                     )
                   ) : (
                     previewImg && (
                       <div className="w-full h-full cursor-default bg-[#1e1e1e] flex flex-col items-center justify-center p-8 rounded-lg">
                           <img src={previewImg.src} className="max-w-full max-h-full object-contain pointer-events-none drop-shadow-2xl" />
                       </div>
                     )
                   )}
                </div>

                {/* Info Bar */}
                <div className="mt-4 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
                   <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                         <ImageIcon className="w-3.5 h-3.5" />
                         {activeFile.name}
                      </div>
                      <div className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                         {previewImg ? `${previewImg.width} × ${previewImg.height} PX` : 'Loading...'}
                      </div>
                   </div>
                   <div className="flex items-center gap-3">
                     <button onClick={handleDownloadCurrent} className="bg-slate-100 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 text-slate-500 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm border border-slate-200">
                       <Download className="w-3.5 h-3.5" />
                       Download Current
                     </button>
                     <button onClick={() => fileInputRef.current?.click()} className="hover:text-blue-500 transition-colors">Replace Image</button>
                   </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center pointer-events-none p-12">
                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-6 shadow-2xl transition-all duration-500 ${isDragging ? 'bg-blue-500 text-white scale-110 rotate-12' : 'bg-white text-blue-500 group-hover:scale-105'}`}>
                  <Upload className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Drop your visuals here</h3>
                <p className="text-[14px] text-slate-400 mt-2 font-medium">
                  Support for high-res PNG, JPEG, WEBP files
                </p>
                <div className="mt-8 px-6 py-2 bg-slate-100 rounded-full text-[11px] font-bold text-slate-500 uppercase tracking-widest border border-slate-200">
                   Waiting for input
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-3 border border-red-100 text-[13px] font-medium shadow-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Processed Files List (Vertical Carousel) */}
          {processedFiles.length > 0 && (
            <div className="flex-shrink-0 md:w-[280px] h-[320px] md:h-full bg-white border border-slate-200 rounded-2xl shadow-sm p-4 animate-in fade-in slide-in-from-right-4 duration-500 flex flex-col gap-3 relative z-10">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-shrink-0">
                <div className="flex items-center gap-2">
                   <div className="text-[12px] font-black text-slate-800 uppercase tracking-widest">History</div>
                   <div className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{processedFiles.length}</div>
                </div>
                <button onClick={() => setProcessedFiles([])} className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors rounded"><Trash2 className="w-4 h-4"/></button>
              </div>

              <div className="flex-1 flex flex-col gap-3 min-h-0 justify-center">
                {processedFiles.slice(historyPage * 2, historyPage * 2 + 2).map((file, idx) => (
                  <div 
                    key={file.id} 
                    onClick={() => {
                       const newFile = new File([file.blob], file.name, { type: file.blob.type });
                       setActiveFile(newFile);
                       if (pendingFiles.length <= 1) {
                         setPendingFiles([newFile]);
                       }
                    }}
                    className={`flex-1 min-h-0 border rounded-xl p-3 flex flex-col gap-3 relative shadow-sm hover:border-blue-400 transition-colors cursor-pointer ${file.isOriginal ? 'bg-orange-50 border-orange-200' : 'bg-slate-50 border-slate-200'}`}
                  >
                      <div className="absolute top-2 left-2 flex gap-1 z-10">
                        <span className="bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm backdrop-blur-sm">#{processedFiles.length - (historyPage * 2 + idx)}</span>
                        {file.isOriginal && (
                          <span className="bg-orange-500/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm backdrop-blur-sm tracking-wider uppercase">Original</span>
                        )}
                      </div>
                      
                      <div className="flex-1 min-h-0 bg-white rounded-lg flex items-center justify-center pattern-checkerboard border border-slate-200/60 overflow-hidden relative pointer-events-none">
                         <img src={file.url} className="max-w-full max-h-full object-contain pointer-events-none" />
                      </div>
                      
                      <div className="flex-shrink-0 flex items-center justify-between gap-2">
                         <div className="flex-1 min-w-0">
                           <div className="text-[11px] font-bold text-slate-800 truncate" title={file.name}>{file.name}</div>
                           <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{Math.round(file.blob.size / 1024)} KB</div>
                         </div>
                         <div className="flex gap-1.5 flex-shrink-0">
                             <button onClick={(e) => { e.stopPropagation(); downloadFile(file.url, file.name); }} className="w-7 h-7 bg-blue-500 text-white rounded-lg flex items-center justify-center hover:bg-blue-600 transition-colors shadow-sm"><Download className="w-3.5 h-3.5"/></button>
                             <button onClick={(e) => { e.stopPropagation(); removeFile(file.id); }} className="w-7 h-7 bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:bg-red-50 hover:border-red-200 rounded-lg flex items-center justify-center transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
                         </div>
                      </div>
                  </div>
                ))}
              </div>

              {processedFiles.length > 2 && (
                 <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-shrink-0 bg-white">
                    <button 
                       disabled={historyPage === 0} 
                       onClick={() => setHistoryPage(p => Math.max(0, p - 1))}
                       className="px-3 py-1.5 text-slate-500 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded-lg disabled:opacity-30 disabled:pointer-events-none transition-colors border border-slate-200 flex items-center gap-1 shadow-sm"
                    >
                       <ChevronUp className="w-4 h-4"/>
                    </button>
                    <div className="text-[10px] font-black text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-100">{historyPage + 1} / {Math.ceil(processedFiles.length / 2)}</div>
                    <button 
                       disabled={(historyPage + 1) * 2 >= processedFiles.length} 
                       onClick={() => setHistoryPage(p => p + 1)}
                       className="px-3 py-1.5 text-slate-500 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded-lg disabled:opacity-30 disabled:pointer-events-none transition-colors border border-slate-200 flex items-center gap-1 shadow-sm"
                    >
                       <ChevronDown className="w-4 h-4"/>
                    </button>
                 </div>
              )}
            </div>
          )}
        </main>
      </div>
      
      {/* Footer minimal info */}
      <footer className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
        <div className="px-4 py-1.5 bg-white/80 backdrop-blur-md border border-slate-200/50 rounded-full inline-flex items-center gap-2 shadow-sm">
           <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
           <span className="text-[9px] text-slate-500 uppercase tracking-[0.2em] font-black">Local processing</span>
        </div>
      </footer>
    </div>
  );
}

