import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to landing page
    router.push('/landing');
  }, [router]);

  return null;
}
