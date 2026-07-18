export type RatioPreset = '16:9' | '4:3' | '1:1' | '9:16' | '21:9' | 'custom';
export type FormatOption = 'original' | 'image/png' | 'image/jpeg' | 'image/webp';
export type AppMode = 'expander' | 'cropper' | 'resizer';
export type CropMode = 'free' | 'ratio' | 'size';

export interface ProcessedFile {
  id: string;
  originalName: string;
  blob: Blob;
  url: string;
  name: string;
  isOriginal?: boolean;
}

export interface CropBox {
  x: number;
  y: number;
  w: number;
  h: number;
}
