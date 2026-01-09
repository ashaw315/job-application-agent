import Link from 'next/link';
import { getQueueJobs } from '@/lib/queue';
import { QueueJobCard } from './QueueJobCard';

export default async function QueuePage(): Promise<JSX.Element> {
  const jobs = await getQueueJobs();

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '0.5rem' }}>
          Approval Queue
        </h1>
        <p style={{ color: '#6b7280', fontSize: '1rem' }}>
          Review and approve job applications before they&apos;re ready to apply
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '2rem',
          fontSize: '0.875rem',
        }}
      >
        <Link
          href="/jobs"
          style={{
            color: '#0070f3',
            textDecoration: 'none',
          }}
        >
          ← Back to Jobs
        </Link>
        <span style={{ color: '#d1d5db' }}>|</span>
        <Link
          href="/jobs/new"
          style={{
            color: '#0070f3',
            textDecoration: 'none',
          }}
        >
          Add New Job
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div
          style={{
            padding: '3rem',
            textAlign: 'center',
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
          }}
        >
          <p style={{ color: '#6b7280', fontSize: '1rem' }}>
            No jobs in the approval queue
          </p>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            Jobs with status &quot;in_review&quot; or &quot;needs_attention&quot; will
            appear here
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {jobs.map((job) => (
            <QueueJobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}
