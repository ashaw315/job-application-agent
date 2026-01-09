'use client';

import { useState } from 'react';
import type { RunnerRunWithArtifacts } from '@/lib/runnerRuns';

interface RunnerRunsDisplayProps {
  runs: RunnerRunWithArtifacts[];
}

export function RunnerRunsDisplay({ runs }: RunnerRunsDisplayProps): JSX.Element {
  if (runs.length === 0) {
    return (
      <div
        style={{
          padding: '1rem',
          backgroundColor: '#f9fafb',
          borderRadius: '6px',
          color: '#666',
          fontSize: '0.875rem',
        }}
      >
        No automation runs yet. Runner executions will appear here after completion.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {runs.map((run) => (
        <RunnerRunCard key={run.id} run={run} />
      ))}
    </div>
  );
}

function RunnerRunCard({ run }: { run: RunnerRunWithArtifacts }): JSX.Element {
  const [showJson, setShowJson] = useState(false);

  const statusColor = getStatusColor(run.status);
  const duration = run.completedAt
    ? Math.round(
        (run.completedAt.getTime() - run.startedAt.getTime()) / 1000
      )
    : null;

  return (
    <div
      style={{
        border: '1px solid #ddd',
        borderRadius: '6px',
        padding: '1rem',
        backgroundColor: '#fff',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                padding: '0.25rem 0.75rem',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: '500',
                backgroundColor: statusColor.bg,
                color: statusColor.text,
                border: `1px solid ${statusColor.border}`,
              }}
            >
              {formatStatus(run.status)}
            </span>
            {run.appliedAt && (
              <span style={{ fontSize: '0.75rem', color: '#666' }}>
                ✓ Applied at {new Date(run.appliedAt).toLocaleString()}
              </span>
            )}
          </div>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: '#666' }}>
            Started: {new Date(run.startedAt).toLocaleString()}
            {duration !== null && ` • Duration: ${duration}s`}
          </p>
        </div>

        <button
          onClick={() => setShowJson(!showJson)}
          style={{
            padding: '0.5rem 0.75rem',
            fontSize: '0.75rem',
            backgroundColor: '#f3f4f6',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          {showJson ? 'Hide JSON' : 'View JSON'}
        </button>
      </div>

      {/* Summary */}
      {(run.errors.length > 0 || run.warnings.length > 0 || run.stoppedReason) && (
        <div style={{ marginBottom: '1rem' }}>
          {run.errors.length > 0 && (
            <div
              style={{
                marginBottom: '0.5rem',
                padding: '0.5rem',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '4px',
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#dc2626',
                }}
              >
                Errors ({run.errors.length}):
              </p>
              <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0 }}>
                {run.errors.map((error, idx) => (
                  <li key={idx} style={{ fontSize: '0.875rem', color: '#7c2d12' }}>
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {run.warnings.length > 0 && (
            <div
              style={{
                marginBottom: '0.5rem',
                padding: '0.5rem',
                backgroundColor: '#fef3c7',
                border: '1px solid #fbbf24',
                borderRadius: '4px',
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#92400e',
                }}
              >
                Warnings ({run.warnings.length}):
              </p>
              <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0 }}>
                {run.warnings.map((warning, idx) => (
                  <li key={idx} style={{ fontSize: '0.875rem', color: '#78350f' }}>
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {run.stoppedReason && (
            <p
              style={{
                margin: 0,
                padding: '0.5rem',
                backgroundColor: '#f9fafb',
                borderRadius: '4px',
                fontSize: '0.875rem',
                color: '#666',
              }}
            >
              <strong>Stopped:</strong> {run.stoppedReason}
            </p>
          )}
        </div>
      )}

      {/* Artifacts */}
      {run.artifacts.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <p
            style={{
              margin: '0 0 0.5rem 0',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#333',
            }}
          >
            Artifacts ({run.artifacts.length}):
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr auto',
              gap: '0.5rem',
              fontSize: '0.875rem',
            }}
          >
            {run.artifacts.map((artifact) => (
              <ArtifactRow key={artifact.id} artifact={artifact} />
            ))}
          </div>
        </div>
      )}

      {/* JSON Report Viewer */}
      {showJson && (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: '#f9fafb',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
          }}
        >
          <p
            style={{
              margin: '0 0 0.5rem 0',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#333',
            }}
          >
            Full Report JSON:
          </p>
          <pre
            style={{
              margin: 0,
              padding: '0.75rem',
              backgroundColor: '#fff',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontFamily: 'monospace',
              overflow: 'auto',
              maxHeight: '400px',
            }}
          >
            {JSON.stringify(
              {
                jobPostingId: run.jobPostingId,
                status: run.status,
                errors: run.errors,
                warnings: run.warnings,
                stoppedReason: run.stoppedReason,
                appliedAt: run.appliedAt,
                startedAt: run.startedAt,
                completedAt: run.completedAt,
                artifacts: run.artifacts.map((a) => ({
                  type: a.artifactType,
                  filePath: a.filePath,
                  description: a.description,
                })),
              },
              null,
              2
            )}
          </pre>
        </div>
      )}
    </div>
  );
}

function ArtifactRow({
  artifact,
}: {
  artifact: RunnerRunWithArtifacts['artifacts'][0];
}): JSX.Element {
  return (
    <>
      <span
        style={{
          padding: '0.25rem 0.5rem',
          backgroundColor: '#e5e7eb',
          borderRadius: '4px',
          fontSize: '0.75rem',
          fontWeight: '500',
        }}
      >
        {artifact.artifactType}
      </span>
      <span style={{ color: '#666' }}>
        {artifact.description || artifact.filePath || 'No description'}
      </span>
      <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>
        {artifact.filePath || 'inline'}
      </span>
    </>
  );
}

function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    success: 'Success',
    stopped_before_submit: 'Stopped Before Submit',
    failed: 'Failed',
    critical_error: 'Critical Error',
  };
  return statusMap[status] || status;
}

function getStatusColor(status: string): {
  bg: string;
  text: string;
  border: string;
} {
  switch (status) {
    case 'success':
      return { bg: '#d1fae5', text: '#065f46', border: '#6ee7b7' };
    case 'stopped_before_submit':
      return { bg: '#fef3c7', text: '#92400e', border: '#fbbf24' };
    case 'failed':
    case 'critical_error':
      return { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' };
    default:
      return { bg: '#f3f4f6', text: '#374151', border: '#d1d5db' };
  }
}
