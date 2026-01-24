import { useState } from 'react';
import { Mic, Send } from 'lucide-react';

export default function PromptBar() {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = () => {
    if (!prompt.trim()) return;
    // TODO: Handle prompt submission (AI workflow generation)
    console.log('Submitted prompt:', prompt);
    setPrompt('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="bg-surface border border-border rounded-full px-6 py-3 shadow-2xl flex items-center gap-4">
      <input
        type="text"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Edit these steps"
        className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500"
      />

      <button
        className="p-2 text-gray-400 hover:text-white hover:bg-surface-hover rounded-full transition-colors"
        title="Voice input"
      >
        <Mic className="w-5 h-5" />
      </button>

      <button
        onClick={handleSubmit}
        disabled={!prompt.trim()}
        className={`p-2 rounded-full transition-colors ${
          prompt.trim()
            ? 'bg-accent text-white hover:bg-accent-hover'
            : 'bg-surface-hover text-gray-500'
        }`}
        title="Send"
      >
        <Send className="w-5 h-5" />
      </button>

      {/* Disclaimer */}
      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-gray-600">
        Claude can make mistakes, so double-check it
      </div>
    </div>
  );
}
