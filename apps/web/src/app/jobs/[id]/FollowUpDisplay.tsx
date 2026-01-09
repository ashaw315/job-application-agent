'use client';

import { useState } from 'react';

interface FollowUpSuggestion {
  id: string;
  text: string;
  suggestedAt: Date;
  emailDrafts: {
    id: string;
    subject: string;
    body: string;
    createdAt: Date;
  }[];
}

interface FollowUpDisplayProps {
  jobId: string;
  suggestions: FollowUpSuggestion[];
}

export function FollowUpDisplay({
  jobId,
  suggestions,
}: FollowUpDisplayProps): JSX.Element {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateSuggestions = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/jobs/${jobId}/followup/suggest`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create suggestions');
      }

      // Refresh the page to show new suggestions
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create suggestions');
    } finally {
      setLoading(false);
    }
  };

  const handleDraftEmail = async (suggestionId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/jobs/${jobId}/followup/draftEmail`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ suggestionId }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to draft email');
      }

      // Refresh the page to show new draft
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to draft email');
    } finally {
      setLoading(false);
    }
  };

  if (suggestions.length === 0) {
    return (
      <div
        style={{
          padding: '1.5rem',
          backgroundColor: '#f9fafb',
          borderRadius: '6px',
          border: '1px solid #e5e7eb',
        }}
      >
        <p style={{ margin: '0 0 1rem 0', color: '#666', fontSize: '0.875rem' }}>
          No follow-up suggestions yet. Create suggestions to draft follow-up emails.
        </p>
        <button
          onClick={handleCreateSuggestions}
          disabled={loading}
          style={{
            padding: '0.5rem 1rem',
            fontSize: '0.875rem',
            fontWeight: '500',
            backgroundColor: loading ? '#d1d5db' : '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Creating...' : 'Create Follow-Up Suggestions'}
        </button>
        {error && (
          <p style={{ margin: '0.5rem 0 0 0', color: '#dc2626', fontSize: '0.875rem' }}>
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {error && (
        <div
          style={{
            padding: '0.75rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            color: '#dc2626',
            fontSize: '0.875rem',
          }}
        >
          {error}
        </div>
      )}

      {suggestions.map((suggestion) => (
        <SuggestionCard
          key={suggestion.id}
          suggestion={suggestion}
          onDraftEmail={() => handleDraftEmail(suggestion.id)}
          loading={loading}
        />
      ))}
    </div>
  );
}

function SuggestionCard({
  suggestion,
  onDraftEmail,
  loading,
}: {
  suggestion: FollowUpSuggestion;
  onDraftEmail: () => void;
  loading: boolean;
}): JSX.Element {
  const [showEmailBody, setShowEmailBody] = useState(false);
  const hasDraft = suggestion.emailDrafts.length > 0;
  const draft = suggestion.emailDrafts[0]; // Show most recent draft

  const suggestedDate = new Date(suggestion.suggestedAt);
  const now = new Date();
  const isPastDue = suggestedDate < now;

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
          marginBottom: '0.75rem',
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
                backgroundColor: isPastDue ? '#fef3c7' : '#dbeafe',
                color: isPastDue ? '#92400e' : '#1e40af',
                border: `1px solid ${isPastDue ? '#fbbf24' : '#93c5fd'}`,
              }}
            >
              {isPastDue ? 'Due' : 'Scheduled'}
            </span>
            <span style={{ fontSize: '0.875rem', color: '#666' }}>
              {suggestedDate.toLocaleDateString()}
            </span>
          </div>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: '#333' }}>
            {suggestion.text}
          </p>
        </div>

        {!hasDraft && (
          <button
            onClick={onDraftEmail}
            disabled={loading}
            style={{
              padding: '0.5rem 0.75rem',
              fontSize: '0.75rem',
              fontWeight: '500',
              backgroundColor: loading ? '#d1d5db' : '#10b981',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {loading ? 'Drafting...' : 'Draft Email'}
          </button>
        )}
      </div>

      {/* Email Draft */}
      {hasDraft && (
        <div
          style={{
            marginTop: '0.75rem',
            padding: '1rem',
            backgroundColor: '#f9fafb',
            borderRadius: '4px',
            border: '1px solid #e5e7eb',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.5rem',
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#333',
              }}
            >
              Drafted Email
            </p>
            <button
              onClick={() => setShowEmailBody(!showEmailBody)}
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.75rem',
                backgroundColor: '#fff',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {showEmailBody ? 'Hide' : 'Show'} Email
            </button>
          </div>

          <div
            style={{
              padding: '0.75rem',
              backgroundColor: '#fff',
              borderRadius: '4px',
              fontSize: '0.875rem',
            }}
          >
            <p style={{ margin: '0 0 0.5rem 0' }}>
              <strong>Subject:</strong> {draft.subject}
            </p>

            {showEmailBody && (
              <div
                style={{
                  marginTop: '0.75rem',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid #e5e7eb',
                }}
              >
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: '600' }}>Body:</p>
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'inherit',
                    fontSize: '0.875rem',
                    lineHeight: '1.6',
                  }}
                >
                  {draft.body}
                </pre>
              </div>
            )}

            <p
              style={{
                margin: '0.5rem 0 0 0',
                fontSize: '0.75rem',
                color: '#999',
              }}
            >
              Drafted on {new Date(draft.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
