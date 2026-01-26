import React, { useState, useEffect } from 'react';
import { X, Key, FileJson, ExternalLink, Check, Loader2, AlertCircle } from 'lucide-react';

export interface SkillCredential {
  type: 'api_key' | 'service_account' | 'oauth';
  envVar: string;
  service: string;
  description: string;
  setupUrl: string;
  required: boolean;
}

interface CredentialStatus {
  credential: SkillCredential;
  configured: boolean;
  value?: string;
}

interface CredentialsSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  skillName: string;
  skillPath: string;
  projectPath: string;
  onComplete: () => void;
}

const CREDENTIAL_TYPE_INFO: Record<string, { icon: React.ReactNode; label: string; hint: string }> = {
  api_key: {
    icon: <Key className="w-5 h-5 text-amber-400" />,
    label: 'API 키',
    hint: '서비스에서 발급받은 API 키를 입력하세요',
  },
  service_account: {
    icon: <FileJson className="w-5 h-5 text-blue-400" />,
    label: '서비스 계정',
    hint: 'JSON 파일의 내용을 붙여넣기 하세요',
  },
  oauth: {
    icon: <FileJson className="w-5 h-5 text-purple-400" />,
    label: 'OAuth 인증',
    hint: '인증 토큰 JSON을 붙여넣기 하세요',
  },
};

