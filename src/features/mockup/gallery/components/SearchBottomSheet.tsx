import React from "react";
import type { GalleryFilters, FilterOptions } from "../types";
import {
  getTranslations,
  type DeviceTypeTranslations,
  type ColorTranslations,
} from "../../../../i18n/translations";

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

  // ボトムナビ: h-16(64px) + mb-2(8px) + safe-area
  // パネルはボトムナビの「下（背面）」に位置し、ナビの下から伸びてくるように見せる
  // z-indexをボトムナビ(30)より下(25)に設定
  // サイドマージンはボトムナビ(mx-3=12px)より大きく設定して一回り小さく見せる
  const bottomNavHeight = 67; // 64px + 8px margin - 5px調整

  return (
    <>
      {/* Overlay - 960px以下でのみ表示、背景をぼかさない */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-[24] transition-opacity tablet:hidden"
          onClick={onClose}
        />
      )}

      {/* Bottom Sheet - 960px以下でのみ表示、ボトムナビより下（z-[25]） */}
      {/* ボトムナビの背面から上へスライドイン、サイドはボトムナビより一回り小さく */}
      <div
        className={`
          fixed left-0 right-0 z-[25] bg-white shadow-2xl tablet:hidden
          transition-all duration-300 ease-out
          ${isOpen ? "" : "pointer-events-none"}
        `}
        style={{
          maxHeight: "80vh",
          marginLeft: "2rem",
          marginRight: "2rem",
          // ボトムナビとの間に外部余白なし（直接つながるように）
          bottom: `calc(${bottomNavHeight}px + env(safe-area-inset-bottom))`,
          // 上左右のみ丸み、下左右は0
          borderRadius: "1.25rem 1.25rem 0 0",
          // 非表示時: パネルをボトムナビの後ろに完全に隠す
          // 表示時: ボトムナビの上に出てくる（ただしz-indexはナビより下なので背面から）
          transform: isOpen ? "translateY(0)" : "translateY(calc(100% + 100px))",
          opacity: isOpen ? 1 : 0,
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
        <div className="px-5 py-4 overflow-y-auto" style={{ maxHeight: "calc(80vh - 100px)" }}>
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
                    {t.deviceTypes[device as keyof DeviceTypeTranslations] || device}
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
                  {t.colorNames[color as keyof ColorTranslations] || color}
                </button>
              ))}
            </div>
          </div>

          {/* Search Button */}
          <div className="pt-2 pb-2">
            <button
              onClick={onClose}
              className="w-full py-3.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl shadow-md hover:from-indigo-600 hover:to-purple-600 active:from-indigo-700 active:to-purple-700 transition-all duration-300 min-h-[48px]"
              style={{ fontWeight: 600, letterSpacing: "1px" }}
            >
              {t.searchWithConditions || "この条件で探す"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
