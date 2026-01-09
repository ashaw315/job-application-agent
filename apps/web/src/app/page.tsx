import Link from 'next/link';

export default function Home(): JSX.Element {
  return (
    <main style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Job Application Agent v0</h1>
      <p style={{ marginBottom: '2rem' }}>
        AI-powered job application assistant to help you find, track, and apply
        to jobs.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <Link
          href="/jobs"
          style={{
            padding: '1rem 1.5rem',
            backgroundColor: '#0070f3',
            color: '#fff',
            textDecoration: 'none',
            borderRadius: '6px',
            fontWeight: '500',
            textAlign: 'center',
          }}
        >
          Browse Job Postings
        </Link>
      </div>
    </main>
  );
}
