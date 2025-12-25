import { useState, useEffect } from "react";
import { getTranslations } from "../../../../i18n/translations";

interface AspectRatioGuideBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = "instagram" | "x" | "tiktok" | "threads" | "facebook" | "linkedin" | "reference";

export function AspectRatioGuideBottomSheet({ isOpen, onClose }: AspectRatioGuideBottomSheetProps) {
  const t = getTranslations();
  const [activeTab, setActiveTab] = useState<TabType>("instagram");
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  if (!isOpen) return null;

  const tabs: { id: TabType; label: string; icon: React.ReactNode; activeIcon?: React.ReactNode }[] = [
    {
      id: "instagram",
      label: "Instagram",
      icon: <img src="/assets/icon/Instagram.webp" alt="Instagram" className="w-4 h-4 object-contain" />,
      activeIcon: <img src="/assets/icon/Instagram_Glyph_White.webp" alt="Instagram" className="w-4 h-4 object-contain" />,
    },
    {
      id: "x",
      label: "X",
      icon: <img src="/assets/icon/x.webp" alt="X" className="w-4 h-4 object-contain rounded" />,
    },
    {
      id: "tiktok",
      label: "TikTok",
      icon: <img src="/assets/icon/tiktok.webp" alt="TikTok" className="w-4 h-4 object-contain rounded" />,
    },
    {
      id: "threads",
      label: "Threads",
      icon: <img src="/assets/icon/Threads.webp" alt="Threads" className="w-4 h-4 object-contain rounded" />,
    },
    {
      id: "facebook",
      label: "Facebook",
      icon: <img src="/assets/icon/Facebook.webp" alt="Facebook" className="w-4 h-4 object-contain" />,
    },
    {
      id: "linkedin",
      label: "LinkedIn",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>
      ),
    },
    {
      id: "reference",
      label: "一覧表",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M3 9h18M9 21V9"/>
        </svg>
      ),
    },
  ];

  const getTabActiveClass = (tabId: TabType) => {
    const baseClass = "text-white ";
    switch (tabId) {
      case "instagram": return baseClass + "bg-gradient-to-r from-[#f09433] via-[#dc2743] to-[#bc1888]";
      case "x": return baseClass + "bg-black";
      case "tiktok": return baseClass + "bg-black";
      case "threads": return baseClass + "bg-black";
      case "facebook": return baseClass + "bg-[#1877F2]";
      case "linkedin": return baseClass + "bg-[#0A66C2]";
      case "reference": return baseClass + "bg-indigo-500";
      default: return "";
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-end justify-center transition-all duration-300 ${
        isAnimating ? "bg-black/40 backdrop-blur-[2px]" : "bg-transparent"
      }`}
      onClick={handleBackdropClick}
    >
      <div
        className={`w-[calc(100%-16px)] max-w-3xl mx-2 mb-2 bg-slate-50 rounded-2xl shadow-2xl transition-transform duration-300 ease-out overflow-hidden ${
          isAnimating ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ maxHeight: "75vh" }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white rounded-t-2xl border-b border-slate-200 px-4 py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <span className="text-lg">📐</span>
            <h2 className="text-sm font-bold text-slate-900">{t.aspectRatioGuide}</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 hover:bg-slate-100 rounded-full text-slate-500 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
            <span className="material-icons text-xl">close</span>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="sticky top-[53px] bg-slate-50 px-3 py-2 border-b border-slate-200 z-10 overflow-hidden">
          <div className="flex gap-1 flex-wrap justify-center">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === tab.id
                    ? getTabActiveClass(tab.id)
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {activeTab === tab.id && tab.activeIcon ? tab.activeIcon : tab.icon}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto overflow-x-hidden p-3" style={{ maxHeight: "calc(75vh - 110px)" }}>
          {activeTab === "instagram" && <InstagramContentCompact />}
          {activeTab === "x" && <XContentCompact />}
          {activeTab === "tiktok" && <TikTokContentCompact />}
          {activeTab === "threads" && <ThreadsContentCompact />}
          {activeTab === "facebook" && <FacebookContentCompact />}
          {activeTab === "linkedin" && <LinkedInContentCompact />}
          {activeTab === "reference" && <ReferenceTableCompact />}
        </div>
      </div>
    </div>
  );
}

// Compact Size Card Component
interface SizeCardCompactProps {
  ratio: string;
  size: string;
  label: string;
  aspectType: string;
  gradient: "instagram" | "x" | "tiktok" | "default";
}

