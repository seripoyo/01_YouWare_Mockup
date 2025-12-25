/**
 * モバイルデバイス対応のユーティリティ関数
 * iOS Safari、Android、デスクトップで画像保存が正しく動作するように実装
 */

/**
 * 画像をデバイスに保存する
 * プラットフォームに応じて最適な保存方法を自動選択
 *
 * @param dataURL - 保存する画像のdata URLまたはblob URL
 * @param filename - 保存時のファイル名
 * @returns 保存成功の場合true
 */
export const saveImageToDevice = async (
  dataURL: string,
  filename = "photo.png"
): Promise<boolean> => {
  // 【1】プラットフォーム検出
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isMobile = isIOS || isAndroid;

  // 【2】data URLをBlobに変換（全プラットフォーム共通）
  let blob: Blob | null = null;
  if (dataURL.startsWith('data:') || dataURL.startsWith('blob:')) {
    try {
      const response = await fetch(dataURL);
      blob = await response.blob();
    } catch (err) {
      console.warn("Blob conversion failed:", err);
    }
  }

  // 【3】モバイル: Web Share API（最優先）
  if (isMobile && navigator.share && blob) {
    try {
      const file = new File([blob], filename, {
        type: blob.type || 'image/png'
      });

      // canShareチェックを省略（より寛容に）
      await navigator.share({
        files: [file],
        title: filename,
      });
      return true;
    } catch (error: unknown) {
      const err = error as Error;
      // AbortError = ユーザーがキャンセル → 成功扱い
      if (err?.name === 'AbortError') {
        console.log("User cancelled share");
        return true;
      }
      // その他のエラー → 次の方法にフォールバック
      console.log("Web Share API failed:", err?.message);
    }
  }

  // 【4】デスクトップ/Android: Anchor Download
  if (!isIOS) {
    try {
      let downloadUrl = dataURL;

      // Blobがあればblob URLを使用
      if (blob) {
        downloadUrl = URL.createObjectURL(blob);
      }

      const link = document.createElement("a");
      link.download = filename;
      link.href = downloadUrl;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();

      // クリーンアップ
      setTimeout(() => {
        document.body.removeChild(link);
        if (downloadUrl.startsWith('blob:')) {
          URL.revokeObjectURL(downloadUrl);
        }
      }, 100);

      return true;
    } catch (error) {
      console.error("Anchor download failed:", error);
    }
  }

  // 【5】iOS Safari専用フォールバック
  if (isIOS) {
    try {
      let imageUrl = dataURL;
      if (blob) {
        imageUrl = URL.createObjectURL(blob);
      }

      // 新規タブで専用ページを開く
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
            <title>画像を保存</title>
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #000;
                min-height: 100vh;
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 20px;
                padding-top: env(safe-area-inset-top, 20px);
                padding-bottom: env(safe-area-inset-bottom, 20px);
              }
              .close-btn {
                position: fixed;
                top: max(12px, env(safe-area-inset-top));
                right: 12px;
                width: 36px;
                height: 36px;
                border-radius: 50%;
                background: rgba(255,255,255,0.9);
                border: none;
                font-size: 24px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 100;
                color: #333;
              }
              .instructions {
                background: rgba(255,255,255,0.95);
                padding: 16px 24px;
                border-radius: 16px;
                margin-bottom: 20px;
                text-align: center;
                max-width: 320px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
              }
              .instructions h2 {
                font-size: 18px;
                color: #007AFF;
                margin-bottom: 8px;
              }
              .instructions p {
                font-size: 14px;
                color: #333;
                line-height: 1.5;
              }
              .instructions strong {
                color: #007AFF;
              }
              .image-container {
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 100%;
              }
              img {
                max-width: 100%;
                max-height: 65vh;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.4);
              }
            </style>
          </head>
          <body>
            <button class="close-btn" onclick="window.close()">×</button>
            <div class="instructions">
              <h2>📱 画像を保存する方法</h2>
              <p>下の画像を<strong>長押し</strong>して<br>「"写真"に追加」を選択してください</p>
            </div>
            <div class="image-container">
              <img src="${imageUrl}" alt="保存する画像">
            </div>
          </body>
          </html>
        `);
        newWindow.document.close();
        return true;
      }
    } catch (error) {
      console.error("iOS fallback failed:", error);
    }
  }

  // すべての方法が失敗
  return false;
};

/**
 * デバイスを振動させる（対応デバイスのみ）
 * @param duration - 振動時間（ミリ秒）
 */
export const vibrate = (duration: number = 50): void => {
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(duration);
    } catch (e) {
      // iOS等、非対応デバイスでは無視
    }
  }
};

/**
 * ハプティックフィードバック（触覚フィードバック）
 * @param intensity - 強度 ('light' | 'medium' | 'heavy')
 */
export const hapticFeedback = (intensity: 'light' | 'medium' | 'heavy' = 'medium'): void => {
  const durations = {
    light: 10,
    medium: 25,
    heavy: 50
  };
  vibrate(durations[intensity]);
};

/**
 * モバイルデバイスかどうかを判定
 */
export const isMobileDevice = (): boolean => {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
};

/**
 * iOSデバイスかどうかを判定
 */
export const isIOSDevice = (): boolean => {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
};

/**
 * Androidデバイスかどうかを判定
 */
export const isAndroidDevice = (): boolean => {
  return /Android/i.test(navigator.userAgent);
};
