import React, { useEffect, useState, useRef, useCallback } from 'react';

interface DebugEvent {
  timestamp: string;
  type: 'state' | 'event' | 'render' | 'analysis' | 'error';
  component: string;
  action: string;
  details: any;
  level: 'info' | 'warning' | 'error' | 'success';
}

import type { DeviceAnalysisMetrics } from '../types/debug';

interface EnhancedDebugPanelProps {
  isVisible: boolean;
  debugMode: boolean;
  selectedDeviceIndex: number | null;
  deviceRegions: Array<{
    deviceIndex: number;
    rect: { xPct: number; yPct: number; wPct: number; hPct: number } | null;
    fillColor: string;
    imageUrl?: string | null;
    imageNatural?: { w: number; h: number } | null;
    deviceType?: string;
    deviceTypeConfidence?: number;
    detectionReasoning?: string;
    verticalDirection?: string;
    shapePattern?: string;
    analysisMetrics?: DeviceAnalysisMetrics;
  }>;
  whiteMarginAnalyses: any[];
  orientationAnalyses: any[];
  onDebugEvent?: (event: DebugEvent) => void;
}

export const EnhancedDebugPanel: React.FC<EnhancedDebugPanelProps> = ({
  isVisible,
  debugMode,
  selectedDeviceIndex,
  deviceRegions,
  whiteMarginAnalyses,
  orientationAnalyses,
  onDebugEvent
}) => {
  const [debugEvents, setDebugEvents] = useState<DebugEvent[]>([]);
  const [expandedSections, setExpandedSections] = useState({
    events: true,
    state: true,
    analysis: true,
    diagnostic: true
  });
  const [panelHeight, setPanelHeight] = useState(200); // 初期高さを200pxに設定
  const [isResizing, setIsResizing] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  // デバッグイベントを記録
  const logDebugEvent = (event: Omit<DebugEvent, 'timestamp'>) => {
    const fullEvent = {
      ...event,
      timestamp: new Date().toISOString()
    };
    setDebugEvents(prev => [...prev.slice(-50), fullEvent]);
    onDebugEvent?.(fullEvent);
  };

  // コンポーネントマウント時のログ
  useEffect(() => {
    logDebugEvent({
      type: 'render',
      component: 'EnhancedDebugPanel',
      action: 'mount',
      details: {
        isVisible,
        debugMode,
        selectedDeviceIndex,
        deviceRegionsCount: deviceRegions?.length || 0,
        hasAnalyses: {
          whiteMargin: whiteMarginAnalyses?.length > 0,
          orientation: orientationAnalyses?.length > 0
        }
      },
      level: 'info'
    });
  }, []);

  // プロップスの変更を監視
  useEffect(() => {
    logDebugEvent({
      type: 'state',
      component: 'EnhancedDebugPanel',
      action: 'props_changed',
      details: {
        isVisible,
        debugMode,
        selectedDeviceIndex,
        deviceRegionsCount: deviceRegions?.length || 0,
        whiteMarginCount: whiteMarginAnalyses?.length || 0,
        orientationCount: orientationAnalyses?.length || 0
      },
      level: selectedDeviceIndex !== null ? 'success' : 'info'
    });
  }, [isVisible, debugMode, selectedDeviceIndex, deviceRegions, whiteMarginAnalyses, orientationAnalyses]);

  // リサイズハンドリング
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

  // デバッグモードがOFFの場合は最小限の表示
  if (!debugMode) {
    return (
      <div className="fixed bottom-4 right-4 bg-red-600 text-white px-3 py-1 rounded-full text-xs z-50">
        Debug Mode OFF
      </div>
    );
  }

  // パネル表示状態の診断
  const diagnosticInfo = {
    'Debug Mode': debugMode ? '✅ ON' : '❌ OFF',
    'Panel Visible': isVisible ? '✅ Yes' : '❌ No',
    'Selected Device': selectedDeviceIndex !== null ? `✅ Device ${selectedDeviceIndex + 1}` : '❌ None',
    'Device Regions': `${deviceRegions?.length || 0} regions`,
    'White Margin Analyses': `${whiteMarginAnalyses?.length || 0} items`,
    'Orientation Analyses': `${orientationAnalyses?.length || 0} items`,
    'Has Selected Data': selectedDeviceIndex !== null && deviceRegions?.[selectedDeviceIndex] ? '✅' : '❌'
  };

  const selectedDevice = selectedDeviceIndex !== null ? deviceRegions?.[selectedDeviceIndex] : null;
  const selectedWhiteMargin = selectedDeviceIndex !== null
    ? whiteMarginAnalyses?.find(a => a.deviceIndex === selectedDeviceIndex)
    : null;
  const selectedOrientation = selectedDeviceIndex !== null
    ? orientationAnalyses?.find(a => a.deviceIndex === selectedDeviceIndex)
    : null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 bg-black bg-opacity-95 text-white z-50"
      style={{ height: isMinimized ? '40px' : `${panelHeight}px` }}
    >
      {/* リサイズハンドル */}
      <div
        className="absolute top-0 left-0 right-0 h-3 cursor-ns-resize hover:bg-purple-500 hover:bg-opacity-30 transition-colors"
        onMouseDown={handleMouseDown}
      >
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-1 bg-purple-400 rounded-full"></div>
      </div>

      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-3 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold flex items-center gap-2">
            🔬 Enhanced Debug Panel
            <span className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded">
              {debugEvents.length} events
            </span>
          </h3>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-xs">
              <span className={`px-2 py-1 rounded ${debugMode ? 'bg-green-500' : 'bg-red-500'}`}>
                Debug: {debugMode ? 'ON' : 'OFF'}
              </span>
              <span className={`px-2 py-1 rounded ${isVisible ? 'bg-green-500' : 'bg-yellow-500'}`}>
                Panel: {isVisible ? 'VISIBLE' : 'HIDDEN'}
              </span>
            </div>
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors"
            >
              {isMinimized ? '展開 ▲' : '折りたたみ ▼'}
            </button>
          </div>
        </div>
      </div>

      <div
        className={`p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto ${isMinimized ? 'hidden' : ''}`}
        style={{ maxHeight: isMinimized ? '0' : `${panelHeight - 60}px` }}
      >
        {/* 診断情報セクション */}
        <div className="bg-gray-900 rounded-lg p-3">
          <div
            className="flex items-center justify-between mb-2 cursor-pointer"
            onClick={() => setExpandedSections(prev => ({ ...prev, diagnostic: !prev.diagnostic }))}
          >
            <h4 className="font-semibold text-yellow-400">📊 Diagnostic Info</h4>
            <span>{expandedSections.diagnostic ? '▼' : '▶'}</span>
          </div>
          {expandedSections.diagnostic && (
            <div className="text-xs space-y-1">
              {Object.entries(diagnosticInfo).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-gray-400">{key}:</span>
                  <span className="font-mono">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 選択中のデバイス情報 */}
        <div className="bg-gray-900 rounded-lg p-3">
          <div
            className="flex items-center justify-between mb-2 cursor-pointer"
            onClick={() => setExpandedSections(prev => ({ ...prev, state: !prev.state }))}
          >
            <h4 className="font-semibold text-blue-400">🎯 Selected Device</h4>
            <span>{expandedSections.state ? '▼' : '▶'}</span>
          </div>
          {expandedSections.state && (
            <div className="text-xs space-y-1">
              {selectedDevice ? (
                <>
                  <div>Index: {selectedDeviceIndex}</div>
                  <div>Fill Color: {selectedDevice.fillColor}</div>
                  <div>Active: {selectedDevice.isActive ? '✅' : '❌'}</div>
                  <div>Has Image: {selectedDevice.imageUrl ? '✅' : '❌'}</div>
                  <div>Has Rect: {selectedDevice.rect ? '✅' : '❌'}</div>
                  {selectedDevice.rect && (
                    <>
                      <div>Rect X: {(selectedDevice.rect.xPct * 100).toFixed(1)}%</div>
                      <div>Rect Y: {(selectedDevice.rect.yPct * 100).toFixed(1)}%</div>
                      <div>Rect W: {(selectedDevice.rect.wPct * 100).toFixed(1)}%</div>
                      <div>Rect H: {(selectedDevice.rect.hPct * 100).toFixed(1)}%</div>
                    </>
                  )}
                </>
              ) : (
                <div className="text-yellow-400">No device selected</div>
              )}
            </div>
          )}
        </div>

        {/* 分析データ */}
        <div className="bg-gray-900 rounded-lg p-3">
          <div
            className="flex items-center justify-between mb-2 cursor-pointer"
            onClick={() => setExpandedSections(prev => ({ ...prev, analysis: !prev.analysis }))}
          >
            <h4 className="font-semibold text-green-400">📈 Analysis Data</h4>
            <span>{expandedSections.analysis ? '▼' : '▶'}</span>
          </div>
          {expandedSections.analysis && (
            <div className="text-xs space-y-2">
              <div className="border-t border-gray-700 pt-1">
                <div className="font-semibold text-cyan-400">Orientation:</div>
                {selectedOrientation ? (
                  <>
                    <div>Type: {selectedOrientation.deviceType}</div>
                    <div>Rotation: {selectedOrientation.deviceRotation}°</div>
                    <div>Aspect: {selectedOrientation.analysisDetails?.aspectRatio?.toFixed(2)}</div>
                    <div>Portrait: {selectedOrientation.analysisDetails?.isPortrait ? '✅' : '❌'}</div>
                    <div>Confidence: {((selectedOrientation.confidence || 0) * 100).toFixed(0)}%</div>

                    {/* 詳細な分析結果を表示 */}
                    {(selectedOrientation.analysisDetails as any)?.deviceAnalysis && (
                      <div className="mt-2 p-2 bg-gray-800 rounded text-xs">
                        <div className="font-semibold text-yellow-400 mb-1">📊 Detection Reasoning:</div>
                        <div className="text-green-400">
                          {(selectedOrientation.analysisDetails as any).deviceAnalysis.reasoning.primary}
                        </div>
                        <div className="mt-1 text-gray-400">
                          {(selectedOrientation.analysisDetails as any).deviceAnalysis.reasoning.factors.map((factor: string, i: number) => (
                            <div key={i}>• {factor}</div>
                          ))}
                        </div>
                        <div className="mt-1 text-blue-400">
                          <div>Width: {((selectedOrientation.analysisDetails as any).deviceAnalysis.dimensions.widthPercent).toFixed(1)}%</div>
                          <div>Height: {((selectedOrientation.analysisDetails as any).deviceAnalysis.dimensions.heightPercent).toFixed(1)}%</div>
                          <div>Area: {((selectedOrientation.analysisDetails as any).deviceAnalysis.dimensions.pixelArea).toFixed(1)}%</div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-gray-500">No orientation data</div>
                )}
              </div>

              {selectedDevice?.analysisMetrics && (
                <div className="border-t border-gray-700 pt-1">
                  <div className="font-semibold text-cyan-400">Detection Metrics:</div>
                  <div className="text-xs text-gray-300 space-y-1 mt-1">
                    <div>Aspect Ratio: {selectedDevice.analysisMetrics.aspectRatio?.toFixed?.(2) ?? 'N/A'}</div>
                    <div>Pixel Area: {selectedDevice.analysisMetrics.pixelArea ? selectedDevice.analysisMetrics.pixelArea.toFixed(1) : 'N/A'}</div>

                    {selectedDevice.analysisMetrics.keyboard && (
                      <div className="mt-2">
                        <div className="font-semibold text-rose-400">Keyboard</div>
                        <div>Detected: {selectedDevice.analysisMetrics.keyboard.detected ? '✅' : '❌'}</div>
                        {selectedDevice.analysisMetrics.keyboard.blackRatio !== undefined && (
                          <div>Black Ratio: {(selectedDevice.analysisMetrics.keyboard.blackRatio * 100).toFixed(1)}%</div>
                        )}
                        {selectedDevice.analysisMetrics.keyboard.midToneRatio !== undefined && (
                          <div>Mid Tone Ratio: {(selectedDevice.analysisMetrics.keyboard.midToneRatio * 100).toFixed(1)}%</div>
                        )}
                        {selectedDevice.analysisMetrics.keyboard.whiteRatio !== undefined && (
                          <div>White Ratio: {(selectedDevice.analysisMetrics.keyboard.whiteRatio * 100).toFixed(1)}%</div>
                        )}
                        {selectedDevice.analysisMetrics.keyboard.method && (
                          <div>Method: {selectedDevice.analysisMetrics.keyboard.method}</div>
                        )}
                      </div>
                    )}

                    {selectedDevice.analysisMetrics.notch && (
                      <div className="mt-2">
                        <div className="font-semibold text-blue-300">Notch</div>
                        <div>Detected: {selectedDevice.analysisMetrics.notch.detected ? '✅' : '❌'}</div>
                        {selectedDevice.analysisMetrics.notch.blackRatio !== undefined && (
                          <div>Black Ratio: {(selectedDevice.analysisMetrics.notch.blackRatio * 100).toFixed(2)}%</div>
                        )}
                        {selectedDevice.analysisMetrics.notch.consecutiveRows !== undefined && (
                          <div>Consecutive Rows: {selectedDevice.analysisMetrics.notch.consecutiveRows}</div>
                        )}
                        {selectedDevice.analysisMetrics.notch.scanArea && (
                          <div>Scan Area: {selectedDevice.analysisMetrics.notch.scanArea}</div>
                        )}
                      </div>
                    )}

                    {selectedDevice.analysisMetrics.metalSide && (
                      <div className="mt-2">
                        <div className="font-semibold text-emerald-300">Metal Side</div>
                        <div>Detected: {selectedDevice.analysisMetrics.metalSide.detected ? '✅' : '❌'}</div>
                        {selectedDevice.analysisMetrics.metalSide.ratio !== undefined && (
                          <div>Metal Ratio: {(selectedDevice.analysisMetrics.metalSide.ratio * 100).toFixed(1)}%</div>
                        )}
                      </div>
                    )}

                    {selectedDevice.analysisMetrics.frameIntersection && (
                      <div className="mt-2">
                        <div className="font-semibold text-purple-300">Frame Intersection</div>
                        <div>Expanded Height: {selectedDevice.analysisMetrics.frameIntersection.expandedHeight ?? 'N/A'}</div>
                        <div>Keyboard Area Height: {selectedDevice.analysisMetrics.frameIntersection.screenBottomThreshold ?? 'N/A'}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="border-t border-gray-700 pt-1">
                <div className="font-semibold text-cyan-400">White Margin:</div>
                {selectedWhiteMargin ? (
                  <>
                    <div>Has Margin: {selectedWhiteMargin.hasWhiteMargin ? '⚠️ Yes' : '✅ No'}</div>
                    <div>Required Bleed: {selectedWhiteMargin.requiredBleedPercentage}%</div>
                  </>
                ) : (
                  <div className="text-gray-500">No margin data</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* イベントログ */}
        <div className="bg-gray-900 rounded-lg p-3 lg:col-span-3">
          <div
            className="flex items-center justify-between mb-2 cursor-pointer"
            onClick={() => setExpandedSections(prev => ({ ...prev, events: !prev.events }))}
          >
            <h4 className="font-semibold text-purple-400">📜 Event Log (Last 10)</h4>
            <span>{expandedSections.events ? '▼' : '▶'}</span>
          </div>
          {expandedSections.events && (
            <div className="text-xs space-y-1 max-h-40 overflow-y-auto">
              {debugEvents.slice(-10).reverse().map((event, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-2 p-1 rounded ${
                    event.level === 'error' ? 'bg-red-900 bg-opacity-20' :
                    event.level === 'warning' ? 'bg-yellow-900 bg-opacity-20' :
                    event.level === 'success' ? 'bg-green-900 bg-opacity-20' :
                    'bg-gray-800 bg-opacity-20'
                  }`}
                >
                  <span className="text-gray-500 whitespace-nowrap">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={`px-1 rounded text-xs ${
                    event.type === 'state' ? 'bg-blue-600' :
                    event.type === 'event' ? 'bg-purple-600' :
                    event.type === 'render' ? 'bg-green-600' :
                    event.type === 'analysis' ? 'bg-orange-600' :
                    'bg-red-600'
                  }`}>
                    {event.type}
                  </span>
                  <span className="text-cyan-400">{event.component}</span>
                  <span className="text-white">{event.action}</span>
                  <span className="text-gray-400 text-xs">
                    {JSON.stringify(event.details, null, 2).substring(0, 100)}...
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 全デバイスエリア情報 */}
        <div className="bg-gray-900 rounded-lg p-3 lg:col-span-3">
          <h4 className="font-semibold text-orange-400 mb-2">🔍 全デバイスエリア情報</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {deviceRegions?.map((region, idx) => (
              <div
                key={idx}
                className={`p-2 rounded border ${
                  idx === selectedDeviceIndex ? 'border-blue-400 bg-blue-900 bg-opacity-30' : 'border-gray-700'
                }`}
              >
                <div className="text-xs space-y-1">
                  <div className="font-semibold flex items-center gap-2">
                    デバイス {idx + 1}
                    {region.deviceType && (
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        region.deviceType === 'laptop' ? 'bg-purple-600 text-white' :
                        region.deviceType === 'smartphone' ? 'bg-blue-600 text-white' :
                        region.deviceType === 'tablet' ? 'bg-green-600 text-white' :
                        'bg-gray-600 text-white'
                      }`}>
                        {region.deviceType === 'laptop' ? '💻 ノートPC' :
                         region.deviceType === 'smartphone' ? '📱 スマホ' :
                         region.deviceType === 'tablet' ? '📱 タブレット' :
                         '❓ 不明'}
                      </span>
                    )}
                  </div>
                  {region.deviceType && (
                    <div className="text-xs">
                      <span className="text-cyan-400">種類: </span>
                      <span className="font-bold">
                        {region.deviceType === 'laptop' ? 'ノートパソコン' :
                         region.deviceType === 'smartphone' ? 'スマートフォン' :
                         region.deviceType === 'tablet' ? 'タブレット' :
                         '判定不能'}
                      </span>
                    </div>
                  )}
                  {region.verticalDirection && (
                    <div className="text-xs flex items-center gap-1">
                      <span className="text-cyan-400">縦方向: </span>
                      <span className="text-2xl font-bold text-yellow-400">
                        {region.verticalDirection}
                      </span>
                      <span className="text-gray-400 text-xs ml-1">
                        {region.verticalDirection === '↑' ? '(上向き)' :
                         region.verticalDirection === '→' ? '(横向き)' :
                         region.verticalDirection === '↗' ? '(斜め上)' :
                         region.verticalDirection === '↘' ? '(斜め横)' :
                         ''}
                      </span>
                    </div>
                  )}
                  {region.shapePattern && (
                    <div className="text-xs flex items-center gap-1">
                      <span className="text-cyan-400">形状: </span>
                      <span className="font-bold text-purple-400">
                        {region.shapePattern === 'rectangle' ? '🔷 長方形' :
                         region.shapePattern === 'parallelogram' ? '🔶 平行四辺形' :
                         region.shapePattern === 'trapezoid' ? '🔶 台形' :
                         '❓ 不規則'}
                      </span>
                      <span className="text-gray-400 text-xs ml-1">
                        {region.shapePattern === 'rectangle' ? '(正面ビュー)' :
                         region.shapePattern === 'parallelogram' ? '(斜め3D)' :
                         region.shapePattern === 'trapezoid' ? '(遠近法)' :
                         ''}
                      </span>
                    </div>
                  )}
                  {region.deviceTypeConfidence !== undefined && (
                    <div className="flex items-center gap-2">
                      <span className="text-cyan-400">信頼度:</span>
                      <div className="flex-1 bg-gray-700 rounded-full h-2 relative">
                        <div
                          className={`absolute top-0 left-0 h-full rounded-full ${
                            region.deviceTypeConfidence > 0.8 ? 'bg-green-500' :
                            region.deviceTypeConfidence > 0.6 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${region.deviceTypeConfidence * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold">{(region.deviceTypeConfidence * 100).toFixed(0)}%</span>
                    </div>
                  )}
                  {region.detectionReasoning && (
                    <div className="mt-1">
                      <div className="text-cyan-400 text-xs">判定理由:</div>
                      <div className="text-xs text-gray-300 italic ml-2">
                        {region.detectionReasoning}
                      </div>
                    </div>
                  )}
                  <div className="pt-1 border-t border-gray-700 mt-2">
                    <div>カラー: <span style={{ color: region.fillColor }}>{region.fillColor}</span></div>
                    <div>アクティブ: {region.isActive ? '✅' : '❌'}</div>
                    <div>画像あり: {region.imageUrl ? '✅' : '❌'}</div>
                    <div>エリア設定: {region.rect ? '✅' : '❌'}</div>
                    <div>ハードマスク: {region.hardMaskUrl ? '✅' : '❌'}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};