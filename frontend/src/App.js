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

const API =
  process.env.REACT_APP_API_URL ||
  'http://localhost:8000';

function PoultryScanner() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const chooseFile = (selectedFile) => {
    if (!selectedFile) return;

    if (!selectedFile.type.startsWith('image/')) {
      setError('Please select an image.');
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('Image must be smaller than 10 MB.');
      return;
    }

    setError('');
    setResult(null);
    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
  };

  const runDetection = async () => {
    if (!file) {
      setError('Please upload a poultry image first.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const body = new FormData();
      body.append('file', file);

      const response = await fetch(
        `${API}/poultry-diagnosis`,
        {
          method: 'POST',
          body,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || 'Poultry detection failed.'
        );
      }

      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.panel}>
      <h2 style={styles.sectionTitle}>
        🐔 Poultry Health Scanner
      </h2>

      <p style={styles.muted}>
        Upload a clear poultry/bird photo for AI-assisted
        poultry health screening.
      </p>

      <input
        type="file"
        accept="image/*"
        onChange={(event) =>
          chooseFile(event.target.files[0])
        }
      />

      {preview && (
        <img
          src={preview}
          alt="Poultry sample"
          style={styles.preview}
        />
      )}

      <br />

      <button
        onClick={runDetection}
        disabled={!file || loading}
        style={styles.button}
      >
        {loading
          ? 'Screening...'
          : 'Run poultry screening'}
      </button>

      {error && (
        <div style={styles.error}>
          {error}
        </div>
      )}

      {result && (
        <div style={styles.result}>
          <div style={styles.resultHeader}>
            <div>
              <small>Bird type</small>
              <h3>
                {result.bird_type ||
                  'Unidentified bird'}
              </h3>
            </div>

            <div style={styles.confidence}>
              {result.confidence ?? '--'}%
              <small>confidence</small>
            </div>
          </div>

          <h2>
            {result.disease_name ||
              'Unable to determine'}
          </h2>

          {result.scientific_name && (
            <p>
              <i>{result.scientific_name}</i>
            </p>
          )}

          <p>
            <b>Severity:</b>{' '}
            {result.severity ||
              'Unable to determine'}
          </p>

          {result.description && (
            <p>{result.description}</p>
          )}

          {result.symptoms &&
            result.symptoms.length > 0 && (
              <>
                <h4>Visible symptoms</h4>

                <ul>
                  {result.symptoms.map(
                    (symptom, index) => (
                      <li key={index}>
                        {symptom}
                      </li>
                    )
                  )}
                </ul>
              </>
            )}

          {result.recommendations &&
            result.recommendations.length > 0 && (
              <>
                <h4>Recommended action</h4>

                <ul>
                  {result.recommendations.map(
                    (recommendation, index) => (
                      <li key={index}>
                        {recommendation}
                      </li>
                    )
                  )}
                </ul>
              </>
            )}
        </div>
      )}
    </div>
  );
}

const demoMessages = [
  {
    name: 'Ravi Kumar',
    message:
      'Some of my chickens are not eating and look weak.',
    time: '10:15 AM',
  },
  {
    name: 'Priya Sharma',
    message:
      'A few birds have coughing and breathing problems.',
    time: '11:30 AM',
  },
  {
    name: 'Arun Patel',
    message:
      'Several chickens have reduced activity and watery droppings.',
    time: '1:05 PM',
  },
  {
    name: 'Meena Devi',
    message:
      'Two birds look sick and are staying away from the flock.',
    time: '2:40 PM',
  },
];

