import AdminPanel from "@/components/Admin/AdminPanel";
import { Toaster } from "@/components/ui/toaster";
import { MenuProvider } from "@/providers/MenuProvider";

export default function AdminPage() {
  return (
    <MenuProvider>
      <AdminPanel />
      <Toaster />
    </MenuProvider>
  );
}
