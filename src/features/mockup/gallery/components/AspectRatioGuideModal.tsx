import { useState, useEffect } from "react";

interface AspectRatioGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = "instagram" | "x" | "tiktok" | "threads" | "facebook" | "linkedin" | "reference";

export function AspectRatioGuideModal({ isOpen, onClose }: AspectRatioGuideModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("instagram");
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
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
      className={`fixed inset-0 z-50 flex items-end justify-center transition-all duration-300 ${
        isAnimating ? "bg-black/50 backdrop-blur-sm" : "bg-transparent"
      }`}
      onClick={handleBackdropClick}
    >
      <div
        className={`w-full max-w-4xl bg-slate-50 rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out ${
          isAnimating ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white rounded-t-3xl border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📐</span>
            <h2 className="text-lg font-bold text-slate-900">SNS Post Size Guide</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
          >
            <span className="material-icons">close</span>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="sticky top-[65px] bg-slate-50 px-4 py-3 border-b border-slate-200 z-10 overflow-x-auto">
          <div className="flex gap-2 justify-start md:justify-center min-w-max">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? getTabActiveClass(tab.id)
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {activeTab === tab.id && tab.activeIcon ? tab.activeIcon : tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content - 統一された高さでコンテンツを表示 */}
        <div className="overflow-y-auto p-4 md:p-6" style={{ maxHeight: "calc(90vh - 140px)" }}>
          {activeTab === "instagram" && <InstagramContent />}
          {activeTab === "x" && <XContent />}
          {activeTab === "tiktok" && <TikTokContent />}
          {activeTab === "threads" && <ThreadsContent />}
          {activeTab === "facebook" && <FacebookContent />}
          {activeTab === "linkedin" && <LinkedInContent />}
          {activeTab === "reference" && <ReferenceTable />}
        </div>
      </div>
    </div>
  );
}

// Section Divider Component
function SectionDivider({ title }: { title: string }) {
  return (
    <div className="text-center my-4 relative">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-slate-200"></div>
      </div>
      <span className="relative bg-white px-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">
        {title}
      </span>
    </div>
  );
}

// Size Card Component
interface SizeCardProps {
  ratio: string;
  size: string;
  label: string;
  aspectType: string;
  gradient: "instagram" | "x" | "tiktok" | "default";
}

function SizeCard({ ratio, size, label, aspectType, gradient }: SizeCardProps) {
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
      case "square": return { width: 80, height: 80 };
      case "portrait-4-5": return { width: 64, height: 80 };
      case "portrait-3-4": return { width: 60, height: 80 };
      case "portrait-9-16": return { width: 45, height: 80 };
      case "portrait-8-9": return { width: 71, height: 80 };
      case "portrait-1-2": return { width: 40, height: 80 };
      case "portrait-2-3": return { width: 53, height: 80 };
      case "landscape-16-9": return { width: 100, height: 56 };
      case "landscape-5-4": return { width: 100, height: 80 };
      case "landscape-4-3": return { width: 100, height: 75 };
      case "landscape-2-1": return { width: 100, height: 50 };
      case "landscape-3-2": return { width: 100, height: 67 };
      default: return { width: 80, height: 80 };
    }
  };

  const boxStyle = getAspectBoxStyle();

  return (
    <div className="bg-slate-50 rounded-xl overflow-hidden border border-transparent hover:border-slate-200 hover:shadow-md transition-all">
      <div className={`relative flex items-center justify-center py-4 px-3 ${getGradientClass()}`}>
        <div
          className="bg-white/90 rounded-lg flex items-center justify-center text-sm font-semibold text-slate-700 shadow-md backdrop-blur-sm"
          style={{ width: boxStyle.width, height: boxStyle.height }}
        >
          {ratio}
        </div>
        {size && (
          <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded-md font-medium">
            {size}
          </span>
        )}
      </div>
      <div className="p-2.5 text-center bg-white">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-sm font-semibold text-slate-800">{ratio}</div>
      </div>
    </div>
  );
}

// Multi-Image Card Component for X
function MultiImageCard({
  layout,
  label,
  ratioText
}: {
  layout: "2col" | "3col" | "4grid";
  label: string;
  ratioText: string;
}) {
  return (
    <div className="bg-slate-50 rounded-xl overflow-hidden border border-transparent hover:border-slate-200 hover:shadow-md transition-all">
      <div className="relative flex items-center justify-center py-4 px-3 bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400">
        {layout === "2col" && (
          <div className="flex gap-1" style={{ height: 80, width: 140 }}>
            <div className="flex-1 bg-white/90 rounded-md flex items-center justify-center text-xs font-semibold text-slate-700 shadow-sm">8:9</div>
            <div className="flex-1 bg-white/90 rounded-md flex items-center justify-center text-xs font-semibold text-slate-700 shadow-sm">8:9</div>
          </div>
        )}
        {layout === "3col" && (
          <div className="grid grid-cols-2 gap-1" style={{ height: 80, width: 120 }}>
            <div className="row-span-2 bg-white/90 rounded-md flex items-center justify-center text-xs font-semibold text-slate-700 shadow-sm">8:9</div>
            <div className="bg-white/90 rounded-md flex items-center justify-center text-xs font-semibold text-slate-700 shadow-sm">16:9</div>
            <div className="bg-white/90 rounded-md flex items-center justify-center text-xs font-semibold text-slate-700 shadow-sm">16:9</div>
          </div>
        )}
        {layout === "4grid" && (
          <div className="grid grid-cols-2 gap-1" style={{ height: 70, width: 120 }}>
            <div className="bg-white/90 rounded-md flex items-center justify-center text-xs font-semibold text-slate-700 shadow-sm">16:9</div>
            <div className="bg-white/90 rounded-md flex items-center justify-center text-xs font-semibold text-slate-700 shadow-sm">16:9</div>
            <div className="bg-white/90 rounded-md flex items-center justify-center text-xs font-semibold text-slate-700 shadow-sm">16:9</div>
            <div className="bg-white/90 rounded-md flex items-center justify-center text-xs font-semibold text-slate-700 shadow-sm">16:9</div>
          </div>
        )}
      </div>
      <div className="p-2.5 text-center bg-white">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-sm font-semibold text-slate-800">{ratioText}</div>
      </div>
    </div>
  );
}

// Facebook/LinkedIn Multi-Image Cards
function FBMultiImageCard({
  layout,
  label,
  ratioText
}: {
  layout: "2col-vertical" | "2row-horizontal" | "3col-tall" | "3row-wide" | "4grid" | "4main-wide" | "4main-tall";
  label: string;
  ratioText: string;
}) {
  return (
    <div className="bg-slate-50 rounded-xl overflow-hidden border border-transparent hover:border-slate-200 hover:shadow-md transition-all">
      <div className="relative flex items-center justify-center py-4 px-3 bg-gradient-to-br from-indigo-100 via-indigo-200 to-indigo-300">
        {layout === "2col-vertical" && (
          <div className="flex gap-1" style={{ height: 90, width: 90 }}>
            <div className="flex-1 bg-white/90 rounded-md flex items-center justify-center text-xs font-semibold text-slate-700 shadow-sm">1:2</div>
            <div className="flex-1 bg-white/90 rounded-md flex items-center justify-center text-xs font-semibold text-slate-700 shadow-sm">1:2</div>
          </div>
        )}
        {layout === "2row-horizontal" && (
          <div className="flex flex-col gap-1" style={{ height: 70, width: 120 }}>
            <div className="flex-1 bg-white/90 rounded-md flex items-center justify-center text-xs font-semibold text-slate-700 shadow-sm">2:1</div>
            <div className="flex-1 bg-white/90 rounded-md flex items-center justify-center text-xs font-semibold text-slate-700 shadow-sm">2:1</div>
          </div>
        )}
        {layout === "3col-tall" && (
          <div className="grid grid-cols-2 gap-1" style={{ height: 90, width: 120 }}>
            <div className="row-span-2 bg-white/90 rounded-md flex items-center justify-center text-xs font-semibold text-slate-700 shadow-sm">1:2</div>
            <div className="bg-white/90 rounded-md flex items-center justify-center text-xs font-semibold text-slate-700 shadow-sm">1:1</div>
            <div className="bg-white/90 rounded-md flex items-center justify-center text-xs font-semibold text-slate-700 shadow-sm">1:1</div>
          </div>
        )}
        {layout === "3row-wide" && (
          <div className="grid grid-cols-2 gap-1" style={{ height: 80, width: 120 }}>
            <div className="col-span-2 bg-white/90 rounded-md flex items-center justify-center text-xs font-semibold text-slate-700 shadow-sm" style={{ height: 30 }}>2:1</div>
            <div className="bg-white/90 rounded-md flex items-center justify-center text-xs font-semibold text-slate-700 shadow-sm">1:1</div>
            <div className="bg-white/90 rounded-md flex items-center justify-center text-xs font-semibold text-slate-700 shadow-sm">1:1</div>
          </div>
        )}
        {layout === "4grid" && (
          <div className="grid grid-cols-2 gap-1" style={{ height: 100, width: 100 }}>
            <div className="bg-white/90 rounded-md flex items-center justify-center text-xs font-semibold text-slate-700 shadow-sm">1:1</div>
            <div className="bg-white/90 rounded-md flex items-center justify-center text-xs font-semibold text-slate-700 shadow-sm">1:1</div>
            <div className="bg-white/90 rounded-md flex items-center justify-center text-xs font-semibold text-slate-700 shadow-sm">1:1</div>
            <div className="bg-white/90 rounded-md flex items-center justify-center text-xs font-semibold text-slate-700 shadow-sm">1:1</div>
          </div>
        )}
        {layout === "4main-wide" && (
          <div className="grid grid-cols-3 gap-1" style={{ height: 90, width: 120 }}>
            <div className="col-span-3 bg-white/90 rounded-md flex items-center justify-center text-xs font-semibold text-slate-700 shadow-sm" style={{ height: 40 }}>3:2</div>
            <div className="bg-white/90 rounded-md flex items-center justify-center text-xs font-semibold text-slate-700 shadow-sm">1:1</div>
            <div className="bg-white/90 rounded-md flex items-center justify-center text-xs font-semibold text-slate-700 shadow-sm">1:1</div>
            <div className="bg-white/90 rounded-md flex items-center justify-center text-xs font-semibold text-slate-700 shadow-sm">1:1</div>
          </div>
        )}
        {layout === "4main-tall" && (
          <div className="grid grid-cols-2 gap-1" style={{ height: 90, width: 120 }}>
            <div className="row-span-3 bg-white/90 rounded-md flex items-center justify-center text-xs font-semibold text-slate-700 shadow-sm">2:3</div>
            <div className="bg-white/90 rounded-md flex items-center justify-center text-xs font-semibold text-slate-700 shadow-sm">1:1</div>
            <div className="bg-white/90 rounded-md flex items-center justify-center text-xs font-semibold text-slate-700 shadow-sm">1:1</div>
            <div className="bg-white/90 rounded-md flex items-center justify-center text-xs font-semibold text-slate-700 shadow-sm">1:1</div>
          </div>
        )}
      </div>
      <div className="p-2.5 text-center bg-white">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-sm font-semibold text-slate-800">{ratioText}</div>
      </div>
    </div>
  );
}

// LinkedIn 2枚投稿用の追加カード
function LinkedInMultiCard({
  layout,
  label,
  ratioText
}: {
  layout: "1-2" | "4-5" | "1-1";
  label: string;
  ratioText: string;
}) {
  return (
    <div className="bg-slate-50 rounded-xl overflow-hidden border border-transparent hover:border-slate-200 hover:shadow-md transition-all">
      <div className="relative flex items-center justify-center py-4 px-3 bg-gradient-to-br from-indigo-100 via-indigo-200 to-indigo-300">
        {layout === "1-2" && (
          <div className="flex gap-1" style={{ height: 90, width: 90 }}>
            <div className="flex-1 bg-white/90 rounded-md flex items-center justify-center text-xs font-semibold text-slate-700 shadow-sm">1:2</div>
            <div className="flex-1 bg-white/90 rounded-md flex items-center justify-center text-xs font-semibold text-slate-700 shadow-sm">1:2</div>
          </div>
        )}
        {layout === "4-5" && (
          <div className="flex gap-1" style={{ height: 90, width: 72 }}>
            <div className="flex-1 bg-white/90 rounded-md flex items-center justify-center text-xs font-semibold text-slate-700 shadow-sm">4:5</div>
            <div className="flex-1 bg-white/90 rounded-md flex items-center justify-center text-xs font-semibold text-slate-700 shadow-sm">4:5</div>
          </div>
        )}
        {layout === "1-1" && (
          <div className="flex gap-1" style={{ height: 80, width: 80 }}>
            <div className="flex-1 bg-white/90 rounded-md flex items-center justify-center text-xs font-semibold text-slate-700 shadow-sm">1:1</div>
            <div className="flex-1 bg-white/90 rounded-md flex items-center justify-center text-xs font-semibold text-slate-700 shadow-sm">1:1</div>
          </div>
        )}
      </div>
      <div className="p-2.5 text-center bg-white">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-sm font-semibold text-slate-800">{ratioText}</div>
      </div>
    </div>
  );
}

// Platform Header Component
function PlatformHeader({
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
    <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-100">
      {iconSrc ? (
        <img src={iconSrc} alt={name} className="w-12 h-12 object-contain rounded-xl" />
      ) : (
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white ${iconClass || ''}`}>
          {icon}
        </div>
      )}
      <div>
        <h3 className="text-xl font-bold text-slate-900">{name}</h3>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
    </div>
  );
}

