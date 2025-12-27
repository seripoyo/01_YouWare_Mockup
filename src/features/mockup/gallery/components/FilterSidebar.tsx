import React, { useState } from "react";
import type { GalleryFilters, FilterOptions } from "../types";
import {
  getCurrentLanguage,
  setLanguageAndReload,
  getTranslations,
  LANGUAGE_LABELS,
  type SupportedLanguage,
} from "../../../../i18n/translations";
import { client } from "../../../../api/client";

const ASPECT_RATIOS = ["1:1", "4:5", "16:9", "9:16"];

// 言語オプション
const LANGUAGE_OPTIONS: { code: SupportedLanguage; label: string }[] = [
  { code: "ja", label: "日本語" },
  { code: "en", label: "English" },
  { code: "zh-CN", label: "中文（簡体字）" },
  { code: "zh-TW", label: "中文（繁体字）" },
  { code: "ko", label: "한국어" },
];

interface FilterSidebarProps {
  filters: GalleryFilters;
  onChange: (filters: GalleryFilters) => void;
  options: FilterOptions;
  total: number;
  isOpen?: boolean;
  onClose?: () => void;
  user?: any;
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
  user,
}: FilterSidebarProps) {
  const [isLangExpanded, setIsLangExpanded] = useState(false);

  // Get current language and translations
  const currentLang = getCurrentLanguage();
  const t = getTranslations();

  // Google Sign In handler - now uses Youbase OAuth
  const handleGoogleSignIn = async () => {
    try {
      console.log("Google Sign In clicked - initiating OAuth flow");
      // Redirect to Google OAuth with callback URL
      await client.auth.signIn.social({
        provider: "google",
        callbackURL: window.location.href, // Return to current page after login
      });
    } catch (error) {
      console.error("Google Sign In error:", error);
      alert("ログインに失敗しました。もう一度お試しください。");
    }
  };

  // Language change handler - reload page after changing
  const handleLanguageChange = (langCode: SupportedLanguage) => {
    setLanguageAndReload(langCode);
  };

  const currentLangLabel = LANGUAGE_LABELS[currentLang];

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
            <h2 className="text-lg font-bold text-slate-900">{t.menu}</h2>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-500"
              >
                <span className="material-icons">close</span>
              </button>
            )}
          </div>

          {/* Mobile: Language Switcher & Google Sign In */}
          <div className="lg:hidden mb-6 space-y-3">
            {/* Language Switcher */}
            <div>
              <button
                onClick={() => setIsLangExpanded(!isLangExpanded)}
                className="w-full flex items-center justify-between px-4 py-3 border border-indigo-500 rounded-xl bg-white hover:bg-indigo-50 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <span className="material-icons text-indigo-500">language</span>
                  <span className="text-sm font-medium text-indigo-600">{currentLangLabel}</span>
                </span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 18 18"
                  className={`text-indigo-500 transition-transform ${isLangExpanded ? "rotate-180" : ""}`}
                  fill="currentColor"
                >
                  <path d="M9 12L4 7h10L9 12z" />
                </svg>
              </button>

              {isLangExpanded && (
                <div className="mt-2 bg-slate-50 rounded-xl overflow-hidden">
                  {LANGUAGE_OPTIONS.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => handleLanguageChange(lang.code)}
                      className={`w-full px-4 py-3 text-left text-sm hover:bg-indigo-50 transition-colors border-b border-slate-100 last:border-b-0 ${
                        currentLang === lang.code ? "text-indigo-600 font-medium bg-indigo-50" : "text-slate-700"
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Google Sign In Button */}
            {!user && (
              <button
                onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border border-slate-300 rounded-xl hover:shadow-md transition-all"
              >
                <svg width="20" height="20" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                <span className="text-sm font-medium text-slate-700">{t.signInWithGoogle}</span>
              </button>
            )}

            {/* Divider */}
            <div className="border-t border-slate-200 pt-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {t.filters}
              </h3>
            </div>
          </div>

          {/* Count & Clear */}
          <div className="flex items-center justify-between mb-6">
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
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <span className="material-icons text-sm text-indigo-500">filter_alt</span>
              {t.deviceType}
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
              {t.aspectRatio}
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
      </aside>
    </>
  );
}
