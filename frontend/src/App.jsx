
import React, { useEffect, useState } from 'react';
import { Activity, BusFront, Clock3, Gauge, MapPinned, BrainCircuit, BellRing, History, LayoutDashboard, RefreshCw, ShieldCheck, Wifi } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const initial = { route_id: 'R01', latitude: '11.0168', longitude: '76.9558', speed_kmph: '18', timestamp: new Date().toISOString().slice(0,16), data_mode: 'simulated' };
export default function App() {
  const [form, setForm] = useState(initial);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState({predictions:0, average_predicted_delay_minutes:0, high_risk_predictions:0});
  const [metrics, setMetrics] = useState(null);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function refresh() {
    try {
      const [h,s,p,m] = await Promise.all([
        fetch(`${API}/api/health`).then(r=>r.json()),
        fetch(`${API}/api/analytics/summary`).then(r=>r.json()),
        fetch(`${API}/api/predictions?limit=8`).then(r=>r.json()),
        fetch(`${API}/api/model/metrics`).then(r=>r.ok?r.json():null)
      ]);
      setHealth(h); setSummary(s); setHistory(p); setMetrics(m);
    } catch { setHealth({model_ready:false}); }
  }
  useEffect(()=>{ refresh(); }, []);
  async function predict(e) {
    e.preventDefault(); setBusy(true); setError(''); setResult(null);
    try {
      const res = await fetch(`${API}/api/predict`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({...form, latitude:Number(form.latitude), longitude:Number(form.longitude), speed_kmph:Number(form.speed_kmph), timestamp:new Date(form.timestamp).toISOString()})});
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Prediction failed');
      setResult(data); await refresh();
    } catch(err) { setError(`${err.message}. Confirm the backend is running and the model has been trained.`); }
    finally { setBusy(false); }
  }
  const chartData = history.slice(0,6).reverse().map((x,i)=>({name:x.route_id, delay:x.predicted_delay_minutes}));
  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-icon"><BusFront size={23}/></div><div><b>TransitIQ</b><small>DELAY INTELLIGENCE</small></div></div>
      <div className="nav-label">WORKSPACE</div>
      <div className="nav active"><LayoutDashboard size={17}/> Overview</div>
      <div className="nav"><MapPinned size={17}/> Vehicle monitoring</div>
      <div className="nav"><BrainCircuit size={17}/> DNN predictions</div>
      <div className="nav"><History size={17}/> Prediction history</div>
      <div className="nav"><Activity size={17}/> Model performance</div>
      <div className="side-bottom"><div className="secure"><ShieldCheck size={17}/><span><b>Local demo environment</b><small>Data stays on this machine</small></span></div><small className="version">SEMESTER PROJECT · v1.0</small></div>
    </aside>
    <main className="main">
      <header className="topbar"><div><span className="eyebrow">TRANSPORT OPERATIONS / OVERVIEW</span><h1>Delay intelligence dashboard</h1><p>Predict, monitor, and understand public transport delays.</p></div><button className="refresh" onClick={refresh}><RefreshCw size={15}/> Refresh</button></header>
      <div className="notice"><div className="notice-icon"><Wifi size={19}/></div><div><b>Demonstration mode</b><p>Predictions use a DNN-style model trained on synthetic sample data. Vehicle readings are simulated unless a real IoT source is connected.</p></div><span className={`status ${health?.model_ready?'online':'offline'}`}><i/>{health?.model_ready?'MODEL READY':'MODEL NOT READY'}</span></div>
      <section className="kpis">
        <Kpi icon={<Activity/>} label="Predictions made" value={summary.predictions} foot="Stored prediction records" />
        <Kpi icon={<Clock3/>} label="Average predicted delay" value={`${summary.average_predicted_delay_minutes} min`} foot="Across saved predictions" />
        <Kpi icon={<BellRing/>} label="High-risk predictions" value={summary.high_risk_predictions} foot="Predicted delay ≥ 15 min" />
        <Kpi icon={<BrainCircuit/>} label="Model status" value={health?.model_ready?'Ready':'Training needed'} foot={metrics?`Test MAE ${metrics.mae_minutes} min`:'Train model to enable predictions'} />
      </section>
      <section className="content-grid">
        <div className="panel predict-panel"><div className="panel-head"><div><span className="eyebrow">INFERENCE ENGINE</span><h2>Predict a vehicle delay</h2><p>Enter a vehicle reading to run the saved model.</p></div><span className="tag">DNN REGRESSION</span></div>
          <form onSubmit={predict}>
            <div className="form-grid">
              <label>Route ID<input value={form.route_id} onChange={e=>setForm({...form,route_id:e.target.value})} required maxLength="20"/></label>
              <label>Vehicle speed (km/h)<input type="number" min="0" max="160" step="0.1" value={form.speed_kmph} onChange={e=>setForm({...form,speed_kmph:e.target.value})} required/></label>
              <label>GPS latitude<input type="number" min="-90" max="90" step="0.000001" value={form.latitude} onChange={e=>setForm({...form,latitude:e.target.value})} required/></label>
              <label>GPS longitude<input type="number" min="-180" max="180" step="0.000001" value={form.longitude} onChange={e=>setForm({...form,longitude:e.target.value})} required/></label>
              <label className="wide">Observation time<input type="datetime-local" value={form.timestamp} onChange={e=>setForm({...form,timestamp:e.target.value})} required/></label>
            </div>
            <div className="data-mode"><span>Input source</span><b>Simulated vehicle reading</b></div>
            <button className="primary" disabled={busy}>{busy?'Running model…':<><BrainCircuit size={17}/> Predict delay</>}</button>
          </form>
          {error && <div className="error">{error}</div>}
          {result && <div className={`result ${result.risk_level.toLowerCase()}`}><div><span className="eyebrow">PREDICTED DELAY</span><div className="result-number">{result.predicted_delay_minutes} <small>minutes</small></div><p>{result.warning}</p></div><span className="risk">{result.risk_level} risk</span></div>}
        </div>
        <div className="panel chart-panel"><div className="panel-head"><div><span className="eyebrow">RECENT INFERENCE</span><h2>Recent predicted delays</h2><p>Latest saved predictions by route.</p></div><span className="chart-icon"><Gauge size={18}/></span></div>
          {chartData.length ? <div className="chart"><ResponsiveContainer width="100%" height="250"><BarChart data={chartData} margin={{top:12,right:8,left:-20,bottom:0}}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8edf3"/><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill:'#778399',fontSize:12}}/><YAxis axisLine={false} tickLine={false} tick={{fill:'#778399',fontSize:12}}/><Tooltip/><Bar dataKey="delay" name="Delay (min)" fill="#1ba99a" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div>:<div className="empty"><Activity size={26}/><b>No predictions yet</b><span>Run your first prediction to populate this chart.</span></div>}
          <div className="chart-foot"><span><i className="legend-dot"/> Predicted delay</span><span>Unit: minutes</span></div>
        </div>
      </section>
      <section className="panel history-panel"><div className="panel-head"><div><span className="eyebrow">AUDIT TRAIL</span><h2>Prediction history</h2><p>Results returned by the backend and stored in SQLite.</p></div><button className="text-button" onClick={refresh}>View latest <span>↗</span></button></div>
        <div className="table-wrap"><table><thead><tr><th>ROUTE</th><th>OBSERVATION TIME</th><th>SPEED</th><th>PREDICTED DELAY</th><th>RISK</th><th>DATA SOURCE</th></tr></thead><tbody>{history.map(row=><tr key={row.id}><td><b>{row.route_id}</b></td><td>{new Date(row.timestamp).toLocaleString()}</td><td>{row.speed_kmph} km/h</td><td><b>{row.predicted_delay_minutes} min</b></td><td><span className={`table-risk ${row.risk_level.toLowerCase()}`}>{row.risk_level}</span></td><td><span className="source-dot"/>{row.data_mode}</td></tr>)}</tbody></table>{!history.length&&<div className="table-empty">Prediction history will appear here after your first successful request.</div>}</div>
      </section>
      <footer><span>TransitIQ · IoT-Based Public Transport Delay Prediction using DNN</span><span>Academic demonstration · Synthetic data</span></footer>
    </main>
  </div>;
}
function Kpi({icon,label,value,foot}) { return <div className="kpi"><div className="kpi-top"><span>{label}</span><i>{icon}</i></div><strong>{value}</strong><small>{foot}</small></div>; }