function DemoMessages() {
  return (
    <div style={styles.content}>
      <div style={styles.panel}>
        <h2 style={styles.sectionTitle}>
          💬 Poultry Problem Messages
        </h2>

        <p style={styles.muted}>
          Demo messages from poultry farmers reporting
          poultry problems.
        </p>

        <div style={styles.demoBadge}>
          WHATSAPP MESSAGES
        </div>

        {demoMessages.map((person, index) => (
          <div
            key={index}
            style={styles.messageCard}
          >
            <div style={styles.messageHeader}>
              <div>
                <h3 style={styles.personName}>
                  👤 {person.name}
                </h3>

                <small style={styles.muted}>
                  Today · {person.time}
                </small>
              </div>

              <span style={styles.newBadge}>
                New
              </span>
            </div>

            <p style={styles.messageText}>
              "{person.message}"
            </p>

            <span style={styles.problemLabel}>
              🐔 Poultry Problem
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function App() {
  const [zones, setZones] = useState([]);
  const [activeZone, setActiveZone] =
    useState(null);
  const [historyData, setHistoryData] =
    useState([]);
  const [tab, setTab] =
    useState('dashboard');

  const fetchFarmStatus = () => {
    fetch(`${API}/farm-status`)
      .then((response) => response.json())
      .then((data) => setZones(data))
      .catch((error) =>
        console.error(
          'Farm status error:',
          error
        )
      );
  };

  const fetchHistory = (zoneId) => {
    fetch(`${API}/zone-history/${zoneId}`)
      .then((response) => response.json())
      .then((data) => setHistoryData(data))
      .catch((error) =>
        console.error(
          'Zone history error:',
          error
        )
      );
  };

  useEffect(() => {
    fetchFarmStatus();

    const interval = setInterval(
      fetchFarmStatus,
      5000
    );

    return () =>
      clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!activeZone) return;

    fetchHistory(activeZone);

    const interval = setInterval(
      () => fetchHistory(activeZone),
      5000
    );

    return () =>
      clearInterval(interval);
  }, [activeZone]);

  return (
    <div style={styles.app}>
      <aside style={styles.sidebar}>
        <h1 style={styles.title}>
          Biosecurity Command
        </h1>

        <p style={styles.sidebarMuted}>
          Farm Signal · Live Monitoring
        </p>

        <div style={styles.nav}>
          <button
            onClick={() =>
              setTab('dashboard')
            }
            style={
              tab === 'dashboard'
                ? styles.navActive
                : styles.navButton
            }
          >
            📊 Dashboard
          </button>

          <button
            onClick={() =>
              setTab('scanner')
            }
            style={
              tab === 'scanner'
                ? styles.navActive
                : styles.navButton
            }
          >
            🐔 Poultry Scanner
          </button>

          <button
            onClick={() =>
              setTab('messages')
            }
            style={
              tab === 'messages'
                ? styles.navActive
                : styles.navButton
            }
          >
            💬 Poultry Messages
          </button>
        </div>

        {tab === 'dashboard' && (
          <>
            <h2 style={styles.label}>
              Zone Status
            </h2>

            {zones.map((zone) => {
              const risk = Number(
                zone.risk || 0
              );

              const riskColor =
                risk >= 80
                  ? '#ef4444'
                  : risk >= 50
                  ? '#eab308'
                  : '#22c55e';

              const active =
                activeZone === zone.id;

              return (
                <div
                  key={zone.id}
                  onClick={() =>
                    setActiveZone(
                      active
                        ? null
                        : zone.id
                    )
                  }
                  style={{
                    ...styles.zone,
                    borderLeft: `5px solid ${riskColor}`,
                    background: active
                      ? '#334155'
                      : '#1e293b',
                  }}
                >
                  <div
                    style={styles.zoneHeader}
                  >
                    <b>{zone.name}</b>

                    <strong
                      style={{
                        color: riskColor,
                      }}
                    >
                      {risk}%
                    </strong>
                  </div>

                  <div>
                    {zone.status}
                  </div>

                  {zone.note && (
                    <small
                      style={
                        styles.warningText
                      }
                    >
                      ⚠️ {zone.note}
                    </small>
                  )}

                  {active &&
                    historyData.length > 0 && (
                      <LineChart
                        width={230}
                        height={140}
                        data={historyData}
                      >
                        <XAxis
                          dataKey="time"
                          stroke="#94a3b8"
                          fontSize={10}
                        />

                        <YAxis
                          domain={[0, 100]}
                          stroke="#94a3b8"
                          fontSize={10}
                        />

                        <Tooltip />

                        <Line
                          type="monotone"
                          dataKey="risk"
                          stroke={riskColor}
                          strokeWidth={3}
                        />
                      </LineChart>
                    )}
                </div>
              );
            })}
          </>
        )}
      </aside>

      <main style={styles.main}>
        {tab === 'dashboard' && (
          <MapContainer
            center={[
              13.0827,
              80.2707,
            ]}
            zoom={16}
            style={{
              height: '100%',
              width: '100%',
            }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />
              {[
  {
    id: 'p1',
    name: 'Ravi Kumar',
    lat: 13.0832,
    lng: 80.2698,
    message: 'Some of my chickens are not eating and look weak.',
    risk: 'High'
  },
  {
    id: 'p2',
    name: 'Priya Sharma',
    lat: 13.0845,
    lng: 80.2715,
    message: 'A few birds have coughing and breathing problems.',
    risk: 'High'
  },
  {
    id: 'p3',
    name: 'Arun Patel',
    lat: 13.0818,
    lng: 80.2725,
    message: 'Several chickens have reduced activity and watery droppings.',
    risk: 'Moderate'
  },
  {
    id: 'p4',
    name: 'Meena Devi',
    lat: 13.0808,
    lng: 80.2688,
    message: 'Two birds look sick and are staying away from the flock.',
    risk: 'Moderate'
  }
].map(problem => (
  <Marker
    key={problem.id}
    position={[problem.lat, problem.lng]}
  >
    <Popup>
      <div>
        <h3>🐔 Poultry Problem</h3>
        <b>👤 {problem.name}</b>
        <p>💬 {problem.message}</p>
        <strong>
          ⚠️ {problem.risk} Risk
        </strong>
      </div>
    </Popup>
  </Marker>
))}

            {zones.map((zone) => (
              <Marker
                key={zone.id}
                position={[
                  zone.lat,
                  zone.lng,
                ]}
              >
                <Popup>
                  <b>{zone.name}</b>
                  <br />
                  Risk: {zone.risk}%
                  <br />
                  {zone.status}
                  <br />
                  {zone.note || ''}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}

        {tab === 'scanner' && (
          <div style={styles.content}>
            <PoultryScanner />
          </div>
        )}

        {tab === 'messages' && (
          <DemoMessages />
        )}
      </main>
    </div>
  );
}

const styles = {
  app: {
    display: 'flex',
    height: '100vh',
    fontFamily:
      'Inter, Arial, sans-serif',
    background: '#f8fafc',
    color: '#0f172a',
  },

  sidebar: {
    width: 280,
    background: '#0f172a',
    padding: 20,
    color: '#ffffff',
    flexShrink: 0,
    overflowY: 'auto',
  },

  main: {
    flex: 1,
    minWidth: 0,
    overflowY: 'auto',
  },

  title: {
    fontSize: 23,
    marginTop: 0,
    marginBottom: 6,
  },

  sidebarMuted: {
    color: '#94a3b8',
    fontSize: 13,
  },

  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginTop: 24,
    marginBottom: 28,
  },

  navButton: {
    border: 'none',
    background: 'transparent',
    color: '#cbd5e1',
    padding: '11px 12px',
    borderRadius: 8,
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: 14,
  },

  navActive: {
    border: 'none',
    background: '#334155',
    color: '#ffffff',
    padding: '11px 12px',
    borderRadius: 8,
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 'bold',
  },

  label: {
    fontSize: 14,
    color: '#cbd5e1',
    marginBottom: 10,
  },

  zone: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    cursor: 'pointer',
    color: '#ffffff',
  },

  zoneHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 5,
  },

  warningText: {
    display: 'block',
    color: '#fca5a5',
    marginTop: 5,
  },

  content: {
    padding: 28,
    maxWidth: 1100,
    margin: '0 auto',
  },

  panel: {
    background: '#ffffff',
    padding: 24,
    borderRadius: 16,
    boxShadow:
      '0 4px 20px rgba(0,0,0,0.08)',
    marginBottom: 20,
  },

  sectionTitle: {
    marginTop: 0,
    marginBottom: 8,
  },

  muted: {
    color: '#64748b',
  },

  preview: {
    display: 'block',
    width: '100%',
    maxWidth: 500,
    maxHeight: 400,
    objectFit: 'contain',
    marginTop: 18,
    borderRadius: 12,
  },

  button: {
    marginTop: 15,
    padding: '11px 18px',
    border: 'none',
    borderRadius: 8,
    background: '#0f172a',
    color: '#ffffff',
    cursor: 'pointer',
    fontWeight: 'bold',
  },

  error: {
    marginTop: 15,
    padding: 12,
    borderRadius: 8,
    background: '#fee2e2',
    color: '#991b1b',
  },

  result: {
    marginTop: 22,
    padding: 18,
    borderRadius: 12,
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
  },

  resultHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  confidence: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'right',
  },

  demoBadge: {
    display: 'inline-block',
    padding: '6px 10px',
    borderRadius: 6,
    background: '#fef3c7',
    color: '#92400e',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 16,
  },

  messageCard: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },

  messageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  personName: {
    margin: 0,
  },

  messageText: {
    fontSize: 15,
    lineHeight: 1.5,
    margin: '14px 0',
  },

  newBadge: {
    background: '#dcfce7',
    color: '#166534',
    padding: '5px 9px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 'bold',
  },

  problemLabel: {
    display: 'inline-block',
    background: '#fee2e2',
    color: '#991b1b',
    padding: '5px 9px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 'bold',
  },
};

export default App;
