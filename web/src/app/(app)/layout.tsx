import { redirect } from "next/navigation";
import { getUserFromServer } from "@/lib/server/auth";
import { AppSidebarAndHeader } from "@/components/layout-client";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUserFromServer();
  
  if (!user) {
    redirect("/");
  }

  return (
    <>
      <AppSidebarAndHeader user={user} />
      <div className="min-h-screen pt-14 md:pt-0 md:pl-64">
        {children}
      </div>
    </>
  );
}
