import React, { useState, useEffect, useRef } from 'react';
import { getEngineStatus, suggestEngineUpdate, applyEngineUpdate } from '../api/engine';

export default function EngineAdmin() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchStatus = async () => {
    try {
      const data = await getEngineStatus();
      setStatus(data);
    } catch (error) {
      console.error('Failed to fetch engine status:', error);
    }
  };

  const handleSendPrompt = async () => {
    if (!prompt.trim()) return;

    const userMessage = { role: 'user', content: prompt };
    setMessages(prev => [...prev, userMessage]);
    setPrompt('');
    setLoading(true);

    try {
      const suggestion = await suggestEngineUpdate(prompt);
      const aiMessage = {
        role: 'ai',
        content: suggestion.suggestion,
        diff: suggestion.diff,
        currentVersion: suggestion.currentVersion,
        codePreview: suggestion.currentCode,
        recommendations: suggestion.recommendations,
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      setMessages(prev => [
        ...prev,
        { role: 'ai', content: `Error: ${error.message}`, error: true },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (diff, index) => {
    if (!diff) {
      alert('No diff to apply. Please request a suggestion first.');
      return;
    }

    setApplying(true);
    setApplyResult(null);

    try {
      const result = await applyEngineUpdate(diff, { source: 'admin-ui' });
      setApplyResult({ success: true, data: result });
      // Refresh status after apply
      await fetchStatus();
      // Update the message with a success indicator
      const updatedMessages = [...messages];
      updatedMessages[index] = {
        ...updatedMessages[index],
        applied: true,
        applyResult: result,
      };
      setMessages(updatedMessages);
    } catch (error) {
      setApplyResult({ success: false, error: error.message });
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">⚙️ Engine Admin</h1>

      {/* Status Bar */}
      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mb-6 flex flex-wrap items-center gap-4">
        {status ? (
          <>
            <span className="font-mono text-sm bg-gray-200 dark:bg-gray-700 px-3 py-1 rounded">
              v{status.currentVersion || 'unknown'}
            </span>
            <span className={`text-sm ${status.ready ? 'text-green-600' : 'text-yellow-600'}`}>
              {status.ready ? '✅ Ready' : '⏳ Loading'}
            </span>
            <span className="text-sm text-gray-500">
              {status.versions?.length || 0} versions cached
            </span>
            <button
              onClick={fetchStatus}
              className="ml-auto text-sm text-blue-600 hover:underline"
            >
              Refresh
            </button>
          </>
        ) : (
          <span>Loading status...</span>
        )}
      </div>

      {/* Chat Area */}
      <div className="border rounded-lg overflow-hidden bg-white dark:bg-gray-900">
        <div className="h-96 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-400 mt-20">
              <p className="text-lg">🤖 Ask me to suggest an engine improvement</p>
              <p className="text-sm">
                Example: "optimize normalizeRateCard" or "fix bug in calcGrossFromRates"
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-3xl rounded-lg p-3 ${
                    msg.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : msg.error
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                      : 'bg-gray-100 dark:bg-gray-800'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <p>{msg.content}</p>
                  ) : (
                    <div>
                      <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                      {msg.diff && (
                        <div className="mt-2">
                          <details>
                            <summary className="text-sm font-medium text-blue-600 dark:text-blue-400 cursor-pointer">
                              View diff / suggestion
                            </summary>
                            <pre className="mt-2 p-2 bg-gray-200 dark:bg-gray-700 rounded text-xs overflow-auto max-h-60">
                              {msg.diff}
                            </pre>
                          </details>
                          {!msg.applied && (
                            <button
                              onClick={() => handleApply(msg.diff, idx)}
                              disabled={applying}
                              className="mt-2 px-4 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm"
                            >
                              {applying ? 'Applying...' : '✅ Apply'}
                            </button>
                          )}
                          {msg.applied && (
                            <span className="mt-2 inline-block text-green-600 text-sm">
                              ✅ Applied successfully
                            </span>
                          )}
                          {msg.recommendations && (
                            <div className="mt-2 text-xs text-gray-500">
                              <strong>Recommendations:</strong>
                              <ul className="list-disc list-inside">
                                {msg.recommendations.map((rec, i) => (
                                  <li key={i}>{rec}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                      {msg.codePreview && (
                        <details className="mt-2">
                          <summary className="text-sm font-medium text-gray-500 cursor-pointer">
                            Current code (preview)
                          </summary>
                          <pre className="mt-2 p-2 bg-gray-200 dark:bg-gray-700 rounded text-xs overflow-auto max-h-40">
                            {msg.codePreview}
                          </pre>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                <span className="animate-pulse">•••</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t p-4 bg-gray-50 dark:bg-gray-800 flex gap-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendPrompt()}
            placeholder="Ask for a suggestion (e.g., 'optimize normalizeRateCard')..."
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
          <button
            onClick={handleSendPrompt}
            disabled={loading || !prompt.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>

      {/* Apply Result Notification */}
      {applyResult && (
        <div
          className={`mt-4 p-3 rounded-lg ${
            applyResult.success
              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
              : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
          }`}
        >
          {applyResult.success ? (
            <div>
              <p className="font-medium">✅ Engine updated successfully!</p>
              <p className="text-sm">
                New version: {applyResult.data?.version} | Applied at:{' '}
                {new Date(applyResult.data?.appliedAt).toLocaleString()}
              </p>
              {applyResult.data?.testResults && (
                <p className="text-sm">
                  Tests: {applyResult.data.testResults.passedTests || 0} passed,{' '}
                  {applyResult.data.testResults.failedTests || 0} failed
                </p>
              )}
            </div>
          ) : (
            <p className="font-medium">❌ Apply failed: {applyResult.error}</p>
          )}
          <button
            onClick={() => setApplyResult(null)}
            className="mt-2 text-sm underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
