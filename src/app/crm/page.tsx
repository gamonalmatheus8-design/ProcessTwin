import { CrmDashboard } from "@/features/crm/crm-dashboard";

export const metadata = {
  title: "CRM Dashboard",
  description: "Dashboard comercial para gestão de pipeline, leads e atividades.",
};

export default function CrmPage() {
  return <CrmDashboard />;
}
