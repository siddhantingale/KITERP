import React, { useState, useEffect } from "react";
import { api } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MapPin, Plus, Edit, Trash2, Navigation } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function GeoFenceManagementPage() {
  const [geoFences, setGeoFences] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingFence, setEditingFence] = useState(null);
  const [formData, setFormData] = useState({
    session_id: "",
    location_name: "",
    latitude: "",
    longitude: "",
    radius_meters: 50,
    college_name: "",
    batch_id: ""
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fencesData, sessionsData] = await Promise.all([
        api.entities.GeoFenceZone.list('-created_date', 100),
        api.entities.Session.list('-created_date', 50)
      ]);
      setGeoFences(fencesData);
      setSessions(sessionsData);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setLoading(false);
  };

  const getCurrentLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData(prev => ({
            ...prev,
            latitude: position.coords.latitude.toFixed(6),
            longitude: position.coords.longitude.toFixed(6)
          }));
        },
        (error) => {
          console.error("Error getting location:", error);
          alert("Unable to get your current location. Please enter coordinates manually.");
        },
        { enableHighAccuracy: true }
      );
    } else {
      alert("Geolocation is not supported by your browser");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        radius_meters: parseInt(formData.radius_meters)
      };

      if (editingFence) {
        await api.entities.GeoFenceZone.update(editingFence.id, data);
      } else {
        await api.entities.GeoFenceZone.create(data);
      }

      setShowAddDialog(false);
      setEditingFence(null);
      setFormData({
        session_id: "",
        location_name: "",
        latitude: "",
        longitude: "",
        radius_meters: 50,
        college_name: "",
        batch_id: ""
      });
      loadData();
    } catch (error) {
      console.error("Error saving geo-fence:", error);
      alert("Error saving geo-fence. Please try again.");
    }
  };

  const handleDelete = async (id) => {
    if (confirm("Are you sure you want to delete this geo-fence zone?")) {
      try {
        await api.entities.GeoFenceZone.delete(id);
        loadData();
      } catch (error) {
        console.error("Error deleting geo-fence:", error);
      }
    }
  };

  const toggleActive = async (fence) => {
    try {
      await api.entities.GeoFenceZone.update(fence.id, {
        is_active: !fence.is_active
      });
      loadData();
    } catch (error) {
      console.error("Error toggling geo-fence:", error);
    }
  };

  const startEdit = (fence) => {
    setEditingFence(fence);
    setFormData({
      session_id: fence.session_id || "",
      location_name: fence.location_name || "",
      latitude: fence.latitude?.toString() || "",
      longitude: fence.longitude?.toString() || "",
      radius_meters: fence.radius_meters || 50,
      college_name: fence.college_name || "",
      batch_id: fence.batch_id || ""
    });
    setShowAddDialog(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading geo-fence zones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <MapPin className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Geo-Fence Management</h1>
          </div>
          <p className="text-gray-600">Configure location-based attendance validation</p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setEditingFence(null);
              setFormData({
                session_id: "",
                location_name: "",
                latitude: "",
                longitude: "",
                radius_meters: 50,
                college_name: "",
                batch_id: ""
              });
            }}>
              <Plus className="w-4 h-4 mr-2" />
              Add Geo-Fence
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingFence ? 'Edit' : 'Add'} Geo-Fence Zone</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Session</Label>
                <Select value={formData.session_id} onValueChange={(val) => setFormData({...formData, session_id: val})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select session" />
                  </SelectTrigger>
                  <SelectContent>
                    {sessions.map(session => (
                      <SelectItem key={session.id} value={session.id}>
                        {session.session_name} - {session.college_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Location Name</Label>
                <Input
                  placeholder="e.g., Classroom 101, Lab A"
                  value={formData.location_name}
                  onChange={(e) => setFormData({...formData, location_name: e.target.value})}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Latitude</Label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="18.5204"
                    value={formData.latitude}
                    onChange={(e) => setFormData({...formData, latitude: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label>Longitude</Label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="73.8567"
                    value={formData.longitude}
                    onChange={(e) => setFormData({...formData, longitude: e.target.value})}
                    required
                  />
                </div>
              </div>
              <Button type="button" variant="outline" onClick={getCurrentLocation} className="w-full">
                <Navigation className="w-4 h-4 mr-2" />
                Use My Current Location
              </Button>
              <div>
                <Label>Radius (meters)</Label>
                <Input
                  type="number"
                  min="10"
                  max="500"
                  value={formData.radius_meters}
                  onChange={(e) => setFormData({...formData, radius_meters: e.target.value})}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Typical: 30-100 meters</p>
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">
                  {editingFence ? 'Update' : 'Create'} Geo-Fence
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Geo-Fences List */}
      <div className="grid gap-4">
        {geoFences.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">No geo-fence zones configured yet</p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Geo-Fence
              </Button>
            </CardContent>
          </Card>
        ) : (
          geoFences.map((fence) => {
            const session = sessions.find(s => s.id === fence.session_id);
            return (
              <Card key={fence.id} className={!fence.is_active ? 'opacity-60' : ''}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-lg font-semibold">{fence.location_name}</h3>
                        <Badge className={fence.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                          {fence.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Session</p>
                          <p className="font-semibold">{session?.session_name || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Coordinates</p>
                          <p className="font-mono text-xs">{fence.latitude?.toFixed(4)}, {fence.longitude?.toFixed(4)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Radius</p>
                          <p className="font-semibold">{fence.radius_meters}m</p>
                        </div>
                        <div>
                          <p className="text-gray-500">College</p>
                          <p className="font-semibold">{fence.college_name || session?.college_name || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button size="sm" variant="outline" onClick={() => toggleActive(fence)}>
                        {fence.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => startEdit(fence)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(fence.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}