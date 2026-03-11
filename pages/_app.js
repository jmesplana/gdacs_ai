import '../styles/globals.css'
import { Analytics } from '@vercel/analytics/react'
import Head from 'next/head'

function MyApp({ Component, pageProps }) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
      </Head>
      <Component {...pageProps} />
      <Analytics />
    </>
  )
}

export default MyApp