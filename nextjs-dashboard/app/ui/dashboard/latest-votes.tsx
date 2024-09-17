"use client";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { inter } from "@/app/ui/fonts";
import { fetchItems } from "@/app/lib/data";
import { useEffect, useState } from "react";

export default function LatestInvoices() {
  const [data, setData] = useState([]);

  useEffect(() => {
    const fetchLatestVotes = async () => {
      const latestInvoices = await fetchItems();
      setData(
        latestInvoices.sort(
          (a: { numVotes: number }, b: { numVotes: number }) =>
            b.numVotes - a.numVotes
        )
      );
    };

    fetchLatestVotes();

    const interval = setInterval(fetchLatestVotes, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className='flex w-full flex-col md:col-span-4'>
      <h2 className={`${inter.className} mb-4 text-xl md:text-2xl`}>
        Latest Votes
      </h2>
      <div className='flex grow flex-col justify-between rounded-xl bg-gray-50 p-4'>
        <div className='bg-white px-6'>
          {data.map((item: any, i: number) => {
            // Mapping each category to a generic emoji
            const categoryEmojiMap = {
              cafe: "🍵",
              restaurant: "🍴",
              store: "🛍️",
              default: "🚀", // Default emoji for unknown categories
            };
            const categoryEmoji =
              categoryEmojiMap[
                item.category as keyof typeof categoryEmojiMap
              ] || categoryEmojiMap["default"];

            return (
              <div
                key={item.id}
                className={clsx(
                  "flex flex-row items-center justify-between py-4",
                  {
                    "border-t": i !== 0,
                  }
                )}
              >
                <div className='flex items-center'>
                  <div className='flex items-center px-3 py-0'>
                    {categoryEmoji}
                  </div>
                  <div className='min-w-0'>
                    <p className='truncate text-sm font-semibold md:text-base'>
                      {item.name}
                    </p>
                    <p className='hidden text-sm text-gray-500 sm:block'>
                      {item.category}
                    </p>
                  </div>
                </div>
                <p
                  className={`${inter.className} truncate text-sm font-medium md:text-base`}
                >
                  {item.numVotes} votes, {item.numStars} stars w/{" "}
                  {item.averageStars} stars average
                </p>
              </div>
            );
          })}
        </div>
        <div className='flex items-center pb-2 pt-6'>
          <ArrowPathIcon className='h-5 w-5 text-gray-500' />
          <h3 className='ml-2 text-sm text-gray-500 '>Updated just now</h3>
        </div>
      </div>
    </div>
  );
}
