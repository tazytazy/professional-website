// Main Application Controller with Multi-Year Horizon Support

let globalData = null;
let currentFilters = {
  horizon: '1', // '1', '2', '3', '4', or '5' years
  town: 'ALL',
  flatType: 'ALL',
  maxRent: 6000,
  metric: 'volume', // 'volume' or 'price'
  radius: 25,
  blur: 15,
  leaderboardTab: 'towns'
};

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide Icons
  if (window.lucide) lucide.createIcons();

  // Initialize Map
  initMap();

  // Load Data from API
  fetchRentalData();

  // Set up Event Listeners
  setupEventListeners();
});

/**
 * Get active data structure based on selected time horizon slider
 */
function getActiveData() {
  if (!globalData) return null;
  if (globalData.horizons && globalData.horizons[currentFilters.horizon]) {
    return globalData.horizons[currentFilters.horizon];
  }
  return globalData; // Fallback if old format
}

/**
 * Fetch HDB Rental Data from API endpoint
 */
async function fetchRentalData() {
  try {
    const resp = await fetch('data/hdb_rentals.json');
    if (!resp.ok) throw new Error('API request failed');
    globalData = await resp.json();

    const active = getActiveData();

    // Populate Town Dropdown Options
    populateTownDropdown(active.towns || []);

    // Update Header KPIs
    updateHeaderKPIs(active.summary);

    // Initial UI Render
    applyFilters();

    // Render Analytics Dashboard Charts
    renderCharts(active);

  } catch (err) {
    console.error('Error loading rental data:', err);
    alert('Failed to load HDB rental dataset. Please ensure server and fetch_data.py have run.');
  }
}

/**
 * Populate Town Select Options
 */
function populateTownDropdown(towns) {
  const select = document.getElementById('select-town');
  const prevVal = currentFilters.town;
  select.innerHTML = '<option value="ALL">All Singapore Towns (27 Towns)</option>';
  
  const sorted = [...towns].sort((a, b) => a.name.localeCompare(b.name));
  sorted.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.name;
    opt.textContent = `${t.name} (${t.count.toLocaleString()} rentals)`;
    select.appendChild(opt);
  });

  select.value = prevVal;
}

/**
 * Update Header KPI Badges
 */
function updateHeaderKPIs(summary) {
  if (!summary) return;
  document.getElementById('stat-total-volume').textContent = `${summary.total_volume.toLocaleString()} Approvals`;
  document.getElementById('stat-top-town').textContent = summary.top_town;
  document.getElementById('stat-avg-rent').textContent = `$${summary.overall_avg_rent.toLocaleString()} / mo`;
  
  const labelYears = summary.years ? `Past ${summary.years} Year${summary.years > 1 ? 's' : ''}` : 'Past 12 Months';
  document.getElementById('hdr-date-range').textContent = `${labelYears} (${summary.start_date} to ${summary.end_date})`;
}

/**
 * Apply Active Filters to Dataset & Re-render Map & Leaderboard
 */
