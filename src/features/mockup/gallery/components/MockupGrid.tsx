import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { MockupGalleryItem } from "../types";
import { getTranslations } from "../../../../i18n/translations";

// Constants for infinite scroll
const ITEMS_PER_PAGE = 24;
const LOAD_THRESHOLD = 200; // px from bottom to trigger load

interface MockupGridProps {
  items: MockupGalleryItem[];         // All items
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
  const containerRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  
  // Track how many items to display (for infinite scroll)
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE);
  
  // Track previous filter key to detect filter changes
  const prevFilterKeyRef = useRef<string>("");

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

  // Filter out broken images from ALL items (memoized)
  const validItems = useMemo(() => 
    items.filter(item => !brokenImageIds.has(item.id)),
    [items, brokenImageIds]
  );

  // Determine which items should be visible based on filter (memoized)
  const filteredItems = useMemo(() => {
    if (!visibleItemsProp) return validItems;
    const validIds = new Set(validItems.map(item => item.id));
    return visibleItemsProp.filter(item => validIds.has(item.id));
  }, [visibleItemsProp, validItems]);

  // Create a stable key for filter changes (used for animation re-trigger)
  const [animationKey, setAnimationKey] = useState(0);
  const filterKey = useMemo(() =>
    filteredItems.map(item => item.id).slice(0, 10).join(","),
    [filteredItems]
  );

  // Reset display count and animation key when filter changes
  useEffect(() => {
    if (prevFilterKeyRef.current !== filterKey) {
      // Skip scroll on initial mount (empty string)
      const isInitialMount = prevFilterKeyRef.current === "";
      prevFilterKeyRef.current = filterKey;
      setDisplayCount(ITEMS_PER_PAGE);
      // Increment animation key to force re-render and re-trigger animations
      setAnimationKey(prev => prev + 1);

      // Smooth scroll to top of grid when filter changes (not on initial mount)
      if (!isInitialMount && containerRef.current) {
        const gridTop = containerRef.current.getBoundingClientRect().top + window.scrollY - 100;
        window.scrollTo({
          top: Math.max(0, gridTop),
          behavior: 'smooth'
        });
      }
    }
  }, [filterKey]);

  // Items to actually render (sliced for infinite scroll)
  const displayedItems = useMemo(() =>
    filteredItems.slice(0, displayCount),
    [filteredItems, displayCount]
  );

  // Check if there are more items to load
  const hasMore = displayCount < filteredItems.length;

  // Infinite scroll: Intersection Observer
  useEffect(() => {
    if (!hasMore || !loadMoreRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setDisplayCount(prev => Math.min(prev + ITEMS_PER_PAGE, filteredItems.length));
        }
      },
      { rootMargin: `${LOAD_THRESHOLD}px` }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, filteredItems.length]);

  if (filteredItems.length === 0) {
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
    <>
      {/* Masonry layout with CSS columns - only render displayed items */}
      <div ref={containerRef} className="mockup-gallery-grid relative w-full columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 pb-8">
        {displayedItems.map((item) => (
          <div
            key={`${animationKey}-${item.id}`}
            data-id={item.id}
            className="mockup-item mb-6 w-full break-inside-avoid animate-fadeIn"
            onClick={() => onSelect(item)}
          >
            {/* Card Container - ふわっとしたhoverアニメーション */}
            <div
              className="mockup-card group relative rounded-3xl overflow-hidden cursor-pointer bg-slate-200"
              style={{
                transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                willChange: 'transform, box-shadow',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-8px)';
                e.currentTarget.style.boxShadow = '0 20px 50px -12px rgba(0,0,0,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Image Container - 画像の自然なアスペクト比を使用（Pinterest風Masonry） */}
              <div className="relative w-full">
                <img
                  src={item.publicPath}
                  alt={item.displayName}
                  loading="lazy"
                  className="w-full h-auto object-cover"
                  onError={() => handleImageError(item.id)}
                />

                {/* Dark Overlay for better text contrast */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />

                {/* Glassmorphism Button: "Use this template" */}
                <div className="absolute inset-4 sm:inset-6 md:inset-8 flex items-center justify-center z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <button
                    className="
                      px-3 py-1.5 text-[10px]
                      sm:px-4 sm:py-2 sm:text-xs
                      md:px-5 md:py-2.5 md:text-sm
                      lg:px-6 lg:py-3 lg:text-base
                      bg-white/20 backdrop-blur-md
                      border border-white/30
                      rounded-full
                      text-white font-medium tracking-wide
                      shadow-xl
                      hover:bg-white/30 transition-colors duration-150
                      whitespace-nowrap
                    "
                  >
                    {t.useThisTemplate}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Load more trigger element */}
      {hasMore && (
        <div ref={loadMoreRef} className="flex justify-center py-8">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
        </div>
      )}

      {/* Show count info */}
      <div className="text-center text-sm text-slate-400 pb-8">
        {displayedItems.length} / {filteredItems.length} templates
      </div>
    </>
  );
}
