import React from "react";
import type { GalleryFilters, FilterOptions } from "../types";
import { getTranslations } from "../../../../i18n/translations";

const ASPECT_RATIOS = ["1:1", "4:5", "16:9", "9:16"];

interface SearchBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  filters: GalleryFilters;
  onChange: (filters: GalleryFilters) => void;
  options: FilterOptions;
  total: number;
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

export function SearchBottomSheet({
  isOpen,
  onClose,
  filters,
  onChange,
  options,
  total,
}: SearchBottomSheetProps) {
  const t = getTranslations();

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
      {/* Overlay - 960px以下でのみ表示 */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-[10] backdrop-blur-sm transition-opacity tablet:hidden"
          onClick={onClose}
        />
      )}

      {/* Bottom Sheet - 960px以下でのみ表示 */}
      <div
        className={`
          fixed bottom-0 left-0 right-0 z-[20] bg-white rounded-t-3xl shadow-2xl tablet:hidden
          transform transition-transform duration-300 ease-out
          ${isOpen ? "translate-y-0" : "translate-y-full"}
        `}
        style={{
          maxHeight: "80vh",
          marginLeft: "0.75rem",
          marginRight: "0.75rem",
          marginBottom: "calc(80px + env(safe-area-inset-bottom))",
          borderRadius: "1.5rem",
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">{t.filters}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-500 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <span className="material-icons">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 overflow-y-auto" style={{ maxHeight: "calc(80vh - 120px)" }}>
          {/* Count & Clear */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {t.showingItems(total)}
            </span>
            {hasActiveFilters && (
              <button
                onClick={clearAll}
                className="text-xs text-indigo-600 font-medium hover:text-indigo-800 transition-colors"
              >
                {t.clearAll}
              </button>
            )}
          </div>

          {/* Device Type Section */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <span className="material-icons text-sm text-indigo-500">filter_alt</span>
              {t.deviceType}
            </h3>
            <div className="space-y-2">
              {options.devices.map((device) => (
                <button
                  key={device}
                  onClick={() => toggleDevice(device)}
                  className={`
                    w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all duration-200
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
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              {t.aspectRatio}
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {ASPECT_RATIOS.map((ratio) => (
                <button
                  key={ratio}
                  onClick={() => toggleRatio(ratio)}
                  className={`
                    px-3 py-2.5 rounded-md text-sm border transition-all duration-200 text-center
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
          <div className="pb-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              {t.colorTheme}
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
      </div>
    </>
  );
}
