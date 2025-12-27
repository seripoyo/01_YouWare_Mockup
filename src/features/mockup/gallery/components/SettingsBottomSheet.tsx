import React, { useState } from "react";
import {
  getCurrentLanguage,
  setLanguageAndReload,
  getTranslations,
  LANGUAGE_LABELS,
  type SupportedLanguage,
} from "../../../../i18n/translations";

// 言語オプション
const LANGUAGE_OPTIONS: { code: SupportedLanguage; label: string }[] = [
  { code: "ja", label: "日本語" },
  { code: "en", label: "English" },
  { code: "zh-CN", label: "中文（簡体字）" },
  { code: "zh-TW", label: "中文（繁体字）" },
  { code: "ko", label: "한국어" },
];

interface SettingsBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsBottomSheet({
  isOpen,
  onClose,
}: SettingsBottomSheetProps) {
  const [isLangExpanded, setIsLangExpanded] = useState(false);

  const currentLang = getCurrentLanguage();
  const t = getTranslations();
  const currentLangLabel = LANGUAGE_LABELS[currentLang];

  const handleLanguageChange = (langCode: SupportedLanguage) => {
    setLanguageAndReload(langCode);
  };

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
          maxHeight: "70vh",
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
          <h2 className="text-lg font-bold text-slate-900">{t.menu}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-500 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <span className="material-icons">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 overflow-y-auto" style={{ maxHeight: "calc(70vh - 100px)" }}>
          {/* Language Switcher */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <span className="material-icons text-sm text-indigo-500">language</span>
              {t.language || "言語"}
            </h3>
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
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <span className="material-icons text-sm text-indigo-500">account_circle</span>
              {t.account || "アカウント"}
            </h3>
            <button
              onClick={() => {
                console.log("Google Sign In clicked");
                // TODO: Implement Google Sign In
              }}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border border-slate-300 rounded-xl hover:shadow-md transition-all"
            >
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span className="text-sm font-medium text-slate-700">{t.signInWithGoogle || "Sign in with Google"}</span>
            </button>
          </div>

          {/* Additional Settings can be added here */}
          <div className="pb-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <span className="material-icons text-sm text-indigo-500">info</span>
              {t.about || "情報"}
            </h3>
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-sm text-slate-600">
                Mockup Generator v1.0
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {t.appDescription || "モックアップ画像を簡単に作成できます"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
