import {
  BadgePoundSterling,
  Bot,
  Boxes,
  Building2,
  CalendarCheck2,
  ClipboardList,
  Gauge,
  Megaphone,
  MessageSquareText,
  MousePointerClick,
} from "lucide-react";

const FUTURE_PACK_LINKS = [
  {
    to: "/rebooking-campaigns",
    label: "Rebooking Campaigns",
    description: "Schedule and measure rebooking outreach",
    icon: Megaphone,
  },
  {
    to: "/marketing-attribution",
    label: "Marketing Attribution",
    description: "Campaign and acquisition-source conversion",
    icon: MousePointerClick,
  },
  {
    to: "/smart-appointments",
    label: "Smart Appointments",
    description: "Recommended available customer slots",
    icon: CalendarCheck2,
  },
  {
    to: "/capacity-planning",
    label: "Capacity Planning",
    description: "Staff utilisation and spare capacity",
    icon: Gauge,
  },
  {
    to: "/dynamic-pricing",
    label: "Dynamic Pricing",
    description: "Bounded demand-based price recommendations",
    icon: BadgePoundSterling,
  },
  {
    to: "/inventory-forecasting",
    label: "Inventory Forecasting",
    description: "Stock cover and reorder alerts",
    icon: Boxes,
  },
  {
    to: "/feedback-analytics",
    label: "Feedback Analytics",
    description: "Ratings, sentiment and service recovery",
    icon: MessageSquareText,
  },
  {
    to: "/management-copilot",
    label: "Management Copilot",
    description: "Explainable operational recommendations",
    icon: Bot,
  },
  {
    to: "/executive-command-centre",
    label: "Executive Command Centre",
    description: "Consolidated salon performance KPIs",
    icon: Building2,
  },
  {
    to: "/data-export-audit",
    label: "Data Export and Audit",
    description: "CSV, JSON and export audit history",
    icon: ClipboardList,
  },
];

export { FUTURE_PACK_LINKS };
