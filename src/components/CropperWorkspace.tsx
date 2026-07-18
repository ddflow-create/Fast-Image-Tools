import React, { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, Search } from 'lucide-react';
import { CropBox, CropMode } from '../types';

interface CropperWorkspaceProps {
  previewImg: HTMLImageElement;
  cropMode: CropMode;
  cropRatioW: number;
  cropRatioH: number;
  cropFixedW: number;
  cropFixedH: number;
  snapToEdge: boolean;
  cropRotation: number;
  onCropBoxChange: (box: CropBox) => void;
  onCropRotationChange: (rot: number) => void;
  bgColor: string;
  transparentBg: boolean;
  cropBox: CropBox | null;
}

const CropperWorkspace: React.FC<CropperWorkspaceProps> = ({ previewImg, cropMode, cropRatioW, cropRatioH, cropFixedW, cropFixedH, snapToEdge, cropRotation, onCropBoxChange, onCropRotationChange, bgColor, transparentBg, cropBox }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<{cw: number, ch: number, iw: number, ih: number, scale: number}>({cw: 0, ch: 0, iw: 0, ih: 0, scale: 1});
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{x: number, y: number}>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const lastPanPoint = useRef<{x: number, y: number}>({ x: 0, y: 0 });

  const handleWheel = (e: React.WheelEvent) => {
    // Zoom with mouse wheel with focus to cursor
    const zoomIntensity = 0.05;
    const wheel = e.deltaY < 0 ? 1 : -1;
    const zoomFactor = Math.pow(1 + zoomIntensity, wheel);
    const nextZoom = zoom * zoomFactor;
    
    // Constrain zoom
    const clampedZoom = Math.max(0.01, Math.min(nextZoom, 20));
    
    if (clampedZoom === zoom) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Center offset
    const cx = mouseX - rect.width / 2;
    const cy = mouseY - rect.height / 2;

    // Viewport to world coordinate (relative to center of content)
    const relativeX = cx - pan.x;
    const relativeY = cy - pan.y;

    const ratio = clampedZoom / zoom;
    
    // Adjust pan to keep point under cursor
    const newPanX = cx - relativeX * ratio;
    const newPanY = cy - relativeY * ratio;

    setZoom(clampedZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  const handlePointerDownContainer = (e: React.PointerEvent) => {
    if (e.button === 2) { // Right click
      setIsPanning(true);
      lastPanPoint.current = { x: e.clientX, y: e.clientY };
      containerRef.current?.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMoveContainer = (e: React.PointerEvent) => {
    if (isPanning) {
      const dx = e.clientX - lastPanPoint.current.x;
      const dy = e.clientY - lastPanPoint.current.y;
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      lastPanPoint.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handlePointerUpContainer = (e: React.PointerEvent) => {
    if (e.button === 2) {
      setIsPanning(false);
      containerRef.current?.releasePointerCapture(e.pointerId);
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;
    
    const updateLayout = () => {
      if (!containerRef.current) return;
      const cw = containerRef.current.clientWidth;
      const ch = containerRef.current.clientHeight;
      if (cw === 0 || ch === 0) return;
      
      const originalW = previewImg.width;
      const originalH = previewImg.height;

      const rad = cropRotation * Math.PI / 180;
      const absCos = Math.abs(Math.cos(rad));
      const absSin = Math.abs(Math.sin(rad));
      const boundW = originalW * absCos + originalH * absSin;
      const boundH = originalW * absSin + originalH * absCos;

      const baseScale = Math.min(cw / boundW, ch / boundH) * 0.95;
      const scale = baseScale * zoom;
      const iw = originalW * scale;
      const ih = originalH * scale;

      setLayout({ cw, ch, iw, ih, scale });
    };

    const resizeObserver = new ResizeObserver(() => {
      updateLayout();
    });

    resizeObserver.observe(containerRef.current);
    updateLayout();

    return () => {
      resizeObserver.disconnect();
    };
  }, [previewImg, cropRotation, zoom]);

  useEffect(() => {
    if (layout.iw === 0) return;
    
    const rad = cropRotation * Math.PI / 180;
    const absCos = Math.abs(Math.cos(rad));
    const absSin = Math.abs(Math.sin(rad));
    const boundW = previewImg.width * absCos + previewImg.height * absSin;
    const boundH = previewImg.width * absSin + previewImg.height * absCos;
    const minX = (previewImg.width - boundW) / 2;
    const minY = (previewImg.height - boundH) / 2;
    const maxX = minX + boundW;
    const maxY = minY + boundH;

    // Initialize crop box if null or mode changed
    if (!cropBox) {
       let w = boundW;
       let h = boundH;
       
       if (cropMode === 'size') {
          w = Math.min(cropFixedW, boundW);
          h = Math.min(cropFixedH, boundH);
       } else if (cropMode === 'ratio') {
          const r = cropRatioW / cropRatioH;
          if (w / h > r) {
             w = h * r;
          } else {
             h = w / r;
          }
       }
       
       onCropBoxChange({
         x: minX + (boundW - w) / 2,
         y: minY + (boundH - h) / 2,
         w, 
         h
       });
    } else {
       // Re-constrain according to mode if mode changed
       let { x, y, w, h } = cropBox;
       if (cropMode === 'size' && (w !== cropFixedW || h !== cropFixedH)) {
          w = cropFixedW;
          h = cropFixedH;
          x = Math.max(minX, Math.min(maxX - w, x));
          y = Math.max(minY, Math.min(maxY - h, y));
          onCropBoxChange({x, y, w, h});
       } else if (cropMode === 'ratio') {
          const r = cropRatioW / cropRatioH;
          const currentR = w / h;
          if (Math.abs(currentR - r) > 0.01) {
             if (w / h > r) { w = h * r; } else { h = w / r; }
             x = Math.max(minX, Math.min(maxX - w, x));
             y = Math.max(minY, Math.min(maxY - h, y));
             onCropBoxChange({x, y, w, h});
          }
       }
    }
  }, [cropMode, cropRatioW, cropRatioH, cropFixedW, cropFixedH, layout.iw, previewImg, cropRotation]); 

  const [interaction, setInteraction] = useState<{type: 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'rotate', startX: number, startY: number, initialBox: CropBox, initialRotation?: number} | null>(null);

  const handlePointerDown = (e: React.PointerEvent, type: 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'rotate') => {
    e.stopPropagation();
    e.preventDefault();
    if (!cropBox) return;
    setInteraction({
      type,
      startX: e.clientX,
      startY: e.clientY,
      initialBox: { ...cropBox },
      initialRotation: cropRotation
    });
  };

  useEffect(() => {
    if (!interaction || !cropBox) return;
    
    const snapThresholdOrig = snapToEdge ? 20 / layout.scale : 0; // 20px threshold in screen space

    const handlePointerMove = (e: PointerEvent) => {
      e.preventDefault();
      const dx = (e.clientX - interaction.startX) / layout.scale;
      const dy = (e.clientY - interaction.startY) / layout.scale;
      
      const rad = cropRotation * Math.PI / 180;
      const absCos = Math.abs(Math.cos(rad));
      const absSin = Math.abs(Math.sin(rad));
      const boundW = previewImg.width * absCos + previewImg.height * absSin;
      const boundH = previewImg.width * absSin + previewImg.height * absCos;
      const minX = (previewImg.width - boundW) / 2;
      const minY = (previewImg.height - boundH) / 2;
      const maxX = minX + boundW;
      const maxY = minY + boundH;

      let { x, y, w, h } = interaction.initialBox;

      if (interaction.type === 'rotate') {
         const sensitivity = 0.1;
         let newR = (interaction.initialRotation || 0) + dx * sensitivity;
         if (newR > 180) newR -= 360;
         if (newR < -180) newR += 360;
         onCropRotationChange(Number(newR.toFixed(2)));
      } else if (interaction.type === 'move') {
        let newX = x + dx;
        let newY = y + dy;

        if (snapToEdge) {
           if (Math.abs(newX - minX) < snapThresholdOrig) newX = minX;
           if (Math.abs(newY - minY) < snapThresholdOrig) newY = minY;
           if (Math.abs(newX + w - maxX) < snapThresholdOrig) newX = maxX - w;
           if (Math.abs(newY + h - maxY) < snapThresholdOrig) newY = maxY - h;
        }

        newX = Math.max(minX, Math.min(maxX - w, newX));
        newY = Math.max(minY, Math.min(maxY - h, newY));
        
        onCropBoxChange({ x: newX, y: newY, w, h });
      } else {
         let reqW = w; let reqH = h;
         if (interaction.type.includes('w')) reqW -= dx;
         if (interaction.type.includes('e')) reqW += dx;
         if (interaction.type.includes('n')) reqH -= dy;
         if (interaction.type.includes('s')) reqH += dy;

         if (snapToEdge) {
            if (interaction.type.includes('w') && Math.abs(x + w - reqW - minX) < snapThresholdOrig) reqW = x + w - minX;
            if (interaction.type.includes('e') && Math.abs(x + reqW - maxX) < snapThresholdOrig) reqW = maxX - x;
            if (interaction.type.includes('n') && Math.abs(y + h - reqH - minY) < snapThresholdOrig) reqH = y + h - minY;
            if (interaction.type.includes('s') && Math.abs(y + reqH - maxY) < snapThresholdOrig) reqH = maxY - y;
         }

         if (reqW < 20) reqW = 20;
         if (reqH < 20) reqH = 20;

         let maxW = interaction.type.includes('w') ? x + w - minX : maxX - x;
         let maxH = interaction.type.includes('n') ? y + h - minY : maxY - y;
         reqW = Math.min(reqW, maxW);
         reqH = Math.min(reqH, maxH);

         if (cropMode === 'ratio') {
           const r = cropRatioW / cropRatioH;
           let propH = reqW / r;
           let propW = reqH * r;

           if (propH <= maxH && (propW > maxW || Math.abs(reqW - w) > Math.abs(reqH - h) * r)) {
              reqH = propH;
           } else {
              reqW = propW;
              if (reqW > maxW) {
                 reqW = maxW;
                 reqH = reqW / r;
              }
           }
         }

         let newW = reqW; let newH = reqH;
         let newX = interaction.type.includes('w') ? x + w - newW : x;
         let newY = interaction.type.includes('n') ? y + h - newH : y;
         
         onCropBoxChange({ x: newX, y: newY, w: newW, h: newH });
      }
    };

    const handlePointerUp = () => setInteraction(null);

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [interaction, layout.scale, snapToEdge, previewImg.width, previewImg.height, cropMode, cropRatioW, cropRatioH, cropRotation, onCropBoxChange, onCropRotationChange]);

  const renderedBox = cropBox ? {
    left: cropBox.x * layout.scale,
    top: cropBox.y * layout.scale,
    width: cropBox.w * layout.scale,
    height: cropBox.h * layout.scale,
  } : null;

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full flex items-center justify-center bg-[#1e1e1e] rounded-lg overflow-hidden relative shadow-inner scrollbar-none"
      onWheel={handleWheel}
      onContextMenu={e => e.preventDefault()}
      onPointerDown={handlePointerDownContainer}
      onPointerMove={handlePointerMoveContainer}
      onPointerUp={handlePointerUpContainer}
      style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
    >
      <div className="absolute top-4 right-4 z-[60] flex flex-col gap-2 pointer-events-auto">
        <div className="bg-black/60 backdrop-blur-md rounded-lg border border-white/10 p-1 flex flex-col shadow-xl overflow-hidden">
          <button 
            onClick={(e) => { e.stopPropagation(); setZoom(prev => Math.min(prev * 1.05, 20)); }}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors"
            title="Приблизить"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); setZoom(prev => Math.max(prev / 1.05, 0.01)); }}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors"
            title="Отдалить"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <div className="h-px bg-white/10 mx-2 my-1" />
          <button 
            onClick={(e) => { e.stopPropagation(); setZoom(1); setPan({x: 0, y:0}); }}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors flex flex-col items-center"
            title="Сбросить масштаб и положение"
          >
            <Search className="w-5 h-5 mb-0.5" />
            <span className="text-[9px] font-bold leading-none">100%</span>
          </button>
        </div>
      </div>
      {cropBox && layout.iw > 0 && renderedBox && (
        <div 
           style={{ 
             width: layout.iw, 
             height: layout.ih, 
             position: 'relative',
             transform: `translate(${pan.x}px, ${pan.y}px)`
           }} 
           className="select-none touch-none"
        >
        <img src={previewImg.src} className="w-full h-full pointer-events-none opacity-50" style={{ transform: `rotate(${cropRotation}deg)`, transformOrigin: `50% 50%` }} draggable={false} />
        
        {/* Cropped portion visible */}
        <div 
          className={transparentBg ? "bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNlNWU1ZTUiLz48cmVjdCB4PSI0IiB5PSI0IiB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZTVlNWU1Ii8+PC9zdmc+')] bg-repeat" : ""}
          style={{
            position: 'absolute',
            left: renderedBox.left,
            top: renderedBox.top,
            width: renderedBox.width,
            height: renderedBox.height,
            backgroundColor: transparentBg ? 'transparent' : bgColor,
            overflow: 'hidden'
          }}
        >
           <img 
              src={previewImg.src} 
              style={{
                position: 'absolute',
                left: -renderedBox.left,
                top: -renderedBox.top,
                width: layout.iw,
                height: layout.ih,
                transform: `rotate(${cropRotation}deg)`,
                transformOrigin: `50% 50%`,
                maxWidth: 'none'
              }}
              className="pointer-events-none"
              draggable={false}
           />
        </div>

        {/* Crop UI Overlay */}
        <div
          style={{
            position: 'absolute',
            left: renderedBox.left,
            top: renderedBox.top,
            width: renderedBox.width,
            height: renderedBox.height,
          }}
          className="ring-2 ring-blue-500 cursor-move group/crop shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]"
          onPointerDown={e => handlePointerDown(e, 'move')}
        >
          {/* Grid lines */}
          <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-0 group-hover/crop:opacity-50 transition-opacity">
             <div className="border-r border-b border-white"></div><div className="border-r border-b border-white"></div><div className="border-b border-white"></div>
             <div className="border-r border-b border-white"></div><div className="border-r border-b border-white"></div><div className="border-b border-white"></div>
             <div className="border-r border-white"></div><div className="border-r border-white"></div><div></div>
          </div>
          
          {/* Rotation Handle */}
          <div 
             onPointerDown={e => handlePointerDown(e, 'rotate')} 
             className="absolute top-2 left-1/2 -translate-x-1/2 w-6 h-6 bg-white ring-1 ring-slate-900 rounded-full cursor-ew-resize flex items-center justify-center z-20 shadow cursor-grab active:cursor-grabbing opacity-80 hover:opacity-100 transition-opacity"
             title="Вращать"
          >
             <div className="w-1 h-3 bg-slate-400 rounded-full pointer-events-none" />
          </div>

          {cropMode !== 'size' && (
            <>
              <div onPointerDown={e => handlePointerDown(e, 'nw')} className="absolute -left-2 -top-2 w-4 h-4 bg-white ring-1 ring-slate-900 rounded-full cursor-nwse-resize z-10" />
              <div onPointerDown={e => handlePointerDown(e, 'ne')} className="absolute -right-2 -top-2 w-4 h-4 bg-white ring-1 ring-slate-900 rounded-full cursor-nesw-resize z-10" />
              <div onPointerDown={e => handlePointerDown(e, 'sw')} className="absolute -left-2 -bottom-2 w-4 h-4 bg-white ring-1 ring-slate-900 rounded-full cursor-nesw-resize z-10" />
              <div onPointerDown={e => handlePointerDown(e, 'se')} className="absolute -right-2 -bottom-2 w-4 h-4 bg-white ring-1 ring-slate-900 rounded-full cursor-nwse-resize z-10" />
            </>
          )}
        </div>
      </div>)}
    </div>
  );
};

export default CropperWorkspace;
