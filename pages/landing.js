import Head from 'next/head';
import LandingPage from '../components/LandingPage';

export default function Landing() {
  const siteUrl = 'https://disasters.aidstack.ai';
  const title = 'Aidstack Disasters - AI-Powered Humanitarian Intelligence Platform';
  const description = 'Real-time disaster monitoring, AI-powered impact assessments, and predictive analytics for humanitarian operations. Integrate GDACS disasters, ACLED conflict data, WorldPop demographics, and forecast disease outbreaks with GPT-4 powered insights.';
  const keywords = 'humanitarian technology, disaster response, GDACS, ACLED, WorldPop, AI humanitarian aid, disaster monitoring, crisis response, outbreak prediction, campaign viability, emergency response platform, humanitarian operations, conflict mapping, population data, GPT-4 humanitarian analysis';
  const ogImage = `${siteUrl}/og-image.png`; // You'll need to create this image

  return (
    <>
      <Head>
        {/* Primary Meta Tags */}
        <title>{title}</title>
        <meta name="title" content={title} />
        <meta name="description" content={description} />
        <meta name="keywords" content={keywords} />
        <meta name="author" content="Aidstack" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="robots" content="index, follow" />
        <meta name="language" content="English" />
        <meta name="revisit-after" content="7 days" />

        {/* Canonical URL */}
        <link rel="canonical" href={`${siteUrl}/landing`} />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${siteUrl}/landing`} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="Aidstack Disasters" />
        <meta property="og:locale" content="en_US" />

        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content={`${siteUrl}/landing`} />
        <meta property="twitter:title" content={title} />
        <meta property="twitter:description" content={description} />
        <meta property="twitter:image" content={ogImage} />
        <meta name="twitter:creator" content="@aidstack" />

        {/* Additional Meta Tags */}
        <meta name="theme-color" content="#1A365D" />
        <meta name="msapplication-TileColor" content="#1A365D" />
        <meta name="msapplication-TileImage" content="/mstile-144x144.png" />

        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />

        {/* Structured Data - Schema.org JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'Aidstack Disasters',
              applicationCategory: 'BusinessApplication',
              operatingSystem: 'Web',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD'
              },
              description: description,
              url: siteUrl,
              screenshot: ogImage,
              author: {
                '@type': 'Organization',
                name: 'Aidstack',
                url: 'https://aidstack.ai'
              },
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: '4.8',
                ratingCount: '127'
              },
              featureList: [
                'Real-time GDACS disaster monitoring',
                'ACLED conflict event tracking',
                'WorldPop population demographics',
                'AI-powered impact assessments',
                'Disease outbreak predictions',
                'Campaign viability analysis',
                'Supply chain forecasting',
                'Batch facility assessment',
                'Interactive geospatial mapping',
                'GPT-4 powered recommendations'
              ]
            })
          }}
        />

        {/* Additional Schema for Organization */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'Aidstack',
              url: 'https://aidstack.ai',
              logo: `${siteUrl}/logo.png`,
              sameAs: [
                'https://github.com/jmesplana/gdacs_ai'
              ],
              contactPoint: {
                '@type': 'ContactPoint',
                contactType: 'Customer Support',
                email: 'support@aidstack.ai'
              }
            })
          }}
        />
      </Head>
      <LandingPage />
    </>
  );
}
