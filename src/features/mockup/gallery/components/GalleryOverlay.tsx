import type { PropsWithChildren } from "react";

export function GalleryOverlay({ children }: PropsWithChildren) {
  return (
    <div className="absolute inset-0 z-[120] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="flex h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        {children}
      </div>
    </div>
  );
}
