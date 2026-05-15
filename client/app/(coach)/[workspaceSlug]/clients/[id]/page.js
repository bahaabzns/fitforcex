"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/axios";
import { Eye, EyeOff, RefreshCw, Copy, Check } from "lucide-react";
import Modal from "@/app/components/Modal";
import { Button } from "@heroui/react/button";
import { Card } from "@heroui/react/card";
import { Skeleton } from "@heroui/react/skeleton";

const inputCls = "w-full px-3 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors";

function generatePassword(length = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

const COUNTRY_CODES = [
    { code: "+93", name: "Afghanistan" }, { code: "+355", name: "Albania" }, { code: "+213", name: "Algeria" },
    { code: "+376", name: "Andorra" }, { code: "+244", name: "Angola" }, { code: "+54", name: "Argentina" },
    { code: "+374", name: "Armenia" }, { code: "+61", name: "Australia" }, { code: "+43", name: "Austria" },
    { code: "+994", name: "Azerbaijan" }, { code: "+973", name: "Bahrain" }, { code: "+880", name: "Bangladesh" },
    { code: "+375", name: "Belarus" }, { code: "+32", name: "Belgium" }, { code: "+55", name: "Brazil" },
    { code: "+1", name: "Canada / USA" }, { code: "+86", name: "China" }, { code: "+57", name: "Colombia" },
    { code: "+385", name: "Croatia" }, { code: "+357", name: "Cyprus" }, { code: "+420", name: "Czech Republic" },
    { code: "+45", name: "Denmark" }, { code: "+20", name: "Egypt" }, { code: "+358", name: "Finland" },
    { code: "+33", name: "France" }, { code: "+995", name: "Georgia" }, { code: "+49", name: "Germany" },
    { code: "+233", name: "Ghana" }, { code: "+30", name: "Greece" }, { code: "+36", name: "Hungary" },
    { code: "+354", name: "Iceland" }, { code: "+91", name: "India" }, { code: "+62", name: "Indonesia" },
    { code: "+98", name: "Iran" }, { code: "+964", name: "Iraq" }, { code: "+353", name: "Ireland" },
    { code: "+972", name: "Israel" }, { code: "+39", name: "Italy" }, { code: "+81", name: "Japan" },
    { code: "+962", name: "Jordan" }, { code: "+7", name: "Kazakhstan / Russia" }, { code: "+254", name: "Kenya" },
    { code: "+965", name: "Kuwait" }, { code: "+961", name: "Lebanon" }, { code: "+218", name: "Libya" },
    { code: "+60", name: "Malaysia" }, { code: "+960", name: "Maldives" }, { code: "+52", name: "Mexico" },
    { code: "+212", name: "Morocco" }, { code: "+31", name: "Netherlands" }, { code: "+64", name: "New Zealand" },
    { code: "+234", name: "Nigeria" }, { code: "+47", name: "Norway" }, { code: "+968", name: "Oman" },
    { code: "+92", name: "Pakistan" }, { code: "+970", name: "Palestine" }, { code: "+507", name: "Panama" },
    { code: "+63", name: "Philippines" }, { code: "+48", name: "Poland" }, { code: "+351", name: "Portugal" },
    { code: "+974", name: "Qatar" }, { code: "+40", name: "Romania" }, { code: "+250", name: "Rwanda" },
    { code: "+966", name: "Saudi Arabia" }, { code: "+221", name: "Senegal" }, { code: "+381", name: "Serbia" },
    { code: "+65", name: "Singapore" }, { code: "+27", name: "South Africa" }, { code: "+82", name: "South Korea" },
    { code: "+34", name: "Spain" }, { code: "+94", name: "Sri Lanka" }, { code: "+249", name: "Sudan" },
    { code: "+46", name: "Sweden" }, { code: "+41", name: "Switzerland" }, { code: "+963", name: "Syria" },
    { code: "+886", name: "Taiwan" }, { code: "+255", name: "Tanzania" }, { code: "+66", name: "Thailand" },
    { code: "+216", name: "Tunisia" }, { code: "+90", name: "Turkey" }, { code: "+256", name: "Uganda" },
    { code: "+380", name: "Ukraine" }, { code: "+971", name: "United Arab Emirates" }, { code: "+44", name: "United Kingdom" },
    { code: "+1", name: "United States" }, { code: "+998", name: "Uzbekistan" }, { code: "+58", name: "Venezuela" },
    { code: "+84", name: "Vietnam" }, { code: "+967", name: "Yemen" }, { code: "+260", name: "Zambia" },
    { code: "+263", name: "Zimbabwe" },
];

function CountryCodeSelect({ value, onChange }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const ref = useRef(null);

    useEffect(() => {
        function handler(e) {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const filtered = COUNTRY_CODES.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) || c.code.includes(search)
    );

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-24 px-3 py-2 rounded-lg bg-background border border-input text-foreground text-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring truncate transition-colors"
            >
                {value || "+?"}
            </button>
            {open && (
                <div className="absolute top-full left-0 mt-1 z-20 w-64 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
                    <input
                        type="text"
                        placeholder="Search country or code..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full px-3 py-2 bg-background border-b border-border text-foreground text-xs placeholder:text-muted-foreground focus-visible:outline-none"
                        autoFocus
                    />
                    <div className="max-h-48 overflow-y-auto">
                        {filtered.map((c, i) => (
                            <button
                                key={`${c.code}-${i}`}
                                type="button"
                                onClick={() => { onChange(c.code); setOpen(false); setSearch(""); }}
                                className={`w-full px-3 py-1.5 text-left text-xs transition-colors flex justify-between ${
                                    value === c.code ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent"
                                }`}
                            >
                                <span>{c.name}</span>
                                <span className="text-muted-foreground">{c.code}</span>
                            </button>
                        ))}
                        {filtered.length === 0 && <p className="px-3 py-2 text-muted-foreground text-xs">No results</p>}
                    </div>
                </div>
            )}
        </div>
    );
}

const BLANK_PHONE = { countryCode: "+20", number: "" };

export default function ClientOverviewPage() {
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);

  // Edit form state
  const [formData, setFormData] = useState({ fname: "", lname: "", email: "" });
  const [editPhones, setEditPhones] = useState([{ ...BLANK_PHONE }, { ...BLANK_PHONE }, { ...BLANK_PHONE }]);
  const [editPhoneCount, setEditPhoneCount] = useState(1);

  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const [tempPassword, setTempPassword] = useState(null);
  const [showStoredPassword, setShowStoredPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  const { id } = useParams();
  const router = useRouter();

  useEffect(() => {
    api.get(`/api/clients/${id}`)
      .then(res => setClient(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  function updateEditPhone(index, field, value) {
    setEditPhones(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function openEdit() {
    const phones = (client.phones && client.phones.length > 0)
      ? client.phones
      : (client.phone ? [{ countryCode: "", number: client.phone }] : []);

    setFormData({ fname: client.fname, lname: client.lname, email: client.email });
    setEditPhones([
      phones[0] || { ...BLANK_PHONE },
      phones[1] || { ...BLANK_PHONE },
      phones[2] || { ...BLANK_PHONE },
    ]);
    setEditPhoneCount(Math.max(1, phones.length));
    setNewPassword("");
    setPasswordError("");
    setShowNewPassword(false);
    setShowEditForm(true);
  }

  async function handleUpdate(e) {
    e.preventDefault();
    setPasswordError("");
    if (newPassword && newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }
    const phonesToSend = editPhones.slice(0, editPhoneCount).filter(p => p.number.trim());
    try {
      const updated = await api.put(`/api/clients/${id}`, {
        ...formData,
        phones: phonesToSend,
      });
      let updatedClient = { ...client, ...updated.data };
      if (newPassword) {
        await api.post(`/api/clients/${id}/set-password`, { password: newPassword });
        setTempPassword(newPassword);
        updatedClient = { ...updatedClient, has_password: true };
      }
      setClient(updatedClient);
      setShowEditForm(false);
      setNewPassword("");
    } catch (error) {
      console.error("Error updating client:", error);
    }
  }

  async function handleDelete() {
    if (confirm("Are you sure you want to delete this client?")) {
      try {
        await api.delete(`/api/clients/${id}`);
        router.push("/clients");
      } catch (error) {
        console.error("Error deleting client:", error);
      }
    }
  }

  const copyCredentials = () => {
    if (!tempPassword) return;
    const text = `Email: ${client.email}\nPassword: ${tempPassword}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <>
      {loading ? (
        <div className="p-8 flex flex-col gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}
        </div>
      ) : !client ? (
        <div className="p-8 text-muted-foreground">Client not found.</div>
      ) : (
        <div className="p-8 flex flex-col gap-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-foreground flex-1">
              #{client.code ?? client.client_code} — {client.fname} {client.lname}
            </h1>
            <Button onClick={openEdit} variant="primary" size="sm">
              Edit
            </Button>
            <Button
              onClick={handleDelete}
              className="bg-destructive/10 hover:bg-destructive/20 text-destructive"
              size="sm"
            >
              Delete
            </Button>
          </div>

          {/* Info Card */}
          <Card>
            <Card.Content className="p-6">
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <span className="text-sm text-muted-foreground font-medium w-32 shrink-0">Email</span>
                <span className="text-sm text-foreground">{client.email || "—"}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-sm text-muted-foreground font-medium w-32 shrink-0">Phone</span>
                <div className="flex flex-col gap-0.5">
                  {(client.phones && client.phones.length > 0)
                    ? client.phones.map((p, i) => (
                        <span key={i} className={`text-sm ${i === 0 ? "text-foreground" : "text-muted-foreground"}`}>
                          {p.countryCode} {p.number}
                        </span>
                      ))
                    : <span className="text-sm text-foreground">{client.phone || "—"}</span>
                  }
                </div>
              </div>
              <div className="flex gap-2">
                <span className="text-sm text-muted-foreground font-medium w-32 shrink-0">Client Code</span>
                <span className="text-sm font-semibold text-primary">#{client.code ?? client.client_code}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-sm text-muted-foreground font-medium w-32 shrink-0">Package</span>
                <span className="text-sm text-foreground">{client.current_package || "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground font-medium w-32 shrink-0">Portal Password</span>
                {tempPassword ? (
                  <>
                    <span className="font-mono text-sm text-foreground">
                      {showStoredPassword ? tempPassword : "•".repeat(tempPassword.length)}
                    </span>
                    <button
                      onClick={() => setShowStoredPassword(v => !v)}
                      className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                    >
                      {showStoredPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </>
                ) : client.has_password ? (
                  <span className="text-sm text-muted-foreground italic">Password set — use Edit to reset &amp; reveal</span>
                ) : (
                  <span className="text-sm text-muted-foreground">Not set</span>
                )}
              </div>
              {tempPassword && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5">
                    Save this password — it won&apos;t be shown again after you leave the page.
                  </p>
                  <Button
                    onClick={copyCredentials}
                    variant="outline"
                    size="sm"
                    className="self-start"
                  >
                    {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                    {copied ? "Copied!" : "Copy Credentials"}
                  </Button>
                </div>
              )}
            </div>
            </Card.Content>
          </Card>

          {/* Edit Modal */}
          <Modal open={showEditForm} onClose={() => setShowEditForm(false)} title="Edit Client">
            <form onSubmit={handleUpdate} className="flex flex-col gap-3">
              {/* First + Last name */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="First Name *"
                  value={formData.fname}
                  onChange={e => setFormData({ ...formData, fname: e.target.value })}
                  className={`${inputCls} flex-1`}
                  autoFocus
                />
                <input
                  type="text"
                  placeholder="Last Name"
                  value={formData.lname}
                  onChange={e => setFormData({ ...formData, lname: e.target.value })}
                  className={`${inputCls} flex-1`}
                />
              </div>

              {/* Email */}
              <input
                type="email"
                placeholder="Email *"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className={inputCls}
              />

              {/* Phone numbers */}
              <label className="text-muted-foreground text-xs font-medium">Phone Numbers</label>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2 items-center">
                  <CountryCodeSelect value={editPhones[0].countryCode} onChange={code => updateEditPhone(0, "countryCode", code)} />
                  <input type="text" placeholder="Primary phone" value={editPhones[0].number} onChange={e => updateEditPhone(0, "number", e.target.value)} className={`flex-1 ${inputCls}`} />
                </div>
                {editPhoneCount >= 2 && (
                  <div className="flex gap-2 items-center">
                    <CountryCodeSelect value={editPhones[1].countryCode} onChange={code => updateEditPhone(1, "countryCode", code)} />
                    <input type="text" placeholder="Phone 2 (optional)" value={editPhones[1].number} onChange={e => updateEditPhone(1, "number", e.target.value)} className={`flex-1 ${inputCls}`} />
                  </div>
                )}
                {editPhoneCount >= 3 && (
                  <div className="flex gap-2 items-center">
                    <CountryCodeSelect value={editPhones[2].countryCode} onChange={code => updateEditPhone(2, "countryCode", code)} />
                    <input type="text" placeholder="Phone 3 (optional)" value={editPhones[2].number} onChange={e => updateEditPhone(2, "number", e.target.value)} className={`flex-1 ${inputCls}`} />
                  </div>
                )}
                {editPhoneCount < 3 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditPhoneCount(c => c + 1)} className="text-xs text-primary self-start px-0">
                    + Add another phone
                  </Button>
                )}
              </div>

              {/* Password */}
              <div className="border-t border-border pt-3 mt-1 flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">
                  New Password <span className="font-normal">(leave blank to keep current)</span>
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={e => { setNewPassword(e.target.value); setPasswordError(""); }}
                      placeholder="New portal password"
                      className={`${inputCls} pr-10 ${passwordError ? "border-destructive" : ""}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(v => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                      tabIndex={-1}
                    >
                      {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setNewPassword(generatePassword()); setShowNewPassword(true); setPasswordError(""); }}
                    className="cursor-pointer p-2 rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary transition-colors shrink-0"
                  >
                    <RefreshCw size={15} />
                  </button>
                </div>
                {passwordError && <p className="text-xs text-destructive">{passwordError}</p>}
              </div>

              <div className="flex gap-2 mt-1">
                <Button type="submit" variant="primary" fullWidth>
                  Save Changes
                </Button>
                <Button
                  type="button"
                  onClick={() => setShowEditForm(false)}
                  className="flex-1 bg-destructive/10 hover:bg-destructive/20 text-destructive"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Modal>
        </div>
      )}
    </>
  );
}