// Instagram Content
function InstagramContent() {
  return (
    <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-slate-100 min-h-[700px]">
      <PlatformHeader
        name="Instagram"
        description="ビジュアル重視のSNS。縦長画像がフィードで目立つ。"
        iconSrc="/assets/icon/Instagram.webp"
      />

      <SectionDivider title="フィード投稿" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
        <SizeCard ratio="4:5" size="1080×1350" label="縦長（推奨）" aspectType="portrait-4-5" gradient="instagram" />
        <SizeCard ratio="3:4" size="1080×1440" label="縦長" aspectType="portrait-3-4" gradient="instagram" />
        <SizeCard ratio="1:1" size="1080×1080" label="正方形" aspectType="square" gradient="instagram" />
      </div>

      <SectionDivider title="ストーリーズ / リール" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
        <SizeCard ratio="9:16" size="1080×1920" label="フルスクリーン" aspectType="portrait-9-16" gradient="instagram" />
      </div>
    </div>
  );
}

// X Content
function XContent() {
  return (
    <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-slate-100 min-h-[700px]">
      <PlatformHeader
        name="X (Twitter)"
        description="複数枚投稿時のレイアウトに注意が必要。"
        iconSrc="/assets/icon/x.webp"
      />

      <SectionDivider title="1枚投稿" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
        <SizeCard ratio="16:9" size="1200×675" label="横長" aspectType="landscape-16-9" gradient="x" />
        <SizeCard ratio="1:1" size="1200×1200" label="正方形" aspectType="square" gradient="x" />
        <SizeCard ratio="8:9" size="1200×1350" label="縦長" aspectType="portrait-8-9" gradient="x" />
        <SizeCard ratio="3:4" size="900×1200" label="縦長" aspectType="portrait-3-4" gradient="x" />
      </div>

      <SectionDivider title="複数枚投稿" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
        <MultiImageCard layout="2col" label="2枚投稿" ratioText="8:9 × 2" />
        <MultiImageCard layout="3col" label="3枚投稿" ratioText="8:9 + 16:9×2" />
        <MultiImageCard layout="4grid" label="4枚投稿" ratioText="16:9 × 4" />
      </div>
    </div>
  );
}

