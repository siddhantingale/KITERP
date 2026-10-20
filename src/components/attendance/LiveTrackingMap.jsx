import React from "react";
import { MapContainer, TileLayer, Circle, Marker, Popup, useMap } from "react-leaflet";
import { Badge } from "@/components/ui/badge";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix leaflet default marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Custom icons for inside/outside students
const insideIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const outsideIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function MapUpdater({ center }) {
  const map = useMap();
  React.useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  return null;
}

export default function LiveTrackingMap({ geoFence, activeStudents }) {
  if (!geoFence || !geoFence.latitude || !geoFence.longitude) {
    return (
      <div className="w-full h-96 bg-gray-100 rounded-lg flex items-center justify-center">
        <p className="text-gray-500">No geo-fence configured for this session</p>
      </div>
    );
  }

  const center = [geoFence.latitude, geoFence.longitude];
  const radius = geoFence.radius_meters || 50;

  return (
    <div className="w-full h-96 rounded-lg overflow-hidden border-2 border-gray-200 shadow-lg">
      <MapContainer
        center={center}
        zoom={17}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapUpdater center={center} />

        {/* Geo-fence circle */}
        <Circle
          center={center}
          radius={radius}
          pathOptions={{
            color: "blue",
            fillColor: "blue",
            fillOpacity: 0.1,
            weight: 2,
            dashArray: "5, 5"
          }}
        >
          <Popup>
            <div>
              <strong>{geoFence.location_name || "Classroom Geo-Fence"}</strong>
              <br />
              Radius: {radius}m
            </div>
          </Popup>
        </Circle>

        {/* Student markers */}
        {activeStudents.map((student) => {
          if (!student.latitude || !student.longitude) return null;
          
          const icon = student.is_inside_geofence ? insideIcon : outsideIcon;
          
          return (
            <Marker
              key={student.id}
              position={[student.latitude, student.longitude]}
              icon={icon}
            >
              <Popup>
                <div className="text-sm">
                  <strong>{student.student_name || student.prn}</strong>
                  <br />
                  PRN: {student.prn}
                  <br />
                  Email: {student.email || "N/A"}
                  <br />
                  <Badge className={student.is_inside_geofence ? "bg-green-500" : "bg-red-500"}>
                    {student.is_inside_geofence ? "✓ Inside Zone" : "⚠ Outside Zone"}
                  </Badge>
                  <br />
                  Distance: {Math.round(student.distance_from_geofence || 0)}m
                  <br />
                  Accuracy: ±{Math.round(student.gps_accuracy || 0)}m
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}