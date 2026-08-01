import { CircleCheck, Clock3, ShieldCheck } from "lucide-react";

export default function ManagementContextBar() {
  const now = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(new Date());
  return (
    <div className="management-context-bar" role="status">
      <span><CircleCheck size={16} /> Operational workspace</span>
      <span><Clock3 size={16} /> {now}</span>
      <span><ShieldCheck size={16} /> Management access</span>
    </div>
  );
}
