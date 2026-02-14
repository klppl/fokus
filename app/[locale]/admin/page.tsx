import AdminPanel from "@/components/Admin/AdminPanel";
import { MenuProvider } from "@/providers/MenuProvider";

export default function AdminPage() {
  return (
    <MenuProvider>
      <AdminPanel />
    </MenuProvider>
  );
}
