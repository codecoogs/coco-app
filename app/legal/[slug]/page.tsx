import fs from 'fs'
import path from 'path'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'

interface PageProps {
  params: {
    slug: string
  }
}

export async function generateStaticParams() {
  const legalDir = path.join(process.cwd(), 'public/legal')
  const files = fs.readdirSync(legalDir)
  return files
    .filter((file) => file.endsWith('.md') && file !== 'README.md')
    .map((file) => ({
      slug: file.replace('.md', ''),
    }))
}

export default function LegalDocumentPage({ params }: PageProps) {
  const { slug } = params
  const legalDir = path.join(process.cwd(), 'public/legal')
  const filePath = path.join(legalDir, `${slug}.md`)

  if (!fs.existsSync(filePath)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Document not found
            </h1>
            <p className="text-gray-600 mb-6">
              The legal document you're looking for doesn't exist.
            </p>
            <Link
              href="/legal"
              className="inline-block bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition-colors"
            >
              Back to Legal Documents
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const content = fs.readFileSync(filePath, 'utf-8')

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/legal"
          className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-6"
        >
          <span className="mr-2">←</span> Back to Legal Documents
        </Link>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <article className="prose prose-sm sm:prose lg:prose-lg max-w-none">
            <ReactMarkdown
              components={{
                h1: ({ node, ...props }) => (
                  <h1 className="text-3xl font-bold text-gray-900 mb-4" {...props} />
                ),
                h2: ({ node, ...props }) => (
                  <h2 className="text-2xl font-bold text-gray-800 mt-8 mb-4" {...props} />
                ),
                h3: ({ node, ...props }) => (
                  <h3 className="text-xl font-semibold text-gray-700 mt-6 mb-3" {...props} />
                ),
                p: ({ node, ...props }) => (
                  <p className="text-gray-700 mb-4 leading-relaxed" {...props} />
                ),
                ul: ({ node, ...props }) => (
                  <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2" {...props} />
                ),
                ol: ({ node, ...props }) => (
                  <ol className="list-decimal list-inside text-gray-700 mb-4 space-y-2" {...props} />
                ),
                li: ({ node, ...props }) => (
                  <li className="text-gray-700" {...props} />
                ),
                a: ({ node, ...props }) => (
                  <a className="text-blue-600 hover:underline" {...props} />
                ),
                blockquote: ({ node, ...props }) => (
                  <blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-600 my-4" {...props} />
                ),
                code: ({ node, ...props }) => (
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-gray-800" {...props} />
                ),
                pre: ({ node, ...props }) => (
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto mb-4" {...props} />
                ),
                table: ({ node, ...props }) => (
                  <table className="w-full border-collapse border border-gray-300 mb-4" {...props} />
                ),
                th: ({ node, ...props }) => (
                  <th className="border border-gray-300 bg-gray-100 p-2 text-left font-semibold" {...props} />
                ),
                td: ({ node, ...props }) => (
                  <td className="border border-gray-300 p-2" {...props} />
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          </article>

          <div className="mt-12 pt-8 border-t border-gray-200">
            <p className="text-sm text-gray-600 mb-4">
              Last updated: {new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
            <Link
              href="/legal"
              className="inline-block bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition-colors"
            >
              Back to Legal Documents
            </Link>
          </div>
        </div>

        <div className="mt-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-2">Have questions?</h3>
          <p className="text-blue-800">
            Contact us at{' '}
            <a
              href="mailto:main@codecoogs.com"
              className="font-semibold hover:underline"
            >
              main@codecoogs.com
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
