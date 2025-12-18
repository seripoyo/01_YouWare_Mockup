/**
 * デバイス表示デバッグコンポーネント
 * デバイス表示問題を診断・解決するためのツール
 */

import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle, RefreshCw, Trash2, Info } from 'lucide-react';

interface DebugCheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: string[];
  action?: () => void;
  actionLabel?: string;
}

export const DeviceDebugger: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [checks, setChecks] = useState<DebugCheckResult[]>([]);
  const [isChecking, setIsChecking] = useState(false);

  const runDiagnostics = async () => {
    setIsChecking(true);
    const results: DebugCheckResult[] = [];

    // 1. DOM要素のチェック
    const domCheck = checkDOMElements();
    results.push(domCheck);

    // 2. ローカルストレージのチェック
    const storageCheck = checkLocalStorage();
    results.push(storageCheck);

    // 3. Viteキャッシュのチェック
    const cacheCheck = checkViteCache();
    results.push(cacheCheck);

    // 4. デバイス表示要素のチェック
    const deviceDisplayCheck = checkDeviceDisplayElements();
    results.push(deviceDisplayCheck);

    setChecks(results);
    setIsChecking(false);
  };

  const checkDOMElements = (): DebugCheckResult => {
    const elements = document.querySelectorAll('[class*="device"], [id*="device"]');
    const problematicElements: string[] = [];

    elements.forEach(el => {
      const text = el.textContent || '';
      // 不正な表示パターンをチェック
      if (/dev\d+\.\w+/.test(text)) {
        problematicElements.push(`Element: ${el.tagName}, Class: ${el.className}`);
      }
    });

    if (problematicElements.length > 0) {
      return {
        name: 'DOM要素チェック',
        status: 'fail',
        message: `${problematicElements.length}個の要素で問題を検出`,
        details: problematicElements,
        action: () => window.location.reload(),
        actionLabel: 'ページをリロード'
      };
    }

    return {
      name: 'DOM要素チェック',
      status: 'pass',
      message: 'すべてのデバイス表示が正常です'
    };
  };

  const checkLocalStorage = (): DebugCheckResult => {
    const keys = Object.keys(localStorage);
    const suspiciousKeys: string[] = [];

    keys.forEach(key => {
      const value = localStorage.getItem(key) || '';
      // 不正なパターンをチェック
      if (/dev\d+\.\w+/.test(value)) {
        suspiciousKeys.push(`Key: ${key}`);
      }
    });

    if (suspiciousKeys.length > 0) {
      return {
        name: 'ローカルストレージ',
        status: 'warning',
        message: '問題のある参照が見つかりました',
        details: suspiciousKeys,
        action: () => {
          if (confirm('ローカルストレージをクリアしますか？')) {
            localStorage.clear();
            window.location.reload();
          }
        },
        actionLabel: 'ストレージをクリア'
      };
    }

    return {
      name: 'ローカルストレージ',
      status: 'pass',
      message: 'クリーンな状態です'
    };
  };

  const checkViteCache = (): DebugCheckResult => {
    // Viteの開発サーバーキャッシュをチェック
    const viteClientScript = document.querySelector('script[type="module"][src*="@vite"]');

    if (viteClientScript) {
      const src = viteClientScript.getAttribute('src') || '';
      const hasTimestamp = src.includes('t=');

      if (!hasTimestamp) {
        return {
          name: 'Viteキャッシュ',
          status: 'warning',
          message: 'キャッシュバスティングが無効の可能性',
          details: ['Viteの開発サーバーを再起動することを推奨'],
          action: () => {
            console.info('開発サーバーを手動で再起動してください');
          },
          actionLabel: 'コンソールに指示を表示'
        };
      }
    }

    return {
      name: 'Viteキャッシュ',
      status: 'pass',
      message: 'キャッシュバスティング有効'
    };
  };

  const checkDeviceDisplayElements = (): DebugCheckResult => {
    const deviceElements = document.querySelectorAll('[class*="デバイス"], [aria-label*="Device"]');
    const correctDisplays: string[] = [];
    const incorrectDisplays: string[] = [];

    deviceElements.forEach(el => {
      const text = el.textContent || '';
      if (text.match(/デバイス\s*[1-3]/)) {
        correctDisplays.push(text);
      } else if (/dev\d*/.test(text)) {
        incorrectDisplays.push(`問題: "${text}"`);
      }
    });

    if (incorrectDisplays.length > 0) {
      return {
        name: 'デバイス表示テキスト',
        status: 'fail',
        message: `${incorrectDisplays.length}個の不正な表示`,
        details: incorrectDisplays,
        action: () => {
          // 強制的にテキストを修正
          deviceElements.forEach(el => {
            const text = el.textContent || '';
            const match = text.match(/dev(\d)/);
            if (match) {
              const num = parseInt(match[1]) + 1;
              el.textContent = `デバイス ${num}`;
            }
          });
          alert('表示を一時的に修正しました。根本解決にはキャッシュクリアが必要です。');
        },
        actionLabel: '表示を修正'
      };
    }

    return {
      name: 'デバイス表示テキスト',
      status: 'pass',
      message: `${correctDisplays.length}個の正常な表示`,
      details: correctDisplays
    };
  };

  const clearAllCaches = async () => {
    if (!confirm('すべてのキャッシュをクリアして再起動しますか？')) return;

    try {
      // 1. ローカルストレージクリア
      localStorage.clear();

      // 2. セッションストレージクリア
      sessionStorage.clear();

      // 3. Service Workerキャッシュクリア
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }

      // 4. ハードリロード
      window.location.reload();
    } catch (error) {
      console.error('キャッシュクリアエラー:', error);
      alert('キャッシュクリアに失敗しました');
    }
  };

  useEffect(() => {
    // 初回実行
    runDiagnostics();
  }, []);

  return (
    <>
      {/* デバッグボタン（固定位置） */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-50 bg-purple-600 text-white p-3 rounded-full shadow-lg hover:bg-purple-700 transition-colors"
        title="デバイスデバッガー"
      >
        <AlertTriangle className="w-6 h-6" />
      </button>

      {/* デバッグパネル */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="bg-purple-600 text-white p-4 flex justify-between items-center">
              <h2 className="text-xl font-bold">🔍 デバイス表示デバッガー</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white hover:bg-purple-700 p-1 rounded"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[calc(80vh-120px)]">
              {/* 問題の説明 */}
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-sm">
                  <strong>問題:</strong> デバイス番号が正しく表示されない
                </p>
                <p className="text-sm mt-1">
                  <strong>原因:</strong> ビルドキャッシュまたはブラウザキャッシュの問題
                </p>
              </div>

              {/* アクションボタン */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={runDiagnostics}
                  disabled={isChecking}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
                  診断を実行
                </button>
                <button
                  onClick={clearAllCaches}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                  全キャッシュクリア
                </button>
              </div>

              {/* 診断結果 */}
              <div className="space-y-3">
                {checks.map((check, index) => (
                  <div
                    key={index}
                    className={`border rounded p-3 ${
                      check.status === 'pass' ? 'border-green-300 bg-green-50' :
                      check.status === 'warning' ? 'border-yellow-300 bg-yellow-50' :
                      'border-red-300 bg-red-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-2">
                        {check.status === 'pass' && <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />}
                        {check.status === 'warning' && <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />}
                        {check.status === 'fail' && <XCircle className="w-5 h-5 text-red-600 mt-0.5" />}
                        <div className="flex-1">
                          <h3 className="font-semibold">{check.name}</h3>
                          <p className="text-sm text-gray-600 mt-1">{check.message}</p>
                          {check.details && check.details.length > 0 && (
                            <ul className="mt-2 text-xs text-gray-500 space-y-1">
                              {check.details.map((detail, i) => (
                                <li key={i}>• {detail}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                      {check.action && (
                        <button
                          onClick={check.action}
                          className="ml-2 px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50"
                        >
                          {check.actionLabel}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* 手動修正手順 */}
              <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded">
                <h3 className="font-semibold flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  手動修正手順
                </h3>
                <ol className="mt-2 text-sm space-y-1">
                  <li>1. 開発サーバーを停止（Ctrl+C）</li>
                  <li>2. <code className="bg-gray-200 px-1">rm -rf node_modules/.vite</code></li>
                  <li>3. <code className="bg-gray-200 px-1">npm run build</code></li>
                  <li>4. <code className="bg-gray-200 px-1">npm run dev</code></li>
                  <li>5. ブラウザのキャッシュをクリア（Ctrl+Shift+Delete）</li>
                  <li>6. ページをリロード（Ctrl+F5）</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
