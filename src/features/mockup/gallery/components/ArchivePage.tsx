import React from "react";

interface ArchivePageProps {
  onBack: () => void;
}

export function ArchivePage({ onBack }: ArchivePageProps) {
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

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-4">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                onBack();
              }}
              className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors"
            >
              ホーム
            </a>
            <a
              href="/archive"
              className="text-sm font-medium text-indigo-600 transition-colors"
            >
              アーカイブ
            </a>
          </nav>

          {/* Spacer */}
          <div className="flex-1" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="max-w-screen-2xl mx-auto">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-800">アーカイブ</h2>
            <p className="text-slate-600 mt-2">保存したモックアップの履歴</p>
          </div>

          {/* Empty State */}
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="material-icons text-6xl text-slate-300 mb-4">
              inventory_2
            </span>
            <h3 className="text-lg font-medium text-slate-600 mb-2">
              アーカイブが空です
            </h3>
            <p className="text-slate-500 mb-6">
              モックアップを作成すると、ここに履歴が表示されます
            </p>
            <button
              onClick={onBack}
              className="px-6 py-3 bg-indigo-600 text-white rounded-full font-medium hover:bg-indigo-700 transition-colors"
            >
              モックアップを作成する
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
