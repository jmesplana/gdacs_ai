import Head from 'next/head';
import LandingPage from '../components/LandingPage';

export default function Landing() {
  return (
    <>
      <Head>
        <title>Aidstack Disasters - Intelligence for Impact Workers</title>
        <meta name="description" content="Monitor global disasters, assess facility risks, and deploy humanitarian operations faster with AI-powered insights" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <LandingPage />
    </>
  );
}
