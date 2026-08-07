import { useEffect, useState } from "react";
import { CheckCircle2, Home, Mail, MapPin, Phone, Save, ShieldCheck, UserRound } from "lucide-react";

import useAuth from "../hooks/useAuth.js";

const emptyAddress = {
  line1: "",
  line2: "",
  city: "",
  county: "",
  postcode: "",
  country: "United Kingdom",
};

export default function ManageAccountPage() {
  const { user, refreshAccount, updateAccount } = useAuth();
  const [form, setForm] = useState({ name: "", phone: "", homeAddress: emptyAddress });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    refreshAccount()
      .then((account) => {
        if (!active) return;
        setForm({
          name: account?.name || "",
          phone: account?.phone || "",
          homeAddress: { ...emptyAddress, ...(account?.homeAddress || {}) },
        });
      })
      .catch(() => {
        if (!active) return;
        setForm({
          name: user?.name || "",
          phone: user?.phone || "",
          homeAddress: { ...emptyAddress, ...(user?.homeAddress || {}) },
        });
        setError("The latest account details could not be loaded. You can still review the saved details below.");
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [refreshAccount]);

  function updateField(field, value) {
    setMessage("");
    setError("");
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateAddress(field, value) {
    setMessage("");
    setError("");
    setForm((current) => ({
      ...current,
      homeAddress: { ...current.homeAddress, [field]: value },
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await updateAccount(form);
      setForm({
        name: response.user?.name || "",
        phone: response.user?.phone || "",
        homeAddress: { ...emptyAddress, ...(response.user?.homeAddress || {}) },
      });
      setMessage("Your account and home address have been saved.");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Your account details could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="manage-account-page" id="main-content" tabIndex="-1">
      <section className="manage-account-hero">
        <div className="manage-account-hero-icon"><UserRound size={26} /></div>
        <div>
          <span>Manage account</span>
          <h1>Your details and home address</h1>
          <p>Keep your contact and delivery details accurate for bookings, receipts and haircare orders.</p>
        </div>
        <div className="manage-account-email"><Mail size={17} /><span><small>Sign-in email</small>{user?.email || "Not available"}</span></div>
      </section>

      {error ? <div className="manage-account-alert" role="alert">{error}</div> : null}
      {message ? <div className="manage-account-alert is-success" role="status"><CheckCircle2 size={18} />{message}</div> : null}

      <form className="manage-account-form" onSubmit={submit} aria-busy={loading || saving}>
        <section>
          <header><UserRound size={20} /><div><h2>Personal details</h2><p>Used by the salon when managing your bookings.</p></div></header>
          <div className="manage-account-grid">
            <label className="manage-account-wide">Full name<input required disabled={loading} value={form.name} onChange={(event) => updateField("name", event.target.value)} autoComplete="name" /></label>
            <label>Phone number<input disabled={loading} value={form.phone} onChange={(event) => updateField("phone", event.target.value)} autoComplete="tel" inputMode="tel" /></label>
          </div>
        </section>

        <section>
          <header><Home size={20} /><div><h2>Home address</h2><p>Saved securely to your account and available for delivery checkout.</p></div></header>
          <div className="manage-account-grid">
            <label className="manage-account-wide">Address line 1<input disabled={loading} value={form.homeAddress.line1} onChange={(event) => updateAddress("line1", event.target.value)} autoComplete="address-line1" /></label>
            <label className="manage-account-wide">Address line 2<input disabled={loading} value={form.homeAddress.line2} onChange={(event) => updateAddress("line2", event.target.value)} autoComplete="address-line2" /></label>
            <label>Town or city<input disabled={loading} value={form.homeAddress.city} onChange={(event) => updateAddress("city", event.target.value)} autoComplete="address-level2" /></label>
            <label>County<input disabled={loading} value={form.homeAddress.county} onChange={(event) => updateAddress("county", event.target.value)} autoComplete="address-level1" /></label>
            <label>Postcode<input disabled={loading} value={form.homeAddress.postcode} onChange={(event) => updateAddress("postcode", event.target.value.toUpperCase())} autoComplete="postal-code" /></label>
            <label>Country<input disabled={loading} value={form.homeAddress.country} onChange={(event) => updateAddress("country", event.target.value)} autoComplete="country-name" /></label>
          </div>
        </section>

        <footer>
          <p><ShieldCheck size={17} />Your address is never displayed publicly.</p>
          <button type="submit" className="app-button app-button-primary" disabled={loading || saving}><Save size={17} />{saving ? "Saving…" : "Save account details"}</button>
        </footer>
      </form>

      <aside className="manage-account-checkout-note"><MapPin size={19} /><div><strong>Faster haircare checkout</strong><p>Your saved home address will prefill the delivery form; you can still change it for an individual order.</p></div></aside>
    </main>
  );
}