function applyFilters() {
  const active = getActiveData();
  if (!active) return;

  const raw = active.raw_records || [];
  
  // 1. Filter Raw Records
  const filtered = raw.filter(r => {
    const rent = float(r.monthly_rent || 0);
    if (currentFilters.town !== 'ALL' && r.town !== currentFilters.town) return false;
    if (currentFilters.flatType !== 'ALL' && r.flat_type !== currentFilters.flatType) return false;
    if (rent > currentFilters.maxRent) return false;
    return true;
  });

  // 2. Generate Heatmap Points
  const locationMap = new Map();
  let maxCount = 1;
  let maxRentVal = 1;

  filtered.forEach(r => {
    const key = `${r.block} ${r.street_name}`;
    if (!locationMap.has(key)) {
      const blkInfo = (active.blocks || []).find(b => b.block === r.block && b.street === r.street_name);
      const lat = blkInfo ? blkInfo.lat : 1.3521;
      const lng = blkInfo ? blkInfo.lng : 103.8198;

      locationMap.set(key, {
        block: r.block,
        street: r.street_name,
        town: r.town,
        lat: lat,
        lng: lng,
        count: 0,
        rentSum: 0
      });
    }

    const loc = locationMap.get(key);
    loc.count += 1;
    loc.rentSum += float(r.monthly_rent || 0);
    if (loc.count > maxCount) maxCount = loc.count;
    const avg = loc.rentSum / loc.count;
    if (avg > maxRentVal) maxRentVal = avg;
  });

  const heatPoints = [];
  const topBlockItems = [];

  locationMap.forEach(loc => {
    const avgRent = loc.rentSum / loc.count;
    let intensity = 0;

    if (currentFilters.metric === 'volume') {
      intensity = Math.min(1.0, Math.max(0.15, loc.count / Math.max(5, maxCount * 0.7)));
    } else {
      intensity = Math.min(1.0, Math.max(0.15, (avgRent - 1500) / 3500));
    }

    heatPoints.push({
      lat: loc.lat,
      lng: loc.lng,
      intensity: intensity,
      count: loc.count,
      avg_rent: Math.round(avgRent)
    });

    topBlockItems.push({
      block: loc.block,
      street: loc.street,
      town: loc.town,
      lat: loc.lat,
      lng: loc.lng,
      count: loc.count,
      avg_rent: Math.round(avgRent)
    });
  });

  topBlockItems.sort((a, b) => b.count - a.count);

  // Update Leaflet Heatmap Layer
  updateHeatmap(heatPoints, {
    radius: currentFilters.radius,
    blur: currentFilters.blur,
    metric: currentFilters.metric
  });

  // Update Circle Markers for top 50 hotspot blocks in active view
  updateMarkers(topBlockItems.slice(0, 50));

  // Render Leaderboard Items
  renderLeaderboard(filtered);

  // If specific town selected, pan map to town
  if (currentFilters.town !== 'ALL') {
    const townObj = (active.towns || []).find(t => t.name === currentFilters.town);
    if (townObj) flyToLocation(townObj.lat, townObj.lng, 14);
  }
}

/**
 * Render Hotspot Leaderboard Items
 */
function renderLeaderboard(filteredRecords) {
  const container = document.getElementById('leaderboard-items');
  container.innerHTML = '';
  const active = getActiveData();

  const tab = currentFilters.leaderboardTab;

  if (tab === 'towns') {
    const townMap = new Map();
    filteredRecords.forEach(r => {
      const t = r.town;
      if (!townMap.has(t)) townMap.set(t, { count: 0, rentSum: 0 });
      const item = townMap.get(t);
      item.count += 1;
      item.rentSum += float(r.monthly_rent || 0);
    });

    const sorted = Array.from(townMap.entries()).map(([town, data]) => {
      const info = (active.towns || []).find(x => x.name === town) || {};
      return {
        name: town,
        count: data.count,
        avg_rent: Math.round(data.rentSum / data.count),
        lat: info.lat,
        lng: info.lng
      };
    }).sort((a, b) => b.count - a.count).slice(0, 15);

    sorted.forEach((item, idx) => {
      const card = createLeaderboardCard(idx + 1, item.name, item.count, item.avg_rent, () => {
        if (item.lat && item.lng) flyToLocation(item.lat, item.lng, 14);
      });
      container.appendChild(card);
    });

  } else if (tab === 'streets') {
    const streetMap = new Map();
    filteredRecords.forEach(r => {
      const s = `${r.street_name} (${r.town})`;
      if (!streetMap.has(s)) streetMap.set(s, { street: r.street_name, town: r.town, count: 0, rentSum: 0 });
      const item = streetMap.get(s);
      item.count += 1;
      item.rentSum += float(r.monthly_rent || 0);
    });

    const sorted = Array.from(streetMap.values()).map(data => {
      const info = (active.streets || []).find(x => x.street === data.street) || {};
      return {
        name: `${data.street}`,
        sub: data.town,
        count: data.count,
        avg_rent: Math.round(data.rentSum / data.count),
        lat: info.lat,
        lng: info.lng
      };
    }).sort((a, b) => b.count - a.count).slice(0, 15);

    sorted.forEach((item, idx) => {
      const card = createLeaderboardCard(idx + 1, item.name, item.count, item.avg_rent, () => {
        if (item.lat && item.lng) flyToLocation(item.lat, item.lng, 16);
      }, item.sub);
      container.appendChild(card);
    });

  } else {
    // Blocks
    const blockMap = new Map();
    filteredRecords.forEach(r => {
      const b = `Blk ${r.block} ${r.street_name}`;
      if (!blockMap.has(b)) blockMap.set(b, { block: r.block, street: r.street_name, town: r.town, count: 0, rentSum: 0 });
      const item = blockMap.get(b);
      item.count += 1;
      item.rentSum += float(r.monthly_rent || 0);
    });

    const sorted = Array.from(blockMap.values()).map(data => {
      const info = (active.blocks || []).find(x => x.block === data.block && x.street === data.street) || {};
      return {
        name: `Blk ${data.block} ${data.street}`,
        sub: data.town,
        count: data.count,
        avg_rent: Math.round(data.rentSum / data.count),
        lat: info.lat,
        lng: info.lng
      };
    }).sort((a, b) => b.count - a.count).slice(0, 15);

    sorted.forEach((item, idx) => {
      const card = createLeaderboardCard(idx + 1, item.name, item.count, item.avg_rent, () => {
        if (item.lat && item.lng) flyToLocation(item.lat, item.lng, 17);
      }, item.sub);
      container.appendChild(card);
    });
  }
}

