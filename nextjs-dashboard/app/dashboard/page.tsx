import { Card } from "@/app/ui/dashboard/cards";
import LatestInvoices from "@/app/ui/dashboard/latest-invoices";
import { inter } from "@/app/ui/fonts";

import { LatestInvoicesSkeleton } from "@/app/ui/skeletons";
import { Suspense } from "react";

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
      <div className='mt-6 grid grid-cols-1 gap-6 md:grid-cols-4 lg:grid-cols-8'>
        <Suspense fallback={<LatestInvoicesSkeleton />}>
          <LatestInvoices />
        </Suspense>
      </div>
    </main>
  );
}
