import React, { useLayoutEffect, useRef } from 'react';
import { MockupMetadata } from '../types';
import { Tag } from 'lucide-react';
import gsap from 'gsap';
import { Flip } from 'gsap/Flip';

// Register the Flip plugin
gsap.registerPlugin(Flip);

interface MockupGridProps {
  items: MockupMetadata[];        // All items (for DOM persistence)
  visibleItems: MockupMetadata[]; // Items that should be visible (filtering logic)
  onSelect: (item: MockupMetadata) => void;
  hideAspectRatioBadge?: boolean;
}

export const MockupGrid: React.FC<MockupGridProps> = ({ 
  items, 
  visibleItems, 
  onSelect, 
  hideAspectRatioBadge = false 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // GSAP Flip Animation
  useLayoutEffect(() => {
    if (!containerRef.current || items.length === 0) return;

    const ctx = gsap.context(() => {
      const targets = gsap.utils.toArray('.mockup-item') as HTMLElement[];
      const visibleIds = new Set(visibleItems.map(item => item.id));

      // Kill any ongoing animations to prevent conflicts/flickering
      gsap.killTweensOf(targets);

      // 1. Capture current state
      const state = Flip.getState(targets);

      // 2. Update DOM state
      targets.forEach((el) => {
        const id = el.dataset.id;
        const shouldBeVisible = id && visibleIds.has(id);
        
        if (shouldBeVisible) {
          el.style.display = 'block';
        } else {
          el.style.display = 'none';
        }
      });

      // 3. Animate
      Flip.from(state, {
        duration: 0.5,
        ease: "power2.inOut",
        stagger: {
            amount: 0.2, // Limits total stagger time
            from: "start",
            grid: "auto"
        },
        absolute: true, // Needed for smooth reordering
        
        // Ensure z-index is handled correctly: entering items on top
        zIndex: 10,

        onEnter: elements => {
          return gsap.fromTo(elements, 
            { opacity: 0, scale: 0.8 }, 
            { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(1.2)" }
          );
        },
        onLeave: elements => {
          return gsap.to(elements, 
            { opacity: 0, scale: 0.5, duration: 0.3, onComplete: () => {
                // Ensure hidden elements are really hidden after animation
                // This prevents gaps caused by ghost elements
                gsap.set(elements, { display: "none" }); 
            }}
          );
        }
      });
    }, containerRef);

    return () => ctx.revert();
  }, [visibleItems, items]);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-400">
        <Tag size={48} className="mb-4 opacity-50" />
        <p className="text-lg font-medium">No mockups found</p>
      </div>
    );
  }

  return (
    // Masonry layout with CSS columns
    <div ref={containerRef} className="relative w-full columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 pb-20">
      {items.map((item) => (
        <div 
          key={item.id}
          data-id={item.id}
          className="mockup-item mb-6 w-full break-inside-avoid"
          onClick={() => onSelect(item)}
        >
          {/* Card Container: Slower transition duration (700ms) and larger translateY (-2) */}
          <div className="group relative rounded-3xl overflow-hidden hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.2)] transition-all duration-700 cursor-pointer transform hover:-translate-y-2 bg-slate-200">
            
            {/* Image Container */}
            <div 
                className="relative w-full"
                style={{ aspectRatio: item.aspectRatio.replace(':', '/') }}
            >
              <img 
                src={item.url} 
                alt={item.originalFilename}
                loading="lazy"
                // Image Scale Effect on Hover
                className="w-full h-full object-cover absolute inset-0 transition-transform duration-700 group-hover:scale-105"
              />
              
              {/* Dark Overlay for better text contrast */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

              {/* Aspect Ratio Badge */}
              {!hideAspectRatioBadge && (
                <div className="absolute top-4 left-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">
                  <span className="
                    px-3 py-1.5 
                    bg-black/20 backdrop-blur-md border border-white/10
                    shadow-sm
                    rounded-full 
                    text-[10px] font-medium text-white tracking-wider
                    flex items-center justify-center
                  ">
                    {item.aspectRatio}
                  </span>
                </div>
              )}

              {/* Glassmorphism Button: "Use this template" */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-max opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-4 group-hover:translate-y-0">
                <button className="
                  px-6 py-3
                  bg-white/20 backdrop-blur-md
                  border border-white/30
                  rounded-full
                  text-white font-medium text-sm tracking-wide
                  shadow-xl
                  hover:bg-white/30 transition-colors
                  flex items-center gap-2
                ">
                  このテンプレートを使う
                </button>
              </div>

            </div>
          </div>
        </div>
      ))}
    </div>
  );
};