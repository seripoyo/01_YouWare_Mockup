import React, { useState, useRef, useEffect } from "react";
import { FilterSidebar } from "./components/FilterSidebar";
import { MockupGrid } from "./components/MockupGrid";
import { PreviewModal } from "./components/PreviewModal";
import { AspectRatioGuideModal } from "./components/AspectRatioGuideModal";
import { BottomNav } from "./components/BottomNav";
import { SearchBottomSheet } from "./components/SearchBottomSheet";
import { SettingsBottomSheet } from "./components/SettingsBottomSheet";
import { useGalleryFilters } from "../hooks/useGalleryFilters";
import { mockupGalleryItems } from "../data/mockupGalleryData";
import type { MockupGalleryItem, GalleryFilters } from "./types";
import type { DeviceCategory } from "../types/frame";
import {
  getCurrentLanguage,
  setLanguageAndReload,
  getTranslations,
  LANGUAGE_LABELS,
  type SupportedLanguage,
} from "../../../i18n/translations";

// 言語オプション
const LANGUAGE_OPTIONS: { code: SupportedLanguage; label: string }[] = [
  { code: "ja", label: "日本語" },
  { code: "en", label: "English" },
  { code: "zh-CN", label: "中文（簡体字）" },
  { code: "zh-TW", label: "中文（繁体字）" },
  { code: "ko", label: "한국어" },
];

interface GalleryProps {
  onSelectFrame: (item: MockupGalleryItem) => void;
  onClose: () => void;
}

function detectCategory(item: MockupGalleryItem): DeviceCategory {
  switch (item.deviceType) {
    case "Laptop":
      return "laptop";
    case "Tablet":
      return "tablet";
    case "Smartphone":
      return "smartphone";
    default:
      return "laptop";
  }
}

