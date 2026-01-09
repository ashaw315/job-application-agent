'use client';

import { useState } from 'react';

interface RunPipelineButtonProps {
  jobId: string;
  currentStatus: string;
}

export function RunPipelineButton({
  jobId,
  currentStatus,
}: RunPipelineButtonProps): JSX.Element {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleRunPipeline = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(`/api/jobs/${jobId}/runPipeline`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to run pipeline');
      }

      setSuccess(true);
      // Reload the page to show updated status
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Don't show button for jobs already in_review, applied, rejected, or archived
  const disabledStatuses = ['in_review', 'applied', 'rejected', 'archived'];
  if (disabledStatuses.includes(currentStatus)) {
    return (
      <div
        style={{
          padding: '1rem',
          backgroundColor: '#f9fafb',
          borderRadius: '6px',
          border: '1px solid #e5e7eb',
        }}
      >
        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>
          Pipeline already run for this job (status: {currentStatus})
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '1.5rem',
        backgroundColor: '#f9fafb',
        borderRadius: '6px',
        border: '1px solid #e5e7eb',
      }}
    >
      <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem' }}>
        Application Pipeline
      </h3>
      <p
        style={{
          margin: '0 0 1rem 0',
          fontSize: '0.875rem',
          color: '#6b7280',
          lineHeight: '1.5',
        }}
      >
        Run the full pipeline to score this job, generate application materials
        (cover letter and resume variant), and move it to review status.
      </p>

      <button
        onClick={handleRunPipeline}
        disabled={loading}
        style={{
          padding: '0.75rem 1.5rem',
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
        {loading ? 'Running Pipeline...' : 'Run Pipeline'}
      </button>

      {error && (
        <div
          style={{
            marginTop: '1rem',
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

      {success && (
        <div
          style={{
            marginTop: '1rem',
            padding: '0.75rem',
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '6px',
            color: '#16a34a',
            fontSize: '0.875rem',
          }}
        >
          Pipeline completed successfully! Refreshing...
        </div>
      )}
    </div>
  );
}
