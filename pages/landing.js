import Head from 'next/head';
import LandingPage from '../components/LandingPage';

export default function Landing() {
  const siteUrl = 'https://disasters.aidstack.ai';
  const title = 'Aidstack Disasters - AI-Powered Humanitarian Intelligence Platform';
  const description = 'Admin-level humanitarian analysis from uploaded boundary shapefiles. Combine GDACS, ACLED, WorldPop, OSM infrastructure, Earth Engine hazard context, and temporal trend analysis in one auditable workspace for forecast, operational outlook, and prioritization.';
  const keywords = 'humanitarian technology, disaster response, GDACS, ACLED, WorldPop, Google Earth Engine, admin boundary analysis, prioritization board, operational outlook, emergency response platform, humanitarian operations, conflict mapping, population data, OSM infrastructure, logistics assessment, trend analysis, temporal patterns';

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
        <meta property="og:site_name" content="Aidstack Disasters" />
        <meta property="og:locale" content="en_US" />

        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content={`${siteUrl}/landing`} />
        <meta property="twitter:title" content={title} />
        <meta property="twitter:description" content={description} />
        <meta name="twitter:creator" content="@aidstack" />

        {/* Additional Meta Tags */}
        <meta name="theme-color" content="#1A365D" />
        <meta name="msapplication-TileColor" content="#1A365D" />

        {/* Favicon */}
        <link rel="icon" type="image/svg+xml" href="/images/gdacs/warning.svg" />

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
              author: {
                '@type': 'Organization',
                name: 'Aidstack',
                url: 'https://aidstack.ai'
              },
              featureList: [
                'Real-time GDACS disaster monitoring',
                'ACLED conflict event tracking',
                'WorldPop population demographics',
                'Admin boundary shapefile analysis',
                'District hazard analysis with auditable drivers',
                'Operational outlook and prioritization board',
                'Operation viability analysis',
                'Flood and drought context overlays',
                'Nighttime lights date comparison',
                'Batch site assessment',
                'Interactive geospatial mapping',
                'AI-assisted decision support',
                'OSM infrastructure integration and logistics assessment',
                'Temporal trend analysis and pattern detection',
                'Multi-tier caching for offline capability'
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
              sameAs: [
                'https://github.com/jmesplana/gdacs_ai'
              ]
            })
          }}
        />
      </Head>
      <LandingPage />
    </>
  );
}
