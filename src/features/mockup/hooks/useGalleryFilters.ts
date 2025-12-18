import { useMemo, useState } from "react";
import type { GalleryFilters, MockupGalleryItem } from "../gallery/types";

const DEFAULT_FILTERS: GalleryFilters = {
  device: null,
  ratio: null,
  colors: [],
  search: "",
};

// Excluded colors that should not appear in the filter list
const EXCLUDED_COLORS = new Set([
  "001", "002", "003", "004", "005", "006", "007", "008", "009",
  "Brpwn", "Baihe", "brpwn", "baihe"
]);

// Check if a color is valid for filtering
function isValidFilterColor(color: string): boolean {
  // Exclude if it's in the exclusion list
  if (EXCLUDED_COLORS.has(color)) {
    return false;
  }
  // Exclude if it's purely numeric
  if (/^\d+$/.test(color)) {
    return false;
  }
  return true;
}

export function useGalleryFilters(items: MockupGalleryItem[]) {
  const [filters, setFilters] = useState<GalleryFilters>(DEFAULT_FILTERS);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filters.device && item.deviceType !== filters.device) {
        return false;
      }

      if (filters.ratio && item.aspectRatio !== filters.ratio) {
        return false;
      }

      if (filters.colors.length > 0) {
        const hasColor = filters.colors.some((color) =>
          item.colorTokens.includes(color.toLowerCase())
        );
        if (!hasColor) {
          return false;
        }
      }

      if (filters.search) {
        const q = filters.search.toLowerCase();
        const matches = item.searchTokens.some((token) => token.includes(q));
        if (!matches) {
          return false;
        }
      }

      return true;
    });
  }, [items, filters]);

  const availableFilters = useMemo(() => {
    const devices = new Set<string>();
    const ratios = new Set<string>();
    const colors = new Set<string>();

    items.forEach((item) => {
      devices.add(item.deviceType);
      ratios.add(item.aspectRatio);
      // Only add valid colors (exclude numbers and excluded terms)
      item.colors.forEach((color) => {
        if (isValidFilterColor(color)) {
          colors.add(color);
        }
      });
    });

    return {
      devices: Array.from(devices).sort(),
      ratios: Array.from(ratios).sort(),
      colors: Array.from(colors).sort(),
    };
  }, [items]);

  return {
    filters,
    setFilters,
    filteredItems,
    availableFilters,
    resetFilters: () => setFilters(DEFAULT_FILTERS),
  };
}
