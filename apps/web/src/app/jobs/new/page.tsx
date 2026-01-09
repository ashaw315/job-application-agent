'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewJobPage(): JSX.Element {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    const requestBody = {
      sourceType: 'manual',
      manual: {
        companyName: formData.get('companyName') as string,
        title: formData.get('title') as string,
        location: formData.get('location') as string || undefined,
        description: formData.get('description') as string,
      },
    };

    try {
      const response = await fetch('/api/jobs/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to create job posting');
        setIsSubmitting(false);
        return;
      }

      // Navigate to the newly created job
      router.push(`/jobs/${data.jobId}`);
    } catch (err) {
      setError('Failed to create job posting. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
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

      <h1 style={{ marginBottom: '2rem' }}>Add New Job Posting</h1>

      {error && (
        <div
          style={{
            padding: '1rem',
            marginBottom: '1rem',
            backgroundColor: '#fee',
            border: '1px solid #fcc',
            borderRadius: '4px',
            color: '#c00',
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1.5rem' }}>
          <label
            htmlFor="companyName"
            style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}
          >
            Company Name *
          </label>
          <input
            type="text"
            id="companyName"
            name="companyName"
            required
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '0.5rem',
              fontSize: '1rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label
            htmlFor="title"
            style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}
          >
            Job Title *
          </label>
          <input
            type="text"
            id="title"
            name="title"
            required
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '0.5rem',
              fontSize: '1rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label
            htmlFor="location"
            style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}
          >
            Location
          </label>
          <input
            type="text"
            id="location"
            name="location"
            placeholder="e.g. San Francisco, CA or Remote"
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '0.5rem',
              fontSize: '1rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label
            htmlFor="description"
            style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}
          >
            Job Description *
          </label>
          <textarea
            id="description"
            name="description"
            required
            disabled={isSubmitting}
            rows={10}
            style={{
              width: '100%',
              padding: '0.5rem',
              fontSize: '1rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              fontWeight: '500',
              color: '#fff',
              backgroundColor: isSubmitting ? '#999' : '#0070f3',
              border: 'none',
              borderRadius: '4px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
            }}
          >
            {isSubmitting ? 'Creating...' : 'Create Job Posting'}
          </button>

          <Link
            href="/jobs"
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              fontWeight: '500',
              color: '#333',
              backgroundColor: '#f0f0f0',
              border: 'none',
              borderRadius: '4px',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
