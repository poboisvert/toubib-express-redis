import "@/app/ui/global.css";
import { inter } from "@/app/ui/fonts";
import { SocketProvider } from "@/app/context/socketprovider";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang='en'>
      <SocketProvider>
        <body className={`${inter.className} antialiased`}>{children}</body>
      </SocketProvider>
    </html>
  );
}
