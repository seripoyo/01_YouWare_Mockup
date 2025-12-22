import { memo, useState, useCallback } from "react";
import type { MockupGalleryItem } from "../types";

interface MockupCardProps {
  item: MockupGalleryItem;
  onSelect: (item: MockupGalleryItem) => void;
  onImageError?: (itemId: string) => void;
}

function MockupCardComponent({ item, onSelect, onImageError }: MockupCardProps) {
  const [hasError, setHasError] = useState(false);

  const handleImageError = useCallback(() => {
    setHasError(true);
    onImageError?.(item.id);
  }, [item.id, onImageError]);

  // Don't render if image failed to load
  if (hasError) {
    return null;
  }

  return (
    <button
      onClick={() => onSelect(item)}
      className="group relative w-full overflow-hidden rounded-3xl bg-slate-200 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-indigo-200"
    >
      <div className="relative w-full" style={{ aspectRatio: item.aspectRatio.replace(":", "/") }}>
        <img
          src={item.publicPath}
          alt={item.originalFilename}
          loading="lazy"
          onError={handleImageError}
          className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-black/20 opacity-0 transition group-hover:opacity-100" />
      </div>

      <div className="space-y-2 p-4">
        <div className="flex items-center justify-between gap-2 text-xs font-medium uppercase tracking-wider text-slate-500">
          <span>{item.deviceType}</span>
          <span>{item.aspectRatio}</span>
        </div>

        <p className="text-sm font-semibold text-slate-900">{item.displayName}</p>

        {item.colors.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.colors.map((color) => (
              <span
                key={color}
                className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
              >
                {color}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

export const MockupCard = memo(MockupCardComponent);
