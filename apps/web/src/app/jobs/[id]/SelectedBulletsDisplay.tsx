'use client';

import { useEffect, useState } from 'react';

interface SelectedBulletsDisplayProps {
  metadata: string | null;
}

interface BulletScore {
  bulletId: string;
  overlapScore: number;
}

interface MaterialMetadata {
  selectedKbBulletIds: string[];
  jobKeywords: string[];
  bulletScores: BulletScore[];
}

interface KbBullet {
  id: string;
  text: string;
}

export function SelectedBulletsDisplay({
  metadata,
}: SelectedBulletsDisplayProps): JSX.Element | null {
  const [bullets, setBullets] = useState<KbBullet[]>([]);
  const [bulletScores, setBulletScores] = useState<BulletScore[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!metadata) return;

    try {
      const parsed: MaterialMetadata = JSON.parse(metadata);
      setBulletScores(parsed.bulletScores || []);

      // Fetch the bullet texts from the API
      const fetchBullets = async (): Promise<void> => {
        setLoading(true);
        try {
          const response = await fetch('/api/kb/bullets');
          if (!response.ok) {
            throw new Error('Failed to fetch KB bullets');
          }
          const data = await response.json();
          const allBullets: KbBullet[] = data.bullets || [];

          // Filter to only selected bullets
          const selected = allBullets.filter((b) =>
            parsed.selectedKbBulletIds.includes(b.id)
          );

          // Sort by overlap score (desc)
          const sorted = selected.sort((a, b) => {
            const scoreA =
              parsed.bulletScores.find((s) => s.bulletId === a.id)
                ?.overlapScore || 0;
            const scoreB =
              parsed.bulletScores.find((s) => s.bulletId === b.id)
                ?.overlapScore || 0;
            return scoreB - scoreA;
          });

          setBullets(sorted);
        } catch (error) {
          console.error('Error fetching KB bullets:', error);
        } finally {
          setLoading(false);
        }
      };

      fetchBullets();
    } catch (error) {
      console.error('Error parsing metadata:', error);
    }
  }, [metadata]);

  if (!metadata) {
    return null;
  }

  if (loading) {
    return (
      <div
        style={{
          padding: '1rem',
          backgroundColor: '#f9fafb',
          borderRadius: '6px',
          border: '1px solid #e5e7eb',
        }}
      >
        <p style={{ margin: 0, color: '#6b7280' }}>Loading KB bullets...</p>
      </div>
    );
  }

  if (bullets.length === 0) {
    return (
      <div
        style={{
          padding: '1rem',
          backgroundColor: '#f9fafb',
          borderRadius: '6px',
          border: '1px solid #e5e7eb',
        }}
      >
        <p style={{ margin: 0, color: '#6b7280' }}>
          No KB bullets selected for drafting.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '1rem',
        backgroundColor: '#f9fafb',
        borderRadius: '6px',
        border: '1px solid #e5e7eb',
      }}
    >
      <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: '#6b7280' }}>
        These bullets from your resume KB will be used for drafting application
        materials:
      </p>
      <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
        {bullets.map((bullet) => {
          const score = bulletScores.find((s) => s.bulletId === bullet.id);
          return (
            <li
              key={bullet.id}
              style={{ marginBottom: '0.5rem', color: '#374151' }}
            >
              {bullet.text}
              {score && score.overlapScore > 0 && (
                <span
                  style={{
                    marginLeft: '0.5rem',
                    fontSize: '0.75rem',
                    color: '#10b981',
                    fontWeight: '600',
                  }}
                >
                  ({score.overlapScore} keyword{score.overlapScore !== 1 ? 's' : ''})
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
