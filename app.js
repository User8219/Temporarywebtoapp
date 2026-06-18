// Supabase Pipeline Credentials Config
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ACTUAL_ANON_KEY';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const MY_USER_ID = 'YOUR_SUPABASE_USER_UUID';

// Global Data Matrix Memory Core
let localEntries = [];
let localPlans = [];
let map = null, markerGroup = null, modalMap = null, modalMarker = null;

// Primary App Initializer on System Boot
document.addEventListener('DOMContentLoaded', () => {
  loadLocalData();
  if (typeof renderEntries === 'function') renderEntries(localEntries);
});

function loadLocalData() {
  localEntries = JSON.parse(localStorage.getItem('adventure_entries') || '[]');
  localPlans = JSON.parse(localStorage.getItem('adventure_plans') || '[]');
  updateSyncBadge();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0); // Normalize to midnight to avoid premature midday wipes

  const initialPlanCount = localPlans.length;
  // Keep plans only if their date is today or in the future
  localPlans = localPlans.filter(plan => {
    if (!plan.visit_date) return true; // Keep old plans without explicit dates
    const planDate = new Date(plan.visit_date);
    return planDate >= startOfToday;
  });

  // If expired plans were removed, save the trimmed list back to device memory immediately
  if (localPlans.length !== initialPlanCount) {
    localStorage.setItem('adventure_plans', JSON.stringify(localPlans));
  }

  updateSyncBadge();
}

function saveToLocalStorage() {
  localStorage.setItem('adventure_entries', JSON.stringify(localEntries));
  localStorage.setItem('adventure_plans', JSON.stringify(localPlans));
  updateSyncBadge();
}

function updateSyncBadge() {
  const count = localEntries.filter(e => !e.synced).length;
  const badge = document.getElementById('sync-count');
  if (badge) badge.innerText = count;
}

function switchTab(tabName) {
  ['list', 'map', 'planner', 'add', 'settings', 'calendar'].forEach(tab => {
    const el = document.getElementById(`view-${tab}`);
    const nav = document.getElementById(`nav-${tab}`);
    if(el) el.classList.add('hidden');
    if(nav) nav.className = "flex flex-col items-center justify-center w-full h-full text-gray-400 text-xs gap-1";
  });

  const activeView = document.getElementById(`view-${tabName}`);
  const activeNav = document.getElementById(`nav-${tabName}`);
  
  if(activeView) activeView.classList.remove('hidden');
  if(activeNav) activeNav.className = "flex flex-col items-center justify-center w-full h-full text-blue-500 font-semibold text-xs gap-1";

  if (tabName === 'list' && typeof renderEntries === 'function') renderEntries(localEntries);
  if (tabName === 'planner' && typeof renderPlans === 'function') renderPlans();
  if (tabName === 'calendar' && typeof renderCalendar === 'function') {
    renderCalendar();
  }
  if (tabName === 'map') {
    initMap();
    if (map && markerGroup) {
      markerGroup.clearLayers();
      localEntries.concat(localPlans).forEach(item => {
        if (item.latitude && item.longitude) {
          const m = L.marker([item.latitude, item.longitude]);
          m.on('click', () => openDeepView(item.id, !!item.isPlan));
          markerGroup.addLayer(m);
        }
      });
    }
    setTimeout(() => { if(map) map.invalidateSize(); }, 200);
  }
}

function initMap() {
  if (map) return;
  map = L.map('map').setView([16.4023, 120.5963], 10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  markerGroup = L.layerGroup().addTo(map);
}

function closeDeepView() {
  document.getElementById('deep-view-modal').classList.add('hidden');
}
