import { PropsWithChildren } from "react";

export function GalleryLayout({ children }: PropsWithChildren) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur">
      <div className="relative flex h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        {children}
      </div>
    </div>
  );
}
