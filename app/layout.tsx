export const metadata = { title: "Inbox AI Drafter" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", maxWidth: 860, margin: "0 auto", padding: 24 }}>
        {children}
      </body>
    </html>
  );
}
