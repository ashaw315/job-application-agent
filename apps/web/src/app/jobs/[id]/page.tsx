import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getJobPostingById } from '@/lib/jobs';
import { RunPipelineButton } from './RunPipelineButton';
import { FitScoreDisplay } from './FitScoreDisplay';
import { ComputeScoreButton } from './ComputeScoreButton';
import { SelectedBulletsDisplay } from './SelectedBulletsDisplay';
import { CoverLetterDisplay } from './CoverLetterDisplay';
import { ResumeVariantDisplay } from './ResumeVariantDisplay';

interface JobDetailPageProps {
  params: {
    id: string;
  };
}

export default async function JobDetailPage({
  params,
}: JobDetailPageProps): Promise<JSX.Element> {
  const job = await getJobPostingById(params.id);

  if (!job) {
    notFound();
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <Link
        href="/jobs"
        style={{
          color: '#0070f3',
          textDecoration: 'none',
          display: 'inline-block',
          marginBottom: '1rem',
        }}
      >
        ← Back to Jobs
      </Link>

      <div
        style={{
          border: '1px solid #ddd',
          borderRadius: '8px',
          padding: '2rem',
          backgroundColor: '#fff',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '1.5rem',
          }}
        >
          <div>
            <h1 style={{ margin: '0 0 0.5rem 0' }}>{job.title}</h1>
            <p style={{ margin: 0, fontSize: '1.125rem', color: '#666' }}>
              {job.company}
            </p>
          </div>
          <span
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              fontSize: '0.875rem',
              fontWeight: '500',
              backgroundColor: getStatusColor(job.status),
              color: '#fff',
            }}
          >
            {job.status}
          </span>
        </div>

        {job.status === 'needs_attention' && (
          <div
            style={{
              padding: '1rem',
              marginBottom: '1.5rem',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '6px',
            }}
          >
            <h3
              style={{
                margin: '0 0 0.5rem 0',
                fontSize: '1rem',
                fontWeight: '600',
                color: '#dc2626',
              }}
            >
              ⚠️ Attention Required
            </h3>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#7c2d12' }}>
              This job requires manual review. Check the validation errors in the
              Resume Variant section below.
            </p>
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '1rem',
            marginBottom: '2rem',
            padding: '1.5rem',
            backgroundColor: '#f9fafb',
            borderRadius: '6px',
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#666' }}>
              Location
            </p>
            <p style={{ margin: '0.25rem 0 0 0', fontWeight: '500' }}>
              {job.location || 'Not specified'}
            </p>
          </div>

          <div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#666' }}>
              Salary Range
            </p>
            <p style={{ margin: '0.25rem 0 0 0', fontWeight: '500' }}>
              {job.salaryMin && job.salaryMax
                ? `$${job.salaryMin.toLocaleString()} - $${job.salaryMax.toLocaleString()}`
                : 'Not specified'}
            </p>
          </div>

          <div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#666' }}>
              Posted
            </p>
            <p style={{ margin: '0.25rem 0 0 0', fontWeight: '500' }}>
              {new Date(job.createdAt).toLocaleDateString()}
            </p>
          </div>

          <div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#666' }}>
              Last Updated
            </p>
            <p style={{ margin: '0.25rem 0 0 0', fontWeight: '500' }}>
              {new Date(job.updatedAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>
            Description
          </h2>
          <div
            style={{
              whiteSpace: 'pre-wrap',
              lineHeight: '1.6',
              color: '#333',
            }}
          >
            {job.description}
          </div>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>
            Fit Score
          </h2>
          {job.fitScore ? (
            <FitScoreDisplay fitScore={job.fitScore} />
          ) : (
            <ComputeScoreButton jobId={job.id} hasFitScore={false} />
          )}
          {job.fitScore && (
            <div style={{ marginTop: '1rem' }}>
              <ComputeScoreButton jobId={job.id} hasFitScore={true} />
            </div>
          )}
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>
            Job Source
          </h2>
          <div
            style={{
              padding: '1rem',
              backgroundColor: '#f9fafb',
              borderRadius: '6px',
            }}
          >
            <p style={{ margin: '0 0 0.5rem 0' }}>
              <strong>URL:</strong>{' '}
              <a
                href={job.jobSource.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#0070f3', textDecoration: 'none' }}
              >
                {job.jobSource.url}
              </a>
            </p>
            <p style={{ margin: 0 }}>
              <strong>ATS Type:</strong> {job.jobSource.atsType}
            </p>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: '#666' }}>
              Scraped: {new Date(job.jobSource.scrapedAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <RunPipelineButton jobId={job.id} currentStatus={job.status} />
        </div>

        {job.materialPackets.length > 0 && job.materialPackets[0].metadata && (
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>
              Selected KB Bullets (for Drafting)
            </h2>
            <SelectedBulletsDisplay metadata={job.materialPackets[0].metadata} />
          </div>
        )}

        {job.materialPackets.length > 0 && job.materialPackets[0].versions.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>
              Application Materials
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <CoverLetterDisplay versions={job.materialPackets[0].versions} />
              <ResumeVariantDisplay versions={job.materialPackets[0].versions} />
            </div>
          </div>
        )}

        <div
          style={{
            padding: '1rem',
            backgroundColor: '#f0f0f0',
            borderRadius: '6px',
            fontSize: '0.875rem',
            color: '#666',
          }}
        >
          <p style={{ margin: 0 }}>
            <strong>Dedupe Key:</strong> {job.dedupeKey}
          </p>
          <p style={{ margin: '0.5rem 0 0 0' }}>
            <strong>ID:</strong> {job.id}
          </p>
        </div>
      </div>
    </div>
  );
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    new: '#10b981',
    scored: '#3b82f6',
    needs_attention: '#f59e0b',
    in_review: '#3b82f6',
    applied: '#8b5cf6',
    rejected: '#ef4444',
    archived: '#6b7280',
  };
  return colors[status] || '#6b7280';
}
