import React from "react";
import type { GalleryFilters, FilterOptions } from "../types";

const ASPECT_RATIOS = ["1:1", "4:5", "16:9", "9:16"];

interface FilterSidebarProps {
  filters: GalleryFilters;
  onChange: (filters: GalleryFilters) => void;
  options: FilterOptions;
  total: number;
  isOpen?: boolean;
  onClose?: () => void;
}

const DeviceIcon = ({ type }: { type: string }) => {
  switch (type) {
    case "Laptop":
      return <span className="material-icons text-base">laptop</span>;
    case "Smartphone":
      return <span className="material-icons text-base">smartphone</span>;
    case "Tablet":
      return <span className="material-icons text-base">tablet</span>;
    case "Device Set":
      return <span className="material-icons text-base">devices</span>;
    default:
      return <span className="material-icons text-base">grid_view</span>;
  }
};

export function FilterSidebar({
  filters,
  onChange,
  options,
  total,
  isOpen = true,
  onClose,
}: FilterSidebarProps) {
  const toggleDevice = (device: string) => {
    onChange({
      ...filters,
      device: filters.device === device ? null : device,
    });
  };

  const toggleRatio = (ratio: string) => {
    onChange({
      ...filters,
      ratio: filters.ratio === ratio ? null : ratio,
    });
  };

  const toggleColor = (color: string) => {
    const exists = filters.colors.includes(color);
    onChange({
      ...filters,
      colors: exists
        ? filters.colors.filter((c) => c !== color)
        : [...filters.colors, color],
    });
  };

  const clearAll = () => {
    onChange({ device: null, ratio: null, colors: [], search: "" });
  };

  const hasActiveFilters =
    filters.device || filters.ratio || filters.colors.length > 0;

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && onClose && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-72 bg-white border-r border-slate-200 
          transform transition-transform duration-300 ease-in-out shadow-xl 
          lg:shadow-none lg:sticky lg:top-0 lg:transform-none lg:h-screen
          ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <div className="p-6 h-full overflow-y-auto">
          {/* Mobile Header */}
          <div className="flex items-center justify-between mb-6 lg:hidden">
            <h2 className="text-lg font-bold text-slate-900">Filters</h2>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-500"
              >
                <span className="material-icons">close</span>
              </button>
            )}
          </div>

          {/* Count & Clear */}
          <div className="flex items-center justify-between mb-6">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Showing {total} items
            </span>
            {hasActiveFilters && (
              <button
                onClick={clearAll}
                className="text-xs text-indigo-600 font-medium hover:text-indigo-800 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Device Type Section */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <span className="material-icons text-sm text-indigo-500">filter_alt</span>
              Device Type
            </h3>
            <div className="space-y-2">
              {options.devices.map((device) => (
                <button
                  key={device}
                  onClick={() => toggleDevice(device)}
                  className={`
                    w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-200
                    ${
                      filters.device === device
                        ? "bg-indigo-50 text-indigo-700 font-medium shadow-sm border border-indigo-100"
                        : "text-slate-600 hover:bg-slate-50 border border-transparent"
                    }
                  `}
                >
                  <span className="flex items-center gap-2">
                    <DeviceIcon type={device} />
                    {device}
                  </span>
                  {filters.device === device && (
                    <span className="material-icons text-sm">check</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Aspect Ratio Section */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">
              Aspect Ratio
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {ASPECT_RATIOS.map((ratio) => (
                <button
                  key={ratio}
                  onClick={() => toggleRatio(ratio)}
                  className={`
                    px-3 py-2 rounded-md text-sm border transition-all duration-200 text-center
                    ${
                      filters.ratio === ratio
                        ? "bg-slate-900 text-white border-slate-900 shadow-md"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }
                  `}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </div>

          {/* Colors Section */}
          <div className="pb-10">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">
              Color & Theme
            </h3>
            <div className="flex flex-wrap gap-2">
              {options.colors.map((color) => (
                <button
                  key={color}
                  onClick={() => toggleColor(color)}
                  className={`
                    px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200
                    ${
                      filters.colors.includes(color)
                        ? "bg-indigo-100 text-indigo-800 border-indigo-200"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }
                  `}
                >
                  {color}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
