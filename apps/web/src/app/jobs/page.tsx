import Link from 'next/link';
import { getJobPostings } from '@/lib/jobs';

export const dynamic = 'force-dynamic';

export default async function JobsPage(): Promise<JSX.Element> {
  const jobs = await getJobPostings();

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
        }}
      >
        <h1 style={{ margin: 0 }}>Job Postings</h1>
        <Link
          href="/jobs/new"
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#0070f3',
            color: '#fff',
            textDecoration: 'none',
            borderRadius: '6px',
            fontWeight: '500',
          }}
        >
          + Add New Job
        </Link>
      </div>

      {jobs.length === 0 ? (
        <p>No job postings found. Run the seed script to create sample data.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {jobs.map((job) => (
            <div
              key={job.id}
              style={{
                border: '1px solid #ddd',
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
                  marginBottom: '0.5rem',
                }}
              >
                <div>
                  <Link
                    href={`/jobs/${job.id}`}
                    style={{
                      fontSize: '1.25rem',
                      fontWeight: 'bold',
                      color: '#0070f3',
                      textDecoration: 'none',
                    }}
                  >
                    {job.title}
                  </Link>
                  <p style={{ margin: '0.25rem 0', color: '#666' }}>
                    {job.company}
                    {job.location && ` • ${job.location}`}
                  </p>
                </div>
                <span
                  style={{
                    padding: '0.25rem 0.75rem',
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
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#999' }}>
                Posted: {new Date(job.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    new: '#10b981',
    needs_attention: '#f59e0b',
    in_review: '#3b82f6',
    applied: '#8b5cf6',
    rejected: '#ef4444',
    archived: '#6b7280',
  };
  return colors[status] || '#6b7280';
}
