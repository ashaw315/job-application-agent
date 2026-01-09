import Link from 'next/link';

export default function NotFound(): JSX.Element {
  return (
    <div
      style={{
        padding: '4rem 2rem',
        textAlign: 'center',
        maxWidth: '600px',
        margin: '0 auto',
      }}
    >
      <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>404</h1>
      <h2 style={{ marginBottom: '1rem' }}>Job Not Found</h2>
      <p style={{ marginBottom: '2rem', color: '#666' }}>
        The job posting you&apos;re looking for doesn&apos;t exist or has been removed.
      </p>
      <Link
        href="/jobs"
        style={{
          display: 'inline-block',
          padding: '0.75rem 1.5rem',
          backgroundColor: '#0070f3',
          color: '#fff',
          textDecoration: 'none',
          borderRadius: '6px',
          fontWeight: '500',
        }}
      >
        Back to Jobs
      </Link>
    </div>
  );
}
