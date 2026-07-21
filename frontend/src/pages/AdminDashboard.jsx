import { Link } from "react-router-dom";

const cards = [
  {
    title: "Services",
    value: "Manage",
    link: "/admin/services",
    icon: "✂️"
  },
  {
    title: "Stylists",
    value: "Manage",
    link: "/admin/stylists",
    icon: "💇"
  },
  {
    title: "Appointments",
    value: "Manage",
    link: "/admin/appointments",
    icon: "📅"
  },
  {
    title: "Customers",
    value: "Manage",
    link: "/admin/customers",
    icon: "👥"
  }
];

export default function AdminDashboard() {
  return (
    <div className="admin-dashboard">
      <h1>SalonAI Admin Dashboard</h1>

      <div className="dashboard-grid">
        {cards.map(card => (
          <Link
            key={card.title}
            to={card.link}
            className="dashboard-card"
          >
            <span className="dashboard-icon">
              {card.icon}
            </span>

            <h2>{card.title}</h2>

            <p>{card.value}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}