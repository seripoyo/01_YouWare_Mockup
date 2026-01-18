import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "@edgespark/client/styles.css"; // EdgeSpark auth UI styles
import App from "./App.tsx";

/**
 * ローディング画面を非表示にし、アプリコンテンツを表示する
 * フォント読み込み完了を待ってからフェードアウト
 */
function hideLoadingScreen() {
  const loadingScreen = document.getElementById("loading-screen");

  // ローディング画面をフェードアウト
  if (loadingScreen) {
    loadingScreen.classList.add("fade-out");
  }

  // bodyにapp-loadedクラスを追加してReactコンテンツを表示
  // ローディング画面のフェードアウトと同時にコンテンツをフェードイン
  document.body.classList.add("app-loaded");

  // ローディング画面のアニメーション完了後にDOMから削除
  if (loadingScreen) {
    setTimeout(() => {
      loadingScreen.remove();
    }, 500);
  }
}

/**
 * フォント読み込みを待つ
 */
async function waitForFonts(): Promise<void> {
  // document.fonts APIがサポートされている場合
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }
  // 少し待って確実にフォントを適用
  return new Promise((resolve) => setTimeout(resolve, 100));
}

// Reactアプリをレンダリング
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// アプリ開始時刻を記録
const appStartTime = performance.now();

// フォント読み込み完了後にローディング画面を非表示
waitForFonts().then(() => {
  // 【一時的に無効化】ローディングアニメーション調整用
  // 調整完了後、以下のreturnを削除してください
  // return;

  // 最低でも800ms表示してユーザーにローディングを認識させる
  const minDisplayTime = 800;
  const elapsed = performance.now() - appStartTime;
  const remainingTime = Math.max(0, minDisplayTime - elapsed);

  setTimeout(hideLoadingScreen, remainingTime);
});
