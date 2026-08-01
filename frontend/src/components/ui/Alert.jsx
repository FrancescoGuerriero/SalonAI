import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
const icons = { info: Info, success: CheckCircle2, warning: TriangleAlert, error: AlertCircle };
export default function Alert({ type = "info", title, children }) { const Icon = icons[type] || Info; return <div className={`app-alert app-alert-${type}`} role={type === "error" ? "alert" : "status"}><Icon size={20} /><div>{title && <strong>{title}</strong>}<div>{children}</div></div></div>; }
