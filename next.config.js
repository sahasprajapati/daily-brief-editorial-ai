import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: ['payload-richtext-tiptap'],
  // Brief text is extracted in the browser; server actions only receive text (not PDF/DOCX bytes).
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
}

export default withPayload(nextConfig, {
  devBundleServerPackages: false,
})
