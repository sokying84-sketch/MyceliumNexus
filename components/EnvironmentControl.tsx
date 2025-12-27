
import React, { useState, useEffect, useRef } from 'react';
import { User, Sensor, ChamberID, ChamberConfig, SensorType } from '../types';
import { StorageService } from '../services/storageService';
import { Plus, Save, Thermometer, Droplets, Wind, Fan, Activity, Server, Settings, Wifi, PlayCircle, PauseCircle, Edit2, FileText, Clock, Filter, Layers, Microchip } from 'lucide-react';

interface Props {
  user: User;
}

// Default configs if none exist
const DEFAULT_CONFIG = {
  targetTempMin: 20,
  targetTempMax: 24,
  targetHumMin: 75,
  targetHumMax: 85
};

// Extended History Type to support multiple sensors
interface HistoryPoint {
  t: number;
  avgTemp: number;
  avgHum: number;
  sensors: Record<string, { temp: number, hum: number }>; // Map sensorID to values
}

export const EnvironmentControl: React.FC<Props> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'inventory' | 'operation'>('operation');
  const [viewFilter, setViewFilter] = useState<'ALL' | 'Chamber A' | 'Chamber B'>('ALL');
  
  // --- Inventory State ---
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [showSensorModal, setShowSensorModal] = useState(false);
  const [editingSensorId, setEditingSensorId] = useState<string | null>(null);
  const [newSensor, setNewSensor] = useState<Partial<Sensor>>({ type: 'DHT22 (Temp/Hum)', room: 'Unassigned', version: 'v1.0' });

  // --- Operation State (The Digital Twin) ---
  const [isRunning, setIsRunning] = useState(false);
  
  // Physics State (The "Real" Room Environment)
  const [chamberPhysA, setChamberPhysA] = useState({ temp: 24.0, hum: 60.0, fan: false, mister: false });
  const [chamberPhysB, setChamberPhysB] = useState({ temp: 24.0, hum: 60.0, fan: false, mister: false });

  // Config State (Persisted)
  const [configA, setConfigA] = useState<ChamberConfig>({ ...DEFAULT_CONFIG, entityId: user.entityId, room: 'Chamber A' });
  const [configB, setConfigB] = useState<ChamberConfig>({ ...DEFAULT_CONFIG, entityId: user.entityId, room: 'Chamber B' });

  // History State (Deep Log)
  const [historyA, setHistoryA] = useState<HistoryPoint[]>([]);
  const [historyB, setHistoryB] = useState<HistoryPoint[]>([]);

  // Refs for loop
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    initializeDefaults();
    loadConfigs();
    return () => stopSimulation();
  }, [user]);

  const initializeDefaults = () => {
    let currentSensors = StorageService.getSensors(user.entityId);
    
    // Auto-seed 2 pairs if empty
    if (currentSensors.length === 0) {
        const defaults: Sensor[] = [
            { id: 'SN-A-01', entityId: user.entityId, type: 'DHT22 (Temp/Hum)', version: 'v1.0', room: 'Chamber A', info: 'Rack 1 - Top', registeredAt: new Date().toISOString() },
            { id: 'SN-A-02', entityId: user.entityId, type: 'DHT22 (Temp/Hum)', version: 'v1.0', room: 'Chamber A', info: 'Rack 3 - Bottom', registeredAt: new Date().toISOString() },
            { id: 'SN-B-01', entityId: user.entityId, type: 'DHT22 (Temp/Hum)', version: 'v1.0', room: 'Chamber B', info: 'Near Door', registeredAt: new Date().toISOString() },
            { id: 'SN-B-02', entityId: user.entityId, type: 'DHT22 (Temp/Hum)', version: 'v1.0', room: 'Chamber B', info: 'Center Mass', registeredAt: new Date().toISOString() },
        ];
        defaults.forEach(s => StorageService.saveSensor(s));
        currentSensors = defaults;
    }
    setSensors(currentSensors);
  };

  const loadConfigs = () => {
    const cA = StorageService.getChamberConfig(user.entityId, 'Chamber A');
    const cB = StorageService.getChamberConfig(user.entityId, 'Chamber B');
    if (cA) setConfigA(cA);
    if (cB) setConfigB(cB);
  };

  // --- SENSOR INVENTORY LOGIC ---
  const handleRegisterSensor = () => {
    if (!newSensor.info) return alert("Please add some info/location detail.");
    
    const sensor: Sensor = {
        id: editingSensorId || `SN-${Date.now().toString().slice(-6)}`,
        entityId: user.entityId,
        type: newSensor.type as SensorType,
        version: newSensor.version || 'v1.0',
        room: newSensor.room as ChamberID,
        info: newSensor.info,
        registeredAt: newSensor.registeredAt || new Date().toISOString()
    };
    
    StorageService.saveSensor(sensor);
    setSensors(StorageService.getSensors(user.entityId)); // Refresh from storage
    handleCloseSensorModal();
  };

  const handleEditSensor = (s: Sensor) => {
      setNewSensor({ ...s });
      setEditingSensorId(s.id);
      setShowSensorModal(true);
  };

  const handleCloseSensorModal = () => {
      setShowSensorModal(false);
      setEditingSensorId(null);
      setNewSensor({ type: 'DHT22 (Temp/Hum)', room: 'Unassigned', version: 'v1.0', info: '' });
  };

  // --- PHYSICS ENGINE & AUTOMATION ---
  const startSimulation = () => {
    if (intervalRef.current) return;
    setIsRunning(true);
    
    intervalRef.current = setInterval(() => {
        const now = Date.now();

        // Helper to run physics for a room
        const processRoom = (
            roomName: string, 
            currentPhys: { temp: number, hum: number, fan: boolean, mister: boolean }, 
            config: ChamberConfig,
            roomSensors: Sensor[]
        ) => {
            let { temp, hum, fan, mister } = currentPhys;

            // 1. GENERATE SENSOR READINGS (Data Fusion)
            // Each sensor reads the "True" physics + random noise variance
            const sensorReadings: Record<string, { temp: number, hum: number }> = {};
            let sumTemp = 0;
            let sumHum = 0;
            let activeCount = 0;

            if (roomSensors.length > 0) {
                roomSensors.forEach(s => {
                    // Unique noise per sensor ID to simulate hardware differences
                    const noiseSeed = s.id.charCodeAt(s.id.length - 1); 
                    const tempNoise = (Math.sin(now / 1000 + noiseSeed) * 0.2) + (Math.random() * 0.2 - 0.1);
                    const humNoise = (Math.cos(now / 1000 + noiseSeed) * 0.5) + (Math.random() * 0.4 - 0.2);
                    
                    const sTemp = temp + tempNoise;
                    const sHum = hum + humNoise;
                    
                    sensorReadings[s.id] = { temp: sTemp, hum: sHum };
                    sumTemp += sTemp;
                    sumHum += sHum;
                    activeCount++;
                });
            } else {
                // No sensors? Logic runs on "Blind" physics
                activeCount = 1; 
                sumTemp = temp;
                sumHum = hum;
            }

            // 2. CALCULATE WEIGHTED AVERAGE (Used for Automation)
            const avgTemp = sumTemp / activeCount;
            const avgHum = sumHum / activeCount;

            // 3. AUTOMATION LOGIC (PLC) based on AVERAGE
            // Hysteresis: Turn ON if > Max, Turn OFF if < Min
            if (avgTemp > config.targetTempMax) fan = true;
            else if (avgTemp < config.targetTempMin) fan = false;

            if (avgHum < config.targetHumMin) mister = true;
            else if (avgHum > config.targetHumMax) mister = false;

            // 4. PHYSICS UPDATE (Reaction)
            const tempChange = fan ? -0.5 : 0.1; // Cools fast, heats slow
            const humChange = mister ? 1.5 : -0.3; // Humidifies fast, dries slow

            let newTemp = Math.max(0, Math.min(50, temp + tempChange + (Math.random() * 0.05)));
            let newHum = Math.max(0, Math.min(100, hum + humChange + (Math.random() * 0.1)));

            return {
                phys: { temp: newTemp, hum: newHum, fan, mister },
                historyPoint: { t: now, avgTemp, avgHum, sensors: sensorReadings }
            };
        };

        // PROCESS CHAMBER A
        const sensorsA = sensors.filter(s => s.room === 'Chamber A');
        const resA = processRoom('Chamber A', chamberPhysA, configA, sensorsA);
        setChamberPhysA(resA.phys);
        // Functional update to avoid stale closure on history
        setHistoryA(prev => [...prev.slice(-49), resA.historyPoint]);

        // PROCESS CHAMBER B
        const sensorsB = sensors.filter(s => s.room === 'Chamber B');
        const resB = processRoom('Chamber B', chamberPhysB, configB, sensorsB);
        setChamberPhysB(resB.phys);
        setHistoryB(prev => [...prev.slice(-49), resB.historyPoint]);

    }, 1000); // 1 tick per second
  };

  // Keep Ref updated for interval (standard React pattern for mutable state in interval)
  // Actually, we used functional state updates inside setInterval so standard state is fine.
  // However, `sensors`, `configA`, `configB`, `chamberPhys` need to be fresh. 
  // The simple setInterval closure captures initial state.
  // We need to restart interval if deps change OR use refs.
  // For simplicity in this demo, let's use a `useEffect` on dependencies to restart sim if running.
  useEffect(() => {
      if (isRunning) {
          stopSimulation();
          startSimulation();
      }
  }, [sensors, configA, configB, chamberPhysA, chamberPhysB]); 
  // Note: Depending on chamberPhys causes rapid restart (1000ms). Ideally use Refs for physics state or reducer.
  // Optimization: For this specific React structure, putting physics in Refs is better for performance, 
  // but for readability we keep State. We will just ignore the dependency warning or accept the restart overhead.
  // BETTER FIX: Use Refs for the mutable physics data inside the interval.
  const physARef = useRef(chamberPhysA);
  const physBRef = useRef(chamberPhysB);
  useEffect(() => { physARef.current = chamberPhysA }, [chamberPhysA]);
  useEffect(() => { physBRef.current = chamberPhysB }, [chamberPhysB]);
  
  // Re-implement startSimulation to use Refs to avoid closure staleness without restarting interval
  const startSimulationRef = () => {
    if (intervalRef.current) return;
    setIsRunning(true);
    
    intervalRef.current = setInterval(() => {
        const now = Date.now();
        // Capture current values from Refs
        const currentA = physARef.current;
        const currentB = physBRef.current;
        
        // ... (Logic same as above, but using currentA/currentB) ...
        // Re-defining process here to access latest state
        const process = (phys: any, cfg: any, roomSensors: any[]) => {
            let { temp, hum, fan, mister } = phys;
            const sensorReadings: any = {};
            let sumT = 0, sumH = 0, count = 0;

            if (roomSensors.length > 0) {
                roomSensors.forEach(s => {
                    const noiseSeed = s.id.charCodeAt(s.id.length - 1); 
                    const sTemp = temp + ((Math.sin(now/1000 + noiseSeed)*0.2) + (Math.random()*0.2-0.1));
                    const sHum = hum + ((Math.cos(now/1000 + noiseSeed)*0.5) + (Math.random()*0.4-0.2));
                    sensorReadings[s.id] = { temp: sTemp, hum: sHum };
                    sumT += sTemp; sumH += sHum; count++;
                });
            } else {
                count = 1; sumT = temp; sumH = hum;
            }

            const avgT = sumT / count;
            const avgH = sumH / count;

            if (avgT > cfg.targetTempMax) fan = true; else if (avgT < cfg.targetTempMin) fan = false;
            if (avgH < cfg.targetHumMin) mister = true; else if (avgH > cfg.targetHumMax) mister = false;

            const newT = Math.max(0, Math.min(50, temp + (fan?-0.5:0.1) + (Math.random()*0.05)));
            const newH = Math.max(0, Math.min(100, hum + (mister?1.5:-0.3) + (Math.random()*0.1)));

            return { phys: { temp: newT, hum: newH, fan, mister }, hist: { t: now, avgTemp: avgT, avgHum: avgH, sensors: sensorReadings } };
        };

        const resA = process(currentA, configA, sensors.filter(s => s.room === 'Chamber A'));
        setChamberPhysA(resA.phys);
        setHistoryA(prev => [...prev.slice(-49), resA.hist]);

        const resB = process(currentB, configB, sensors.filter(s => s.room === 'Chamber B'));
        setChamberPhysB(resB.phys);
        setHistoryB(prev => [...prev.slice(-49), resB.hist]);

    }, 1000);
  };

  const stopSimulation = () => {
    if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
    }
    setIsRunning(false);
  };

  const handleConfigSave = (room: string) => {
      if (room === 'Chamber A') StorageService.saveChamberConfig(configA);
      else StorageService.saveChamberConfig(configB);
      alert(`Target Configuration saved for ${room}`);
  };

  // --- CHART COMPONENT ---
  const Sparkline = ({ data, color, maxVal }: { data: number[], color: string, maxVal: number }) => {
      if (data.length < 2) return <div className="h-16 w-full bg-gray-50 rounded"></div>;
      const height = 64;
      const width = 200;
      const step = width / (data.length - 1);
      const points = data.map((val, i) => `${i * step},${height - ((val / maxVal) * height)}`).join(' ');
      return (
          <svg width="100%" height={height} className="overflow-visible" preserveAspectRatio="none">
              <polyline points={points} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </svg>
      );
  };

  // --- DATA LOG TABLE ---
  const DataLogTable = ({ history, sensors }: { history: HistoryPoint[], sensors: Sensor[] }) => {
      const [traceMode, setTraceMode] = useState<string>('AVG'); // AVG or Sensor ID

      return (
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm mt-6 flex flex-col h-72">
          <div className="bg-gray-50 px-4 py-2 border-b flex justify-between items-center shrink-0">
              <h4 className="font-bold text-xs text-gray-500 uppercase flex items-center gap-2">
                  <FileText size={14}/> Real-time Trace
              </h4>
              <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Source:</span>
                  <select 
                    className="text-xs border rounded p-1 bg-white focus:ring-1 focus:ring-primary-500 outline-none"
                    value={traceMode}
                    onChange={(e) => setTraceMode(e.target.value)}
                  >
                      <option value="AVG">Composite Average</option>
                      {sensors.map(s => <option key={s.id} value={s.id}>{s.id} ({s.info})</option>)}
                  </select>
              </div>
          </div>
          <div className="overflow-y-auto flex-1 p-0">
              <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 sticky top-0 text-gray-500 z-10 shadow-sm border-b">
                      <tr>
                          <th className="p-2 pl-4 font-semibold">Timestamp</th>
                          <th className="p-2 font-semibold">Temperature</th>
                          <th className="p-2 font-semibold">Humidity</th>
                          <th className="p-2 text-right pr-4 font-semibold">Source</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                      {[...history].reverse().map((row, i) => {
                          let displayTemp = row.avgTemp;
                          let displayHum = row.avgHum;
                          let isDerived = true;

                          if (traceMode !== 'AVG') {
                              const sData = row.sensors[traceMode];
                              if (sData) {
                                  displayTemp = sData.temp;
                                  displayHum = sData.hum;
                                  isDerived = false;
                              } else {
                                  // Fallback if sensor data missing for this tick
                                  displayTemp = 0; displayHum = 0;
                              }
                          }

                          return (
                          <tr key={i} className="hover:bg-gray-50 transition-colors">
                              <td className="p-2 pl-4 font-mono text-gray-500">{new Date(row.t).toLocaleTimeString()}</td>
                              <td className="p-2 font-medium text-gray-800">{displayTemp.toFixed(2)}°C</td>
                              <td className="p-2 font-medium text-gray-800">{displayHum.toFixed(2)}%</td>
                              <td className="p-2 text-right pr-4">
                                  {isDerived ? (
                                      <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">AVG</span>
                                  ) : (
                                      <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200 font-mono">{traceMode}</span>
                                  )}
                              </td>
                          </tr>
                      )})}
                      {history.length === 0 && (
                          <tr><td colSpan={4} className="p-8 text-center text-gray-400 italic">No data logged yet. Start simulation.</td></tr>
                      )}
                  </tbody>
              </table>
          </div>
      </div>
      );
  };

  // --- CHAMBER CARD COMPONENT ---
  const ChamberCard = ({ 
      name, 
      phys, 
      config, 
      setConfig, 
      history, 
      roomSensors 
  }: { 
      name: string, 
      phys: any, 
      config: ChamberConfig, 
      setConfig: (c: ChamberConfig) => void,
      history: HistoryPoint[],
      roomSensors: Sensor[]
  }) => {
      // Get latest metrics (Use average from history if avail, else phys)
      const lastPoint = history.length > 0 ? history[history.length - 1] : null;
      const displayTemp = lastPoint ? lastPoint.avgTemp : phys.temp;
      const displayHum = lastPoint ? lastPoint.avgHum : phys.hum;

      return (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-2">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                <h3 className="font-bold text-gray-800 flex items-center gap-2"><Settings size={18}/> {name}</h3>
                {roomSensors.length === 0 ? 
                    <span className="text-xs text-red-500 font-bold bg-red-50 px-2 py-1 rounded">No Sensors!</span> :
                    <span className="text-xs text-green-600 font-bold bg-green-50 px-2 py-1 rounded border border-green-200 flex items-center gap-1"><Wifi size={12}/> {roomSensors.length} Online</span>
                }
            </div>
            <div className="p-6 space-y-6 flex-1 flex flex-col">
                {/* Metrics */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-orange-50 rounded-xl border border-orange-100 text-center relative">
                        <div className="text-xs text-orange-600 font-bold uppercase mb-1 flex justify-center items-center gap-1"><Thermometer size={14}/> Avg. Temp</div>
                        <div className="text-3xl font-mono font-bold text-orange-900">{displayTemp.toFixed(1)}°C</div>
                        <div className="h-12 mt-2 opacity-50"><Sparkline data={history.map(h => h.avgTemp)} color="#ea580c" maxVal={50} /></div>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-center relative">
                        <div className="text-xs text-blue-600 font-bold uppercase mb-1 flex justify-center items-center gap-1"><Droplets size={14}/> Avg. Hum</div>
                        <div className="text-3xl font-mono font-bold text-blue-900">{displayHum.toFixed(1)}%</div>
                        <div className="h-12 mt-2 opacity-50"><Sparkline data={history.map(h => h.avgHum)} color="#2563eb" maxVal={100} /></div>
                    </div>
                </div>

                {/* Individual Sensors Grid */}
                <div className="border rounded-lg p-3 bg-gray-50/50">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-2 flex items-center gap-1"><Microchip size={12}/> Sensor Fusion Data</h4>
                    <div className="grid grid-cols-2 gap-2">
                        {roomSensors.map(s => {
                            const readings = lastPoint?.sensors[s.id];
                            return (
                                <div key={s.id} className="bg-white border rounded p-2 flex justify-between items-center text-xs">
                                    <div>
                                        <div className="font-bold text-gray-700">{s.id.split('-').pop()}</div>
                                        <div className="text-[10px] text-gray-400 truncate w-16">{s.info}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-orange-700">{readings ? readings.temp.toFixed(1) : '-'}°C</div>
                                        <div className="text-blue-700">{readings ? readings.hum.toFixed(1) : '-'}%</div>
                                    </div>
                                </div>
                            )
                        })}
                        {roomSensors.length === 0 && <div className="text-xs text-gray-400 italic col-span-2 text-center">No sensors configured.</div>}
                    </div>
                </div>

                {/* Actuators */}
                <div className="flex gap-4">
                    <div className={`flex-1 p-3 rounded-lg border flex items-center justify-between transition-all ${phys.fan ? 'bg-green-100 border-green-300' : 'bg-gray-50 border-gray-200'}`}>
                        <div className="flex items-center gap-2">
                            <Fan size={20} className={phys.fan ? 'animate-spin text-green-700' : 'text-gray-400'} />
                            <span className={`text-sm font-bold ${phys.fan ? 'text-green-800' : 'text-gray-500'}`}>Cooler Fan</span>
                        </div>
                        <span className="text-xs font-bold uppercase">{phys.fan ? 'ON' : 'OFF'}</span>
                    </div>
                    <div className={`flex-1 p-3 rounded-lg border flex items-center justify-between transition-all ${phys.mister ? 'bg-blue-100 border-blue-300' : 'bg-gray-50 border-gray-200'}`}>
                        <div className="flex items-center gap-2">
                            <Wind size={20} className={phys.mister ? 'text-blue-700' : 'text-gray-400'} />
                            <span className={`text-sm font-bold ${phys.mister ? 'text-blue-800' : 'text-gray-500'}`}>Humidifier</span>
                        </div>
                        <span className="text-xs font-bold uppercase">{phys.mister ? 'ON' : 'OFF'}</span>
                    </div>
                </div>

                {/* Controls */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase border-b pb-2 mb-2 flex justify-between items-center">
                        Target Configuration
                        <span className="text-[10px] bg-gray-200 px-1 rounded text-gray-600">AUTO</span>
                    </h4>
                    
                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span>Temp Range (°C)</span>
                            <span className="font-bold">{config.targetTempMin} - {config.targetTempMax}</span>
                        </div>
                        <div className="flex gap-2 items-center">
                            <input type="range" min="15" max="35" step="0.5" className="w-full h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer" value={config.targetTempMin} onChange={e => setConfig({...config, targetTempMin: Number(e.target.value)})} />
                            <input type="range" min="15" max="35" step="0.5" className="w-full h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer" value={config.targetTempMax} onChange={e => setConfig({...config, targetTempMax: Number(e.target.value)})} />
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span>Humidity Range (%)</span>
                            <span className="font-bold">{config.targetHumMin} - {config.targetHumMax}</span>
                        </div>
                        <div className="flex gap-2 items-center">
                            <input type="range" min="50" max="95" step="1" className="w-full h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer" value={config.targetHumMin} onChange={e => setConfig({...config, targetHumMin: Number(e.target.value)})} />
                            <input type="range" min="50" max="95" step="1" className="w-full h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer" value={config.targetHumMax} onChange={e => setConfig({...config, targetHumMax: Number(e.target.value)})} />
                        </div>
                    </div>

                    <button onClick={() => handleConfigSave(name)} className="w-full py-2 bg-white border border-gray-300 hover:bg-gray-100 rounded text-xs font-bold flex items-center justify-center gap-2 shadow-sm">
                        <Save size={14} /> Update Targets
                    </button>
                </div>

                {/* Data Log Section */}
                <DataLogTable history={history} sensors={roomSensors} />
            </div>
        </div>
      );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Wifi className="text-primary-600" /> Sensors & Environment
            </h2>
            <p className="text-sm text-gray-500">IoT Digital Twin • Multi-Sensor Data Fusion</p>
        </div>
        <div className="flex space-x-2 bg-white rounded-lg p-1 border shadow-sm">
            <button 
                onClick={() => setActiveTab('operation')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'operation' ? 'bg-primary-100 text-primary-800' : 'text-gray-500 hover:bg-gray-50'}`}
            >
                <Activity size={16} /> Operation Room
            </button>
            <button 
                onClick={() => setActiveTab('inventory')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'inventory' ? 'bg-primary-100 text-primary-800' : 'text-gray-500 hover:bg-gray-50'}`}
            >
                <Server size={16} /> Sensor Setup
            </button>
        </div>
      </div>

      {activeTab === 'inventory' && (
          <div className="space-y-6 animate-in fade-in">
              <div className="flex justify-end">
                  <button onClick={() => setShowSensorModal(true)} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 shadow-sm">
                      <Plus size={20} /> Register Sensor
                  </button>
              </div>
              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                  <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50 text-gray-600 uppercase">
                          <tr>
                              <th className="p-4">Sensor ID</th>
                              <th className="p-4">Type</th>
                              <th className="p-4">Location</th>
                              <th className="p-4">Info</th>
                              <th className="p-4">Registered</th>
                              <th className="p-4 text-center">Actions</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                          {sensors.map(s => (
                              <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                                  <td className="p-4 font-mono font-medium">{s.id}</td>
                                  <td className="p-4">{s.type}</td>
                                  <td className="p-4">
                                      <span className={`px-2 py-1 rounded text-xs border ${s.room === 'Unassigned' ? 'bg-gray-100 text-gray-500' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                                          {s.room}
                                      </span>
                                  </td>
                                  <td className="p-4 text-gray-500">{s.info}</td>
                                  <td className="p-4 text-gray-500">{new Date(s.registeredAt).toLocaleDateString()}</td>
                                  <td className="p-4 text-center">
                                      <button 
                                        onClick={() => handleEditSensor(s)}
                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                        title="Edit Sensor"
                                      >
                                          <Edit2 size={16} />
                                      </button>
                                  </td>
                              </tr>
                          ))}
                          {sensors.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-gray-400">No sensors registered.</td></tr>}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {activeTab === 'operation' && (
          <div className="space-y-6 animate-in fade-in">
              {/* Global Controls & Filter */}
              <div className="bg-gray-900 text-white p-4 rounded-xl flex flex-col md:flex-row justify-between items-center shadow-lg gap-4">
                  <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                      <span className="font-mono font-bold tracking-wide">SYSTEM STATUS: {isRunning ? 'ONLINE' : 'STANDBY'}</span>
                  </div>
                  
                  <div className="flex gap-4 items-center">
                      <div className="flex items-center gap-2 bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700">
                          <Filter size={16} className="text-gray-400"/>
                          <select 
                            className="bg-transparent text-sm font-medium focus:outline-none"
                            value={viewFilter}
                            onChange={(e) => setViewFilter(e.target.value as any)}
                          >
                              <option value="ALL">All Chambers</option>
                              <option value="Chamber A">Chamber A Only</option>
                              <option value="Chamber B">Chamber B Only</option>
                          </select>
                      </div>

                      <button 
                          onClick={isRunning ? stopSimulation : startSimulationRef}
                          className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold transition-all ${isRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                      >
                          {isRunning ? <><PauseCircle size={20}/> PAUSE SIMULATION</> : <><PlayCircle size={20}/> RUN SIMULATION</>}
                      </button>
                  </div>
              </div>

              <div className={`grid gap-6 ${viewFilter !== 'ALL' ? 'grid-cols-1 max-w-4xl mx-auto' : 'grid-cols-1 md:grid-cols-2'}`}>
                  {/* CHAMBER A */}
                  {(viewFilter === 'ALL' || viewFilter === 'Chamber A') && (
                      <ChamberCard 
                        name="Chamber A"
                        phys={chamberPhysA}
                        config={configA}
                        setConfig={setConfigA}
                        history={historyA}
                        roomSensors={sensors.filter(s => s.room === 'Chamber A')}
                      />
                  )}

                  {/* CHAMBER B */}
                  {(viewFilter === 'ALL' || viewFilter === 'Chamber B') && (
                      <ChamberCard 
                        name="Chamber B"
                        phys={chamberPhysB}
                        config={configB}
                        setConfig={setConfigB}
                        history={historyB}
                        roomSensors={sensors.filter(s => s.room === 'Chamber B')}
                      />
                  )}
              </div>
          </div>
      )}

      {/* Sensor Modal */}
      {showSensorModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-2xl">
                  <h3 className="font-bold text-lg mb-4">{editingSensorId ? 'Edit Sensor' : 'Register New Sensor'}</h3>
                  <div className="space-y-3">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1">Sensor Type</label>
                          <select className="w-full border rounded p-2" value={newSensor.type} onChange={e => setNewSensor({...newSensor, type: e.target.value as any})}>
                              <option value="DHT22 (Temp/Hum)">DHT22 (Temp/Hum)</option>
                              <option value="CO2 Sensor">CO2 Sensor</option>
                              <option value="Soil Moisture">Soil Moisture</option>
                          </select>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1">Assigned Room</label>
                          <select className="w-full border rounded p-2" value={newSensor.room} onChange={e => setNewSensor({...newSensor, room: e.target.value as any})}>
                              <option value="Unassigned">Unassigned</option>
                              <option value="Chamber A">Chamber A</option>
                              <option value="Chamber B">Chamber B</option>
                          </select>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1">Firmware Version</label>
                          <input type="text" className="w-full border rounded p-2" value={newSensor.version} onChange={e => setNewSensor({...newSensor, version: e.target.value})} />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1">Additional Info / Position</label>
                          <textarea className="w-full border rounded p-2" value={newSensor.info} onChange={e => setNewSensor({...newSensor, info: e.target.value})} />
                      </div>
                  </div>
                  <div className="flex justify-end gap-3 mt-6">
                      <button onClick={handleCloseSensorModal} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded">Cancel</button>
                      <button onClick={handleRegisterSensor} className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700">
                          {editingSensorId ? 'Save Changes' : 'Register'}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
