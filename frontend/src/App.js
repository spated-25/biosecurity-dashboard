import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const API = process.env.REACT_APP_API_URL || 'https://biosecurity-dashboard.onrender.com';

function Scanner() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const choose = (f) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) return setError('Please choose an image.');
    if (f.size > 10 * 1024 * 1024) return setError('Maximum image size is 10 MB.');
    setError(''); setResult(null); setFile(f); setPreview(URL.createObjectURL(f));
  };

  const scan = async () => {
    if (!file) return;
    setLoading(true); setError('');
    try {
      const body = new FormData(); body.append('file', file);
      const res = await fetch(`${API}/crop-diagnosis`, { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Diagnosis failed');
      setResult(data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return <div style={styles.panel}>
    <h2 style={styles.sectionTitle}>🌿 Crop Disease Scanner</h2>
    <p style={styles.muted}>Upload a clear leaf, stem, or fruit photo. The image goes to the Farm Signal backend for AI-assisted screening.</p>
    <input type="file" accept="image/*" onChange={e => choose(e.target.files[0])} />
    {preview && <img src={preview} alt="Crop sample" style={styles.preview} />}
    <div style={{marginTop: 14}}><button onClick={scan} disabled={!file || loading} style={styles.button}>{loading ? 'Scanning…' : 'Run diagnosis'}</button></div>
    {error && <div style={styles.error}>{error}</div>}
    {result && <div style={styles.result}>
      <div style={styles.resultTop}><div><small>Crop</small><h3>{result.crop_type}</h3></div><div style={styles.conf}>{result.confidence}%<small>confidence</small></div></div>
      <h2>{result.disease_name}</h2>
      {result.scientific_name && <i>{result.scientific_name}</i>}
      <p><b>Severity:</b> {result.severity}</p>
      <p>{result.description}</p>
      <h4>Recommended action</h4>
      <ul>{(result.recommendations || []).map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>}
  </div>;
}

function App() {
  const [zones, setZones] = useState([]);
  const [activeZone, setActiveZone] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [tab, setTab] = useState('dashboard');
  const [wa, setWa] = useState(null);

  const fetchFarmStatus = () => fetch(`${API}/farm-status`).then(r => r.json()).then(setZones).catch(console.error);
  const fetchHistory = (id) => fetch(`${API}/zone-history/${id}`).then(r => r.json()).then(setHistoryData).catch(console.error);

  useEffect(() => { fetchFarmStatus(); const i = setInterval(fetchFarmStatus, 5000); return () => clearInterval(i); }, []);
  useEffect(() => { if (!activeZone) return; fetchHistory(activeZone); const i = setInterval(() => fetchHistory(activeZone), 5000); return () => clearInterval(i); }, [activeZone]);
  useEffect(() => { fetch(`${API}/whatsapp/config`).then(r => r.json()).then(setWa).catch(() => {}); }, []);

  return <div style={styles.app}>
    <aside style={styles.sidebar}>
      <h1 style={styles.title}>Biosecurity Command</h1>
      <p style={styles.muted}>Farm Signal · Live Monitoring</p>
      <div style={styles.nav}>
        <button onClick={() => setTab('dashboard')} style={tab === 'dashboard' ? styles.navActive : styles.navBtn}>📊 Dashboard</button>
        <button onClick={() => setTab('scanner')} style={tab === 'scanner' ? styles.navActive : styles.navBtn}>🌿 Crop Scanner</button>
        <button onClick={() => setTab('whatsapp')} style={tab === 'whatsapp' ? styles.navActive : styles.navBtn}>💬 WhatsApp</button>
      </div>
      {tab === 'dashboard' && <>
        <h2 style={styles.label}>Zone Status</h2>
        {zones.map(zone => {
          const color = zone.risk >= 80 ? '#ef4444' : zone.risk >= 50 ? '#eab308' : '#22c55e';
          const active = activeZone === zone.id;
          return <div key={zone.id} onClick={() => setActiveZone(active ? null : zone.id)} style={{...styles.zone, borderLeft: `5px solid ${color}`, background: active ? '#334155' : '#1e293b'}}>
            <div style={styles.zoneHead}><b>{zone.name}</b><strong style={{color}}>{zone.risk}%</strong></div>
            <div>{zone.status}</div>{zone.note && <small style={{color:'#fca5a5'}}>⚠️ {zone.note}</small>}
            {active && historyData.length > 0 && <LineChart width={320} height={140} data={historyData}><XAxis dataKey="time" stroke="#94a3b8" fontSize={10}/><YAxis domain={[0,100]} stroke="#94a3b8" fontSize={10}/><Tooltip/><Line type="monotone" dataKey="risk" stroke={color} strokeWidth={3}/></LineChart>}
          </div>;
        })}
      </>}
    </aside>

    <main style={styles.main}>
      {tab === 'dashboard' && <MapContainer center={[13.0827,80.2707]} zoom={16} style={{height:'100%',width:'100%'}}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors'/>
        {zones.map(z => <Marker key={z.id} position={[z.lat,z.lng]}><Popup><b>{z.name}</b><br/>Risk: {z.risk}%<br/>{z.status}<br/>{z.note || ''}</Popup></Marker>)}
      </MapContainer>}
      {tab === 'scanner' && <div style={styles.content}><Scanner/></div>}
      {tab === 'whatsapp' && <div style={styles.content}><div style={styles.panel}>
        <h2 style={styles.sectionTitle}>💬 WhatsApp connection</h2>
        <p>This dashboard uses the backend WhatsApp webhook. The farmer messages your <b>WhatsApp Business number</b>, not the Vercel website number.</p>
        <div style={styles.info}><b>Configured:</b> {wa ? (wa.configured ? 'Yes' : 'No') : 'Checking…'}<br/><b>Business number:</b> {wa?.display_number || 'Not configured'}</div>
        <p style={styles.muted}>The actual number is the WhatsApp Business number connected in Meta WhatsApp Cloud API. It must be configured in the backend as <code>WHATSAPP_DISPLAY_NUMBER</code>, with its Phone Number ID, access token, and webhook verify token kept as server environment variables.</p>
      </div></div>}
    </main>
  </div>;
}

const styles = {
  app: {
    display: 'flex',
    height: '100vh',
    fontFamily: 'Inter, Arial, sans-serif',
    background: '#f8fafc',
    color: '#0f172a'
  },

  sidebar: {
    width: 280,
    background: '#0f172a',
    padding: 20,
    color: '#fff',
    flexShrink: 0
  },

  main: {
    flex: 1,
    minWidth: 0,
    overflowY: 'auto',
    padding: 24
  },

  title: {
    fontSize: 24,
    color: '#fff',
    margin: 0
  },

  content: {
    maxWidth: 1200,
    margin: '0 auto'
  },

  info: {
    padding: 16,
    borderRadius: 10,
    background: '#fff',
    border: '1px solid #e2e8f0',
    marginBottom: 20
  },

  muted: {
    color: '#64748b'
  }
};
export default App;
