export interface MockupGalleryItem {
  id: string;
  originalFilename: string;
  publicPath: string;
  folder: string;
  aspectKey: string;
  aspectRatio: string;
  deviceType: string;
  deviceLabel: string;
  sequence: number | null;
  colors: string[];
  colorTokens: string[];
  searchTokens: string[];
  displayName: string;
}

export interface GalleryFilters {
  device: string | null;
  ratio: string | null;
  colors: string[];
  search: string;
}

export interface FilterOptions {
  devices: string[];
  ratios: string[];
  colors: string[];
}

export interface GalleryGrouping {
  title: string;
  aspectRatio: string;
  items: MockupGalleryItem[];
}
