'use client';

import { useState } from 'react';

interface ComputeScoreButtonProps {
  jobId: string;
  hasFitScore: boolean;
}

export function ComputeScoreButton({
  jobId,
  hasFitScore,
}: ComputeScoreButtonProps): JSX.Element {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleComputeScore = async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/jobs/${jobId}/score`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to compute score');
      }

      // Reload the page to show the new score
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        padding: '1rem',
        backgroundColor: '#f9fafb',
        borderRadius: '6px',
        border: '1px solid #e5e7eb',
      }}
    >
      <div style={{ marginBottom: '0.75rem' }}>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
          {hasFitScore
            ? 'Recompute the fit score based on current KB bullets'
            : 'Compute fit score to analyze how well this job matches your profile'}
        </p>
      </div>

      <button
        onClick={handleComputeScore}
        disabled={loading}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: loading ? '#9ca3af' : '#3b82f6',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          fontSize: '0.875rem',
          fontWeight: '500',
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'background-color 0.2s',
        }}
        onMouseEnter={(e) => {
          if (!loading) {
            e.currentTarget.style.backgroundColor = '#2563eb';
          }
        }}
        onMouseLeave={(e) => {
          if (!loading) {
            e.currentTarget.style.backgroundColor = '#3b82f6';
          }
        }}
      >
        {loading
          ? 'Computing...'
          : hasFitScore
            ? 'Recompute Score'
            : 'Compute Score'}
      </button>

      {error && (
        <div
          style={{
            marginTop: '0.75rem',
            padding: '0.75rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            color: '#dc2626',
            fontSize: '0.875rem',
          }}
        >
          Error: {error}
        </div>
      )}
    </div>
  );
}
