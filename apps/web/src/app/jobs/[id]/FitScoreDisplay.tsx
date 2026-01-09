'use client';

import { useState } from 'react';

interface FitScoreDisplayProps {
  fitScore: {
    id: string;
    score: number;
    reasoning: string;
  } | null;
}

interface MatchedBullet {
  bulletId: string;
  bulletText: string;
  category: 'strong' | 'partial' | 'gap' | 'risk';
  evidence: string[];
  score: number;
}

interface ScoreBreakdown {
  keywordMatches: number;
  bulletMatches: number;
  roleTypeBonus: number;
  seniorityBonus: number;
  remoteBonus: number;
  total: number;
}

interface ParsedReasoning {
  reasoning: string;
  breakdown: ScoreBreakdown;
  bullets: MatchedBullet[];
}

export function FitScoreDisplay({ fitScore }: FitScoreDisplayProps): JSX.Element | null {
  const [showBreakdown, setShowBreakdown] = useState(false);

  if (!fitScore) {
    return null;
  }

  const parsedReasoning: ParsedReasoning = JSON.parse(fitScore.reasoning);

  const strongBullets = parsedReasoning.bullets.filter((b) => b.category === 'strong');
  const partialBullets = parsedReasoning.bullets.filter((b) => b.category === 'partial');
  const gapBullets = parsedReasoning.bullets.filter((b) => b.category === 'gap');
  const riskBullets = parsedReasoning.bullets.filter((b) => b.category === 'risk');

  const getScoreColor = (score: number): string => {
    if (score >= 80) return '#10b981'; // green
    if (score >= 60) return '#3b82f6'; // blue
    if (score >= 40) return '#f59e0b'; // orange
    return '#ef4444'; // red
  };

  const getCategoryColor = (category: string): string => {
    switch (category) {
      case 'strong':
        return '#10b981';
      case 'partial':
        return '#3b82f6';
      case 'gap':
        return '#6b7280';
      case 'risk':
        return '#ef4444';
      default:
        return '#6b7280';
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>
          Fit Score
        </h3>
        <div
          style={{
            fontSize: '2rem',
            fontWeight: '700',
            color: getScoreColor(fitScore.score),
          }}
        >
          {fitScore.score}/100
        </div>
      </div>

      <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.875rem', color: '#6b7280', lineHeight: '1.5' }}>
        {parsedReasoning.reasoning}
      </p>

      {/* Score Breakdown Summary */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: '0.75rem',
          marginBottom: '1.5rem',
          padding: '1rem',
          backgroundColor: '#fff',
          borderRadius: '6px',
          border: '1px solid #e5e7eb',
        }}
      >
        <div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
            Keywords
          </div>
          <div style={{ fontSize: '1.125rem', fontWeight: '600' }}>
            +{parsedReasoning.breakdown.keywordMatches}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
            Bullets
          </div>
          <div style={{ fontSize: '1.125rem', fontWeight: '600' }}>
            +{parsedReasoning.breakdown.bulletMatches}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
            Role
          </div>
          <div style={{ fontSize: '1.125rem', fontWeight: '600' }}>
            +{parsedReasoning.breakdown.roleTypeBonus}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
            Seniority
          </div>
          <div style={{ fontSize: '1.125rem', fontWeight: '600' }}>
            +{parsedReasoning.breakdown.seniorityBonus}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
            Remote
          </div>
          <div style={{ fontSize: '1.125rem', fontWeight: '600' }}>
            +{parsedReasoning.breakdown.remoteBonus}
          </div>
        </div>
      </div>

      {/* Bullet Categories */}
      <div style={{ marginBottom: '1rem' }}>
        {strongBullets.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <h4
              style={{
                margin: '0 0 0.5rem 0',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: getCategoryColor('strong'),
              }}
            >
              Strong Matches ({strongBullets.length})
            </h4>
            <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.875rem' }}>
              {strongBullets.map((bullet) => (
                <li key={bullet.bulletId} style={{ marginBottom: '0.5rem', color: '#374151' }}>
                  {bullet.bulletText}
                  <span style={{ marginLeft: '0.5rem', color: '#10b981', fontWeight: '600' }}>
                    (+{bullet.score})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {partialBullets.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <h4
              style={{
                margin: '0 0 0.5rem 0',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: getCategoryColor('partial'),
              }}
            >
              Partial Matches ({partialBullets.length})
            </h4>
            <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.875rem' }}>
              {partialBullets.map((bullet) => (
                <li key={bullet.bulletId} style={{ marginBottom: '0.5rem', color: '#374151' }}>
                  {bullet.bulletText}
                  <span style={{ marginLeft: '0.5rem', color: '#3b82f6', fontWeight: '600' }}>
                    (+{bullet.score})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {gapBullets.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <h4
              style={{
                margin: '0 0 0.5rem 0',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: getCategoryColor('gap'),
              }}
            >
              Gaps ({gapBullets.length})
            </h4>
            <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.875rem' }}>
              {gapBullets.slice(0, 3).map((bullet) => (
                <li key={bullet.bulletId} style={{ marginBottom: '0.5rem', color: '#6b7280' }}>
                  {bullet.bulletText}
                </li>
              ))}
              {gapBullets.length > 3 && (
                <li style={{ color: '#6b7280', fontStyle: 'italic' }}>
                  ...and {gapBullets.length - 3} more
                </li>
              )}
            </ul>
          </div>
        )}

        {riskBullets.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <h4
              style={{
                margin: '0 0 0.5rem 0',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: getCategoryColor('risk'),
              }}
            >
              Risks ({riskBullets.length})
            </h4>
            <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.875rem' }}>
              {riskBullets.map((bullet) => (
                <li key={bullet.bulletId} style={{ marginBottom: '0.5rem', color: '#ef4444' }}>
                  {bullet.bulletText}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Expandable JSON Breakdown */}
      <button
        onClick={() => setShowBreakdown(!showBreakdown)}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: '#fff',
          color: '#374151',
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          fontSize: '0.875rem',
          cursor: 'pointer',
          width: '100%',
          textAlign: 'left',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>{showBreakdown ? 'Hide' : 'Show'} Detailed Breakdown</span>
        <span>{showBreakdown ? '▲' : '▼'}</span>
      </button>

      {showBreakdown && (
        <pre
          style={{
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: '#1f2937',
            color: '#f9fafb',
            borderRadius: '6px',
            fontSize: '0.75rem',
            overflow: 'auto',
            maxHeight: '400px',
          }}
        >
          {JSON.stringify(parsedReasoning, null, 2)}
        </pre>
      )}
    </div>
  );
}
