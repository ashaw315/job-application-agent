'use client';

import { useState } from 'react';

interface ValidationError {
  type: 'number_changed' | 'new_tech_term' | 'scope_escalation';
  message: string;
}

interface ResumeVariantBullet {
  original: string;
  variant: string;
  isValid: boolean;
}

interface ResumeVariantContent {
  bullets: ResumeVariantBullet[];
  citations?: {
    selectedBulletIds: string[];
    model: string;
  };
  validation: {
    hasErrors: boolean;
    errors: ValidationError[];
  };
  llmUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  text?: string;
  error?: string;
}

interface ResumeVariantDisplayProps {
  versions: Array<{
    id: string;
    version: number;
    stage: string;
    type: string;
    content: string;
    createdAt: Date;
  }>;
}

export function ResumeVariantDisplay({
  versions,
}: ResumeVariantDisplayProps): JSX.Element | null {
  const [showMetadata, setShowMetadata] = useState(false);
  const [showOriginals, setShowOriginals] = useState(false);

  // Find the most recent resume variant version
  const resumeVersion = versions
    .filter((v) => v.type === 'resume_variant')
    .sort((a, b) => b.version - a.version)[0];

  if (!resumeVersion) {
    return null;
  }

  let content: ResumeVariantContent;
  try {
    content = JSON.parse(resumeVersion.content);
  } catch {
    // Fallback for old format
    content = {
      bullets: [],
      validation: {
        hasErrors: false,
        errors: [],
      },
      text: resumeVersion.content,
    };
  }

  const isPlaceholder = content.text?.includes('TODO') || content.bullets.length === 0;
  const hasValidationErrors = content.validation?.hasErrors || false;

  return (
    <div
      style={{
        padding: '1.5rem',
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>
          Resume Variant
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {hasValidationErrors && (
            <span
              style={{
                fontSize: '0.75rem',
                color: '#dc2626',
                padding: '0.25rem 0.5rem',
                backgroundColor: '#fef2f2',
                borderRadius: '4px',
                border: '1px solid #fecaca',
              }}
            >
              Validation Errors
            </span>
          )}
          <span
            style={{
              fontSize: '0.75rem',
              color: '#6b7280',
              padding: '0.25rem 0.5rem',
              backgroundColor: '#fff',
              borderRadius: '4px',
              border: '1px solid #e5e7eb',
            }}
          >
            v{resumeVersion.version}
          </span>
          {content.llmUsage && (
            <button
              onClick={() => setShowMetadata(!showMetadata)}
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.75rem',
                backgroundColor: '#fff',
                color: '#6b7280',
                border: '1px solid #e5e7eb',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {showMetadata ? 'Hide' : 'Show'} Metadata
            </button>
          )}
          {content.bullets.length > 0 && (
            <button
              onClick={() => setShowOriginals(!showOriginals)}
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.75rem',
                backgroundColor: '#fff',
                color: '#6b7280',
                border: '1px solid #e5e7eb',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {showOriginals ? 'Hide' : 'Show'} Original
            </button>
          )}
        </div>
      </div>

      {hasValidationErrors && content.validation.errors.length > 0 && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '1rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
          }}
        >
          <h4
            style={{
              margin: '0 0 0.5rem 0',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#dc2626',
            }}
          >
            ⚠️ Validation Errors ({content.validation.errors.length})
          </h4>
          <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.875rem' }}>
            {content.validation.errors.map((error, idx) => (
              <li
                key={idx}
                style={{ marginBottom: '0.25rem', color: '#dc2626' }}
              >
                <strong>{error.type.replace(/_/g, ' ')}:</strong> {error.message}
              </li>
            ))}
          </ul>
          <p
            style={{
              margin: '0.75rem 0 0 0',
              fontSize: '0.875rem',
              color: '#7c2d12',
            }}
          >
            The resume variant has been saved but validation failed. Please review
            and manually edit if needed.
          </p>
        </div>
      )}

      {isPlaceholder && content.text ? (
        <div
          style={{
            padding: '1rem',
            backgroundColor: '#fff',
            borderRadius: '6px',
            border: '1px solid #e5e7eb',
            fontStyle: 'italic',
            color: '#6b7280',
          }}
        >
          {content.text}
        </div>
      ) : (
        <div
          style={{
            padding: '1rem',
            backgroundColor: '#fff',
            borderRadius: '6px',
            border: '1px solid #e5e7eb',
          }}
        >
          {content.bullets.map((bullet, idx) => (
            <div
              key={idx}
              style={{
                marginBottom: '1rem',
                paddingBottom: '1rem',
                borderBottom:
                  idx < content.bullets.length - 1 ? '1px solid #e5e7eb' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <span
                  style={{
                    fontSize: '0.875rem',
                    color: bullet.isValid ? '#10b981' : '#dc2626',
                    fontWeight: '600',
                  }}
                >
                  {bullet.isValid ? '✓' : '✗'}
                </span>
                <div style={{ flex: 1 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '0.875rem',
                      lineHeight: '1.5',
                      color: bullet.isValid ? '#374151' : '#6b7280',
                      textDecoration: bullet.isValid ? 'none' : 'line-through',
                    }}
                  >
                    {bullet.variant}
                  </p>
                  {showOriginals && (
                    <p
                      style={{
                        margin: '0.5rem 0 0 0',
                        fontSize: '0.75rem',
                        color: '#6b7280',
                        fontStyle: 'italic',
                      }}
                    >
                      Original: {bullet.original}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {content.error && (
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
          Error: {content.error}
        </div>
      )}

      {showMetadata && content.llmUsage && (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: '#fff',
            borderRadius: '6px',
            border: '1px solid #e5e7eb',
          }}
        >
          <h4
            style={{
              margin: '0 0 0.5rem 0',
              fontSize: '0.875rem',
              fontWeight: '600',
            }}
          >
            Generation Metadata
          </h4>
          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
            <p style={{ margin: '0.25rem 0' }}>
              <strong>Model:</strong> {content.citations?.model || 'Unknown'}
            </p>
            <p style={{ margin: '0.25rem 0' }}>
              <strong>Tokens:</strong> {content.llmUsage.totalTokens} total (
              {content.llmUsage.promptTokens} prompt +{' '}
              {content.llmUsage.completionTokens} completion)
            </p>
            {content.citations && (
              <p style={{ margin: '0.25rem 0' }}>
                <strong>KB Bullets Used:</strong>{' '}
                {content.citations.selectedBulletIds.length}
              </p>
            )}
            <p style={{ margin: '0.25rem 0' }}>
              <strong>Generated:</strong>{' '}
              {new Date(resumeVersion.createdAt).toLocaleString()}
            </p>
            <p style={{ margin: '0.25rem 0' }}>
              <strong>Validation Status:</strong>{' '}
              {hasValidationErrors ? '❌ Failed' : '✅ Passed'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
