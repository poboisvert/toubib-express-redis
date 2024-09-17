import { inter } from "@/app/ui/fonts";

export default function AcmeLogo() {
  return (
    <div
      className={`${inter.className} flex flex-row items-center leading-none text-white`}
    >
      <p className='text-[44px]'>Redis App</p>
    </div>
  );
}
