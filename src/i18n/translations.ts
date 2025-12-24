/**
 * 多言語対応のための翻訳データ
 */

export type SupportedLanguage = "ja" | "en" | "zh-CN" | "zh-TW" | "ko";

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  ja: "日本語",
  en: "English",
  "zh-CN": "中文（簡体字）",
  "zh-TW": "中文（繁体字）",
  ko: "한국어",
};

export interface Translations {
  // MockupGrid
  useThisTemplate: string;
  noTemplatesFound: string;

  // PreviewModal
  deviceLabel: (deviceNum: number) => string;
  dropToDevice: (deviceNum: number) => string;
  selectingDevice: (deviceNum: number) => string;
  uploadImage: string;
  changeImage: string;
  downloadInRatio: (ratio: string) => string;
  downloadWithResizedImage: string;
  showGuidelines: string;
  hideGuidelines: string;
  adjustVertices: string;
  copyImage: string;
  share: string;
  confirm: string;
  cancel: string;
  imageUploaded: string;
  cover: string;
  contain: string;
  cropInfo: (ratio: string) => string;
  resetCrop: string;

  // FilterSidebar
  menu: string;
  filters: string;
  showingItems: (count: number) => string;
  clearAll: string;
  deviceType: string;
  aspectRatio: string;
  colorTheme: string;
  signInWithGoogle: string;

  // Gallery
  allTemplates: string;
  itemsFound: (count: number) => string;

  // Aspect Ratio Guide
  aspectRatioGuide: string;
}

const ja: Translations = {
  useThisTemplate: "このテンプレートを使う",
  noTemplatesFound: "テンプレートが見つかりませんでした",
  deviceLabel: (deviceNum) => `デバイス ${deviceNum}`,
  dropToDevice: (deviceNum) => `デバイス ${deviceNum} にドロップ`,
  selectingDevice: (deviceNum) => `デバイス ${deviceNum} を選択中`,
  uploadImage: "画像をアップロード",
  changeImage: "画像を変更",
  downloadInRatio: (ratio) => `${ratio}でダウンロード`,
  downloadWithResizedImage: "画像サイズを変えてダウンロード",
  showGuidelines: "ガイドライン表示",
  hideGuidelines: "ガイドライン非表示",
  adjustVertices: "頂点を調整",
  copyImage: "画像をコピー",
  share: "共有する",
  confirm: "確定",
  cancel: "キャンセル",
  imageUploaded: "画像設定済み",
  cover: "Cover",
  contain: "Contain",
  cropInfo: (ratio) => `${ratio}で切り抜き済み`,
  resetCrop: "リセット",
  menu: "メニュー",
  filters: "フィルター",
  showingItems: (count) => `${count}件表示中`,
  clearAll: "クリア",
  deviceType: "デバイス",
  aspectRatio: "アスペクト比",
  colorTheme: "カラー",
  signInWithGoogle: "Googleでサインイン",
  allTemplates: "すべてのテンプレート",
  itemsFound: (count) => `${count}件`,
  aspectRatioGuide: "各SNS投稿前必見！画像比率ガイド",
};

const en: Translations = {
  useThisTemplate: "Use this template",
  noTemplatesFound: "No templates found",
  deviceLabel: (deviceNum) => `Device ${deviceNum}`,
  dropToDevice: (deviceNum) => `Drop to Device ${deviceNum}`,
  selectingDevice: (deviceNum) => `Selecting Device ${deviceNum}`,
  uploadImage: "Upload Image",
  changeImage: "Change Image",
  downloadInRatio: (ratio) => `Download in ${ratio}`,
  downloadWithResizedImage: "Download with Resized Image",
  showGuidelines: "Show Guidelines",
  hideGuidelines: "Hide Guidelines",
  adjustVertices: "Adjust Vertices",
  copyImage: "Copy Image",
  share: "Share",
  confirm: "Confirm",
  cancel: "Cancel",
  imageUploaded: "Image uploaded",
  cover: "Cover",
  contain: "Contain",
  cropInfo: (ratio) => `Cropped to ${ratio}`,
  resetCrop: "Reset",
  menu: "Menu",
  filters: "Filters",
  showingItems: (count) => `Showing ${count} items`,
  clearAll: "Clear all",
  deviceType: "Device Type",
  aspectRatio: "Aspect Ratio",
  colorTheme: "Color",
  signInWithGoogle: "Sign in with Google",
  allTemplates: "All Templates",
  itemsFound: (count) => `${count} items found`,
  aspectRatioGuide: "SNS Post Image Ratio Guide – Must-See!",
};

