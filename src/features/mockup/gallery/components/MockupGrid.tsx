import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { MockupGalleryItem } from "../types";
import { getTranslations } from "../../../../i18n/translations";
import gsap from "gsap";

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
  
  // Track items that have been animated
  const animatedIdsRef = useRef<Set<string>>(new Set());

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

  // Create a stable key for filter changes
  const filterKey = useMemo(() => 
    filteredItems.map(item => item.id).slice(0, 10).join(","),
    [filteredItems]
  );

  // Reset display count and animation tracking when filter changes
  useEffect(() => {
    if (prevFilterKeyRef.current !== filterKey) {
      prevFilterKeyRef.current = filterKey;
      setDisplayCount(ITEMS_PER_PAGE);
      animatedIdsRef.current = new Set();
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

  // Lightweight fade-in animation for newly rendered items (no Flip!)
  useEffect(() => {
    if (!containerRef.current) return;

    const newItems: HTMLElement[] = [];
    const allItems = containerRef.current.querySelectorAll('.mockup-item');
    
    allItems.forEach((el) => {
      const id = (el as HTMLElement).dataset.id;
      if (id && !animatedIdsRef.current.has(id)) {
        animatedIdsRef.current.add(id);
        newItems.push(el as HTMLElement);
      }
    });

    if (newItems.length === 0) return;

    // Simple fade-in animation
    gsap.fromTo(newItems,
      { opacity: 0, y: 20 },
      { 
        opacity: 1, 
        y: 0, 
        duration: 0.3, 
        ease: "power2.out",
        stagger: 0.02
      }
    );
  }, [displayedItems]);

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
      <div ref={containerRef} className="relative w-full columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 pb-8">
        {displayedItems.map((item) => (
          <div
            key={item.id}
            data-id={item.id}
            className="mockup-item mb-6 w-full break-inside-avoid opacity-0"
            onClick={() => onSelect(item)}
          >
            {/* Card Container */}
            <div className="group relative rounded-3xl overflow-hidden hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.2)] cursor-pointer transform hover:-translate-y-2 bg-slate-200 transition-shadow duration-200">
              {/* Image Container */}
              <div
                className="relative w-full"
                style={{ aspectRatio: item.aspectRatio.replace(":", "/") }}
              >
                <img
                  src={item.publicPath}
                  alt={item.displayName}
                  loading="lazy"
                  className="w-full h-full object-cover absolute inset-0"
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
