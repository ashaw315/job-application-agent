'use client';

import { useState } from 'react';
import type { RunnerPacket } from '@job-application-agent/shared';

interface RunnerPacketPreviewProps {
  jobId: string;
  jobStatus: string;
}

export function RunnerPacketPreview({
  jobId,
  jobStatus,
}: RunnerPacketPreviewProps): JSX.Element | null {
  const [showPreview, setShowPreview] = useState(false);
  const [packet, setPacket] = useState<RunnerPacket | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only show for approved jobs in dev mode
  const isDev = process.env.NODE_ENV === 'development';
  if (!isDev || jobStatus !== 'approved') {
    return null;
  }

  const fetchPacket = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // For dev preview, we'll show what the packet would look like
      // In production, this would require the runner API key
      const response = await fetch(`/api/runner/packets/${jobId}`, {
        method: 'GET',
        headers: {
          // In dev, we'd need to get this from somewhere - for preview we'll show the structure
          Authorization: 'Bearer dev-preview-token',
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch packet');
      }

      setPacket(data.packet);
      setShowPreview(true);
    } catch (err) {
      // For dev preview, show informative error
      setError(err instanceof Error ? err.message : 'Failed to fetch packet');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        marginBottom: '2rem',
        padding: '1rem',
        backgroundColor: '#fef3c7',
        border: '1px solid #fbbf24',
        borderRadius: '8px',
      }}
    >
      <div style={{ marginBottom: '0.5rem' }}>
        <strong style={{ color: '#92400e' }}>🔧 Dev Mode: Runner Packet Preview</strong>
      </div>
      <p
        style={{
          margin: '0 0 1rem 0',
          fontSize: '0.875rem',
          color: '#78350f',
        }}
      >
        This section is only visible in development mode. It shows the packet that
        would be sent to the runner automation.
      </p>

      {!showPreview ? (
        <button
          onClick={fetchPacket}
          disabled={isLoading}
          style={{
            padding: '0.5rem 1rem',
            fontSize: '0.875rem',
            backgroundColor: '#fff',
            color: '#92400e',
            border: '1px solid #fbbf24',
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.6 : 1,
          }}
        >
          {isLoading ? 'Loading...' : 'Preview Runner Packet'}
        </button>
      ) : (
        <button
          onClick={() => setShowPreview(false)}
          style={{
            padding: '0.5rem 1rem',
            fontSize: '0.875rem',
            backgroundColor: '#fff',
            color: '#92400e',
            border: '1px solid #fbbf24',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Hide Preview
        </button>
      )}

      {error && (
        <div
          style={{
            marginTop: '0.75rem',
            padding: '0.75rem',
            backgroundColor: '#fff',
            border: '1px solid #fbbf24',
            borderRadius: '6px',
            color: '#92400e',
            fontSize: '0.875rem',
          }}
        >
          <strong>Note:</strong> {error}
          <br />
          <span style={{ fontSize: '0.75rem', marginTop: '0.5rem', display: 'block' }}>
            Set RUNNER_API_KEY in your .env file to preview the actual packet.
          </span>
        </div>
      )}

      {showPreview && packet && (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: '#fff',
            border: '1px solid #fbbf24',
            borderRadius: '6px',
          }}
        >
          <pre
            style={{
              margin: 0,
              fontSize: '0.75rem',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              overflow: 'auto',
              maxHeight: '400px',
            }}
          >
            {JSON.stringify(packet, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
