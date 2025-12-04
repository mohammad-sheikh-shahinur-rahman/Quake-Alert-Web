import React, { useState, useMemo } from 'react';
import { EarthquakeFeature, TimePeriod, LocationState } from '../types';
import { formatTime, getRegionName } from '../services/earthquakeService';
import { calculateDistance } from '../utils/geoUtils';
import { AlertTriangle, Clock, MapPin, Activity, Filter, RefreshCcw, CalendarClock, Globe, X, Waves, ExternalLink, Navigation, Info, Share2, Check, Layers, ArrowUpDown, TrendingUp, Search, MessageSquarePlus, Users } from 'lucide-react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';

// Fix for default Leaflet marker icons
const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

interface EarthquakeListProps {
  earthquakes: EarthquakeFeature[];
  loading: boolean;
  period: TimePeriod;
  onPeriodChange: (period: TimePeriod) => void;
  userLocation: LocationState | null;
}

type SortOption = 'newest' | 'oldest' | 'mag_desc' | 'mag_asc';

const EarthquakeList: React.FC<EarthquakeListProps> = ({ earthquakes, loading, period, onPeriodChange, userLocation }) => {
  const [showFilters, setShowFilters] = useState(false);
  const [minMag, setMinMag] = useState<number>(0);
  const [timeRange, setTimeRange] = useState<'all' | '24h' | '12h' | '6h'>('all');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedQuake, setSelectedQuake] = useState<EarthquakeFeature | null>(null);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Sorting State
  const [sortOrder, setSortOrder] = useState<SortOption>('newest');

  // Derive available types from data
  const availableTypes = useMemo(() => {
    const types = new Set(earthquakes.map(q => q.properties.type));
    return Array.from(types).sort();
  }, [earthquakes]);

  // Statistics
  const stats = useMemo(() => {
    if (earthquakes.length === 0) return null;
    const maxMag = Math.max(...earthquakes.map(q => q.properties.mag));
    const count = earthquakes.length;
    // Find biggest quake
    const biggest = earthquakes.find(q => q.properties.mag === maxMag);
    
    // Find nearest quake if location available
    let nearest = null;
    let minDist = Infinity;
    if (userLocation) {
       earthquakes.forEach(q => {
          const d = calculateDistance(userLocation.lat, userLocation.lng, q.geometry.coordinates[1], q.geometry.coordinates[0]);
          if (d < minDist) {
             minDist = d;
             nearest = q;
          }
       });
    }

    return { maxMag, count, biggest, nearest, minDist };
  }, [earthquakes, userLocation]);

  const getTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      'earthquake': 'ভূমিকম্প',
      'quarry blast': 'পাথর ভাঙা',
      'explosion': 'বিস্ফোরণ',
      'nuclear explosion': 'পারমাণবিক বিস্ফোরণ',
      'rock burst': 'শিলা ধস',
      'ice quake': 'বরফ ধস',
      'other event': 'অন্যান্য'
    };
    return map[type] || type;
  };

  const toggleType = (type: string) => {
    setSelectedTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  // Helper for highlighting search text
  const getHighlightedText = (text: string, highlight: string) => {
    if (!highlight.trim()) return text;
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return (
      <>
        {parts.map((part, i) => 
          part.toLowerCase() === highlight.toLowerCase() ? 
            <span key={i} className="bg-yellow-200 text-slate-900 rounded-[2px] px-0.5 shadow-sm">{part}</span> : 
            part
        )}
      </>
    );
  };

  // Filter & Sort Logic
  const processedQuakes = useMemo(() => {
    let result = earthquakes.filter(quake => {
      // Search Filter
      if (searchQuery) {
        if (!quake.properties.place.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      }

      // Magnitude Filter
      if (quake.properties.mag < minMag) return false;

      // Type Filter
      if (selectedTypes.length > 0 && !selectedTypes.includes(quake.properties.type)) return false;

      // Time Filter (relative to current time)
      const now = Date.now();
      const diff = now - quake.properties.time;
      const hours = diff / (1000 * 60 * 60);

      if (timeRange === '6h' && hours > 6) return false;
      if (timeRange === '12h' && hours > 12) return false;
      if (timeRange === '24h' && hours > 24) return false;

      return true;
    });

    // Sorting
    return result.sort((a, b) => {
      switch (sortOrder) {
        case 'newest': return b.properties.time - a.properties.time;
        case 'oldest': return a.properties.time - b.properties.time;
        case 'mag_desc': return b.properties.mag - a.properties.mag;
        case 'mag_asc': return a.properties.mag - b.properties.mag;
        default: return b.properties.time - a.properties.time;
      }
    });
  }, [earthquakes, minMag, selectedTypes, timeRange, sortOrder, searchQuery]);

  const resetFilters = () => {
    setMinMag(0);
    setTimeRange('all');
    setSelectedTypes([]);
    setSortOrder('newest');
    setSearchQuery('');
  };

  const handlePeriodChange = (newPeriod: TimePeriod) => {
    onPeriodChange(newPeriod);
    setTimeRange('all'); 
    setSelectedTypes([]); 
  };

  const handleShare = async () => {
    if (!selectedQuake) return;

    const region = getRegionName(selectedQuake.properties.place);
    const shareData = {
      title: `ভূমিকম্প অ্যালার্ট: ${selectedQuake.properties.mag} মাত্রা`,
      text: `🚨 ভূমিকম্প অ্যালার্ট!
      
📍 স্থান: ${selectedQuake.properties.place}
🌍 অঞ্চল: ${region}
📉 মাত্রা: ${selectedQuake.properties.mag}
🕒 সময়: ${formatTime(selectedQuake.properties.time)}
🌊 গভীরতা: ${selectedQuake.geometry.coordinates[2]} কিমি`,
      url: selectedQuake.properties.url
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.error("Share failed:", err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${shareData.text}\n\nবিস্তারিত: ${shareData.url}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Clipboard failed:", err);
      }
    }
  };

  const activeFilters = minMag > 0 || timeRange !== 'all' || selectedTypes.length > 0 || sortOrder !== 'newest' || searchQuery !== '';

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full pt-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-600"></div>
        <p className="mt-4 text-slate-500">তথ্য লোড হচ্ছে...</p>
      </div>
    );
  }

  return (
    <div className="pb-28 pt-4 px-4 max-w-2xl mx-auto">
      {/* Quick Stats Dashboard */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 mb-6 animate-in slide-in-from-top-2">
           <div className="bg-slate-800 rounded-xl p-4 text-white shadow-lg flex flex-col justify-between">
              <div className="flex justify-between items-start">
                 <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">মোট ঘটনা</div>
                 {stats.nearest && (
                   <div className="text-[10px] bg-slate-700 px-2 py-0.5 rounded-full text-green-400 flex items-center">
                     <MapPin size={10} className="mr-1"/>
                     {Math.round(stats.minDist)} km কাছে
                   </div>
                 )}
              </div>
              <div className="text-3xl font-bold flex items-baseline">
                {stats.count}
                <span className="text-sm font-normal text-slate-400 ml-1">টি</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-2">
                 {period === 'day' ? 'গত ২৪ ঘণ্টায়' : period === 'week' ? 'গত ৭ দিনে' : 'গত ৩০ দিনে'}
              </div>
           </div>
           
           <div className="bg-gradient-to-br from-rose-500 to-rose-600 rounded-xl p-4 text-white shadow-lg flex flex-col justify-between relative overflow-hidden">
              <div className="relative z-10">
                <div className="text-rose-100 text-xs font-semibold uppercase tracking-wider mb-1">সর্বোচ্চ মাত্রা</div>
                <div className="text-3xl font-bold">{stats.maxMag.toFixed(1)}</div>
                <div className="text-[10px] text-rose-100 mt-2 truncate w-full">
                   {stats.biggest?.properties.place ? getRegionName(stats.biggest.properties.place) : '-'}
                </div>
              </div>
              <TrendingUp className="absolute right-2 bottom-2 text-rose-400/30 w-16 h-16 -rotate-12" />
           </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative mb-4">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search size={18} className="text-slate-400" />
        </div>
        <input
          type="text"
          placeholder={period === 'day' ? "শহর বা দেশ খুঁজুন (Search)" : "ইতিহাস খুঁজুন (স্থান বা দেশ)..."}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 sm:text-sm shadow-sm transition-all"
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-slate-800 flex items-center">
          <Activity className="mr-2 text-rose-600" /> 
          {period === 'day' ? 'সাম্প্রতিক তালিকা' : period === 'week' ? 'সাপ্তাহিক তালিকা' : 'মাসিক তালিকা'}
        </h2>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
            showFilters || activeFilters
              ? 'bg-rose-100 text-rose-700 ring-2 ring-rose-200'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Filter size={16} className="mr-1.5" />
          ফিল্টার
          {activeFilters && (
            <span className="ml-1.5 w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
          )}
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 animate-in slide-in-from-top-2">
          <div className="space-y-5">
            
            {/* Sort Order */}
            <div>
               <div className="flex items-center mb-2 text-slate-700">
                <ArrowUpDown size={16} className="mr-2 text-indigo-600"/>
                <label className="text-sm font-medium">সাজানো (Sort By)</label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                 <button 
                   onClick={() => setSortOrder('newest')}
                   className={`px-3 py-2 rounded-lg text-xs font-medium border text-center ${sortOrder === 'newest' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600'}`}
                 >
                   সময় (নতুন)
                 </button>
                 <button 
                   onClick={() => setSortOrder('oldest')}
                   className={`px-3 py-2 rounded-lg text-xs font-medium border text-center ${sortOrder === 'oldest' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600'}`}
                 >
                   সময় (পুরানো)
                 </button>
                 <button 
                   onClick={() => setSortOrder('mag_desc')}
                   className={`px-3 py-2 rounded-lg text-xs font-medium border text-center ${sortOrder === 'mag_desc' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600'}`}
                 >
                   মাত্রা (বেশি)
                 </button>
                 <button 
                   onClick={() => setSortOrder('mag_asc')}
                   className={`px-3 py-2 rounded-lg text-xs font-medium border text-center ${sortOrder === 'mag_asc' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600'}`}
                 >
                   মাত্রা (কম)
                 </button>
              </div>
            </div>

            <div className="h-px bg-slate-100 w-full"></div>

            {/* Data Source Period Selector */}
            <div>
              <div className="flex items-center mb-2 text-slate-700">
                <CalendarClock size={16} className="mr-2 text-blue-600"/>
                <label className="text-sm font-medium">তথ্য ভাণ্ডার (Data Source)</label>
              </div>
              <div className="flex bg-slate-100 p-1 rounded-lg">
                {(['day', 'week', 'month'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => handlePeriodChange(p)}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                      period === p
                        ? 'bg-white text-blue-700 shadow-sm ring-1 ring-black/5'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {p === 'day' && '২৪ ঘণ্টা'}
                    {p === 'week' && '৭ দিন'}
                    {p === 'month' && '৩০ দিন'}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-px bg-slate-100 w-full"></div>

            {/* Event Type Filter */}
            {availableTypes.length > 0 && (
              <div>
                <div className="flex items-center mb-2 text-slate-700">
                  <Layers size={16} className="mr-2 text-slate-500"/>
                  <label className="text-sm font-medium">ইভেন্টের ধরন (Type)</label>
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableTypes.map(type => (
                    <button
                      key={type}
                      onClick={() => toggleType(type)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        selectedTypes.includes(type)
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {getTypeLabel(type)}
                    </button>
                  ))}
                  {selectedTypes.length > 0 && (
                    <button 
                      onClick={() => setSelectedTypes([])}
                      className="px-3 py-1 rounded-full text-xs font-medium border border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-200 bg-white"
                    >
                      সব মুছুন
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="h-px bg-slate-100 w-full"></div>

            {/* Magnitude Slider */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-slate-700">ন্যূনতম মাত্রা (Magnitude)</label>
                <span className="text-sm font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                  {minMag === 0 ? 'সব' : `${minMag}+`}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="7"
                step="0.5"
                value={minMag}
                onChange={(e) => setMinMag(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>0</span>
                <span>3.5</span>
                <span>7+</span>
              </div>
            </div>

            {/* Time Range Filter Buttons */}
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">ফিল্টার (সময়কাল)</label>
              <div className="grid grid-cols-4 gap-2">
                {(['6h', '12h', '24h', 'all'] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      timeRange === range
                        ? 'bg-slate-800 text-white shadow-md'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {range === '6h' && '৬ ঘণ্টা'}
                    {range === '12h' && '১২ ঘণ্টা'}
                    {range === '24h' && '২৪ ঘণ্টা'}
                    {range === 'all' && 'সব'}
                  </button>
                ))}
              </div>
            </div>

            {/* Reset Button */}
            {activeFilters && (
              <div className="pt-2 border-t border-slate-100 flex justify-end">
                <button 
                  onClick={resetFilters}
                  className="text-xs text-rose-600 font-medium flex items-center hover:underline"
                >
                  <RefreshCcw size={12} className="mr-1" /> রিসেট করুন
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Results Count */}
      <div className="mb-4 text-sm text-slate-500 flex justify-between items-center">
        <span>দেখানো হচ্ছে: <span className="font-semibold text-slate-800">{processedQuakes.length}</span> টি ফলাফল</span>
      </div>

      <div className="space-y-3">
        {processedQuakes.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
            <p className="text-slate-500 mb-1">কোনো ভূমিকম্প পাওয়া যায়নি</p>
            <p className="text-xs text-slate-400">ফিল্টার পরিবর্তন করে আবার চেষ্টা করুন</p>
          </div>
        ) : (
          processedQuakes.map((quake) => {
            const magnitude = quake.properties.mag.toFixed(1);
            const isHighAlert = quake.properties.mag >= 5.0;
            const region = getRegionName(quake.properties.place);
            const typeLabel = getTypeLabel(quake.properties.type);
            const feltCount = quake.properties.felt;

            return (
              <div 
                key={quake.id} 
                onClick={() => {
                  setCopied(false);
                  setSelectedQuake(quake);
                }}
                className={`bg-white rounded-xl p-4 shadow-sm border-l-4 ${
                  isHighAlert ? 'border-rose-500' : 'border-amber-400'
                } flex items-start space-x-4 cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]`}
              >
                <div className={`flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md ${
                  isHighAlert ? 'bg-rose-600' : 'bg-amber-500'
                }`}>
                  {magnitude}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-wide">
                      <Globe size={10} className="mr-1" />
                      {region}
                    </span>
                    {quake.properties.type !== 'earthquake' && (
                       <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-100 uppercase tracking-wide">
                         {typeLabel}
                       </span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 truncate" title={quake.properties.place}>
                    {getHighlightedText(quake.properties.place, searchQuery)}
                  </h3>
                  <div className="flex items-center text-xs text-slate-500 mt-1">
                    <Clock size={12} className="mr-1" />
                    {formatTime(quake.properties.time)}
                  </div>
                  <div className="flex items-center text-xs text-slate-500 mt-1">
                    <MapPin size={12} className="mr-1" />
                    গভীরতা: {quake.geometry.coordinates[2]} কিমি
                  </div>
                  {feltCount !== null && feltCount > 0 && (
                    <div className="mt-2">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                        <Users size={12} className="mr-1.5" />
                        {feltCount} জন অনুভব করেছেন
                      </span>
                    </div>
                  )}
                </div>

                {isHighAlert && (
                  <div className="flex-shrink-0">
                    <AlertTriangle className="text-rose-500 animate-pulse" size={20} />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Detail Modal */}
      {selectedQuake && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className={`p-6 text-white relative overflow-hidden ${selectedQuake.properties.mag >= 5 ? 'bg-rose-600' : 'bg-amber-500'}`}>
              <button 
                onClick={() => setSelectedQuake(null)}
                className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors text-white z-10"
              >
                <X size={20} />
              </button>
              
              <div className="flex flex-col items-center justify-center pt-2 relative z-0">
                <div className="text-5xl font-black mb-2 tracking-tighter">
                  {selectedQuake.properties.mag.toFixed(1)}
                </div>
                <div className="text-sm font-medium bg-black/10 px-3 py-1 rounded-full uppercase tracking-wider mb-4">
                  Magnitude
                </div>
                <div className="text-center font-bold text-lg leading-tight">
                  {getRegionName(selectedQuake.properties.place)}
                </div>
                <div className="text-center text-sm text-white/80 mt-1 px-4">
                  {selectedQuake.properties.place}
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              
              {/* Map Preview */}
              <div className="w-full h-48 rounded-xl overflow-hidden border border-slate-200 shadow-inner bg-slate-50 relative z-0">
                 <MapContainer 
                    center={[selectedQuake.geometry.coordinates[1], selectedQuake.geometry.coordinates[0]]} 
                    zoom={7} 
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={false}
                    attributionControl={false}
                 >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker 
                      position={[selectedQuake.geometry.coordinates[1], selectedQuake.geometry.coordinates[0]]}
                      icon={markerIcon}
                    />
                    {userLocation && (
                      <Marker 
                        position={[userLocation.lat, userLocation.lng]}
                        icon={L.divIcon({className: 'bg-blue-500 w-3 h-3 rounded-full border-2 border-white shadow-md'})}
                      />
                    )}
                 </MapContainer>
              </div>

              {/* Distance from User (New Feature) */}
              {userLocation && (
                <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl flex items-center justify-between">
                   <div className="flex items-center text-blue-800 font-semibold text-sm">
                      <Navigation size={16} className="mr-2"/> আপনার থেকে দূরত্ব
                   </div>
                   <div className="text-lg font-bold text-blue-600">
                     {Math.round(calculateDistance(
                       userLocation.lat, 
                       userLocation.lng, 
                       selectedQuake.geometry.coordinates[1], 
                       selectedQuake.geometry.coordinates[0]
                     ))} কিমি
                   </div>
                </div>
              )}

              {/* Felt Reports Highlight */}
              {(selectedQuake.properties.felt || 0) > 0 && (
                <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl flex items-center justify-between">
                   <div className="flex items-center text-indigo-800 font-semibold text-sm">
                      <Users size={16} className="mr-2"/> রিপোর্ট সংখ্যা (Felt)
                   </div>
                   <div className="text-lg font-bold text-indigo-600">
                     {selectedQuake.properties.felt} জন
                   </div>
                </div>
              )}

              {/* Key Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="text-slate-400 text-xs mb-1 flex items-center"><Waves size={12} className="mr-1"/> গভীরতা (Depth)</div>
                  <div className="text-slate-800 font-bold">{selectedQuake.geometry.coordinates[2]} km</div>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="text-slate-400 text-xs mb-1 flex items-center"><Clock size={12} className="mr-1"/> সময় (Time)</div>
                  <div className="text-slate-800 font-bold text-sm">{formatTime(selectedQuake.properties.time)}</div>
                </div>
              </div>

              {/* Coordinates */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center">
                  <Navigation size={12} className="mr-1"/> কোঅর্ডিনেট (Coordinates)
                </h4>
                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg text-sm text-slate-600 font-mono border border-slate-100">
                   <span>Lat: {selectedQuake.geometry.coordinates[1].toFixed(4)}</span>
                   <span className="w-px h-4 bg-slate-300 mx-2"></span>
                   <span>Lng: {selectedQuake.geometry.coordinates[0].toFixed(4)}</span>
                </div>
              </div>

              {/* Tsunami Status */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center">
                  <Info size={12} className="mr-1"/> বিস্তারিত (Details)
                </h4>
                <div className="space-y-2">
                   <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="text-sm text-slate-600">ইভেন্টের ধরন</span>
                      <span className="text-sm font-bold text-slate-800 capitalize">
                         {getTypeLabel(selectedQuake.properties.type)}
                      </span>
                   </div>
                   <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="text-sm text-slate-600">সুনামি সতর্কতা</span>
                      <span className={`text-sm font-bold px-2 py-0.5 rounded ${selectedQuake.properties.tsunami === 1 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                        {selectedQuake.properties.tsunami === 1 ? 'সম্ভাবনা আছে' : 'নেই'}
                      </span>
                   </div>
                   <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="text-sm text-slate-600">স্ট্যাটাস</span>
                      <span className="text-sm font-medium text-slate-500 capitalize">
                        {selectedQuake.properties.status}
                      </span>
                   </div>
                </div>
              </div>

               {/* Did You Feel It Button */}
               <a 
                 href={`${selectedQuake.properties.url}#dyfi`}
                 target="_blank"
                 rel="noopener noreferrer"
                 className="block w-full text-center py-2 bg-teal-50 text-teal-700 font-semibold rounded-lg border border-teal-100 mb-2 hover:bg-teal-100 transition-colors flex items-center justify-center"
               >
                 <MessageSquarePlus size={18} className="mr-2"/>
                 আপনি কি কম্পন অনুভব করেছেন?
               </a>

              {/* Footer Actions */}
              <div className="pt-2 flex gap-3">
                <button 
                  onClick={handleShare}
                  className="flex-1 flex items-center justify-center py-3 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-xl font-medium hover:bg-indigo-100 transition-colors active:scale-95"
                >
                  {copied ? <Check size={18} className="mr-2" /> : <Share2 size={18} className="mr-2" />}
                  {copied ? 'কপি হয়েছে' : 'শেয়ার'}
                </button>

                <a 
                  href={selectedQuake.properties.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex-[2] flex items-center justify-center py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors"
                >
                  <ExternalLink size={18} className="mr-2" />
                  USGS ওয়েব
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EarthquakeList;