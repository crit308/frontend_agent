import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/contexts/AuthContext";
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PanelLeft } from "lucide-react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Tutor",
  description: "Learn interactively with your documents",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(inter.className, "min-h-screen flex")} suppressHydrationWarning>
        <AuthProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <SidebarProvider>
              <Sidebar collapsible="icon">
                <SidebarHeader>
                  <h2 className="text-lg font-semibold">AI Tutor</h2>
                </SidebarHeader>
                <SidebarContent>
                  <p className="p-4">Sidebar Content</p>
                </SidebarContent>
              </Sidebar>

              <div className="flex flex-col flex-1 overflow-auto">
                <header className="sticky top-0 z-10 flex h-[57px] items-center gap-1 border-b bg-background px-4">
                   <SidebarTrigger asChild>
                      <Button variant="ghost" size="icon" className="md:hidden">
                         <PanelLeft className="h-5 w-5" />
                         <span className="sr-only">Toggle Menu</span>
                      </Button>
                   </SidebarTrigger>
                   <h1 className="flex-1 text-xl font-semibold">AI Tutor</h1>
                 </header>
                <main className="flex-1 p-4">
                 {children}
                </main>
                <Toaster />
              </div>
            </SidebarProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
