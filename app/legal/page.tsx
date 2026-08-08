import Link from 'next/link'

const documents = [
  {
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    description: 'How we collect, use, and protect your data',
  },
  {
    slug: 'terms-of-service',
    title: 'Terms of Service',
    description: 'The rules and terms for using CodeCoogs',
  },
  {
    slug: 'cookie-policy',
    title: 'Cookie Policy',
    description: 'Information about cookies and local storage',
  },
  {
    slug: 'third-party-services',
    title: 'Third-Party Services',
    description: 'What data is shared with external services',
  },
  {
    slug: 'data-access-request',
    title: 'Data Access & Deletion',
    description: 'How to access, update, or delete your data',
  },
  {
    slug: 'disclaimers',
    title: 'Disclaimers',
    description: 'Important legal disclaimers and limitations',
  },
]

export default function LegalPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Legal & Privacy</h1>
        <p className="text-lg text-gray-600 mb-12">
          Learn about how CodeCoogs handles your data and our terms of service.
        </p>

        <div className="grid gap-6">
          {documents.map((doc) => (
            <Link
              key={doc.slug}
              href={`/legal/${doc.slug}`}
              className="block p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-200 hover:border-blue-400"
            >
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {doc.title}
              </h2>
              <p className="text-gray-600">{doc.description}</p>
            </Link>
          ))}
        </div>

        <div className="mt-12 p-6 bg-blue-50 rounded-lg border border-blue-200">
          <h2 className="text-lg font-semibold text-blue-900 mb-2">
            Questions about your data?
          </h2>
          <p className="text-blue-800 mb-3">
            Contact us at{' '}
            <a
              href="mailto:main@codecoogs.com"
              className="font-semibold hover:underline"
            >
              main@codecoogs.com
            </a>
          </p>
          <p className="text-sm text-blue-700">
            We'll respond to data access requests within 7 business days.
          </p>
        </div>
      </div>
    </div>
  )
}
