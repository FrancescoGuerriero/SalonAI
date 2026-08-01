import { LoaderCircle } from "lucide-react";
export default function Button({ children, variant = "primary", size = "md", loading = false, icon: Icon, className = "", disabled, ...props }) {
  return <button className={`app-button app-button-${variant} app-button-${size} ${className}`} disabled={disabled || loading} {...props}>{loading ? <LoaderCircle size={17} className="app-spin" /> : Icon ? <Icon size={17} /> : null}<span>{children}</span></button>;
}