function SizeCardCompact({ ratio, size, label, aspectType, gradient }: SizeCardCompactProps) {
  const getGradientClass = () => {
    switch (gradient) {
      case "instagram": return "bg-gradient-to-br from-pink-100 via-pink-200 to-pink-300";
      case "tiktok": return "bg-gradient-to-br from-teal-100 via-teal-200 to-teal-300";
      case "x": return "bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400";
      default: return "bg-gradient-to-br from-indigo-100 via-indigo-200 to-indigo-300";
    }
  };

  const getAspectBoxStyle = () => {
    switch (aspectType) {
      case "square": return { width: 50, height: 50 };
      case "portrait-4-5": return { width: 40, height: 50 };
      case "portrait-3-4": return { width: 38, height: 50 };
      case "portrait-9-16": return { width: 28, height: 50 };
      case "portrait-8-9": return { width: 44, height: 50 };
      case "portrait-1-2": return { width: 25, height: 50 };
      case "portrait-2-3": return { width: 33, height: 50 };
      case "landscape-16-9": return { width: 60, height: 34 };
      case "landscape-5-4": return { width: 60, height: 48 };
      case "landscape-4-3": return { width: 60, height: 45 };
      case "landscape-2-1": return { width: 60, height: 30 };
      case "landscape-3-2": return { width: 60, height: 40 };
      default: return { width: 50, height: 50 };
    }
  };

  const boxStyle = getAspectBoxStyle();

  return (
    <div className="bg-slate-50 rounded-lg overflow-hidden border border-transparent hover:border-slate-200 hover:shadow-sm transition-all">
      <div className={`relative flex items-center justify-center py-2.5 px-2 ${getGradientClass()}`}>
        <div
          className="bg-white/90 rounded flex items-center justify-center text-xs font-semibold text-slate-700 shadow-sm"
          style={{ width: boxStyle.width, height: boxStyle.height }}
        >
          {ratio}
        </div>
        {size && (
          <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[8px] px-1.5 py-0.5 rounded font-medium">
            {size}
          </span>
        )}
      </div>
      <div className="p-1.5 text-center bg-white">
        <div className="text-[10px] text-slate-500">{label}</div>
      </div>
    </div>
  );
}

// Section Divider Component
function SectionDividerCompact({ title }: { title: string }) {
  return (
    <div className="text-center my-2 relative">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-slate-200"></div>
      </div>
      <span className="relative bg-white px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
        {title}
      </span>
    </div>
  );
}

