import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, useMap, useMapEvents, Circle } from 'react-leaflet';
import L from 'leaflet';
import { EarthquakeFeature, LocationState, AlertZone, AlertNotification, MapStyle } from '../types';
import { formatTime } from '../services/earthquakeService';
import { identifyLocationFromImage } from '../services/geminiService';
import { BellPlus, Trash2, Check, X, MapPin, MousePointerClick, LocateFixed, Globe, Pencil, Eye, EyeOff, Layers, RefreshCw, Zap, ZapOff, Camera } from 'lucide-react';

// Fix for default Leaflet marker icons in React
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom User Location Icon
const userIcon = L.divIcon({
  className: '',
  html: `
    <div style="position: relative; width: 24px; height: 24px; pointer-events: none;">
      <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 24px; height: 24px; background-color: rgba(37, 99, 235, 0.3); border-radius: 50%; animation: ripple 2s infinite ease-out;"></div>
      <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 14px; height: 14px; background-color: #2563eb; border: 2px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// Dynamic Marker Icon Generator
const createCustomIcon = (mag: number, isAlert: boolean = false, useAnimation: boolean = true) => {
  let color = '#10b981'; // Emerald (< 3)
  
  if (isAlert) {
    color = '#ef4444'; // Red 500 (Alert)
  } else {
    if (mag >= 7) color = '#7c3aed'; // Violet
    else if (mag >= 6) color = '#dc2626'; // Red
    else if (mag >= 5) color = '#f43f5e'; // Rose
    else if (mag >= 3) color = '#f59e0b'; // Amber
  }

  const size = Math.max(12, Math.min(mag * 6, 50));
  const finalSize = isAlert ? size * 1.3 : size; // Make alert markers larger
  
  // Conditionally apply animation classes
  const pulseClass = useAnimation ? (isAlert ? 'alert-pulse' : 'quake-pulse') : '';
  
  // For no animation, we just don't render the pulse div or make it static
  const pulseHtml = useAnimation 
    ? `<div class="${pulseClass}" style="${!isAlert ? `background-color: ${color};` : ''} width: ${finalSize}px; height: ${finalSize}px;"></div>` 
    : '';

  return L.divIcon({
    className: '',
    html: `
      <div class="quake-marker-container" style="width: ${finalSize}px; height: ${finalSize}px;">
        ${pulseHtml}
        <div class="quake-dot" style="background-color: ${color}; width: ${finalSize}px; height: ${finalSize}px; border-color: ${isAlert ? '#fee2e2' : 'white'};"></div>
      </div>
    `,
    iconSize: [finalSize, finalSize],
    iconAnchor: [finalSize / 2, finalSize / 2],
  });
};

// Component to handle map clicks for adding zones
const MapClickHandler: React.FC<{ 
  isAdding: boolean; 
  onLocationSelect: (lat: number, lng: number) => void 
}> = ({ isAdding, onLocationSelect }) => {
  useMapEvents({
    click(e) {
      if (isAdding) {
        onLocationSelect(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
};

// Improved Recenter Component
const MapRecenter: React.FC<{ center: [number, number] }> = ({ center }) => {
  const map = useMap();
  const [lastCenter, setLastCenter] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (!lastCenter || (lastCenter[0] !== center[0] || lastCenter[1] !== center[1])) {
       map.setView(center, map.getZoom());
       setLastCenter(center);
    }
  }, [center, map, lastCenter]);
  return null;
};

interface MapViewProps {
  earthquakes: EarthquakeFeature[];
  userLocation: LocationState | null;
  zones: AlertZone[];
  activeAlerts: AlertNotification[];
  onAddZone: (zone: AlertZone) => void;
  onUpdateZone: (zone: AlertZone) => void;
  onToggleZoneVisibility: (id: string) => void;
  onDeleteZone: (id: string) => void;
  onLocationUpdate?: (location: LocationState) => void;
  onRefresh: () => void;
  isLoading: boolean;
  reduceAnimation: boolean;
  onToggleAnimation: () => void;
  mapStyle: MapStyle;
  onMapStyleChange: (style: MapStyle) => void;
}

const MapView: React.FC<MapViewProps> = ({ 
  earthquakes, 
  userLocation, 
  zones,
  activeAlerts,
  onAddZone, 
  onUpdateZone,
  onToggleZoneVisibility,
  onDeleteZone,
  onLocationUpdate,
  onRefresh,
  isLoading,
  reduceAnimation,
  onToggleAnimation,
  mapStyle,
  onMapStyleChange
}) => {
  const defaultCenter: [number, number] = [23.8103, 90.4125]; 
  
  // State initialization logic for restoring map view
  const getInitialCenter = (): [number, number] => {
    const saved = localStorage.getItem('mapCenter');
    if (saved) {
       try {
         return JSON.parse(saved);
       } catch(e) { console.error(e); }
    }
    return userLocation ? [userLocation.lat, userLocation.lng] : defaultCenter;
  };

  const getInitialZoom = (): number => {
    const saved = localStorage.getItem('mapZoom');
    return saved ? parseInt(saved) : (userLocation ? 7 : 6);
  };
  
  const [center, setCenter] = useState<[number, number]>(getInitialCenter);
  const [zoom, setZoom] = useState<number>(getInitialZoom);

  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [isAddingZone, setIsAddingZone] = useState(false);
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [showZoneManager, setShowZoneManager] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  
  // Camera/Image Analysis State
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Temporary state for the new zone modal
  const [tempZoneLoc, setTempZoneLoc] = useState<{lat: number, lng: number} | null>(null);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneRadius, setNewZoneRadius] = useState(50);
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  // Map State Persistence Tracker
  const MapStateTracker = () => {
    const map = useMapEvents({
      moveend: () => {
        const c = map.getCenter();
        const z = map.getZoom();
        localStorage.setItem('mapCenter', JSON.stringify([c.lat, c.lng]));
        localStorage.setItem('mapZoom', z.toString());
      }
    });
    return null;
  };

  const handleLocationSelect = (lat: number, lng: number) => {
    setTempZoneLoc({ lat, lng });
    if (!editingZoneId) {
      setNewZoneName('আমার জোন');
    }
  };

  const handleImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzingImage(true);
    try {
      const result = await identifyLocationFromImage(file);
      if (result) {
        setTempZoneLoc({ lat: result.lat, lng: result.lng });
        setNewZoneName(result.name || 'চিহ্নিত স্থান');
        setNewZoneRadius(50);
        setEditingZoneId(null);
        setIsAddingZone(true);
        setShowZoneManager(false);
        
        if (mapInstance) {
          mapInstance.flyTo([result.lat, result.lng], 14, { duration: 1.5 });
        }
      } else {
        alert("ছবি থেকে স্থান শনাক্ত করা যায়নি। অনুগ্রহ করে ম্যানুয়ালি জোন সিলেক্ট করুন।");
      }
    } catch (error) {
      console.error("Analysis failed:", error);
      alert("সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    } finally {
      setIsAnalyzingImage(false);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const triggerCamera = () => {
    fileInputRef.current?.click();
  };

  const saveZone = () => {
    if (tempZoneLoc && newZoneName) {
      if (editingZoneId) {
        // Find existing to preserve visibility state
        const existing = zones.find(z => z.id === editingZoneId);

        // Update existing zone
        const updatedZone: AlertZone = {
          id: editingZoneId,
          name: newZoneName,
          lat: tempZoneLoc.lat,
          lng: tempZoneLoc.lng,
          radiusKm: newZoneRadius,
          isVisible: existing?.isVisible // Preserve visibility
        };
        onUpdateZone(updatedZone);
      } else {
        // Create new zone
        const newZone: AlertZone = {
          id: Date.now().toString(),
          name: newZoneName,
          lat: tempZoneLoc.lat,
          lng: tempZoneLoc.lng,
          radiusKm: newZoneRadius,
          isVisible: true // Default visible
        };
        onAddZone(newZone);
      }
      
      // Cleanup
      setTempZoneLoc(null);
      setIsAddingZone(false);
      setEditingZoneId(null);
    }
  };

  const cancelZoneAdd = () => {
    setTempZoneLoc(null);
    setIsAddingZone(false);
    setEditingZoneId(null);
  };

  const handleEditZone = (zone: AlertZone) => {
    setNewZoneName(zone.name);
    setNewZoneRadius(zone.radiusKm);
    setTempZoneLoc({ lat: zone.lat, lng: zone.lng });
    setEditingZoneId(zone.id);
    setIsAddingZone(true); // Allow them to tap map to move it
    setShowZoneManager(false);
    
    // Fly to zone to help editing
    if (mapInstance) {
      mapInstance.flyTo([zone.lat, zone.lng], 10, { duration: 1 });
    }
  };

  const handleLocateMe = () => {
    setIsLocating(true);
    
    // If we already have the live location from the parent, fly to it immediately
    if (userLocation) {
       if (mapInstance) {
         mapInstance.flyTo([userLocation.lat, userLocation.lng], 15, { duration: 1.5 });
       }
       setIsLocating(false);
       // Optional: trigger update if needed by parent logic, though parent is source of truth here
       if (onLocationUpdate) onLocationUpdate(userLocation);
       return;
    }

    // Fallback: request one-time location if live location isn't ready
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          
          if (onLocationUpdate) {
            onLocationUpdate({ lat: latitude, lng: longitude });
          }

          if (mapInstance) {
            mapInstance.flyTo([latitude, longitude], 14, { duration: 1.5 });
          }
          
          setIsLocating(false);
        },
        (error) => {
          console.error("Error finding location:", error);
          alert("আপনার লোকেশন পাওয়া যাচ্ছে না। অনুগ্রহ করে লোকেশন পারমিশন চেক করুন।");
          setIsLocating(false);
        }
      );
    } else {
      alert("আপনার ডিভাইসে জিওলোকেশন সুবিধা নেই।");
      setIsLocating(false);
    }
  };

  const handleFitBounds = () => {
    if (!mapInstance) return;

    if (earthquakes.length === 0 && zones.length === 0 && !userLocation) {
      mapInstance.flyTo(defaultCenter, 6, { duration: 1.5 });
      return;
    }

    const bounds = L.latLngBounds([]);

    // Add earthquakes to bounds
    earthquakes.forEach(q => {
      bounds.extend([q.geometry.coordinates[1], q.geometry.coordinates[0]]);
    });

    // Add zones to bounds
    zones.forEach(z => {
      // Only include visible zones in fit bounds
      if (z.isVisible !== false) {
        bounds.extend([z.lat, z.lng]);
      }
    });

    // Add user location
    if (userLocation) {
      bounds.extend([userLocation.lat, userLocation.lng]);
    }

    if (bounds.isValid()) {
      mapInstance.flyToBounds(bounds, { padding: [50, 50], duration: 1.5 });
    } else {
      mapInstance.flyTo(defaultCenter, 6, { duration: 1.5 });
    }
  };

  const isZoneAlerted = (zoneId: string) => activeAlerts.some(a => a.zoneId === zoneId);
  const isQuakeAlerted = (quakeId: string) => activeAlerts.some(a => a.quakeId === quakeId);

  // Tile Layer URLs
  const getTileUrl = () => {
    switch (mapStyle) {
      case 'satellite':
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      case 'dark':
        return 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
      case 'standard':
      default:
        return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    }
  };

  const getAttribution = () => {
    switch (mapStyle) {
      case 'satellite':
        return 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community';
      case 'dark':
        return '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
      case 'standard':
      default:
        return '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
    }
  };

  return (
    <div className="h-full w-full relative z-0">
      {/* Hidden File Input for Camera */}
      <input 
        type="file" 
        accept="image/*" 
        capture="environment" 
        ref={fileInputRef} 
        onChange={handleImageCapture}
        className="hidden"
      />

      <MapContainer 
        center={center} 
        zoom={zoom} 
        style={{ height: '100vh', width: '100%', cursor: isAddingZone ? 'crosshair' : 'grab', backgroundColor: mapStyle === 'dark' ? '#1a1a1a' : '#ddd' }}
        zoomControl={false}
        ref={setMapInstance}
      >
        <TileLayer
          attribution={getAttribution()}
          url={getTileUrl()}
        />

        <MapStateTracker />
        <MapClickHandler isAdding={isAddingZone} onLocationSelect={handleLocationSelect} />
        
        {/* User Location */}
        {userLocation && (
          <Marker 
            position={[userLocation.lat, userLocation.lng]} 
            icon={userIcon}
            zIndexOffset={2000} // Keep it on top of everything
          >
             <Tooltip direction="top" offset={[0, -20]} className="custom-tooltip" opacity={1}>
                <div className="tooltip-content px-3 py-1.5 font-bold text-slate-700 text-sm flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  আপনার অবস্থান
                </div>
             </Tooltip>
          </Marker>
        )}

        {/* Zones (Circles) */}
        {zones.map((zone) => {
          // Hide if not visible
          if (zone.isVisible === false) return null;

          const alerted = isZoneAlerted(zone.id);
          // Don't show original circle if currently editing it and we have a temp location (preview)
          if (editingZoneId === zone.id && tempZoneLoc) return null;

          return (
            <Circle
              key={zone.id}
              center={[zone.lat, zone.lng]}
              radius={zone.radiusKm * 1000} // Leaflet takes meters
              pathOptions={{ 
                color: alerted ? '#ef4444' : (mapStyle === 'dark' ? '#60a5fa' : '#3b82f6'), 
                fillColor: alerted ? '#ef4444' : (mapStyle === 'dark' ? '#60a5fa' : '#3b82f6'), 
                fillOpacity: alerted ? 0.3 : 0.15, 
                dashArray: alerted ? '' : '5, 10',
                className: (!reduceAnimation && alerted) ? 'zone-alert-active' : ''
              }}
            >
               <Tooltip permanent direction="center" className="zone-label">
                  {zone.name}
               </Tooltip>
            </Circle>
          );
        })}

        {/* Temporary Circle while adding/editing */}
        {tempZoneLoc && (
           <Circle
           center={[tempZoneLoc.lat, tempZoneLoc.lng]}
           radius={newZoneRadius * 1000}
           pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.2, dashArray: '5, 5' }}
         />
        )}

        {/* Earthquake Markers */}
        {earthquakes.map((quake) => {
          const alerted = isQuakeAlerted(quake.id);
          return (
            <Marker
              key={quake.id}
              position={[quake.geometry.coordinates[1], quake.geometry.coordinates[0]]}
              icon={createCustomIcon(quake.properties.mag, alerted, !reduceAnimation)}
              zIndexOffset={alerted ? 1000 : 0} // Bring alerts to front
            >
              <Tooltip 
                direction="top" 
                offset={[0, -20]} 
                opacity={1} 
                className="custom-tooltip"
                sticky={false}
              >
                <div className="tooltip-content w-[220px] font-sans text-left">
                  <div className={`h-1.5 w-full ${quake.properties.mag >= 5.0 ? 'bg-rose-500' : 'bg-amber-400'}`}></div>
                  <div className="p-3">
                    <h3 className="font-bold text-slate-800 text-sm mb-3 leading-snug">
                      {quake.properties.place}
                    </h3>
                    <div className="flex items-center justify-between mb-3 bg-slate-50 rounded-lg p-2">
                       <div className="text-center">
                          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">মাত্রা</div>
                          <div className={`text-xl font-black ${quake.properties.mag >= 5.0 ? 'text-rose-600' : 'text-amber-500'}`}>
                            {quake.properties.mag.toFixed(1)}
                          </div>
                       </div>
                       <div className="h-8 w-[1px] bg-slate-200"></div>
                       <div className="text-center">
                          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">গভীরতা</div>
                          <div className="text-xl font-bold text-slate-700">
                            {Math.round(quake.geometry.coordinates[2])} <span className="text-[10px] font-normal text-slate-400">কিমি</span>
                          </div>
                       </div>
                    </div>
                    <div className="text-[11px] text-slate-500 text-center font-medium">
                      {formatTime(quake.properties.time)}
                    </div>
                  </div>
                </div>
              </Tooltip>
            </Marker>
          );
        })}

      </MapContainer>
      
      {/* Overlay Gradient */}
      <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/20 to-transparent pointer-events-none z-[400]" />

      {/* Analysis Loading Badge */}
      {isAnalyzingImage && (
        <div className="absolute top-32 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-4 py-2 rounded-full shadow-lg z-[600] text-sm font-medium animate-pulse flex items-center whitespace-nowrap">
           <RefreshCw size={16} className="animate-spin mr-2"/>
           স্থান শনাক্ত করা হচ্ছে...
        </div>
      )}

      {/* --- UI CONTROLS --- */}

      <div className="absolute top-20 right-4 z-[500] flex flex-col gap-3">
         {/* Refresh Button */}
        <button 
          onClick={onRefresh}
          className="p-3 bg-white rounded-full shadow-lg text-slate-700 hover:text-blue-600 transition-colors"
          title="রিফ্রেশ করুন"
        >
          <RefreshCw size={24} className={isLoading ? "animate-spin text-rose-500" : ""} />
        </button>

        {/* Animation Toggle */}
        <button 
          onClick={onToggleAnimation}
          className={`p-3 rounded-full shadow-lg transition-colors ${
            reduceAnimation ? 'bg-slate-200 text-slate-500' : 'bg-white text-yellow-500 hover:text-yellow-600'
          }`}
          title={reduceAnimation ? "অ্যানিমেশন চালু করুন" : "অ্যানিমেশন কমান"}
        >
          {reduceAnimation ? <ZapOff size={24} /> : <Zap size={24} />}
        </button>

        {/* Camera / AI Zone Button */}
        <button 
          onClick={triggerCamera}
          className="p-3 bg-white rounded-full shadow-lg text-slate-700 hover:text-indigo-600 transition-colors relative"
          title="ছবি তুলে জোন যোগ করুন"
        >
           {isAnalyzingImage ? <RefreshCw size={24} className="animate-spin text-indigo-600" /> : <Camera size={24} />}
           {/* Badge for visual hint */}
           {!isAnalyzingImage && <div className="absolute top-0 right-0 w-3 h-3 bg-blue-500 rounded-full border-2 border-white"></div>}
        </button>

        {/* Layer Toggle */}
        <div className="relative">
          <button
            onClick={() => setShowLayerMenu(!showLayerMenu)}
            className="p-3 bg-white rounded-full shadow-lg text-slate-700 hover:text-blue-600 transition-colors"
            title="ম্যাপের ধরন"
          >
            <Layers size={24} />
          </button>
          
          {showLayerMenu && (
            <div className="absolute right-14 top-0 bg-white rounded-xl shadow-xl p-2 w-32 flex flex-col gap-1 border border-slate-100 animate-in slide-in-from-right-2">
               <button 
                onClick={() => { onMapStyleChange('standard'); setShowLayerMenu(false); }}
                className={`text-xs font-semibold px-3 py-2 rounded-lg text-left ${mapStyle === 'standard' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
               >
                 সাধারণ
               </button>
               <button 
                onClick={() => { onMapStyleChange('satellite'); setShowLayerMenu(false); }}
                className={`text-xs font-semibold px-3 py-2 rounded-lg text-left ${mapStyle === 'satellite' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
               >
                 স্যাটেলাইট
               </button>
               <button 
                onClick={() => { onMapStyleChange('dark'); setShowLayerMenu(false); }}
                className={`text-xs font-semibold px-3 py-2 rounded-lg text-left ${mapStyle === 'dark' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
               >
                 ডার্ক মোড
               </button>
            </div>
          )}
        </div>

        {/* Zone Toggle Button */}
        <button 
          onClick={() => {
            setShowZoneManager(!showZoneManager);
            if(isAddingZone) cancelZoneAdd();
          }} 
          className={`p-3 rounded-full shadow-lg transition-colors ${
            showZoneManager ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 hover:text-blue-600'
          }`}
          title="অ্যালার্ট জোন"
        >
          <BellPlus size={24} />
        </button>

        {/* Locate Me Button */}
        <button 
          onClick={handleLocateMe}
          className="p-3 bg-white rounded-full shadow-lg text-slate-700 hover:text-blue-600 transition-colors"
          title="আমার অবস্থান"
        >
          <LocateFixed size={24} className={isLocating ? "animate-spin text-blue-600" : ""} />
        </button>

        {/* Fit Bounds Button */}
        <button
          onClick={handleFitBounds}
          className="p-3 bg-white rounded-full shadow-lg text-slate-700 hover:text-blue-600 transition-colors"
          title="সব দেখুন"
        >
          <Globe size={24} />
        </button>
      </div>

      {/* Zone Management Panel */}
      {showZoneManager && !tempZoneLoc && (
        <div className="absolute top-4 left-4 right-16 z-[500] bg-white rounded-xl shadow-xl p-4 animate-in slide-in-from-top-4 duration-200">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-slate-800">অ্যালার্ট জোন ({zones.length})</h3>
            <button onClick={() => setShowZoneManager(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
          </div>
          
          <button 
            onClick={() => {
              setIsAddingZone(true);
              setEditingZoneId(null);
              setNewZoneName('আমার জোন');
              setNewZoneRadius(50);
              setShowZoneManager(false);
            }}
            className={`w-full py-2.5 rounded-lg font-medium text-sm flex items-center justify-center mb-4 transition-all ${
               isAddingZone ? 'bg-blue-100 text-blue-700' : 'bg-slate-900 text-white shadow-md hover:bg-slate-800'
            }`}
          >
            {isAddingZone ? <span className="animate-pulse">ম্যাপে ট্যাপ করুন...</span> : <><MapPin size={16} className="mr-2"/> নতুন জোন যোগ করুন</>}
          </button>

          <div className="space-y-2 max-h-40 overflow-y-auto no-scrollbar">
            {zones.length === 0 && <p className="text-center text-xs text-slate-400 py-2">কোনো জোন তৈরি করা হয়নি</p>}
            {zones.map(zone => (
              <div key={zone.id} className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100">
                <div className="flex-1 min-w-0 mr-2">
                  <div className={`font-semibold text-sm truncate ${isZoneAlerted(zone.id) ? 'text-red-600' : 'text-slate-700'}`}>{zone.name}</div>
                  <div className="text-xs text-slate-500">{zone.radiusKm} কিমি এলাকা</div>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => onToggleZoneVisibility(zone.id)}
                    className={`p-1.5 rounded transition-colors ${zone.isVisible === false ? 'text-slate-400 hover:bg-slate-100' : 'text-blue-500 hover:bg-blue-50'}`}
                    title={zone.isVisible === false ? "দৃশ্যমান করুন" : "লুকান"}
                  >
                    {zone.isVisible === false ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button 
                    onClick={() => handleEditZone(zone)}
                    className="p-1.5 text-slate-500 hover:bg-slate-100 rounded transition-colors"
                    title="এডিট"
                  >
                    <Pencil size={16} />
                  </button>
                  <button 
                    onClick={() => onDeleteZone(zone.id)}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded transition-colors"
                    title="ডিলিট"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Adding/Editing Zone Modal (Bottom Sheet style) */}
      {tempZoneLoc && (
        <div className="absolute bottom-24 left-4 right-4 z-[500] bg-white rounded-xl shadow-2xl p-4 border border-slate-200 animate-in slide-in-from-bottom-4">
           <h3 className="font-bold text-slate-800 mb-4 flex items-center">
             <MousePointerClick size={18} className="mr-2 text-blue-600"/> 
             {editingZoneId ? 'জোন এডিট করুন' : 'নতুন জোন তৈরি'}
           </h3>
           
           <div className="space-y-4">
             <div>
               <label className="text-xs font-semibold text-slate-500 uppercase">নাম</label>
               <input 
                  type="text" 
                  value={newZoneName}
                  onChange={(e) => setNewZoneName(e.target.value)}
                  className="w-full mt-1 p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="যেমন: বাসা, অফিস..."
               />
             </div>
             <div>
                <div className="flex justify-between">
                  <label className="text-xs font-semibold text-slate-500 uppercase">ব্যাসার্ধ (Radius)</label>
                  <span className="text-xs font-bold text-blue-600">{newZoneRadius} কিমি</span>
                </div>
                <div className="flex gap-2 items-center mt-2">
                   <input 
                      type="number"
                      min="1"
                      max="200"
                      value={newZoneRadius}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val)) setNewZoneRadius(Math.max(1, Math.min(200, val)));
                      }}
                      className="w-20 p-1 border border-slate-300 rounded text-center text-sm"
                   />
                   <input 
                      type="range" 
                      min="1" 
                      max="200" 
                      step="1"
                      value={newZoneRadius}
                      onChange={(e) => setNewZoneRadius(parseInt(e.target.value))}
                      className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                   />
                </div>
             </div>
             
             {isAddingZone && editingZoneId && (
               <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded text-center animate-pulse">
                 লোকেশন পরিবর্তন করতে ম্যাপে ট্যাপ করুন
               </p>
             )}
             
             <div className="flex gap-3 pt-2">
               <button onClick={cancelZoneAdd} className="flex-1 py-2 bg-slate-100 text-slate-600 font-medium rounded-lg text-sm">বাতিল</button>
               <button onClick={saveZone} className="flex-1 py-2 bg-blue-600 text-white font-medium rounded-lg text-sm shadow-lg hover:bg-blue-700">
                 {editingZoneId ? 'আপডেট করুন' : 'সেভ করুন'}
               </button>
             </div>
           </div>
        </div>
      )}

      {/* Instruction Toast when Adding */}
      {isAddingZone && !tempZoneLoc && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg z-[600] text-sm font-medium animate-bounce">
          ম্যাপের যে কোনো জায়গায় ট্যাপ করুন
        </div>
      )}

    </div>
  );
};

export default MapView;