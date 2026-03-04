import React, { useState, useEffect } from 'react';
import * as api from '../api';

const ClientsPage: React.FC = () => {
  const [clients, setClients] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', phone: '' });

  useEffect(() => {
    loadClients();
  }, [search]);

  const loadClients = async () => {
    try {
      const response = await api.getClients(search);
      setClients(response.data);
    } catch (error) {
      console.error('Failed to load clients:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingClient) {
        await api.updateClient(editingClient.id, formData);
      } else {
        await api.createClient(formData);
      }
      setShowModal(false);
      setFormData({ name: '', phone: '' });
      setEditingClient(null);
      loadClients();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to save client');
    }
  };

  const handleEdit = (client: any) => {
    setEditingClient(client);
    setFormData({ name: client.name, phone: client.phone });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this client?')) return;

    try {
      await api.deleteClient(id);
      loadClients();
    } catch (error) {
      alert('Failed to delete client');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Clients</h1>
        <button
          onClick={() => {
            setEditingClient(null);
            setFormData({ name: '', phone: '' });
            setShowModal(true);
          }}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
        >
          + Add Client
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <input
          type="text"
          placeholder="Search by name or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Phone</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Manager</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {clients.map((client) => (
              <tr key={client.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{client.name}</td>
                <td className="px-4 py-3 text-gray-600">{client.phone}</td>
                <td className="px-4 py-3 text-gray-600">{client.manager_name}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleEdit(client)}
                    className="text-blue-600 hover:text-blue-800 mr-4"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(client.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              {editingClient ? 'Edit Client' : 'Add Client'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingClient(null);
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingClient ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientsPage;
