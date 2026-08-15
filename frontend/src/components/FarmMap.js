import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const FarmMap = () => {
  const center = [13.0827, 80.2707];
  const [zones, setZones] = useState([]);

  // Fetch data from FastAPI when the map loads
  useEffect(() => {
    fetch('http://localhost:8000/farm-status')
      .then(response => response.json())
      .then(data => setZones(data))
      .catch(error => console.error("Error fetching farm data:", error));
  }, []);
  
  return (
    <MapContainer center={center} zoom={16} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors'
      />
      
      {zones.map((zone) => (
        <Marker key={zone.id} position={[zone.lat, zone.lng]}>
          <Popup>
            <strong>{zone.name}</strong><br/>
            Risk: {zone.risk}%<br/>
            Status: {zone.status}<br/>
            {zone.note && <em>{zone.note}</em>}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};

export default FarmMap;