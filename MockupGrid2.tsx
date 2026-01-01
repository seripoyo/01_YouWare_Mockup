import { useState, useCallback, useMemo } from "react";
import type { MockupGalleryItem } from "../types";
import { getTranslations } from "../../../../i18n/translations";

interface MockupGridProps {
  items: MockupGalleryItem[];         // All items (for DOM persistence)
  visibleItems?: MockupGalleryItem[]; // Items that should be visible (filtering logic)
  onSelect: (item: MockupGalleryItem) => void;
  hideAspectRatioBadge?: boolean;
}

export function MockupGrid({
  items,
  visibleItems: visibleItemsProp,
  onSelect,
  hideAspectRatioBadge = false,
}: MockupGridProps) {
  const t = getTranslations();

  // Track broken image IDs
  const [brokenImageIds, setBrokenImageIds] = useState<Set<string>>(new Set());

  // Handle image load error - add to broken list
  const handleImageError = useCallback((itemId: string) => {
    setBrokenImageIds(prev => {
      const next = new Set(prev);
      next.add(itemId);
      return next;
    });
  }, []);

  // Use visibleItems if provided, otherwise use items
  // Filter out broken images
  const baseItems = visibleItemsProp ?? items;
  const displayItems = useMemo(() =>
    baseItems.filter(item => !brokenImageIds.has(item.id)),
    [baseItems, brokenImageIds]
  );

  if (displayItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-400">
        <span className="material-icons text-5xl mb-4 opacity-50">
          local_offer
        </span>
        <p className="text-lg font-medium">{t.noTemplatesFound}</p>
      </div>
    );
  }

  return (
    // Masonry layout with CSS columns
    <div className="relative w-full columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 pb-20">
      {displayItems.map((item) => {
        return (
          <div
            key={item.id}
            data-id={item.id}
            className="mockup-item mb-6 w-full break-inside-avoid"
            onClick={() => onSelect(item)}
          >
            {/* Card Container */}
            <div className="group relative rounded-3xl overflow-hidden hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.2)] transition-all duration-700 cursor-pointer transform hover:-translate-y-2 bg-slate-200">
              {/* Image Container */}
              <div
                className="relative w-full"
                style={{ aspectRatio: item.aspectRatio.replace(":", "/") }}
              >
                <img
                  src={item.publicPath}
                  alt={item.displayName}
                  loading="lazy"
                  className="w-full h-full object-cover absolute inset-0 transition-transform duration-700 group-hover:scale-105"
                  onError={() => handleImageError(item.id)}
                />

                {/* Dark Overlay for better text contrast */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                {/* Aspect Ratio Badge */}


                {/* Glassmorphism Button: "Use this template" */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-max opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-4 group-hover:translate-y-0">
                  <button
                    className="
                      px-4 py-2 text-xs
                      sm:px-5 sm:py-2.5 sm:text-sm
                      bg-white/20 backdrop-blur-md
                      border border-white/30
                      rounded-full
                      text-white font-medium tracking-wide
                      shadow-xl
                      hover:bg-white/30 transition-colors
                      flex items-center gap-2
                      max-w-[90%] truncate
                    "
                  >
                    {t.useThisTemplate}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