// TikTok Content
function TikTokContent() {
  return (
    <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-slate-100 min-h-[700px]">
      <PlatformHeader
        name="TikTok"
        description="縦型動画がメイン。フルスクリーン9:16推奨。"
        iconSrc="/assets/icon/tiktok.webp"
      />

      <SectionDivider title="投稿サイズ" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
        <SizeCard ratio="9:16" size="720×1280" label="縦長（推奨）" aspectType="portrait-9-16" gradient="tiktok" />
        <SizeCard ratio="16:9" size="1200×675" label="横長" aspectType="landscape-16-9" gradient="tiktok" />
        <SizeCard ratio="1:1" size="1200×1200" label="正方形" aspectType="square" gradient="tiktok" />
      </div>
    </div>
  );
}

// Threads Content
function ThreadsContent() {
  return (
    <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-slate-100 min-h-[700px]">
      <PlatformHeader
        name="Threads"
        description="Instagram連携。テキストメインだが画像も重要。"
        iconSrc="/assets/icon/Threads.webp"
      />

      <SectionDivider title="投稿サイズ" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
        <SizeCard ratio="1:1" size="1080×1080" label="正方形" aspectType="square" gradient="x" />
        <SizeCard ratio="4:3" size="1080×810" label="横長" aspectType="landscape-4-3" gradient="x" />
        <SizeCard ratio="4:5" size="1080×1350" label="縦長" aspectType="portrait-4-5" gradient="x" />
      </div>
    </div>
  );
}

