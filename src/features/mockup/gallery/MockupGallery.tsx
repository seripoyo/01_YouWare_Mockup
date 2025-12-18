import React, { useState, useMemo } from "react";
import { FilterSidebar } from "./components/FilterSidebar";
import { MockupGrid } from "./components/MockupGrid";
import { PreviewModal } from "./components/PreviewModal";
import { useGalleryFilters } from "../hooks/useGalleryFilters";
import { mockupGalleryItems } from "../data/mockupGalleryData";
import type { MockupGalleryItem, GalleryFilters } from "./types";
import type { DeviceCategory } from "../types/frame";

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

  // Handler for filter changes
  const handleFilterChange = (newFilters: GalleryFilters) => {
    setFilters(newFilters);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          {/* Logo / Title */}
          <div className="flex items-center gap-3 min-w-fit">
            <div className="bg-slate-900 text-white p-2 rounded-lg">
              <span className="material-icons">grid_view</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 leading-tight">
                MockupUI
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Template Library
              </p>
            </div>
          </div>

          {/* Search Bar (Desktop) */}
          <div className="hidden md:flex flex-1 max-w-xl relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="material-icons text-slate-400 text-lg">search</span>
            </div>
            <input
              type="text"
              placeholder="Search by name, color, or tag..."
              className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 sm:text-sm"
              value={filters.search}
              onChange={(e) =>
                setFilters({ ...filters, search: e.target.value })
              }
            />
          </div>

          {/* Mobile Filter Toggle */}
          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2.5 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 active:bg-slate-100"
            >
              <span className="material-icons text-xl">tune</span>
            </button>
          </div>

          <div className="hidden md:block min-w-fit">
            <button className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors">
              Get Full Access
            </button>
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className="md:hidden px-4 pb-4 border-b border-slate-200">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="material-icons text-slate-400 text-lg">search</span>
            </div>
            <input
              type="text"
              placeholder="Search mockups..."
              className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg bg-white text-sm"
              value={filters.search}
              onChange={(e) =>
                setFilters({ ...filters, search: e.target.value })
              }
            />
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 max-w-screen-2xl mx-auto w-full">
        {/* Sidebar */}
        <FilterSidebar
          filters={filters}
          onChange={handleFilterChange}
          options={availableFilters}
          total={filteredItems.length}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        {/* Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="text-2xl font-bold text-slate-800">
              {filters.search
                ? `Results for "${filters.search}"`
                : "All Templates"}
            </h2>
            <span className="text-sm font-medium text-slate-500">
              {filteredItems.length} items found
            </span>
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
            items={filteredItems}
            onSelect={(item) => {
              setActiveItem(item);
            }}
            hideAspectRatioBadge={!!filters.ratio}
          />
        </main>
      </div>

      {/* Modal */}
      <PreviewModal
        item={activeItem}
        onClose={() => setActiveItem(null)}
        onSelectFrame={(item) => {
          onSelectFrame(item);
          onClose();
        }}
        categoryResolver={detectCategory}
      />
    </div>
  );
}
