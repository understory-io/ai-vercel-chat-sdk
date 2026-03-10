'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/toast';

interface ApiKeyInfo {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export function ApiKeysManager() {
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function fetchKeys() {
    try {
      const res = await fetch('/api/api-keys');
      if (res.ok) {
        setKeys(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchKeys();
  }, []);

  async function handleCreate() {
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setCreatedKey(data.key);
        setNewKeyName('');
        fetchKeys();
      } else {
        toast({ type: 'error', description: 'Failed to create API key' });
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    const res = await fetch(`/api/api-keys?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast({ type: 'success', description: 'API key revoked' });
      fetchKeys();
    } else {
      toast({ type: 'error', description: 'Failed to revoke API key' });
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast({ type: 'success', description: 'Copied to clipboard' });
  }

  const activeKeys = keys.filter((k) => !k.revokedAt);
  const revokedKeys = keys.filter((k) => k.revokedAt);

  return (
    <div className="flex flex-col gap-6">
      {/* Create new key */}
      <div className="flex flex-col gap-3 p-4 border rounded-lg dark:border-zinc-700">
        <h2 className="text-sm font-medium dark:text-zinc-200">
          Create API Key
        </h2>
        <div className="flex gap-2">
          <Input
            placeholder="Key name (e.g. Claude Code)"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <Button
            onClick={handleCreate}
            disabled={creating || !newKeyName.trim()}
          >
            {creating ? 'Creating...' : 'Create'}
          </Button>
        </div>
      </div>

      {/* Show newly created key */}
      {createdKey && (
        <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
          <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
            API key created. Copy it now — it won&apos;t be shown again.
          </p>
          <div className="flex gap-2 items-center">
            <code className="flex-1 text-sm bg-white dark:bg-zinc-900 p-2 rounded border dark:border-zinc-700 font-mono break-all">
              {createdKey}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(createdKey)}
            >
              Copy
            </Button>
          </div>
          <button
            type="button"
            className="text-xs text-gray-500 mt-2 hover:underline"
            onClick={() => setCreatedKey(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Active keys */}
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium dark:text-zinc-200">
          Active Keys
        </h2>
        {loading ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : activeKeys.length === 0 ? (
          <p className="text-sm text-gray-400">No active API keys</p>
        ) : (
          <div className="flex flex-col gap-2">
            {activeKeys.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between p-3 border rounded-lg dark:border-zinc-700"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium dark:text-zinc-200">
                    {key.name}
                  </span>
                  <span className="text-xs text-gray-400 font-mono">
                    {key.keyPrefix}...
                  </span>
                  <span className="text-xs text-gray-400">
                    Created{' '}
                    {new Date(key.createdAt).toLocaleDateString()}
                    {key.lastUsedAt &&
                      ` · Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRevoke(key.id)}
                  className="text-red-600 hover:text-red-700 dark:text-red-400"
                >
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Revoked keys */}
      {revokedKeys.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-gray-400">Revoked Keys</h2>
          <div className="flex flex-col gap-2">
            {revokedKeys.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between p-3 border rounded-lg opacity-50 dark:border-zinc-700"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium dark:text-zinc-200">
                    {key.name}
                  </span>
                  <span className="text-xs text-gray-400 font-mono">
                    {key.keyPrefix}...
                  </span>
                  <span className="text-xs text-gray-400">
                    Revoked{' '}
                    {new Date(key.revokedAt!).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
