import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { WhiteMarginAnalysis, DeviceOrientationAnalysis } from '../features/mockup/utils/debugAnalysis';

interface DeviceRegionState {
  rect: { xPct: number; yPct: number; wPct: number; hPct: number };
  fillColor: string;
  deviceIndex: number;
  isActive: boolean;
  imageUrl?: string | null;
  imageNatural?: { w: number; h: number };
}

interface DebugPanelProps {
  whiteMarginAnalyses: WhiteMarginAnalysis[];
  orientationAnalyses: DeviceOrientationAnalysis[];
  isVisible: boolean;
  selectedDeviceIndex?: number | null;
  deviceRegions?: DeviceRegionState[];
}

export const DebugPanel: React.FC<DebugPanelProps> = ({
  whiteMarginAnalyses,
  orientationAnalyses,
  isVisible,
  selectedDeviceIndex,
  deviceRegions
}) => {
  const [panelHeight, setPanelHeight] = useState(250); // 初期高さを250pxに設定
  const [isResizing, setIsResizing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  // Hooksを先に定義（早期returnの前に配置）
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startYRef.current = e.clientY;
    startHeightRef.current = panelHeight;
  }, [panelHeight]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const deltaY = startYRef.current - e.clientY;
      const newHeight = Math.min(Math.max(startHeightRef.current + deltaY, 100), window.innerHeight - 100);
      setPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ns-resize';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
    };
  }, [isResizing]);

  // 早期returnはすべてのHooksの後に配置
  if (!isVisible) return null;

  // 選択されたデバイスの情報を取得
  const selectedDevice = selectedDeviceIndex !== null && selectedDeviceIndex !== undefined
    ? deviceRegions?.[selectedDeviceIndex]
    : null;
  const selectedWhiteMargin = selectedDeviceIndex !== null && selectedDeviceIndex !== undefined
    ? whiteMarginAnalyses.find(a => a.deviceIndex === selectedDeviceIndex)
    : null;
  const selectedOrientation = selectedDeviceIndex !== null && selectedDeviceIndex !== undefined
    ? orientationAnalyses.find(a => a.deviceIndex === selectedDeviceIndex)
    : null;

  return (
    <div
      ref={panelRef}
      className="fixed bottom-0 left-0 right-0 bg-black bg-opacity-90 text-white z-50"
      style={{ height: isCollapsed ? '40px' : `${panelHeight}px` }}
    >
      {/* リサイズハンドル */}
      <div
        className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-blue-500 hover:bg-opacity-30 transition-colors"
        onMouseDown={handleMouseDown}
        style={{ cursor: 'ns-resize' }}
      >
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-12 h-1 bg-gray-500 rounded-full"></div>
      </div>

      {/* ヘッダー部分 */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <h3 className="text-lg font-bold flex items-center">
          🔍 デバッグ分析結果
          {selectedDeviceIndex !== null && selectedDeviceIndex !== undefined && (
            <span className="ml-2 text-yellow-400">
              （デバイス {selectedDeviceIndex + 1} を選択中）
            </span>
          )}
        </h3>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors"
        >
          {isCollapsed ? '展開 ▲' : '折りたたみ ▼'}
        </button>
      </div>

      {/* コンテンツ部分 */}
      <div
        className={`px-4 pb-4 overflow-y-auto ${isCollapsed ? 'hidden' : ''}`}
        style={{ maxHeight: `${panelHeight - 50}px` }}
      >

      {/* 選択されたデバイスの詳細情報を最優先で表示 */}
      {selectedDevice && (
        <div className="mb-4 p-3 bg-blue-900 bg-opacity-50 border-2 border-blue-400 rounded-lg">
          <h4 className="text-md font-semibold mb-2 text-blue-300">
            📱 選択中のデバイス {selectedDeviceIndex! + 1}
          </h4>

          {selectedOrientation && (
            <div className="mb-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="font-semibold text-cyan-400">デバイス種類:</span>{' '}
                  <span className="text-white font-bold text-lg">{selectedOrientation.deviceType}</span>
                </div>
                <div>
                  <span className="font-semibold text-cyan-400">信頼度:</span>{' '}
                  <span className="text-yellow-300 font-bold">{((selectedOrientation.confidence || 0) * 100).toFixed(0)}%</span>
                </div>
                <div>
                  <span className="font-semibold text-cyan-400">デバイス回転角度:</span>{' '}
                  <span className="text-white">{Math.round(selectedOrientation.deviceRotation)}°</span>
                </div>
                <div>
                  <span className="font-semibold text-cyan-400">アスペクト比:</span>{' '}
                  <span className="text-white">{selectedOrientation.analysisDetails.aspectRatio.toFixed(2)}</span>
                </div>
                <div>
                  <span className="font-semibold text-cyan-400">推奨画像回転:</span>{' '}
                  <span className="text-yellow-300 font-bold">{Math.round(selectedOrientation.recommendedImageRotation)}°</span>
                </div>
                <div>
                  <span className="font-semibold text-cyan-400">向き:</span>{' '}
                  <span className="text-white">
                    {selectedOrientation.analysisDetails.isPortrait ? '縦向き' :
                     selectedOrientation.analysisDetails.isLandscape ? '横向き' : '正方形'}
                  </span>
                </div>
              </div>

              {/* 詳細な分析結果を表示 */}
              {(selectedOrientation.analysisDetails as any)?.deviceAnalysis && (
                <div className="mt-3 p-3 bg-gray-900 rounded-lg border border-gray-700">
                  <div className="font-semibold text-yellow-400 mb-2">📊 デバイス判定理由:</div>
                  <div className="text-green-400 mb-2">
                    {(selectedOrientation.analysisDetails as any).deviceAnalysis.reasoning.primary}
                  </div>
                  <div className="text-xs text-gray-300">
                    <div className="font-semibold text-cyan-400 mb-1">判定要因:</div>
                    {(selectedOrientation.analysisDetails as any).deviceAnalysis.reasoning.factors.map((factor: string, i: number) => (
                      <div key={i} className="ml-2 mb-1">• {factor}</div>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-blue-300">
                    <div className="font-semibold text-cyan-400 mb-1">デバイス寸法:</div>
                    <div className="ml-2">
                      幅: {((selectedOrientation.analysisDetails as any).deviceAnalysis.dimensions.widthPercent).toFixed(1)}% /
                      高さ: {((selectedOrientation.analysisDetails as any).deviceAnalysis.dimensions.heightPercent).toFixed(1)}% /
                      面積: {((selectedOrientation.analysisDetails as any).deviceAnalysis.dimensions.pixelArea).toFixed(1)}%
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {selectedWhiteMargin && (
            <div className="mt-2 text-sm">
              <div className="font-semibold text-cyan-400">白い余白:</div>
              {selectedWhiteMargin.hasWhiteMargin ? (
                <div className="text-red-400 ml-2">
                  ⚠️ 検出あり (推奨ブリード: {selectedWhiteMargin.requiredBleedPercentage}%)
                </div>
              ) : (
                <div className="text-green-400 ml-2">✓ なし</div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 白い余白分析 */}
        <div>
          <h4 className="text-md font-semibold mb-2 text-yellow-400">📐 白い余白検出</h4>
          {whiteMarginAnalyses.map((analysis, index) => (
            <div key={index} className="mb-3 p-2 border border-gray-600 rounded">
              <div className="text-sm">
                <div className="font-semibold text-cyan-400">デバイス {analysis.deviceIndex + 1}</div>

                {analysis.hasWhiteMargin ? (
                  <div className="text-red-400">
                    ⚠️ 白い余白が検出されました！
                    <div className="ml-4 mt-1">
                      <div>上: {analysis.marginLocations.top}px</div>
                      <div>下: {analysis.marginLocations.bottom}px</div>
                      <div>左: {analysis.marginLocations.left}px</div>
                      <div>右: {analysis.marginLocations.right}px</div>
                      <div className="font-bold text-yellow-400 mt-1">
                        推奨ブリード: {analysis.requiredBleedPercentage}%
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-green-400">✓ 余白なし</div>
                )}

                <div className="text-xs text-gray-400 mt-1">
                  白ピクセル: {analysis.detectedWhitePixels}/{analysis.totalEdgePixels}
                  ({(analysis.whitePixelRatio * 100).toFixed(2)}%)
                </div>

                {analysis.recommendations.length > 0 && (
                  <div className="mt-2 text-xs">
                    <div className="font-semibold">推奨事項:</div>
                    {analysis.recommendations.map((rec, i) => (
                      <div key={i} className="ml-2">• {rec}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* デバイス向き分析 */}
        <div>
          <h4 className="text-md font-semibold mb-2 text-green-400">🧭 デバイス向き分析</h4>
          {orientationAnalyses.map((analysis, index) => (
            <div key={index} className="mb-3 p-2 border border-gray-600 rounded">
              <div className="text-sm">
                <div className="font-semibold text-cyan-400">
                  デバイス {analysis.deviceIndex + 1} ({analysis.deviceType})
                </div>

                <div className="ml-4 mt-1">
                  <div>デバイス回転: {Math.round(analysis.deviceRotation)}°</div>
                  <div>主軸角度: {Math.round(analysis.majorAxisAngle)}°</div>

                  {analysis.notchPosition.angle > 0 && (
                    <div className="text-yellow-400">
                      ノッチ位置: ({Math.round(analysis.notchPosition.x)}, {Math.round(analysis.notchPosition.y)})
                      <br />
                      ノッチ角度: {Math.round(analysis.notchPosition.angle)}°
                    </div>
                  )}

                  <div className="font-bold text-green-400 mt-1">
                    推奨画像回転: {Math.round(analysis.recommendedImageRotation)}°
                  </div>
                </div>

                <div className="text-xs text-gray-400 mt-1">
                  アスペクト比: {analysis.analysisDetails.aspectRatio.toFixed(2)}
                  {analysis.analysisDetails.isPortrait && ' (縦向き)'}
                  {analysis.analysisDetails.isLandscape && ' (横向き)'}
                  {analysis.analysisDetails.isDiagonal && ' (斜め)'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* サマリー */}
      <div className="mt-4 pt-4 border-t border-gray-600">
        <h4 className="text-md font-semibold mb-2">📊 サマリー</h4>
        <div className="text-sm">
          {whiteMarginAnalyses.filter(a => a.hasWhiteMargin).length > 0 ? (
            <div className="text-red-400">
              ⚠️ {whiteMarginAnalyses.filter(a => a.hasWhiteMargin).length}個のデバイスで白い余白が検出されました
            </div>
          ) : (
            <div className="text-green-400">
              ✓ すべてのデバイスで余白なし
            </div>
          )}

          <div className="mt-1">
            画像回転が必要なデバイス: {
              orientationAnalyses.filter(a => a.recommendedImageRotation !== 0).length
            }個
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};