'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface CoverLetterDisplayProps {
  materialPacketId: string;
  versions: Array<{
    id: string;
    version: number;
    stage: string;
    type: string;
    content: string;
    createdAt: Date;
  }>;
}

interface CoverLetterContent {
  text: string;
  citations?: {
    selectedBulletIds: string[];
    model: string;
  };
  llmUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  error?: string;
}

export function CoverLetterDisplay({
  materialPacketId,
  versions,
}: CoverLetterDisplayProps): JSX.Element | null {
  const router = useRouter();
  const [showMetadata, setShowMetadata] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Find the most recent cover letter version
  const coverLetterVersion = versions
    .filter((v) => v.type === 'cover_letter')
    .sort((a, b) => b.version - a.version)[0];

  if (!coverLetterVersion) {
    return null;
  }

  let content: CoverLetterContent;
  try {
    content = JSON.parse(coverLetterVersion.content);
  } catch {
    content = { text: coverLetterVersion.content };
  }

  const isPlaceholder = content.text.includes('TODO');

  const handleEdit = () => {
    setEditedContent(content.text);
    setIsEditing(true);
    setSaveError(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedContent('');
    setSaveError(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);

    try {
      const response = await fetch(`/api/materials/${materialPacketId}/edit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: editedContent,
          type: 'cover_letter',
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to save edits');
      }

      // Success - refresh the page to show updated content
      setIsEditing(false);
      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save edits');
    } finally {
      setIsSaving(false);
    }
  };

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
          Cover Letter
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
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
            v{coverLetterVersion.version}
          </span>
          {coverLetterVersion.stage === 'edited' && (
            <span
              style={{
                fontSize: '0.75rem',
                color: '#2563eb',
                padding: '0.25rem 0.5rem',
                backgroundColor: '#eff6ff',
                borderRadius: '4px',
                border: '1px solid #bfdbfe',
              }}
            >
              Edited
            </span>
          )}
          {coverLetterVersion.stage === 'approved' && (
            <span
              style={{
                fontSize: '0.75rem',
                color: '#065f46',
                padding: '0.25rem 0.5rem',
                backgroundColor: '#d1fae5',
                borderRadius: '4px',
                border: '1px solid #6ee7b7',
              }}
            >
              ✓ Approved
            </span>
          )}
          {!isEditing && !isPlaceholder && (
            <button
              onClick={handleEdit}
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.75rem',
                backgroundColor: '#fff',
                color: '#2563eb',
                border: '1px solid #2563eb',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Edit
            </button>
          )}
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
        </div>
      </div>

      {isEditing ? (
        <>
          <textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            style={{
              width: '100%',
              minHeight: '300px',
              padding: '1rem',
              backgroundColor: '#fff',
              borderRadius: '6px',
              border: '1px solid #e5e7eb',
              fontFamily: 'inherit',
              fontSize: '0.875rem',
              lineHeight: '1.6',
              resize: 'vertical',
            }}
          />
          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleSave}
              disabled={isSaving}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                backgroundColor: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                opacity: isSaving ? 0.6 : 1,
              }}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleCancel}
              disabled={isSaving}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                backgroundColor: '#fff',
                color: '#6b7280',
                border: '1px solid #e5e7eb',
                borderRadius: '4px',
                cursor: isSaving ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
          {saveError && (
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
              Error: {saveError}
            </div>
          )}
        </>
      ) : (
        <div
          style={{
            padding: '1rem',
            backgroundColor: '#fff',
            borderRadius: '6px',
            border: '1px solid #e5e7eb',
            whiteSpace: 'pre-wrap',
            lineHeight: '1.6',
            color: isPlaceholder ? '#6b7280' : '#374151',
            fontStyle: isPlaceholder ? 'italic' : 'normal',
          }}
        >
          {content.text}
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
              {new Date(coverLetterVersion.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