// Facebook Content
function FacebookContent() {
  return (
    <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-slate-100 min-h-[700px]">
      <PlatformHeader
        name="Facebook"
        description="ビジネス・コミュニティ向けの多様なグリッド。"
        iconSrc="/assets/icon/Facebook.webp"
      />

      <SectionDivider title="1枚投稿" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
        <SizeCard ratio="5:4" size="800×640" label="横長" aspectType="landscape-5-4" gradient="default" />
        <SizeCard ratio="1:1" size="1080×1080" label="正方形" aspectType="square" gradient="default" />
        <SizeCard ratio="4:5" size="960×1200" label="縦長" aspectType="portrait-4-5" gradient="default" />
      </div>

      <SectionDivider title="2枚投稿" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
        <FBMultiImageCard layout="2col-vertical" label="2枚 (縦並び)" ratioText="1:2 × 2" />
        <FBMultiImageCard layout="2row-horizontal" label="2枚 (横並び)" ratioText="2:1 × 2" />
      </div>

      <SectionDivider title="3枚投稿" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
        <FBMultiImageCard layout="3col-tall" label="3枚 (縦型メイン)" ratioText="1:2 + 1:1×2" />
        <FBMultiImageCard layout="3row-wide" label="3枚 (横型メイン)" ratioText="2:1 + 1:1×2" />
      </div>

      <SectionDivider title="4枚投稿" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
        <FBMultiImageCard layout="4grid" label="4枚 (正方形)" ratioText="1:1 × 4" />
        <FBMultiImageCard layout="4main-wide" label="4枚 (横型メイン)" ratioText="3:2 + 1:1×3" />
        <FBMultiImageCard layout="4main-tall" label="4枚 (縦型メイン)" ratioText="2:3 + 1:1×3" />
      </div>
    </div>
  );
}