export default function CredentialsSetupModal({
  isOpen,
  onClose,
  skillName,
  skillPath,
  projectPath,
  onComplete,
}: CredentialsSetupModalProps) {
  const [credentials, setCredentials] = useState<CredentialStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);

  // Load credentials status
  useEffect(() => {
    if (!isOpen) return;

    const fetchCredentials = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/skill/credentials?skillPath=${encodeURIComponent(skillPath)}&projectPath=${encodeURIComponent(projectPath)}`
        );

        if (!response.ok) {
          throw new Error('인증 정보를 확인할 수 없습니다');
        }

        const data = await response.json();
        setCredentials(data.credentials || []);

        // Find first unconfigured required credential
        const firstUnconfigured = (data.credentials || []).findIndex(
          (c: CredentialStatus) => c.credential.required && !c.configured
        );
        setCurrentIndex(firstUnconfigured >= 0 ? firstUnconfigured : 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : '오류가 발생했습니다');
      } finally {
        setLoading(false);
      }
    };

    fetchCredentials();
  }, [isOpen, skillPath, projectPath]);

  const handleSave = async (credential: SkillCredential, value: string) => {
    if (!value.trim()) {
      setError('값을 입력해주세요');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/skill/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential, value: value.trim(), projectPath }),
      });

      if (!response.ok) {
        throw new Error('저장에 실패했습니다');
      }

      // Update local state
      setCredentials((prev) =>
        prev.map((c) =>
          c.credential.envVar === credential.envVar
            ? { ...c, configured: true, value: '****' }
            : c
        )
      );

      // Move to next unconfigured or complete
      const nextUnconfigured = credentials.findIndex(
        (c, i) => i > currentIndex && c.credential.required && !c.configured
      );

      if (nextUnconfigured >= 0) {
        setCurrentIndex(nextUnconfigured);
      } else {
        // All done
        onComplete();
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    const nextUnconfigured = credentials.findIndex(
      (c, i) => i > currentIndex && c.credential.required && !c.configured
    );

    if (nextUnconfigured >= 0) {
      setCurrentIndex(nextUnconfigured);
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  const currentCredential = credentials[currentIndex];
  const unconfiguredCount = credentials.filter(
    (c) => c.credential.required && !c.configured
  ).length;
  const allConfigured = unconfiguredCount === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 rounded-xl w-full max-w-lg mx-4 border border-zinc-700 shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-700 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">인증 정보 설정</h2>
            <p className="text-sm text-zinc-400">{skillName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
            </div>
          ) : allConfigured ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">모든 설정 완료!</h3>
              <p className="text-zinc-400">이제 스킬을 사용할 수 있습니다.</p>
            </div>
          ) : currentCredential ? (
            <div className="space-y-4">
              {/* Progress */}
              <div className="flex items-center justify-between text-sm text-zinc-400">
                <span>
                  {currentIndex + 1} / {credentials.length}
                </span>
                <span>{unconfiguredCount}개 설정 필요</span>
              </div>

              {/* Credential info */}
              <div className="p-4 bg-zinc-800 rounded-lg border border-zinc-700">
                <div className="flex items-start gap-3 mb-3">
                  {CREDENTIAL_TYPE_INFO[currentCredential.credential.type]?.icon}
                  <div>
                    <h3 className="font-medium text-white">
                      {currentCredential.credential.service}
                    </h3>
                    <p className="text-sm text-zinc-400">
                      {currentCredential.credential.description}
                    </p>
                  </div>
                </div>

                {/* Setup link */}
                <a
                  href={currentCredential.credential.setupUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 mb-4"
                >
                  <ExternalLink className="w-4 h-4" />
                  {currentCredential.credential.type === 'api_key'
                    ? 'API 키 발급 페이지 열기'
                    : '설정 페이지 열기'}
                </a>

                {/* Input */}
                {currentCredential.credential.type === 'api_key' ? (
                  <input
                    type="password"
                    value={values[currentCredential.credential.envVar] || ''}
                    onChange={(e) =>
                      setValues((prev) => ({
                        ...prev,
                        [currentCredential.credential.envVar]: e.target.value,
                      }))
                    }
                    placeholder="API 키를 입력하세요"
                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-600 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                ) : (
                  <textarea
                    value={values[currentCredential.credential.envVar] || ''}
                    onChange={(e) =>
                      setValues((prev) => ({
                        ...prev,
                        [currentCredential.credential.envVar]: e.target.value,
                      }))
                    }
                    placeholder={CREDENTIAL_TYPE_INFO[currentCredential.credential.type]?.hint}
                    rows={6}
                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-600 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none font-mono text-sm"
                  />
                )}

                <p className="mt-2 text-xs text-zinc-500">
                  {currentCredential.credential.type === 'api_key' ? (
                    <>
                      저장 위치: <code className="text-amber-400">.env</code> 파일의{' '}
                      <code className="text-amber-400">{currentCredential.credential.envVar}</code>
                    </>
                  ) : (
                    <>
                      저장 위치:{' '}
                      <code className="text-amber-400">
                        .credentials/{currentCredential.credential.envVar}
                      </code>
                    </>
                  )}
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Info */}
              <div className="p-3 bg-zinc-800/50 rounded-lg text-xs text-zinc-400">
                <p>
                  💡 이 정보는 <strong>로컬에만</strong> 저장되며, .gitignore에 자동 추가되어
                  Git에 커밋되지 않습니다.
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-zinc-400">
              설정할 인증 정보가 없습니다.
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && !allConfigured && currentCredential && (
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-zinc-700 bg-zinc-800/50 flex-shrink-0">
            <button
              onClick={handleSkip}
              disabled={saving}
              className="px-4 py-2 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {currentCredential.credential.required ? '나중에' : '건너뛰기'}
            </button>
            <button
              onClick={() =>
                handleSave(
                  currentCredential.credential,
                  values[currentCredential.credential.envVar] || ''
                )
              }
              disabled={saving || !values[currentCredential.credential.envVar]?.trim()}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg font-medium transition-colors ${
                saving || !values[currentCredential.credential.envVar]?.trim()
                  ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                  : 'bg-amber-600 hover:bg-amber-500 text-white'
              }`}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  저장 중...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  저장
                </>
              )}
            </button>
          </div>
        )}

        {allConfigured && (
          <div className="flex justify-end px-5 py-4 border-t border-zinc-700 bg-zinc-800/50 flex-shrink-0">
            <button
              onClick={() => {
                onComplete();
                onClose();
              }}
              className="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-colors"
            >
              <Check className="w-4 h-4" />
              완료
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
