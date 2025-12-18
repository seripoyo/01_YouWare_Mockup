import React, { useState } from 'react';

interface DebugButtonProps {
  label?: string;
  generateReport: () => string;
}

export default function DebugButton({ label = 'デバッグレポート生成', generateReport }: DebugButtonProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<string>('');

  const handleGenerate = () => {
    const report = generateReport();
    setText(report);
    setOpen(true);
    console.log('[DebugReport]', report);
  };

  return (
    <div className="mt-4">
      <button
        className="px-3 py-1 border rounded bg-white hover:bg-gray-50 text-sm"
        onClick={handleGenerate}
      >
        {label}
      </button>

      {open && (
        <div className="mt-2">
          <textarea
            className="w-full h-48 border rounded p-2 text-xs"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="mt-2 flex gap-2">
            <button
              className="px-3 py-1 border rounded bg-black text-white text-sm"
              onClick={() => navigator.clipboard.writeText(text)}
            >
              ログをコピー
            </button>
            <button
              className="px-3 py-1 border rounded text-sm"
              onClick={() => setOpen(false)}
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