// LinkedIn Content
function LinkedInContent() {
  return (
    <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-slate-100 min-h-[700px]">
      <PlatformHeader
        name="LinkedIn"
        description="ビジネス向けSNS。プロフェッショナルな印象を。"
        iconClass="bg-[#0A66C2]"
        icon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
        }
      />

      <SectionDivider title="1枚投稿" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
        <SizeCard ratio="5:4" size="800×640" label="横長" aspectType="landscape-5-4" gradient="default" />
        <SizeCard ratio="1:1" size="1080×1080" label="正方形" aspectType="square" gradient="default" />
        <SizeCard ratio="4:5" size="640×800" label="縦長" aspectType="portrait-4-5" gradient="default" />
      </div>

      <SectionDivider title="2枚投稿" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
        <LinkedInMultiCard layout="1-2" label="2枚" ratioText="1:2 × 2" />
        <LinkedInMultiCard layout="4-5" label="2枚" ratioText="4:5 × 2" />
        <LinkedInMultiCard layout="1-1" label="2枚" ratioText="1:1 × 2" />
      </div>

      <SectionDivider title="3枚投稿" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
        <FBMultiImageCard layout="3col-tall" label="3枚 (縦型メイン)" ratioText="1:2 + 1:1×2" />
        <FBMultiImageCard layout="3row-wide" label="3枚 (横型メイン)" ratioText="2:1 + 1:1×2" />
      </div>

      <SectionDivider title="4枚投稿" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
        <FBMultiImageCard layout="4grid" label="4枚 (正方形)" ratioText="1:1 × 4" />
        <FBMultiImageCard layout="4main-wide" label="4枚 (横型メイン)" ratioText="3:2 + 1:1×3" />
        <FBMultiImageCard layout="4main-tall" label="4枚 (縦型メイン)" ratioText="2:3 + 1:1×3" />
      </div>
    </div>
  );
}

