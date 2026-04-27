"use client";

import { useState, useEffect, use } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/axios";
import Link from "next/link";

export default function ClientOverviewPage({ params }) {
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);
  const [formData, setFormData] = useState({
    fname: "",
    lname: "",
    email: "",
    phone: "",
  });

  const { id } = useParams();
  const router = useRouter();

  useEffect(() => {
    const loadClient = async () => {
      try {
        const result = await api.get(`/api/clients/${id}`);
        setClient(result.data);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching client:", error);
        setLoading(false);
      }
    };
    loadClient();

  }, [id]);

  async function handleUpdate(e) {
    e.preventDefault();
    try {
      await api.put(`/api/clients/${id}`, formData);
      setShowEditForm(false);
      setClient({ ...client, ...formData }); // Refresh client data after update
    } catch (error) {
      console.error("Error updating client:", error);
    }
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  async function handleDelete() {
    if (confirm("Are you sure you want to delete this client?")) {
      try {
        await api.delete(`/api/clients/${id}`);
        router.push("/clients"); // Redirect to clients list after deletion
      } catch (error) {
        console.error("Error deleting client:", error);
      }
    }
  }

  return (
    <>
      {loading ? (
        <div className="p-8">Loading...</div>
      ) : !client ? (
        <div className="p-8">Client not found.</div>
      ) : (
        <div className="p-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <h1 className="text-3xl font-bold flex-1">
              #{client.client_code} — {client.fname} {client.lname}
            </h1>
            <button
              onClick={() => {
                setShowEditForm(true);
                setFormData(client);
              }}
              className="btn-primary px-4"
            >
              Edit
            </button>
            <button onClick={handleDelete} className="btn-danger px-4">
              Delete
            </button>
          </div>

          {/* Info Card */}
          <div className="card mb-6">
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <span className="card-title">Email:</span>
                <span>{client.email}</span>
              </div>
              <div className="flex gap-2">
                <span className="card-title">Phone:</span>
                <span>{client.phone}</span>
              </div>
              <div className="flex gap-2">
                <span className="card-title">Client Code:</span>
                <span
                  className="font-semibold"
                  style={{ color: "var(--accent)" }}
                >
                  #{client.client_code}
                </span>
              </div>
            </div>
          </div>

          {/* Edit Modal */}
          {showEditForm && (
            <div
              onClick={() => setShowEditForm(false)}
              className="fixed inset-0 flex items-center justify-center bg-black/30 z-50"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="card p-6 w-80"
              >
                <h2 className="text-xl font-semibold mb-4">Edit Client</h2>
                <form onSubmit={handleUpdate} className="flex flex-col gap-4">
                  <input
                    type="text"
                    name="fname"
                    placeholder="First Name"
                    value={formData.fname}
                    onChange={handleChange}
                    className="input-field"
                  />
                  <input
                    type="text"
                    name="lname"
                    placeholder="Last Name"
                    value={formData.lname}
                    onChange={handleChange}
                    className="input-field"
                  />
                  <input
                    type="email"
                    name="email"
                    placeholder="Email"
                    value={formData.email}
                    onChange={handleChange}
                    className="input-field"
                  />
                  <input
                    type="tel"
                    name="phone"
                    placeholder="Phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="input-field"
                  />
                  <button type="submit" className="btn-primary px-4">
                    Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEditForm(false)}
                    className="btn-danger px-4"
                  >
                    Cancel
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