/**
 * Helper to build Leaderboard Card Element
 */
function createLeaderboardCard(rank, title, count, avgRent, onClick, subtitle = '') {
  const card = document.createElement('div');
  card.className = 'bg-slate-900/80 hover:bg-slate-750 p-2.5 rounded-xl border border-slate-700/80 flex items-center justify-between cursor-pointer transition shadow-sm group';
  
  let rankBadgeBg = 'bg-slate-800 text-slate-300';
  if (rank === 1) rankBadgeBg = 'bg-amber-500 text-slate-950 font-bold';
  else if (rank === 2) rankBadgeBg = 'bg-slate-300 text-slate-950 font-bold';
  else if (rank === 3) rankBadgeBg = 'bg-amber-700 text-white font-bold';

  card.innerHTML = `
    <div class="flex items-center space-x-2.5 overflow-hidden">
      <span class="w-6 h-6 rounded-lg text-xs flex items-center justify-center shrink-0 ${rankBadgeBg}">${rank}</span>
      <div class="truncate">
        <div class="text-xs font-semibold text-slate-200 group-hover:text-amber-400 truncate">${title}</div>
        ${subtitle ? `<div class="text-[10px] text-slate-400 truncate">${subtitle}</div>` : ''}
      </div>
    </div>
    <div class="text-right shrink-0">
      <div class="text-xs font-bold text-amber-400">${count.toLocaleString()} rentals</div>
      <div class="text-[10px] text-emerald-400">$${avgRent.toLocaleString()}/mo</div>
    </div>
  `;

  card.addEventListener('click', onClick);
  return card;
}

/**
 * Attach UI Event Listeners
 */
