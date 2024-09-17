import { Card } from "@/app/ui/dashboard/cards";
import LatestVotes from "@/app/ui/dashboard/latest-votes";
import { inter } from "@/app/ui/fonts";

import { LatestVotesSkeleton } from "@/app/ui/skeletons";
import { Suspense } from "react";

export const dynamicParams = true;
// Next.js will invalidate the cache when a
// request comes in, at most once every 0 seconds.
export const revalidate = 0;

export default async function Page() {
  return (
    <main>
      <h1 className={`${inter.className} mb-4 text-xl md:text-2xl`}>
        Redis App
      </h1>
      <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-4'>
        <Card title='Collected' value={10} type='collected' />
        <Card title='Pending' value={12} type='pending' />
        <Card title='Total Invoices' value={31} type='invoices' />
        <Card title='Total Customers' value={13} type='customers' />
      </div>
      <div className='mt-6 grid grid-cols-1 gap-4 md:grid-cols-4 lg:grid-cols-4'>
        <Suspense fallback={<LatestVotesSkeleton />}>
          <LatestVotes />
        </Suspense>
      </div>
    </main>
  );
}
