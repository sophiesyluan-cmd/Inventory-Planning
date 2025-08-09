export const metadata = { title: "HSNA – BOM Netting", description: "Multi-level netting • Transit-aware • Container plan • Draft emails" };
import "./globals.css";
export default function RootLayout({ children }: { children: React.ReactNode }){
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
