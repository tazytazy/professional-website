// Map Controller using Leaflet.js and Leaflet.heat

let map = null;
let heatLayer = null;
let markersLayer = null;
let tileLayer = null;

const SINGAPORE_CENTER = [1.3521, 103.8198];
const DEFAULT_ZOOM = 12;

/**
 * Initialize Leaflet Map
 */
function initMap() {
  map = L.map('map', {
    center: SINGAPORE_CENTER,
    zoom: DEFAULT_ZOOM,
    zoomControl: false,
    minZoom: 11,
    maxZoom: 18
  });

  // Free Dark Basemap (Esri World Dark Gray Canvas - No API Key Required)
  tileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
    maxZoom: 18
  }).addTo(map);

  // Add zoom control top-right
  L.control.zoom({ position: 'topright' }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
}

/**
 * Change Map Basemap Style (Dark, OpenStreetMap, Satellite)
 */
function setMapStyle(style) {
  if (!map || !tileLayer) return;
  map.removeLayer(tileLayer);

  if (style === 'osm') {
    tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18
    });
  } else if (style === 'satellite') {
    tileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri',
      maxZoom: 18
    });
  } else {
    // Dark
    tileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri',
      maxZoom: 18
    });
  }
  tileLayer.addTo(map);
}

/**
 * Render Heatmap Points
 * @param {Array} points Array of [lat, lng, weight, popupText]
 * @param {Object} options { radius, blur, metric }
 */
function updateHeatmap(points, options = {}) {
  if (heatLayer) {
    map.removeLayer(heatLayer);
  }

  const radius = options.radius || 25;
  const blur = options.blur || 15;
  const metric = options.metric || 'volume';

  // Custom color gradient: Volume vs Price
  let gradient = {
    0.2: '#2563eb', // Blue
    0.4: '#06b6d4', // Cyan
    0.6: '#22c55e', // Green
    0.8: '#eab308', // Yellow
    1.0: '#ef4444'  // Red (Hotspot)
  };

  if (metric === 'price') {
    gradient = {
      0.2: '#0284c7', // Sky Blue
      0.5: '#a855f7', // Purple
      0.8: '#f43f5e', // Rose
      1.0: '#e11d48'  // Deep Red
    };
  }

  // Format points for L.heatLayer: [lat, lng, intensity]
  const heatData = points.map(p => [p.lat, p.lng, p.intensity]);

  heatLayer = L.heatLayer(heatData, {
    radius: radius,
    blur: blur,
    maxZoom: 17,
    max: 1.0,
    minOpacity: 0.35,
    gradient: gradient
  }).addTo(map);
}

/**
 * Render Circle Markers for Top Blocks/Towns
 * @param {Array} items
 */
function updateMarkers(items) {
  markersLayer.clearLayers();

  items.forEach(item => {
    if (!item.lat || !item.lng) return;

    const marker = L.circleMarker([item.lat, item.lng], {
      radius: Math.min(14, Math.max(5, Math.sqrt(item.count) * 1.5)),
      fillColor: '#f59e0b',
      color: '#ffffff',
      weight: 1.5,
      opacity: 0.9,
      fillOpacity: 0.7
    });

    const popupHtml = `
      <div class="p-2 space-y-1">
        <div class="text-xs font-bold text-amber-400 uppercase tracking-wide">${item.block ? `Block ${item.block} ${item.street}` : item.name || item.street}</div>
        <div class="text-[11px] text-slate-300">Town: <span class="text-white font-semibold">${item.town || item.name}</span></div>
        <div class="text-[11px] text-slate-300">Rental Volume: <span class="text-amber-400 font-bold">${item.count} approvals</span></div>
        <div class="text-[11px] text-slate-300">Avg Monthly Rent: <span class="text-emerald-400 font-bold">$${item.avg_rent}</span></div>
      </div>
    `;

    marker.bindPopup(popupHtml);
    markersLayer.addLayer(marker);
  });
}

/**
 * Pan & Zoom Map to specific lat/lng
 */
function flyToLocation(lat, lng, zoom = 15) {
  if (map && lat && lng) {
    map.flyTo([lat, lng], zoom, { duration: 1.2 });
  }
}