const zhCN: Translations = {
  useThisTemplate: "使用此模板",
  noTemplatesFound: "未找到模板",
  deviceLabel: (deviceNum) => `设备 ${deviceNum}`,
  dropToDevice: (deviceNum) => `拖放到设备 ${deviceNum}`,
  selectingDevice: (deviceNum) => `正在选择设备 ${deviceNum}`,
  uploadImage: "上传图片",
  changeImage: "更换图片",
  downloadInRatio: (ratio) => `以 ${ratio} 下载`,
  downloadWithResizedImage: "调整图片尺寸后下载",
  showGuidelines: "显示参考线",
  hideGuidelines: "隐藏参考线",
  adjustVertices: "调整顶点",
  copyImage: "复制图片",
  share: "分享",
  confirm: "确认",
  cancel: "取消",
  imageUploaded: "图片已设置",
  cover: "Cover",
  contain: "Contain",
  cropInfo: (ratio) => `已裁剪为 ${ratio}`,
  resetCrop: "重置",
  menu: "菜单",
  filters: "筛选",
  showingItems: (count) => `显示 ${count} 项`,
  clearAll: "清除全部",
  deviceType: "设备类型",
  aspectRatio: "宽高比",
  colorTheme: "颜色",
  signInWithGoogle: "使用 Google 登录",
  allTemplates: "所有模板",
  itemsFound: (count) => `找到 ${count} 项`,
  aspectRatioGuide: "发布前必看！图片比例指南",
};

const zhTW: Translations = {
  useThisTemplate: "使用此範本",
  noTemplatesFound: "未找到範本",
  deviceLabel: (deviceNum) => `裝置 ${deviceNum}`,
  dropToDevice: (deviceNum) => `拖放到裝置 ${deviceNum}`,
  selectingDevice: (deviceNum) => `正在選擇裝置 ${deviceNum}`,
  uploadImage: "上傳圖片",
  changeImage: "更換圖片",
  downloadInRatio: (ratio) => `以 ${ratio} 下載`,
  downloadWithResizedImage: "調整圖片尺寸後下載",
  showGuidelines: "顯示參考線",
  hideGuidelines: "隱藏參考線",
  adjustVertices: "調整頂點",
  copyImage: "複製圖片",
  share: "分享",
  confirm: "確認",
  cancel: "取消",
  imageUploaded: "圖片已設置",
  cover: "Cover",
  contain: "Contain",
  cropInfo: (ratio) => `已裁剪為 ${ratio}`,
  resetCrop: "重置",
  menu: "選單",
  filters: "篩選",
  showingItems: (count) => `顯示 ${count} 項`,
  clearAll: "清除全部",
  deviceType: "裝置類型",
  aspectRatio: "寬高比",
  colorTheme: "顏色",
  signInWithGoogle: "使用 Google 登入",
  allTemplates: "所有範本",
  itemsFound: (count) => `找到 ${count} 項`,
  aspectRatioGuide: "發布前必看！圖片比例指南",
};

const ko: Translations = {
  useThisTemplate: "이 템플릿 사용하기",
  noTemplatesFound: "템플릿을 찾을 수 없습니다",
  deviceLabel: (deviceNum) => `디바이스 ${deviceNum}`,
  dropToDevice: (deviceNum) => `디바이스 ${deviceNum}에 드롭`,
  selectingDevice: (deviceNum) => `디바이스 ${deviceNum} 선택 중`,
  uploadImage: "이미지 업로드",
  changeImage: "이미지 변경",
  downloadInRatio: (ratio) => `${ratio}으로 다운로드`,
  downloadWithResizedImage: "이미지 크기 변경하여 다운로드",
  showGuidelines: "가이드라인 표시",
  hideGuidelines: "가이드라인 숨기기",
  adjustVertices: "꼭짓점 조정",
  copyImage: "이미지 복사",
  share: "공유",
  confirm: "확인",
  cancel: "취소",
  imageUploaded: "이미지 설정됨",
  cover: "Cover",
  contain: "Contain",
  cropInfo: (ratio) => `${ratio}로 자르기 완료`,
  resetCrop: "초기화",
  menu: "메뉴",
  filters: "필터",
  showingItems: (count) => `${count}개 표시 중`,
  clearAll: "전체 해제",
  deviceType: "디바이스 유형",
  aspectRatio: "종횡비",
  colorTheme: "색상",
  signInWithGoogle: "Google로 로그인",
  allTemplates: "모든 템플릿",
  itemsFound: (count) => `${count}개 항목`,
  aspectRatioGuide: "SNS 게시 전 필독! 이미지 비율 가이드",
};

export const translations: Record<SupportedLanguage, Translations> = {
  ja,
  en,
  "zh-CN": zhCN,
  "zh-TW": zhTW,
  ko,
};

// LocalStorage key for language preference
const LANG_STORAGE_KEY = "mockup_language";

/**
 * Get current language from localStorage or browser default
 */
export function getCurrentLanguage(): SupportedLanguage {
  const stored = localStorage.getItem(LANG_STORAGE_KEY);
  if (stored && isValidLanguage(stored)) {
    return stored as SupportedLanguage;
  }
  // Default to Japanese
  return "ja";
}

/**
 * Set language and reload page
 */
export function setLanguageAndReload(lang: SupportedLanguage): void {
  localStorage.setItem(LANG_STORAGE_KEY, lang);
  window.location.reload();
}

/**
 * Check if a string is a valid supported language
 */
export function isValidLanguage(lang: string): lang is SupportedLanguage {
  return ["ja", "en", "zh-CN", "zh-TW", "ko"].includes(lang);
}

/**
 * Get translations for current language
 */
export function getTranslations(): Translations {
  const lang = getCurrentLanguage();
  return translations[lang];
}

/**
 * Hook-like function to get current language and translations
 */
export function useTranslations(): { lang: SupportedLanguage; t: Translations } {
  const lang = getCurrentLanguage();
  return { lang, t: translations[lang] };
}
