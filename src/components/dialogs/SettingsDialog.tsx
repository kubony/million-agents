import { useState, useEffect } from 'react';
import { X, Server, Key, Eye, EyeOff } from 'lucide-react';
import { useSettingsStore, type ApiMode } from '../../stores/settingsStore';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const { apiMode, apiKey, proxyUrl, setApiMode, setApiKey, setProxyUrl } = useSettingsStore();

  const [localApiMode, setLocalApiMode] = useState<ApiMode>(apiMode);
  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [localProxyUrl, setLocalProxyUrl] = useState(proxyUrl);
  const [showApiKey, setShowApiKey] = useState(false);

  // Sync with store when dialog opens
  useEffect(() => {
    if (isOpen) {
      setLocalApiMode(apiMode);
      setLocalApiKey(apiKey);
      setLocalProxyUrl(proxyUrl);
    }
  }, [isOpen, apiMode, apiKey, proxyUrl]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setApiMode(localApiMode);
    setApiKey(localApiKey);
    setProxyUrl(localProxyUrl);

    // Save API key to .env if direct mode and key provided
    if (localApiMode === 'direct' && localApiKey) {
      try {
        const res = await fetch('/api/settings/api-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: localApiKey }),
        });
        if (!res.ok) {
          console.error('Failed to save API key to .env');
        }
      } catch (err) {
        console.error('Failed to save API key:', err);
      }
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface border border-border rounded-xl w-full max-w-md mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-white">설정</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-surface-hover rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* API Mode Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-300">API 모드</label>

            <div className="space-y-2">
              <label
                className={`
                  flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                  ${localApiMode === 'proxy'
                    ? 'border-accent bg-accent/10'
                    : 'border-border hover:border-gray-600'
                  }
                `}
              >
                <input
                  type="radio"
                  name="apiMode"
                  value="proxy"
                  checked={localApiMode === 'proxy'}
                  onChange={() => setLocalApiMode('proxy')}
                  className="sr-only"
                />
                <Server className={`w-5 h-5 ${localApiMode === 'proxy' ? 'text-accent' : 'text-gray-400'}`} />
                <div className="flex-1">
                  <div className={`font-medium ${localApiMode === 'proxy' ? 'text-white' : 'text-gray-300'}`}>
                    프록시 서버
                  </div>
                  <div className="text-sm text-gray-500">
                    프록시 서버의 API 키를 사용합니다
                  </div>
                </div>
                {localApiMode === 'proxy' && (
                  <div className="w-2 h-2 bg-accent rounded-full" />
                )}
              </label>

              <label
                className={`
                  flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                  ${localApiMode === 'direct'
                    ? 'border-accent bg-accent/10'
                    : 'border-border hover:border-gray-600'
                  }
                `}
              >
                <input
                  type="radio"
                  name="apiMode"
                  value="direct"
                  checked={localApiMode === 'direct'}
                  onChange={() => setLocalApiMode('direct')}
                  className="sr-only"
                />
                <Key className={`w-5 h-5 ${localApiMode === 'direct' ? 'text-accent' : 'text-gray-400'}`} />
                <div className="flex-1">
                  <div className={`font-medium ${localApiMode === 'direct' ? 'text-white' : 'text-gray-300'}`}>
                    직접 입력
                  </div>
                  <div className="text-sm text-gray-500">
                    나만의 API 키를 사용합니다
                  </div>
                </div>
                {localApiMode === 'direct' && (
                  <div className="w-2 h-2 bg-accent rounded-full" />
                )}
              </label>
            </div>
          </div>

          {/* Proxy URL (shown when proxy mode) */}
          {localApiMode === 'proxy' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">프록시 서버 URL</label>
              <input
                type="text"
                value={localProxyUrl}
                onChange={(e) => setLocalProxyUrl(e.target.value)}
                placeholder="https://your-proxy-server.com"
                className="w-full px-4 py-2.5 bg-surface-hover border border-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              />
              <p className="text-xs text-gray-500">
                서버에서 API 키를 관리하는 프록시 서버 주소
              </p>
            </div>
          )}

          {/* API Key Input (shown when direct mode) */}
          {localApiMode === 'direct' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Anthropic API 키</label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={localApiKey}
                  onChange={(e) => setLocalApiKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="w-full px-4 py-2.5 pr-10 bg-surface-hover border border-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-500">
                API 키는 브라우저에 안전하게 저장됩니다
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
