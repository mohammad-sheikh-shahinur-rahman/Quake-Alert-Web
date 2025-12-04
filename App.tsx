import React, { useState, useEffect, useRef } from 'react';
import { EarthquakeFeature, ViewMode, LocationState, AlertZone, AlertNotification, TimePeriod, MapStyle } from './types';
import { fetchEarthquakes } from './services/earthquakeService';
import { calculateDistance } from './utils/geoUtils';
import NavBar from './components/NavBar';
import EarthquakeList from './components/EarthquakeList';
import MapView from './components/MapView';
import SafetyTips from './components/SafetyTips';
import { RefreshCw, X, AlertOctagon, Volume2, VolumeX, Settings, Check, Sliders, Map as MapIcon, Zap, Mic } from 'lucide-react';

const App: React.FC = () => {
  const [view, setView] = useState<ViewMode>('list');
  const [earthquakes, setEarthquakes] = useState<EarthquakeFeature[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [period, setPeriod] = useState<TimePeriod>('day');
  const [userLocation, setUserLocation] = useState<LocationState | null>(null);
  const [reduceAnimation, setReduceAnimation] = useState<boolean>(() => {
    return localStorage.getItem('reduceAnimation') === 'true';
  });
  
  // Settings State
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('soundEnabled') !== 'false';
  });
  const [volume, setVolume] = useState<number>(() => {
    const saved = localStorage.getItem('appVolume');
    return saved ? parseFloat(saved) : 1.0;
  });
  const [sirenEnabled, setSirenEnabled] = useState<boolean>(() => {
    return localStorage.getItem('sirenEnabled') !== 'false';
  });
  const [quakeSoundEnabled, setQuakeSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('quakeSoundEnabled') !== 'false';
  });
  const [voiceAlertEnabled, setVoiceAlertEnabled] = useState<boolean>(() => {
    return localStorage.getItem('voiceAlertEnabled') !== 'false';
  });

  // Map & Alert Settings
  const [minAlertMag, setMinAlertMag] = useState<number>(() => {
    const saved = localStorage.getItem('minAlertMag');
    return saved ? parseFloat(saved) : 3.0;
  });

  const [mapStyle, setMapStyle] = useState<MapStyle>(() => {
    return (localStorage.getItem('mapStyle') as MapStyle) || 'standard';
  });

  const [showSettings, setShowSettings] = useState(false);
  
  // Zone State
  const [zones, setZones] = useState<AlertZone[]>(() => {
    const saved = localStorage.getItem('alertZones');
    return saved ? JSON.parse(saved) : [];
  });
  
  // Notification State
  const [activeAlerts, setActiveAlerts] = useState<AlertNotification[]>([]);

  // Sound Tracking Refs
  const prevAlertCount = useRef(0);
  const prevLatestQuakeId = useRef<string | null>(null);

  // Persist settings
  useEffect(() => {
    localStorage.setItem('alertZones', JSON.stringify(zones));
  }, [zones]);

  useEffect(() => {
    localStorage.setItem('reduceAnimation', reduceAnimation.toString());
  }, [reduceAnimation]);

  useEffect(() => {
    localStorage.setItem('soundEnabled', isSoundEnabled.toString());
    localStorage.setItem('appVolume', volume.toString());
    localStorage.setItem('sirenEnabled', sirenEnabled.toString());
    localStorage.setItem('quakeSoundEnabled', quakeSoundEnabled.toString());
    localStorage.setItem('voiceAlertEnabled', voiceAlertEnabled.toString());
  }, [isSoundEnabled, volume, sirenEnabled, quakeSoundEnabled, voiceAlertEnabled]);

  useEffect(() => {
    localStorage.setItem('minAlertMag', minAlertMag.toString());
  }, [minAlertMag]);

  useEffect(() => {
    localStorage.setItem('mapStyle', mapStyle);
  }, [mapStyle]);

  // --- Voice Alert (TTS) ---
  const speakAlert = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    
    // Cancel any current speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = volume;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Try to find a Bangla voice, fallback to default
    const voices = window.speechSynthesis.getVoices();
    const banglaVoice = voices.find(v => v.lang.includes('bn'));
    if (banglaVoice) {
      utterance.voice = banglaVoice;
    }

    window.speechSynthesis.speak(utterance);
  };

  // --- Sound Effects ---
  const playAlertSiren = () => {
    if (!isSoundEnabled || !sirenEnabled) return;
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      const maxGain = 0.3 * volume;

      // Siren Effect: Modulating Sawtooth
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(850, ctx.currentTime + 0.3);
      osc.frequency.linearRampToValueAtTime(600, ctx.currentTime + 0.6);
      osc.frequency.linearRampToValueAtTime(850, ctx.currentTime + 0.9);
      osc.frequency.linearRampToValueAtTime(600, ctx.currentTime + 1.2);

      gain.gain.setValueAtTime(maxGain, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);

      osc.start();
      osc.stop(ctx.currentTime + 1.5);
    } catch (e) {
      console.error("Audio play failed", e);
    }
  };

  const playSignificantQuakeSound = () => {
    if (!isSoundEnabled || !quakeSoundEnabled) return;
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      const t = ctx.currentTime;
      
      // Create two oscillators for a distinctive, lower-frequency "Warning" dissonance
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      const maxGain = 0.3 * volume;

      // Oscillator 1: Low Triangle Wave (Rumble/Base)
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(150, t);
      osc1.frequency.exponentialRampToValueAtTime(100, t + 1.0);

      // Oscillator 2: Slightly Higher Sine Wave (Tone)
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(220, t); // A3
      osc2.frequency.exponentialRampToValueAtTime(180, t + 1.0);

      // Volume Envelope
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(maxGain, t + 0.1); // Quick fade in
      gain.gain.exponentialRampToValueAtTime(0.01, t + 2.0); // Long tail fade out

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 2.0);
      osc2.stop(t + 2.0);
    } catch (e) {
      console.error("Audio play failed", e);
    }
  };

  const testSound = () => {
    if (!isSoundEnabled) return;
    playSignificantQuakeSound();
    if (voiceAlertEnabled) {
      setTimeout(() => speakAlert("এটি একটি পরীক্ষামূলক ভয়েস অ্যালার্ট।"), 2500);
    }
  };

  // Monitor Alerts for Sound & Voice
  useEffect(() => {
    if (activeAlerts.length > prevAlertCount.current) {
      playAlertSiren();
      
      if (voiceAlertEnabled && activeAlerts.length > 0) {
        // Speak the details of the latest added alert (assuming logic prepends new alerts)
        // Since we can't easily distinguish exactly which one is "new" without comparing arrays,
        // we'll speak the first one if the count increased.
        const latestAlert = activeAlerts[0];
        const text = `সতর্কতা! ${latestAlert.zoneName} এলাকায় ${latestAlert.mag} মাত্রার ভূমিকম্প শনাক্ত হয়েছে।`;
        speakAlert(text);
      }
    }
    prevAlertCount.current = activeAlerts.length;
  }, [activeAlerts, isSoundEnabled, sirenEnabled, volume, voiceAlertEnabled]);

  // Monitor New Significant Earthquakes for Sound
  useEffect(() => {
    if (earthquakes.length > 0) {
      const latest = earthquakes[0]; // Assumes sorted by time descending
      
      // If we have a new latest quake (and it's not the initial load)
      if (prevLatestQuakeId.current && latest.id !== prevLatestQuakeId.current) {
         // Check if significant (Mag >= 5.5)
         if (latest.properties.mag >= 5.5) {
           playSignificantQuakeSound();
         }
      }
      
      prevLatestQuakeId.current = latest.id;
    }
  }, [earthquakes, isSoundEnabled, quakeSoundEnabled, volume]);

  // --- Logic ---

  const checkZoneAlerts = (quakes: EarthquakeFeature[], currentZones: AlertZone[]) => {
    if (currentZones.length === 0 || quakes.length === 0) return;

    const newAlerts: AlertNotification[] = [];
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000); // Only alert for recent quakes

    quakes.forEach(quake => {
      // Check magnitude threshold
      if (quake.properties.mag < minAlertMag) return;

      // Skip old quakes for alerts
      if (quake.properties.time < oneDayAgo) return;

      currentZones.forEach(zone => {
        const dist = calculateDistance(
          zone.lat, 
          zone.lng, 
          quake.geometry.coordinates[1], 
          quake.geometry.coordinates[0]
        );

        if (dist <= zone.radiusKm) {
          // Check if we already alerted this combo (simple dedupe)
          const alertId = `${quake.id}-${zone.id}`;
          const exists = activeAlerts.find(a => a.id === alertId);
          
          if (!exists) {
            newAlerts.push({
              id: alertId,
              quakeId: quake.id,
              zoneId: zone.id,
              zoneName: zone.name,
              quakePlace: quake.properties.place,
              mag: quake.properties.mag,
              timestamp: quake.properties.time
            });
          }
        }
      });
    });

    if (newAlerts.length > 0) {
      // Add new alerts to start of list
      setActiveAlerts(prev => [...newAlerts, ...prev]);
    }
  };

  const loadData = async (selectedPeriod: TimePeriod = period) => {
    setLoading(true);
    try {
      const data = await fetchEarthquakes(selectedPeriod);
      const sorted = data.features.sort((a, b) => b.properties.time - a.properties.time);
      setEarthquakes(sorted);
      
      // Check for alerts immediately after loading data
      checkZoneAlerts(sorted, zones);
      
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Real-time user location tracking
  useEffect(() => {
    let watchId: number;

    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error("Error watching location", error);
        },
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 1000
        }
      );
    }

    return () => {
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
    };
  }, []); // Run once on mount

  // Fetch data when period changes or initially
  useEffect(() => {
    loadData(period);

    // Refresh interval: only for 'day' mode to keep it real-time. 
    let interval: NodeJS.Timeout;
    if (period === 'day') {
      interval = setInterval(() => loadData('day'), 300000); // 5 mins
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [period]);

  // Re-check alerts if zones or threshold change
  useEffect(() => {
    if(earthquakes.length > 0) {
       checkZoneAlerts(earthquakes, zones);
    }
  }, [zones, minAlertMag]);

  const addZone = (zone: AlertZone) => {
    setZones(prev => [...prev, { ...zone, isVisible: true }]);
  };

  const updateZone = (updatedZone: AlertZone) => {
    setZones(prev => prev.map(z => z.id === updatedZone.id ? updatedZone : z));
  };

  const toggleZoneVisibility = (id: string) => {
    setZones(prev => prev.map(z => 
      z.id === id ? { ...z, isVisible: z.isVisible === false ? true : false } : z
    ));
  };

  const deleteZone = (id: string) => {
    setZones(prev => prev.filter(z => z.id !== id));
  };

  const dismissAlert = (id: string) => {
    setActiveAlerts(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div className="min-h-screen bg-slate-50 relative overflow-hidden flex flex-col">
      {/* ALERT OVERLAY */}
      <div className="fixed top-4 left-4 right-4 z-[2000] flex flex-col gap-2 pointer-events-none">
        {activeAlerts.map(alert => (
          <div key={alert.id} className="pointer-events-auto bg-red-500 text-white p-4 rounded-xl shadow-2xl border-l-4 border-yellow-400 flex items-start animate-in slide-in-from-top-2">
             <div className="bg-white/20 p-2 rounded-full mr-3">
               <AlertOctagon size={24} className="text-white animate-pulse" />
             </div>
             <div className="flex-1">
               <h4 className="font-bold text-sm">সতর্কবার্তা: {alert.zoneName}</h4>
               <p className="text-xs text-red-100 mt-1">
                 {alert.mag} মাত্রার ভূমিকম্প শনাক্ত হয়েছে।<br/>
                 স্থান: {alert.quakePlace}
               </p>
             </div>
             <button onClick={() => dismissAlert(alert.id)} className="text-white/60 hover:text-white ml-2">
               <X size={20} />
             </button>
          </div>
        ))}
      </div>

      {/* Header */}
      {view !== 'map' && (
        <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-50 flex justify-between items-center shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">ভূমিকম্প <span className="text-rose-600">অ্যালার্ট</span></h1>
            <p className="text-xs text-slate-500">
              {period === 'day' ? 'রিয়েল টাইম আপডেট' : period === 'week' ? 'গত ৭ দিনের তথ্য' : 'গত ৩০ দিনের তথ্য'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowSettings(true)} 
              className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"
              title="সেটিংস"
            >
              <Settings size={20} className="text-slate-600"/>
            </button>
            <button 
              onClick={() => loadData(period)} 
              disabled={loading}
              className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"
            >
              <RefreshCw size={20} className={`text-slate-600 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[3000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center">
                <Sliders size={18} className="mr-2 text-slate-500"/> অ্যাপ সেটিংস
              </h3>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-8 overflow-y-auto">
              
              {/* Section 1: Notifications */}
              <div>
                 <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center">
                    <AlertOctagon size={14} className="mr-2"/> নোটিফিকেশন (Notifications)
                 </h4>
                 <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="flex justify-between mb-2">
                       <label className="text-sm font-medium text-slate-700">ন্যূনতম অ্যালার্ট মাত্রা</label>
                       <span className="text-sm font-bold text-rose-600">{minAlertMag} +</span>
                    </div>
                    <input 
                      type="range" 
                      min="3.0" 
                      max="7.0" 
                      step="0.1"
                      value={minAlertMag}
                      onChange={(e) => setMinAlertMag(parseFloat(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-600 mb-2"
                    />
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {minAlertMag}-এর চেয়ে কম মাত্রার ভূমিকম্পে জোন অ্যালার্ট আসবে না।
                    </p>
                 </div>
              </div>

              {/* Section 2: Sound */}
              <div>
                 <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center">
                    <Volume2 size={14} className="mr-2"/> সাউন্ড (Sound)
                 </h4>
                 
                 <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-slate-800 text-sm">শব্দ চালু করুন</div>
                      </div>
                      <button 
                        onClick={() => setIsSoundEnabled(!isSoundEnabled)}
                        className={`w-10 h-6 rounded-full transition-colors relative ${isSoundEnabled ? 'bg-green-500' : 'bg-slate-300'}`}
                      >
                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${isSoundEnabled ? 'translate-x-4' : ''}`}></div>
                      </button>
                    </div>

                    {isSoundEnabled && (
                      <div className="animate-in slide-in-from-top-2 pt-2 border-t border-slate-200 space-y-4">
                        <div>
                          <div className="flex justify-between mb-2">
                            <label className="text-xs font-medium text-slate-600">ভলিউম</label>
                            <span className="text-xs font-bold text-blue-600">{Math.round(volume * 100)}%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <VolumeX size={14} className="text-slate-400"/>
                            <input 
                              type="range" 
                              min="0" 
                              max="1" 
                              step="0.05"
                              value={volume} 
                              onChange={(e) => setVolume(parseFloat(e.target.value))}
                              className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                            <Volume2 size={14} className="text-slate-400"/>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-xs text-slate-700">অ্যালার্ট সাইরেন</span>
                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${sirenEnabled ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`} onClick={() => setSirenEnabled(!sirenEnabled)}>
                              {sirenEnabled && <Check size={10} className="text-white" />}
                            </div>
                          </label>

                          <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-xs text-slate-700">ভূমিকম্পের শব্দ (৫.৫+)</span>
                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${quakeSoundEnabled ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`} onClick={() => setQuakeSoundEnabled(!quakeSoundEnabled)}>
                               {quakeSoundEnabled && <Check size={10} className="text-white" />}
                            </div>
                          </label>

                          <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-xs text-slate-700 flex items-center"><Mic size={12} className="mr-1"/> ভয়েস অ্যালার্ট (TTS)</span>
                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${voiceAlertEnabled ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`} onClick={() => setVoiceAlertEnabled(!voiceAlertEnabled)}>
                               {voiceAlertEnabled && <Check size={10} className="text-white" />}
                            </div>
                          </label>
                        </div>

                        <button 
                          onClick={testSound}
                          className="w-full py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-100 transition-colors"
                        >
                          টেস্ট সাউন্ড
                        </button>
                      </div>
                    )}
                 </div>
              </div>
              
              {/* Section 3: Map & Appearance */}
              <div>
                 <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center">
                    <MapIcon size={14} className="mr-2"/> ম্যাপ ও দৃশ্যমানতা
                 </h4>
                 
                 <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-2 block">ম্যাপের ধরন</label>
                      <div className="grid grid-cols-3 gap-2">
                         {(['standard', 'satellite', 'dark'] as const).map(style => (
                            <button
                              key={style}
                              onClick={() => setMapStyle(style)}
                              className={`px-2 py-2 rounded-lg text-xs font-medium border transition-colors ${
                                mapStyle === style 
                                  ? 'bg-blue-600 text-white border-blue-600' 
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                               {style === 'standard' && 'সাধারণ'}
                               {style === 'satellite' && 'স্যাটেলাইট'}
                               {style === 'dark' && 'ডার্ক'}
                            </button>
                         ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                      <div>
                        <div className="text-sm font-medium text-slate-800">অ্যানিমেশন কমান</div>
                        <div className="text-xs text-slate-500">ব্যাটারি বাঁচাতে বা নয়েজ কমাতে</div>
                      </div>
                      <button 
                        onClick={() => setReduceAnimation(!reduceAnimation)}
                        className={`w-10 h-6 rounded-full transition-colors relative ${reduceAnimation ? 'bg-blue-600' : 'bg-slate-300'}`}
                      >
                         <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${reduceAnimation ? 'translate-x-4' : ''}`}></div>
                      </button>
                    </div>
                 </div>
              </div>

            </div>
            
            <div className="bg-slate-50 p-4 border-t border-slate-100 mt-auto">
               <button onClick={() => setShowSettings(false)} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors">
                 সেভ করুন
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 relative">
        {view === 'list' && (
          <EarthquakeList 
            earthquakes={earthquakes} 
            loading={loading} 
            period={period}
            onPeriodChange={setPeriod}
            userLocation={userLocation}
          />
        )}
        
        {view === 'map' && (
          <div className="absolute inset-0 h-full w-full">
            <MapView 
              earthquakes={earthquakes} 
              userLocation={userLocation} 
              zones={zones}
              activeAlerts={activeAlerts}
              onAddZone={addZone}
              onUpdateZone={updateZone}
              onToggleZoneVisibility={toggleZoneVisibility}
              onDeleteZone={deleteZone}
              onLocationUpdate={setUserLocation}
              onRefresh={() => loadData(period)}
              isLoading={loading}
              reduceAnimation={reduceAnimation}
              onToggleAnimation={() => setReduceAnimation(!reduceAnimation)}
              mapStyle={mapStyle}
              onMapStyleChange={setMapStyle}
            />
          </div>
        )}

        {view === 'safety' && (
          <SafetyTips recentQuakes={earthquakes} />
        )}
      </main>

      <NavBar currentView={view} setView={setView} />
    </div>
  );
};

export default App;