// Platform Header Compact Component
function PlatformHeaderCompact({
  name,
  description,
  iconSrc,
  iconClass,
  icon
}: {
  name: string;
  description: string;
  iconSrc?: string;
  iconClass?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 mb-3 pb-3 border-b border-slate-100">
      {iconSrc ? (
        <img src={iconSrc} alt={name} className="w-8 h-8 object-contain rounded-lg" />
      ) : (
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${iconClass || ''}`}>
          {icon}
        </div>
      )}
      <div>
        <h3 className="text-sm font-bold text-slate-900">{name}</h3>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
    </div>
  );
}

// Instagram Content Compact
function InstagramContentCompact() {
  return (
    <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
      <PlatformHeaderCompact
        name="Instagram"
        description="縦長画像がフィードで目立つ"
        iconSrc="/assets/icon/Instagram.webp"
      />

      <SectionDividerCompact title="フィード投稿" />
      <div className="grid grid-cols-3 gap-2">
        <SizeCardCompact ratio="4:5" size="1080×1350" label="縦長（推奨）" aspectType="portrait-4-5" gradient="instagram" />
        <SizeCardCompact ratio="3:4" size="1080×1440" label="縦長" aspectType="portrait-3-4" gradient="instagram" />
        <SizeCardCompact ratio="1:1" size="1080×1080" label="正方形" aspectType="square" gradient="instagram" />
      </div>

      <SectionDividerCompact title="ストーリーズ / リール" />
      <div className="grid grid-cols-3 gap-2">
        <SizeCardCompact ratio="9:16" size="1080×1920" label="フルスクリーン" aspectType="portrait-9-16" gradient="instagram" />
      </div>
    </div>
  );
}

// X Content Compact
function XContentCompact() {
  return (
    <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
      <PlatformHeaderCompact
        name="X (Twitter)"
        description="複数枚投稿時のレイアウトに注意"
        iconSrc="/assets/icon/x.webp"
      />

      <SectionDividerCompact title="1枚投稿" />
      <div className="grid grid-cols-4 gap-2">
        <SizeCardCompact ratio="16:9" size="1200×675" label="横長" aspectType="landscape-16-9" gradient="x" />
        <SizeCardCompact ratio="1:1" size="1200×1200" label="正方形" aspectType="square" gradient="x" />
        <SizeCardCompact ratio="8:9" size="1200×1350" label="縦長" aspectType="portrait-8-9" gradient="x" />
        <SizeCardCompact ratio="3:4" size="900×1200" label="縦長" aspectType="portrait-3-4" gradient="x" />
      </div>

      <SectionDividerCompact title="複数枚投稿" />
      <div className="grid grid-cols-3 gap-2">
        <MultiImageCardCompact layout="2col" label="2枚投稿" ratioText="8:9 × 2" />
        <MultiImageCardCompact layout="3col" label="3枚投稿" ratioText="8:9 + 16:9×2" />
        <MultiImageCardCompact layout="4grid" label="4枚投稿" ratioText="16:9 × 4" />
      </div>
    </div>
  );
}

// TikTok Content Compact
function TikTokContentCompact() {
  return (
    <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
      <PlatformHeaderCompact
        name="TikTok"
        description="縦型動画がメイン。9:16推奨"
        iconSrc="/assets/icon/tiktok.webp"
      />

      <SectionDividerCompact title="投稿サイズ" />
      <div className="grid grid-cols-3 gap-2">
        <SizeCardCompact ratio="9:16" size="720×1280" label="縦長（推奨）" aspectType="portrait-9-16" gradient="tiktok" />
        <SizeCardCompact ratio="16:9" size="1200×675" label="横長" aspectType="landscape-16-9" gradient="tiktok" />
        <SizeCardCompact ratio="1:1" size="1200×1200" label="正方形" aspectType="square" gradient="tiktok" />
      </div>
    </div>
  );
}

// Threads Content Compact
function ThreadsContentCompact() {
  return (
    <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
      <PlatformHeaderCompact
        name="Threads"
        description="Instagram連携。画像も重要"
        iconSrc="/assets/icon/Threads.webp"
      />

      <SectionDividerCompact title="投稿サイズ" />
      <div className="grid grid-cols-3 gap-2">
        <SizeCardCompact ratio="1:1" size="1080×1080" label="正方形" aspectType="square" gradient="x" />
        <SizeCardCompact ratio="4:3" size="1080×810" label="横長" aspectType="landscape-4-3" gradient="x" />
        <SizeCardCompact ratio="4:5" size="1080×1350" label="縦長" aspectType="portrait-4-5" gradient="x" />
      </div>
    </div>
  );
}

// Facebook Content Compact
function FacebookContentCompact() {
  return (
    <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
      <PlatformHeaderCompact
        name="Facebook"
        description="ビジネス・コミュニティ向け"
        iconSrc="/assets/icon/Facebook.webp"
      />

      <SectionDividerCompact title="1枚投稿" />
      <div className="grid grid-cols-3 gap-2">
        <SizeCardCompact ratio="5:4" size="800×640" label="横長" aspectType="landscape-5-4" gradient="default" />
        <SizeCardCompact ratio="1:1" size="1080×1080" label="正方形" aspectType="square" gradient="default" />
        <SizeCardCompact ratio="4:5" size="960×1200" label="縦長" aspectType="portrait-4-5" gradient="default" />
      </div>

      <SectionDividerCompact title="複数枚投稿" />
      <div className="grid grid-cols-3 gap-2">
        <FBMultiImageCardCompact layout="2col-vertical" label="2枚" ratioText="1:2 × 2" />
        <FBMultiImageCardCompact layout="3col-tall" label="3枚" ratioText="1:2 + 1:1×2" />
        <FBMultiImageCardCompact layout="4grid" label="4枚" ratioText="1:1 × 4" />
      </div>
    </div>
  );
}

// LinkedIn Content Compact
function LinkedInContentCompact() {
  return (
    <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
      <PlatformHeaderCompact
        name="LinkedIn"
        description="ビジネス向けSNS"
        iconClass="bg-[#0A66C2]"
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
        }
      />

      <SectionDividerCompact title="1枚投稿" />
      <div className="grid grid-cols-3 gap-2">
        <SizeCardCompact ratio="5:4" size="800×640" label="横長" aspectType="landscape-5-4" gradient="default" />
        <SizeCardCompact ratio="1:1" size="1080×1080" label="正方形" aspectType="square" gradient="default" />
        <SizeCardCompact ratio="4:5" size="640×800" label="縦長" aspectType="portrait-4-5" gradient="default" />
      </div>

      <SectionDividerCompact title="複数枚投稿" />
      <div className="grid grid-cols-3 gap-2">
        <LinkedInMultiCardCompact layout="1-2" label="2枚" ratioText="1:2 × 2" />
        <FBMultiImageCardCompact layout="3col-tall" label="3枚" ratioText="1:2 + 1:1×2" />
        <FBMultiImageCardCompact layout="4grid" label="4枚" ratioText="1:1 × 4" />
      </div>
    </div>
  );
}

// Multi-Image Card Compact for X
function MultiImageCardCompact({
  layout,
  label,
  ratioText
}: {
  layout: "2col" | "3col" | "4grid";
  label: string;
  ratioText: string;
}) {
  return (
    <div className="bg-slate-50 rounded-lg overflow-hidden border border-transparent hover:border-slate-200 hover:shadow-sm transition-all">
      <div className="relative flex items-center justify-center py-2.5 px-2 bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400">
        {layout === "2col" && (
          <div className="flex gap-0.5" style={{ height: 50, width: 60 }}>
            <div className="flex-1 bg-white/90 rounded flex items-center justify-center text-[8px] font-semibold text-slate-700 shadow-sm">8:9</div>
            <div className="flex-1 bg-white/90 rounded flex items-center justify-center text-[8px] font-semibold text-slate-700 shadow-sm">8:9</div>
          </div>
        )}
        {layout === "3col" && (
          <div className="grid grid-cols-2 gap-0.5" style={{ height: 50, width: 60 }}>
            <div className="row-span-2 bg-white/90 rounded flex items-center justify-center text-[8px] font-semibold text-slate-700 shadow-sm">8:9</div>
            <div className="bg-white/90 rounded flex items-center justify-center text-[8px] font-semibold text-slate-700 shadow-sm">16:9</div>
            <div className="bg-white/90 rounded flex items-center justify-center text-[8px] font-semibold text-slate-700 shadow-sm">16:9</div>
          </div>
        )}
        {layout === "4grid" && (
          <div className="grid grid-cols-2 gap-0.5" style={{ height: 44, width: 60 }}>
            <div className="bg-white/90 rounded flex items-center justify-center text-[8px] font-semibold text-slate-700 shadow-sm">16:9</div>
            <div className="bg-white/90 rounded flex items-center justify-center text-[8px] font-semibold text-slate-700 shadow-sm">16:9</div>
            <div className="bg-white/90 rounded flex items-center justify-center text-[8px] font-semibold text-slate-700 shadow-sm">16:9</div>
            <div className="bg-white/90 rounded flex items-center justify-center text-[8px] font-semibold text-slate-700 shadow-sm">16:9</div>
          </div>
        )}
      </div>
      <div className="p-1.5 text-center bg-white">
        <div className="text-[10px] text-slate-500">{label}</div>
        <div className="text-[10px] font-semibold text-slate-800">{ratioText}</div>
      </div>
    </div>
  );
}

// Facebook Multi-Image Card Compact
function FBMultiImageCardCompact({
  layout,
  label,
  ratioText
}: {
  layout: "2col-vertical" | "2row-horizontal" | "3col-tall" | "3row-wide" | "4grid" | "4main-wide" | "4main-tall";
  label: string;
  ratioText: string;
}) {
  return (
    <div className="bg-slate-50 rounded-lg overflow-hidden border border-transparent hover:border-slate-200 hover:shadow-sm transition-all">
      <div className="relative flex items-center justify-center py-2.5 px-2 bg-gradient-to-br from-indigo-100 via-indigo-200 to-indigo-300">
        {layout === "2col-vertical" && (
          <div className="flex gap-0.5" style={{ height: 56, width: 56 }}>
            <div className="flex-1 bg-white/90 rounded flex items-center justify-center text-[8px] font-semibold text-slate-700 shadow-sm">1:2</div>
            <div className="flex-1 bg-white/90 rounded flex items-center justify-center text-[8px] font-semibold text-slate-700 shadow-sm">1:2</div>
          </div>
        )}
        {layout === "3col-tall" && (
          <div className="grid grid-cols-2 gap-0.5" style={{ height: 56, width: 60 }}>
            <div className="row-span-2 bg-white/90 rounded flex items-center justify-center text-[8px] font-semibold text-slate-700 shadow-sm">1:2</div>
            <div className="bg-white/90 rounded flex items-center justify-center text-[8px] font-semibold text-slate-700 shadow-sm">1:1</div>
            <div className="bg-white/90 rounded flex items-center justify-center text-[8px] font-semibold text-slate-700 shadow-sm">1:1</div>
          </div>
        )}
        {layout === "4grid" && (
          <div className="grid grid-cols-2 gap-0.5" style={{ height: 60, width: 60 }}>
            <div className="bg-white/90 rounded flex items-center justify-center text-[8px] font-semibold text-slate-700 shadow-sm">1:1</div>
            <div className="bg-white/90 rounded flex items-center justify-center text-[8px] font-semibold text-slate-700 shadow-sm">1:1</div>
            <div className="bg-white/90 rounded flex items-center justify-center text-[8px] font-semibold text-slate-700 shadow-sm">1:1</div>
            <div className="bg-white/90 rounded flex items-center justify-center text-[8px] font-semibold text-slate-700 shadow-sm">1:1</div>
          </div>
        )}
        {layout === "2row-horizontal" && (
          <div className="flex flex-col gap-0.5" style={{ height: 44, width: 60 }}>
            <div className="flex-1 bg-white/90 rounded flex items-center justify-center text-[8px] font-semibold text-slate-700 shadow-sm">2:1</div>
            <div className="flex-1 bg-white/90 rounded flex items-center justify-center text-[8px] font-semibold text-slate-700 shadow-sm">2:1</div>
          </div>
        )}
        {layout === "3row-wide" && (
          <div className="grid grid-cols-2 gap-0.5" style={{ height: 50, width: 60 }}>
            <div className="col-span-2 bg-white/90 rounded flex items-center justify-center text-[8px] font-semibold text-slate-700 shadow-sm" style={{ height: 18 }}>2:1</div>
            <div className="bg-white/90 rounded flex items-center justify-center text-[8px] font-semibold text-slate-700 shadow-sm">1:1</div>
            <div className="bg-white/90 rounded flex items-center justify-center text-[8px] font-semibold text-slate-700 shadow-sm">1:1</div>
          </div>
        )}
        {layout === "4main-wide" && (
          <div className="grid grid-cols-3 gap-0.5" style={{ height: 56, width: 60 }}>
            <div className="col-span-3 bg-white/90 rounded flex items-center justify-center text-[8px] font-semibold text-slate-700 shadow-sm" style={{ height: 24 }}>3:2</div>
            <div className="bg-white/90 rounded flex items-center justify-center text-[8px] font-semibold text-slate-700 shadow-sm">1:1</div>
            <div className="bg-white/90 rounded flex items-center justify-center text-[8px] font-semibold text-slate-700 shadow-sm">1:1</div>
            <div className="bg-white/90 rounded flex items-center justify-center text-[8px] font-semibold text-slate-700 shadow-sm">1:1</div>
          </div>
        )}
        {layout === "4main-tall" && (
          <div className="grid grid-cols-2 gap-0.5" style={{ height: 56, width: 60 }}>
            <div className="row-span-3 bg-white/90 rounded flex items-center justify-center text-[8px] font-semibold text-slate-700 shadow-sm">2:3</div>
            <div className="bg-white/90 rounded flex items-center justify-center text-[8px] font-semibold text-slate-700 shadow-sm">1:1</div>
            <div className="bg-white/90 rounded flex items-center justify-center text-[8px] font-semibold text-slate-700 shadow-sm">1:1</div>
            <div className="bg-white/90 rounded flex items-center justify-center text-[8px] font-semibold text-slate-700 shadow-sm">1:1</div>
          </div>
        )}
      </div>
      <div className="p-1.5 text-center bg-white">
        <div className="text-[10px] text-slate-500">{label}</div>
        <div className="text-[10px] font-semibold text-slate-800">{ratioText}</div>
      </div>
    </div>
  );
}

// LinkedIn Multi Card Compact
function LinkedInMultiCardCompact({
  layout,
  label,
  ratioText
}: {
  layout: "1-2" | "4-5" | "1-1";
  label: string;
  ratioText: string;
}) {
  return (
    <div className="bg-slate-50 rounded-lg overflow-hidden border border-transparent hover:border-slate-200 hover:shadow-sm transition-all">
      <div className="relative flex items-center justify-center py-2.5 px-2 bg-gradient-to-br from-indigo-100 via-indigo-200 to-indigo-300">
        {layout === "1-2" && (
          <div className="flex gap-0.5" style={{ height: 56, width: 56 }}>
            <div className="flex-1 bg-white/90 rounded flex items-center justify-center text-[8px] font-semibold text-slate-700 shadow-sm">1:2</div>
            <div className="flex-1 bg-white/90 rounded flex items-center justify-center text-[8px] font-semibold text-slate-700 shadow-sm">1:2</div>
          </div>
        )}
        {layout === "4-5" && (
          <div className="flex gap-0.5" style={{ height: 56, width: 44 }}>
            <div className="flex-1 bg-white/90 rounded flex items-center justify-center text-[8px] font-semibold text-slate-700 shadow-sm">4:5</div>
            <div className="flex-1 bg-white/90 rounded flex items-center justify-center text-[8px] font-semibold text-slate-700 shadow-sm">4:5</div>
          </div>
        )}
        {layout === "1-1" && (
          <div className="flex gap-0.5" style={{ height: 50, width: 50 }}>
            <div className="flex-1 bg-white/90 rounded flex items-center justify-center text-[8px] font-semibold text-slate-700 shadow-sm">1:1</div>
            <div className="flex-1 bg-white/90 rounded flex items-center justify-center text-[8px] font-semibold text-slate-700 shadow-sm">1:1</div>
          </div>
        )}
      </div>
      <div className="p-1.5 text-center bg-white">
        <div className="text-[10px] text-slate-500">{label}</div>
        <div className="text-[10px] font-semibold text-slate-800">{ratioText}</div>
      </div>
    </div>
  );
}

// Reference Table Compact
function ReferenceTableCompact() {
  const data = [
    { ratio: "1:1", size: "1200×1200", platforms: ["IG", "X", "TT", "Th", "FB", "LI"] },
    { ratio: "4:5", size: "1080×1350", platforms: ["IG", "Th", "FB", "LI"] },
    { ratio: "3:4", size: "1080×1440", platforms: ["IG", "X"] },
    { ratio: "9:16", size: "1080×1920", platforms: ["IG", "TT"] },
    { ratio: "16:9", size: "1200×675", platforms: ["X", "TT"] },
    { ratio: "8:9", size: "1200×1350", platforms: ["X"] },
  ];

  const getPlatformClass = (platform: string) => {
    switch (platform) {
      case "IG": return "bg-pink-100 text-pink-700";
      case "X": return "bg-slate-100 text-slate-700";
      case "TT": return "bg-teal-100 text-teal-700";
      case "Th": return "bg-slate-100 text-slate-700";
      case "FB": return "bg-blue-100 text-blue-700";
      case "LI": return "bg-blue-100 text-blue-800";
      default: return "bg-slate-100 text-slate-700";
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-2 border-b border-slate-100">
        <h3 className="text-xs font-bold text-slate-900">比率別サイズ一覧</h3>
        <p className="text-[9px] text-slate-500 mt-0.5">IG=Instagram, TT=TikTok, Th=Threads, FB=Facebook, LI=LinkedIn</p>
      </div>
      <div className="overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50">
              <th className="text-left px-2 py-1.5 text-[9px] font-semibold text-slate-500">比率</th>
              <th className="text-left px-2 py-1.5 text-[9px] font-semibold text-slate-500">サイズ</th>
              <th className="text-left px-2 py-1.5 text-[9px] font-semibold text-slate-500">SNS</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={idx} className="border-t border-slate-100">
                <td className="px-2 py-1.5 font-semibold text-slate-800 text-[10px]">{row.ratio}</td>
                <td className="px-2 py-1.5 text-slate-600 font-mono text-[9px]">{row.size}</td>
                <td className="px-2 py-1.5">
                  <div className="flex flex-wrap gap-0.5">
                    {row.platforms.map((platform) => (
                      <span key={platform} className={`text-[7px] px-1 py-0.5 rounded font-medium ${getPlatformClass(platform)}`}>
                        {platform}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
