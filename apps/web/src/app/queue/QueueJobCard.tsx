'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { computeWordDiff, type DiffResult } from '@job-application-agent/shared';

interface QueueJobCardProps {
  job: {
    id: string;
    title: string;
    company: string;
    status: string;
    fitScore: { score: number } | null;
    materialPackets: Array<{
      id: string;
      versions: Array<{
        id: string;
        version: number;
        stage: string;
        type: string;
        content: string;
      }>;
    }>;
  };
}

interface MaterialContent {
  text?: string;
  bullets?: Array<{
    variant: string;
    isValid: boolean;
  }>;
  validation?: {
    hasErrors: boolean;
    errors: Array<{ type: string; message: string }>;
  };
}

export function QueueJobCard({ job }: QueueJobCardProps): JSX.Element {
  const router = useRouter();
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  const materialPacket = job.materialPackets[0];
  const hasValidationErrors =
    job.status === 'needs_attention' &&
    materialPacket?.versions.some((v) => {
      try {
        const content = JSON.parse(v.content) as MaterialContent;
        return content.validation?.hasErrors;
      } catch {
        return false;
      }
    });

  const handleApprove = async () => {
    setIsApproving(true);
    setError(null);

    try {
      const response = await fetch(`/api/jobs/${job.id}/approve`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to approve job');
      }

      // Refresh the page to update the list
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve job');
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!confirm('Are you sure you want to reject this job application?')) {
      return;
    }

    setIsRejecting(true);
    setError(null);

    try {
      const response = await fetch(`/api/jobs/${job.id}/reject`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to reject job');
      }

      // Refresh the page to update the list
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject job');
    } finally {
      setIsRejecting(false);
    }
  };

  // Get generated and edited versions for diff
  const getVersionsForDiff = (type: 'cover_letter' | 'resume_variant') => {
    if (!materialPacket) return null;

    const generated = materialPacket.versions.find(
      (v) => v.type === type && v.stage === 'generated'
    );
    const edited = materialPacket.versions.find(
      (v) => v.type === type && v.stage === 'edited'
    );

    if (!generated) return null;

    try {
      const generatedContent = JSON.parse(generated.content) as MaterialContent;
      const generatedText = generatedContent.bullets
        ? generatedContent.bullets.map((b) => b.variant).join('\n')
        : generatedContent.text || '';

      if (!edited) {
        return {
          hasEdit: false,
          generated: generatedText,
          edited: '',
          diff: [],
        };
      }

      const editedContent = JSON.parse(edited.content) as MaterialContent;
      const editedText = editedContent.text || '';

      const diff = computeWordDiff(generatedText, editedText);

      return {
        hasEdit: true,
        generated: generatedText,
        edited: editedText,
        diff,
      };
    } catch {
      return null;
    }
  };

  const coverLetterDiff = getVersionsForDiff('cover_letter');
  const resumeDiff = getVersionsForDiff('resume_variant');

  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '1.5rem',
        backgroundColor: '#fff',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '1rem',
        }}
      >
        <div style={{ flex: 1 }}>
          <Link
            href={`/jobs/${job.id}`}
            style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              color: '#0070f3',
              textDecoration: 'none',
            }}
          >
            {job.title}
          </Link>
          <p style={{ margin: '0.25rem 0 0 0', color: '#6b7280', fontSize: '0.875rem' }}>
            {job.company}
            {job.fitScore && (
              <span style={{ marginLeft: '1rem' }}>
                Fit Score: <strong>{Math.round(job.fitScore.score)}</strong>
              </span>
            )}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span
            style={{
              padding: '0.25rem 0.75rem',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: '500',
              backgroundColor:
                job.status === 'needs_attention' ? '#fef2f2' : '#eff6ff',
              color: job.status === 'needs_attention' ? '#dc2626' : '#2563eb',
              border:
                job.status === 'needs_attention'
                  ? '1px solid #fecaca'
                  : '1px solid #bfdbfe',
            }}
          >
            {job.status === 'needs_attention' ? '⚠️ Needs Attention' : 'In Review'}
          </span>
        </div>
      </div>

      {hasValidationErrors && (
        <div
          style={{
            padding: '0.75rem',
            marginBottom: '1rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            color: '#dc2626',
            fontSize: '0.875rem',
          }}
        >
          ⚠️ This job has validation errors in the resume variant. Please review
          manually.
        </div>
      )}

      {materialPacket && (coverLetterDiff || resumeDiff) && (
        <div style={{ marginBottom: '1rem' }}>
          <button
            onClick={() => setShowDiff(!showDiff)}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              backgroundColor: '#f9fafb',
              color: '#374151',
              border: '1px solid #e5e7eb',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            {showDiff ? 'Hide' : 'Show'} Changes
          </button>

          {showDiff && (
            <div style={{ marginTop: '1rem' }}>
              {coverLetterDiff && coverLetterDiff.hasEdit && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h4
                    style={{
                      margin: '0 0 0.5rem 0',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                    }}
                  >
                    Cover Letter Changes
                  </h4>
                  <DiffDisplay diff={coverLetterDiff.diff} />
                </div>
              )}

              {resumeDiff && resumeDiff.hasEdit && (
                <div>
                  <h4
                    style={{
                      margin: '0 0 0.5rem 0',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                    }}
                  >
                    Resume Variant Changes
                  </h4>
                  <DiffDisplay diff={resumeDiff.diff} />
                </div>
              )}

              {!coverLetterDiff?.hasEdit && !resumeDiff?.hasEdit && (
                <p style={{ color: '#6b7280', fontSize: '0.875rem', fontStyle: 'italic' }}>
                  No edits made to generated materials
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button
          onClick={handleApprove}
          disabled={isApproving || isRejecting}
          style={{
            padding: '0.5rem 1.5rem',
            fontSize: '0.875rem',
            fontWeight: '500',
            backgroundColor: '#10b981',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: isApproving || isRejecting ? 'not-allowed' : 'pointer',
            opacity: isApproving || isRejecting ? 0.6 : 1,
          }}
        >
          {isApproving ? 'Approving...' : '✓ Approve'}
        </button>

        <button
          onClick={handleReject}
          disabled={isApproving || isRejecting}
          style={{
            padding: '0.5rem 1.5rem',
            fontSize: '0.875rem',
            fontWeight: '500',
            backgroundColor: '#fff',
            color: '#dc2626',
            border: '1px solid #dc2626',
            borderRadius: '6px',
            cursor: isApproving || isRejecting ? 'not-allowed' : 'pointer',
            opacity: isApproving || isRejecting ? 0.6 : 1,
          }}
        >
          {isRejecting ? 'Rejecting...' : '✗ Reject'}
        </button>

        <Link
          href={`/jobs/${job.id}`}
          style={{
            padding: '0.5rem 1.5rem',
            fontSize: '0.875rem',
            fontWeight: '500',
            backgroundColor: '#fff',
            color: '#6b7280',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            textDecoration: 'none',
            display: 'inline-block',
          }}
        >
          View Details
        </Link>
      </div>

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

interface DiffDisplayProps {
  diff: DiffResult[];
}

function DiffDisplay({ diff }: DiffDisplayProps): JSX.Element {
  return (
    <div
      style={{
        padding: '1rem',
        backgroundColor: '#f9fafb',
        borderRadius: '6px',
        border: '1px solid #e5e7eb',
        fontSize: '0.875rem',
        lineHeight: '1.6',
        fontFamily: 'monospace',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {diff.map((segment, idx) => {
        if (segment.type === 'unchanged') {
          return <span key={idx}>{segment.value}</span>;
        } else if (segment.type === 'added') {
          return (
            <span
              key={idx}
              style={{
                backgroundColor: '#d1fae5',
                color: '#065f46',
                textDecoration: 'none',
              }}
            >
              {segment.value}
            </span>
          );
        } else {
          return (
            <span
              key={idx}
              style={{
                backgroundColor: '#fee2e2',
                color: '#991b1b',
                textDecoration: 'line-through',
              }}
            >
              {segment.value}
            </span>
          );
        }
      })}
    </div>
  );
}
