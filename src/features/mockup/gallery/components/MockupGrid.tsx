import React from "react";
import type { MockupGalleryItem } from "../types";

interface MockupGridProps {
  items: MockupGalleryItem[];
  onSelect: (item: MockupGalleryItem) => void;
  hideAspectRatioBadge?: boolean;
}

export function MockupGrid({ items, onSelect, hideAspectRatioBadge = false }: MockupGridProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-400">
        <span className="material-icons text-5xl mb-4 opacity-50">local_offer</span>
        <p className="text-lg font-medium">テンプレートが見つかりませんでした</p>
      </div>
    );
  }

  return (
    <div className="relative w-full columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 pb-20">
      {items.map((item) => (
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
              />

              {/* Dark Overlay for better text contrast */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

              {/* Aspect Ratio Badge */}
              {!hideAspectRatioBadge && (
                <div className="absolute top-4 left-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">
                  <span
                    className="
                      px-3 py-1.5 
                      bg-black/20 backdrop-blur-md border border-white/10
                      shadow-sm
                      rounded-full 
                      text-[10px] font-medium text-white tracking-wider
                      flex items-center justify-center
                    "
                  >
                    {item.aspectRatio}
                  </span>
                </div>
              )}

              {/* Glassmorphism Button */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-max opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-4 group-hover:translate-y-0">
                <button
                  className="
                    px-6 py-3
                    bg-white/20 backdrop-blur-md
                    border border-white/30
                    rounded-full
                    text-white font-medium text-sm tracking-wide
                    shadow-xl
                    hover:bg-white/30 transition-colors
                    flex items-center gap-2
                  "
                >
                  このテンプレートを使う
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