function setupEventListeners() {
  // Time Horizon Slider (Past 1 to 5 Years)
  const sliderHorizon = document.getElementById('slider-year-horizon');
  if (sliderHorizon) {
    sliderHorizon.addEventListener('input', (e) => {
      const yrs = e.target.value;
      currentFilters.horizon = yrs;
      document.getElementById('val-year-horizon').textContent = yrs === '5' ? 'Past 5+ Years (Full)' : `Past ${yrs} Year${yrs > 1 ? 's' : ''}`;
      
      const active = getActiveData();
      if (active) {
        populateTownDropdown(active.towns || []);
        updateHeaderKPIs(active.summary);
        applyFilters();
        renderCharts(active);
      }
    });
  }

  // Basemap Tile Style Switcher
  const btnDark = document.getElementById('tile-dark');
  const btnOsm = document.getElementById('tile-osm');
  const btnSat = document.getElementById('tile-satellite');

  const setTileBtnActive = (activeBtn) => {
    [btnDark, btnOsm, btnSat].forEach(b => {
      if (b) b.className = 'py-1.5 px-2 rounded-lg font-semibold bg-slate-800 text-slate-300 hover:bg-slate-750 border border-slate-700';
    });
    if (activeBtn) activeBtn.className = 'py-1.5 px-2 rounded-lg font-semibold bg-amber-500 text-slate-950 shadow border border-amber-400';
  };

  if (btnDark) btnDark.addEventListener('click', () => { setTileBtnActive(btnDark); setMapStyle('dark'); });
  if (btnOsm) btnOsm.addEventListener('click', () => { setTileBtnActive(btnOsm); setMapStyle('osm'); });
  if (btnSat) btnSat.addEventListener('click', () => { setTileBtnActive(btnSat); setMapStyle('satellite'); });

  // Minimize / Expand Legend Overlay Toggle
  const btnToggleLegend = document.getElementById('btn-toggle-legend');
  const legendBody = document.getElementById('legend-content-body');
  const legendToggleText = document.getElementById('legend-toggle-text');
  
  if (btnToggleLegend && legendBody) {
    btnToggleLegend.addEventListener('click', () => {
      const isHidden = legendBody.classList.toggle('hidden');
      if (legendToggleText) {
        legendToggleText.textContent = isHidden ? 'Expand' : 'Minimize';
      }
    });
  }

  // Mode Switchers
  const btnVolume = document.getElementById('mode-volume');
  const btnPrice = document.getElementById('mode-price');
  const legendBar = document.getElementById('legend-bar');

  btnVolume.addEventListener('click', () => {
    currentFilters.metric = 'volume';
    btnVolume.className = 'py-2 px-3 text-xs rounded-lg font-semibold bg-amber-500 text-slate-950 shadow border border-amber-400 flex items-center justify-center space-x-1';
    btnPrice.className = 'py-2 px-3 text-xs rounded-lg font-semibold bg-slate-800 text-slate-300 hover:bg-slate-750 border border-slate-700 flex items-center justify-center space-x-1';
    document.getElementById('legend-title').textContent = 'Rental Volume Density';
    document.getElementById('legend-min').textContent = 'Low Volume';
    document.getElementById('legend-max').textContent = 'High Hotspot';
    if (legendBar) legendBar.className = 'h-3 rounded-md w-full bg-gradient-to-r from-blue-600 via-cyan-400 via-yellow-400 to-red-600 border border-slate-600';
    applyFilters();
  });

  btnPrice.addEventListener('click', () => {
    currentFilters.metric = 'price';
    btnPrice.className = 'py-2 px-3 text-xs rounded-lg font-semibold bg-purple-600 text-white shadow border border-purple-400 flex items-center justify-center space-x-1';
    btnVolume.className = 'py-2 px-3 text-xs rounded-lg font-semibold bg-slate-800 text-slate-300 hover:bg-slate-750 border border-slate-700 flex items-center justify-center space-x-1';
    document.getElementById('legend-title').textContent = 'Average Monthly Rent ($)';
    document.getElementById('legend-min').textContent = '< $2,000 / mo';
    document.getElementById('legend-max').textContent = '> $4,000 / mo';
    if (legendBar) legendBar.className = 'h-3 rounded-md w-full bg-gradient-to-r from-sky-600 via-purple-500 via-rose-500 to-red-600 border border-slate-600';
    applyFilters();
  });

  // Radius & Blur Sliders
  const sliderRadius = document.getElementById('slider-radius');
  sliderRadius.addEventListener('input', (e) => {
    currentFilters.radius = parseInt(e.target.value);
    document.getElementById('val-radius').textContent = `${currentFilters.radius} px`;
    applyFilters();
  });

  const sliderBlur = document.getElementById('slider-blur');
  sliderBlur.addEventListener('input', (e) => {
    currentFilters.blur = parseInt(e.target.value);
    document.getElementById('val-blur').textContent = `${currentFilters.blur} px`;
    applyFilters();
  });

  // Town Dropdown Select
  const selectTown = document.getElementById('select-town');
  selectTown.addEventListener('change', (e) => {
    currentFilters.town = e.target.value;
    applyFilters();
  });

  document.getElementById('btn-reset-town').addEventListener('click', () => {
    selectTown.value = 'ALL';
    currentFilters.town = 'ALL';
    flyToLocation(1.3521, 103.8198, 12);
    applyFilters();
  });

  // Flat Type Filter Buttons
  const flatBtns = document.querySelectorAll('.flat-btn');
  flatBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      flatBtns.forEach(b => b.className = 'flat-btn py-1.5 text-xs rounded-lg bg-slate-900 text-slate-300 hover:bg-slate-750 border border-slate-700');
      btn.className = 'flat-btn py-1.5 text-xs rounded-lg bg-amber-500 text-slate-950 font-bold border border-amber-400';
      currentFilters.flatType = btn.dataset.type;
      applyFilters();
    });
  });

  // Price Range Filter Slider
  const sliderPrice = document.getElementById('slider-price');
  sliderPrice.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    currentFilters.maxRent = val;
    document.getElementById('val-price-filter').textContent = val >= 6000 ? 'Any Price' : `<= $${val.toLocaleString()}`;
    applyFilters();
  });

  // Reset All Filters
  document.getElementById('btn-reset-all').addEventListener('click', () => {
    currentFilters.horizon = '1';
    currentFilters.town = 'ALL';
    currentFilters.flatType = 'ALL';
    currentFilters.maxRent = 6000;
    currentFilters.radius = 25;
    currentFilters.blur = 15;
    
    if (sliderHorizon) sliderHorizon.value = '1';
    document.getElementById('val-year-horizon').textContent = 'Past 1 Year';
    selectTown.value = 'ALL';
    sliderPrice.value = 6000;
    document.getElementById('val-price-filter').textContent = 'Any Price';
    sliderRadius.value = 25;
    document.getElementById('val-radius').textContent = '25 px';
    sliderBlur.value = 15;
    document.getElementById('val-blur').textContent = '15 px';

    flatBtns.forEach(b => b.className = 'flat-btn py-1.5 text-xs rounded-lg bg-slate-900 text-slate-300 hover:bg-slate-750 border border-slate-700');
    flatBtns[0].className = 'flat-btn py-1.5 text-xs rounded-lg bg-amber-500 text-slate-950 font-bold border border-amber-400';

    const active = getActiveData();
    if (active) {
      populateTownDropdown(active.towns || []);
      updateHeaderKPIs(active.summary);
      flyToLocation(1.3521, 103.8198, 12);
      applyFilters();
      renderCharts(active);
    }
  });

  // Tabs (Filters vs Leaderboard)
  const tabFilters = document.getElementById('tab-btn-filters');
  const tabLb = document.getElementById('tab-btn-leaderboard');
  const contentFilters = document.getElementById('tab-content-filters');
  const contentLb = document.getElementById('tab-content-leaderboard');

  tabFilters.addEventListener('click', () => {
    tabFilters.className = 'flex-1 py-2.5 text-xs font-semibold text-amber-400 border-b-2 border-amber-400 flex items-center justify-center space-x-1.5';
    tabLb.className = 'flex-1 py-2.5 text-xs font-semibold text-slate-400 hover:text-slate-200 border-b-2 border-transparent flex items-center justify-center space-x-1.5';
    contentFilters.classList.remove('hidden');
    contentLb.classList.add('hidden');
  });

  tabLb.addEventListener('click', () => {
    tabLb.className = 'flex-1 py-2.5 text-xs font-semibold text-amber-400 border-b-2 border-amber-400 flex items-center justify-center space-x-1.5';
    tabFilters.className = 'flex-1 py-2.5 text-xs font-semibold text-slate-400 hover:text-slate-200 border-b-2 border-transparent flex items-center justify-center space-x-1.5';
    contentLb.classList.remove('hidden');
    contentFilters.classList.add('hidden');
  });

  // Leaderboard Sub-tabs (Towns / Streets / Blocks)
  const lbTowns = document.getElementById('lb-tab-towns');
  const lbStreets = document.getElementById('lb-tab-streets');
  const lbBlocks = document.getElementById('lb-tab-blocks');

  const setLbSubTab = (tab, activeBtn) => {
    currentFilters.leaderboardTab = tab;
    [lbTowns, lbStreets, lbBlocks].forEach(b => b.className = 'py-1 rounded text-slate-400 hover:text-white');
    activeBtn.className = 'py-1 rounded bg-amber-500 text-slate-950 font-bold';
    applyFilters();
  };

  lbTowns.addEventListener('click', () => setLbSubTab('towns', lbTowns));
  lbStreets.addEventListener('click', () => setLbSubTab('streets', lbStreets));
  lbBlocks.addEventListener('click', () => setLbSubTab('blocks', lbBlocks));

  // Analytics Modal Toggle
  const modal = document.getElementById('analytics-modal');
  document.getElementById('btn-toggle-analytics').addEventListener('click', () => {
    modal.classList.remove('hidden');
    setTimeout(() => {
      const active = getActiveData();
      if (active) renderCharts(active);
    }, 50);
  });
  document.getElementById('btn-close-analytics').addEventListener('click', () => {
    modal.classList.add('hidden');
  });
}

function float(val) {
  const parsed = parseFloat(val);
  return isNaN(parsed) ? 0 : parsed;
}