// Reference Table Component
function ReferenceTable() {
  const data = [
    { ratio: "1:1（正方形）", size: "1200×1200px", platforms: ["Instagram", "X", "TikTok", "Threads", "Facebook", "LinkedIn"] },
    { ratio: "4:5（縦長）", size: "1080×1350px", platforms: ["Instagram", "Threads", "Facebook", "LinkedIn"] },
    { ratio: "3:4（縦長）", size: "1080×1440px", platforms: ["Instagram", "X"] },
    { ratio: "9:16（縦長）", size: "1080×1920px", platforms: ["Instagram", "TikTok"] },
    { ratio: "16:9（横長）", size: "1200×675px", platforms: ["X", "TikTok"] },
    { ratio: "8:9（縦長）", size: "1200×1350px", platforms: ["X"] },
    { ratio: "5:4（横長）", size: "800×640px", platforms: ["Facebook", "LinkedIn"] },
    { ratio: "4:3（横長）", size: "1080×810px", platforms: ["Threads"] },
    { ratio: "1:2（縦長）", size: "720×1440px", platforms: ["Facebook", "LinkedIn"] },
    { ratio: "2:1（横長）", size: "1440×720px", platforms: ["Facebook", "LinkedIn"] },
    { ratio: "3:2（横長）", size: "1280×853px", platforms: ["Facebook", "LinkedIn"] },
    { ratio: "2:3（縦長）", size: "853×1280px", platforms: ["Facebook", "LinkedIn"] },
  ];

  const getPlatformClass = (platform: string) => {
    switch (platform) {
      case "Instagram": return "bg-pink-100 text-pink-700";
      case "X": return "bg-slate-100 text-slate-700";
      case "TikTok": return "bg-teal-100 text-teal-700";
      case "Threads": return "bg-slate-100 text-slate-700";
      case "Facebook": return "bg-blue-100 text-blue-700";
      case "LinkedIn": return "bg-blue-100 text-blue-800";
      default: return "bg-slate-100 text-slate-700";
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden min-h-[700px]">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-slate-100">
        <h3 className="text-lg font-bold text-slate-900">アスペクト比別 必要最低サイズ一覧</h3>
        <p className="text-sm text-slate-500 mt-1">各アスペクト比ごとに、全プラットフォームで使い回すために必要な最低サイズ</p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">アスペクト比</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">必要最低サイズ</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">該当プラットフォーム</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={idx} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-semibold text-slate-800 text-sm">{row.ratio}</td>
                <td className="px-4 py-3 text-slate-600 text-sm font-mono">{row.size}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {row.platforms.map((platform) => (
                      <span key={platform} className={`text-xs px-2 py-0.5 rounded-md font-medium ${getPlatformClass(platform)}`}>
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
