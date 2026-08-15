import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default map pins
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

function App() {
  const [zones, setZones] = useState([]);
  const [activeZone, setActiveZone] = useState(null); // Tracks which zone is clicked
  const [historyData, setHistoryData] = useState([]); // Holds the chart data

  // 1. Fetch current farm status
  const fetchFarmStatus = () => {
    fetch('https://biosecurity-dashboard.onrender.com/farm-status')
      .then(response => response.json())
      .then(data => setZones(data))
      .catch(error => console.error("Error fetching data:", error));
  };

  // 2. Fetch history for the clicked zone
  const fetchHistory = (zoneId) => {
    fetch(`https://biosecurity-dashboard.onrender.com/zone-history/${zoneId}`)
      .then(response => response.json())
      .then(data => setHistoryData(data))
      .catch(error => console.error("Error fetching history:", error));
  };

  // Auto-refresh the main map
  useEffect(() => {
    fetchFarmStatus();
    const interval = setInterval(fetchFarmStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  // Auto-refresh the chart when a zone is clicked
  useEffect(() => {
    if (activeZone) {
      fetchHistory(activeZone);
      const historyInterval = setInterval(() => fetchHistory(activeZone), 3000);
      return () => clearInterval(historyInterval);
    }
  }, [activeZone]);

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      
      {/* --- LEFT SIDEBAR --- */}
      <div style={{ width: '400px', backgroundColor: '#0f172a', color: 'white', padding: '20px', overflowY: 'auto', zIndex: 1000, boxShadow: '5px 0 15px rgba(0,0,0,0.5)' }}>
        <h1 style={{ fontSize: '24px', margin: '0 0 5px 0', fontWeight: 'bold', color: '#38bdf8' }}>Biosecurity Command</h1>
        <p style={{ margin: '0 0 30px 0', color: '#94a3b8', fontSize: '14px' }}>Live Farm Monitoring System</p>
        
        {/* Zones List */}
        <h2 style={{ fontSize: '13px', textTransform: 'uppercase', color: '#64748b', marginBottom: '10px', letterSpacing: '1px' }}>Zone Status (Click for Trends)</h2>
        
        {zones.map(zone => {
          let statusColor = zone.risk >= 80 ? '#ef4444' : zone.risk >= 50 ? '#eab308' : '#22c55e';
          const isActive = activeZone === zone.id;

          return (
            <div 
              key={zone.id} 
              onClick={() => setActiveZone(isActive ? null : zone.id)}
              style={{ 
                backgroundColor: isActive ? '#334155' : '#1e293b', 
                padding: '16px', 
                borderRadius: '12px', 
                marginBottom: '12px', 
                borderLeft: `6px solid ${statusColor}`,
                cursor: 'pointer',
                transition: '0.3s'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#f8fafc' }}>{zone.name}</h3>
                <span style={{ fontSize: '18px', fontWeight: 'bold', color: statusColor }}>{zone.risk}%</span>
              </div>
              <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#cbd5e1' }}>{zone.status}</p>
              
              {zone.note && (
                <div style={{ marginTop: '12px', padding: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '6px' }}>
                  <p style={{ margin: 0, fontSize: '12px', color: '#fca5a5', fontStyle: 'italic' }}>⚠️ {zone.note}</p>
                </div>
              )}

              {/* --- LIVE CHART SECTION --- */}
              {isActive && historyData.length > 0 && (
                <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '10px', textAlign: 'center' }}>Live Risk Trend</p>
                  
                  {/* We removed ResponsiveContainer and hardcoded width/height directly into the LineChart */}
                  <LineChart width={320} height={140} data={historyData}>
                    <XAxis dataKey="time" stroke="#64748b" fontSize={10} />
                    <YAxis stroke="#64748b" fontSize={10} domain={[0, 100]} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', color: '#fff', borderRadius: '8px' }} />
                    <Line type="monotone" dataKey="risk" stroke={statusColor} strokeWidth={3} dot={{ r: 4 }} animationDuration={300} />
                  </LineChart>
                  
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* --- RIGHT MAP AREA --- */}
      <div style={{ flex: 1 }}>
        <MapContainer center={[13.0827, 80.2707]} zoom={16} style={{ height: "100%", width: "100%" }}>
          <TileLayer 
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          {zones.map(zone => (
            <Marker key={zone.id} position={[zone.lat, zone.lng]}>
              <Popup>
                <div style={{ textAlign: 'center' }}>
                  <h3 style={{ margin: '0 0 5px 0', fontSize: '16px' }}>{zone.name}</h3>
                  <p style={{ margin: 0, fontSize: '14px' }}>Risk: <strong>{zone.risk}%</strong></p>
                  <p style={{ margin: 0, fontSize: '14px' }}>Status: {zone.status}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      
    </div>
  );
}

export default App;