export function MockupGallery({ onSelectFrame, onClose }: GalleryProps) {
  const { filters, setFilters, filteredItems, availableFilters, resetFilters } =
    useGalleryFilters(mockupGalleryItems);
  const [activeItem, setActiveItem] = useState<MockupGalleryItem | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [isAspectGuideOpen, setIsAspectGuideOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);

  // Bottom Navigation state
  const [activeTab, setActiveTab] = useState<"home" | "bookmark" | "search" | "usage" | "setting">("home");
  const [isSearchSheetOpen, setIsSearchSheetOpen] = useState(false);
  const [isSettingsSheetOpen, setIsSettingsSheetOpen] = useState(false);

  // Get current language and translations
  const currentLang = getCurrentLanguage();
  const t = getTranslations();

  // 言語メニューの外側クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setIsLangMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handler for filter changes
  const handleFilterChange = (newFilters: GalleryFilters) => {
    setFilters(newFilters);
  };

  // Google Sign In handler (placeholder)
  const handleGoogleSignIn = () => {
    console.log("Google Sign In clicked");
    // TODO: Implement Google Sign In
  };

  // Language change handler - reload page after changing
  const handleLanguageChange = (langCode: SupportedLanguage) => {
    setLanguageAndReload(langCode);
  };

  // Bottom Nav tab change handler
  const handleTabChange = (tab: "home" | "bookmark" | "search" | "usage" | "setting") => {
    setActiveTab(tab);

    // Close any open sheets first
    setIsSearchSheetOpen(false);
    setIsSettingsSheetOpen(false);

    switch (tab) {
      case "home":
        // Navigate to top page
        window.location.href = "/";
        break;
      case "bookmark":
        // Navigate to bookmark page
        window.location.href = "/bookmark";
        break;
      case "search":
        // Open search bottom sheet
        setIsSearchSheetOpen(true);
        break;
      case "usage":
        // Navigate to usage page (could be documentation or help)
        window.location.href = "/usage";
        break;
      case "setting":
        // Open settings bottom sheet
        setIsSettingsSheetOpen(true);
        break;
    }
  };

  const currentLangLabel = LANGUAGE_LABELS[currentLang];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          {/* Logo / Title */}
          <div className="flex items-center gap-3 min-w-fit">
            <img
              src="/assets/pages-img/logo.webp"
              alt="モックアップジェネレーターツール"
              className="h-12 w-auto object-contain"
            />
          </div>

          {/* Spacer to push buttons to right */}
          <div className="flex-1" />

          {/* Aspect Ratio Guide & Language Switcher & Google Sign In (Desktop) */}
          <div className="hidden md:flex items-center gap-3">
            {/* Aspect Ratio Guide Button */}
            <button
              onClick={() => setIsAspectGuideOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full hover:from-indigo-600 hover:to-purple-600 transition-all shadow-md hover:shadow-lg text-sm font-medium"
            >
              <span className="material-icons text-base">aspect_ratio</span>
              <span className="hidden lg:inline">{t.aspectRatioGuide}</span>
              <span className="lg:hidden">📐</span>
            </button>

            {/* Language Switcher */}
            <div className="relative" ref={langMenuRef}>
              <button
                onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                className="flex items-center gap-2 px-4 py-2 border border-indigo-500 rounded-full bg-white hover:bg-indigo-50 transition-colors"
                aria-haspopup="true"
                aria-expanded={isLangMenuOpen}
              >
                <span className="text-xs font-medium text-indigo-600 tracking-wide">
                  {currentLangLabel}
                </span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 18 18"
                  className={`text-indigo-500 transition-transform ${isLangMenuOpen ? "rotate-180" : ""}`}
                  fill="currentColor"
                >
                  <path d="M9 12L4 7h10L9 12z" />
                </svg>
              </button>

              {/* Language Dropdown */}
              {isLangMenuOpen && (
                <ul className="absolute top-full right-0 mt-2 w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-2 z-50">
                  {LANGUAGE_OPTIONS.map((lang) => (
                    <li key={lang.code}>
                      <button
                        onClick={() => handleLanguageChange(lang.code)}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-indigo-50 transition-colors ${
                          currentLang === lang.code ? "text-indigo-600 font-medium bg-indigo-50" : "text-slate-700"
                        }`}
                      >
                        {lang.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Google Sign In Button */}
            <button
              onClick={handleGoogleSignIn}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-full hover:shadow-md transition-all"
            >
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span className="text-sm font-medium text-slate-700">Sign in</span>
            </button>
          </div>

          {/* Mobile Header - Empty now since we use BottomNav */}
          <div className="flex items-center gap-2 tablet:hidden">
            {/* フィルターボタンを削除 - BottomNavのSearchボタンを使用 */}
          </div>

        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 max-w-screen-2xl mx-auto w-full">
        {/* Sidebar - 960px以上で表示 */}
        <div className="hidden tablet:block">
          <FilterSidebar
            filters={filters}
            onChange={handleFilterChange}
            options={availableFilters}
            total={filteredItems.length}
            isOpen={true}
            onClose={() => {}}
          />
        </div>

        {/* Content Area */}
        <main className="flex-1 p-4 sm:p-6 tablet:p-8 pb-24 tablet:pb-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-800">
              {t.allTemplates}
            </h2>
          </div>

          {/* Active Filters Summary (Chips) */}
          {(filters.device ||
            filters.ratio ||
            filters.colors.length > 0) && (
            <div className="flex flex-wrap gap-2 mb-6">
              {filters.device && (
                <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                  {filters.device}
                  <button
                    onClick={() => setFilters({ ...filters, device: null })}
                    className="hover:text-indigo-900"
                  >
                    ×
                  </button>
                </span>
              )}
              {filters.ratio && (
                <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                  {filters.ratio}
                  <button
                    onClick={() => setFilters({ ...filters, ratio: null })}
                    className="hover:text-slate-900"
                  >
                    ×
                  </button>
                </span>
              )}
              {filters.colors.map((c) => (
                <span
                  key={c}
                  className="bg-orange-50 text-orange-700 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1"
                >
                  {c}
                  <button
                    onClick={() =>
                      setFilters({
                        ...filters,
                        colors: filters.colors.filter((x) => x !== c),
                      })
                    }
                    className="hover:text-orange-900"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Grid */}
          <MockupGrid
            items={mockupGalleryItems}
            visibleItems={filteredItems}
            onSelect={(item) => {
              setActiveItem(item);
            }}
            hideAspectRatioBadge={!!filters.ratio}
          />
        </main>
      </div>

      {/* Preview Modal */}
      <PreviewModal
        item={activeItem}
        onClose={() => setActiveItem(null)}
        onSelectFrame={(item) => {
          onSelectFrame(item);
          onClose();
        }}
        categoryResolver={detectCategory}
      />

      {/* Aspect Ratio Guide Modal */}
      <AspectRatioGuideModal
        isOpen={isAspectGuideOpen}
        onClose={() => setIsAspectGuideOpen(false)}
      />

      {/* Mobile Bottom Navigation - 960px以下で表示 */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />

      {/* Search Bottom Sheet - フィルター検索メニュー */}
      <SearchBottomSheet
        isOpen={isSearchSheetOpen}
        onClose={() => {
          setIsSearchSheetOpen(false);
          setActiveTab("home");
        }}
        filters={filters}
        onChange={handleFilterChange}
        options={availableFilters}
        total={filteredItems.length}
      />

      {/* Settings Bottom Sheet - 設定メニュー */}
      <SettingsBottomSheet
        isOpen={isSettingsSheetOpen}
        onClose={() => {
          setIsSettingsSheetOpen(false);
          setActiveTab("home");
        }}
      />
    </div>
  );
}
