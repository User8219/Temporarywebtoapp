// Supabase Pipeline Credentials Config
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ACTUAL_ANON_KEY';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const MY_USER_ID = 'YOUR_SUPABASE_USER_UUID';

// Global Data Matrix Memory Core
let localEntries = [];
let localPlans = [];
let map = null, markerGroup = null, modalMap = null, modalMarker = null;

// Global Active Tracking & Edit Matrix State Variables
let currentActiveItem = null;
let isEditMode = false;

// Primary App Initializer on System Boot
document.addEventListener('DOMContentLoaded', () => {
  loadLocalData();
  if (typeof renderEntries === 'function') renderEntries(localEntries);
  
  // Connect form submission event listener tracking
  const entryForm = document.getElementById('add-entry-form');
  if (entryForm) {
    entryForm.addEventListener('submit', handleFormSubmit);
  }
});

function loadLocalData() {
  localEntries = JSON.parse(localStorage.getItem('adventure_entries') || '[]');
  localPlans = JSON.parse(localStorage.getItem('adventure_plans') || '[]');
  updateSyncBadge();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const initialPlanCount = localPlans.length;
  localPlans = localPlans.filter(plan => {
    if (!plan.visit_date) return true;
    const planDate = new Date(plan.visit_date);
    return planDate >= startOfToday;
  });

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
    if (el) el.classList.add('hidden');
    if (nav) {
      nav.classList.remove('text-blue-500', 'font-semibold');
      nav.classList.add('text-gray-400');
    }
  });

  const activeView = document.getElementById(`view-${tabName}`);
  const activeNav = document.getElementById(`nav-${tabName}`);
  
  if (activeView) activeView.classList.remove('hidden');
  if (activeNav) {
    activeNav.classList.remove('text-gray-400');
    activeNav.classList.add('text-blue-500', 'font-semibold');
  }

  if (tabName === 'list' && typeof renderEntries === 'function') renderEntries(localEntries);
  if (tabName === 'planner' && typeof renderPlans === 'function') renderPlans();
  if (tabName === 'calendar' && typeof renderCalendar === 'function') renderCalendar();
  
  if (tabName === 'map') {
    initMap();
    if (map && markerGroup) {
      markerGroup.clearLayers();
      
      localEntries.concat(localPlans).forEach((item, index) => {
        try {
          const lat = parseFloat(item.latitude);
          const lng = parseFloat(item.longitude);

          if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return;

          const m = L.marker([lat, lng]);
          m.on('click', () => openDeepView(item.id, !!item.isPlan));
          markerGroup.addLayer(m);
        } catch (error) {
          console.error(`Marker failed to render at index ${index}:`, error);
        }
      });
    }
    
    setTimeout(() => { 
      if (map) {
        map.invalidateSize(); 
        if (markerGroup.getLayers().length > 0) {
          const bounds = L.featureGroup(markerGroup.getLayers()).getBounds();
          map.fitBounds(bounds, { padding: [40, 40] });
        }
      }
    }, 200);
  }
}

function initMap() {
  if (map) return;
  map = L.map('map').setView([16.4023, 120.5963], 10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  markerGroup = L.layerGroup().addTo(map);
}

// 🌐 MASTER OPEN DEEP VIEW TRIGGER ENGINE
function openDeepView(itemId, isPlan) {
  const collection = isPlan ? localPlans : localEntries;
  const item = collection.find(i => i.id === itemId || String(i.id) === String(itemId));
  if (!item) return;

  // Pin item context into global memory matrices
  currentActiveItem = { ...item, isPlan };

  // Run the modal painter inside journal.js if available
  if (typeof window.populateModalUI === 'function') {
    window.populateModalUI(currentActiveItem);
  } else {
    // Standard local fallback painter loop block
    document.getElementById('modal-title').innerText = item.title || 'Untitled Record';
    document.getElementById('modal-location').innerText = item.location_name || item.location || 'Unknown Coordinates';
    document.getElementById('modal-notes').innerText = item.notes || '';
    document.getElementById('modal-date').innerText = item.visit_date ? new Date(item.visit_date).toLocaleDateString() : '';
  }

  // Programmatically hook up action panel triggers securely
  const editModalBtn = document.getElementById('edit-modal-btn');
  if (editModalBtn) editModalBtn.onclick = triggerEditMode;

  document.getElementById('deep-view-modal').classList.remove('hidden');
}

function closeDeepView() {
  document.getElementById('deep-view-modal').classList.add('hidden');
  currentActiveItem = null;
}

// ==========================================
// 🔄 LOG EDIT / UPDATE SEQUENCE REGISTER
// ==========================================
function triggerEditMode() {
  if (!currentActiveItem) return;
  
  isEditMode = true;
  document.getElementById('deep-view-modal').classList.add('hidden'); // Dismiss modal sheet

  // Populate data fields explicitly targeted by index.html IDs
  document.getElementById('form-title').value = currentActiveItem.title || '';
  document.getElementById('form-location').value = currentActiveItem.location_name || currentActiveItem.location || '';
  document.getElementById('form-lat').value = currentActiveItem.latitude || '';
  document.getElementById('form-lng').value = currentActiveItem.longitude || '';
  document.getElementById('form-notes').value = currentActiveItem.notes || '';
  document.getElementById('form-date').value = currentActiveItem.visit_date ? currentActiveItem.visit_date.split('T')[0] : '';
  document.getElementById('form-tags').value = currentActiveItem.tags ? currentActiveItem.tags.join(', ') : '';

  // Transform layout interface states
  const submitBtn = document.getElementById('btn-save-log');
  if (submitBtn) {
    submitBtn.innerText = "Update Existing Record Entry";
    submitBtn.classList.remove('bg-blue-600');
    submitBtn.classList.add('bg-amber-600');
  }
  document.getElementById('form-cancel-edit-btn').classList.remove('hidden');

  switchTab('add');
}

function cancelEditMode() {
  isEditMode = false;
  currentActiveItem = null;
  
  const form = document.getElementById('add-entry-form');
  if (form) form.reset();

  const submitBtn = document.getElementById('btn-save-log');
  if (submitBtn) {
    submitBtn.innerText = "Save to Device Storage";
    submitBtn.classList.remove('bg-amber-600');
    submitBtn.classList.add('bg-blue-600');
  }
  document.getElementById('form-cancel-edit-btn').classList.add('hidden');
}

// ==========================================
// ⚙️ CONNECT INTO EXTANT FORM HANDLING PIPELINE
// ==========================================
function handleFormSubmit(e) {
  if (e) e.preventDefault();

  const title = document.getElementById('form-title').value.trim();
  const location = document.getElementById('form-location').value.trim() || 'Unknown Vector';
  const lat = parseFloat(document.getElementById('form-lat').value);
  const lng = parseFloat(document.getElementById('form-lng').value);
  const notes = document.getElementById('form-notes').value.trim();
  const dateVal = document.getElementById('form-date').value;
  const tagsRaw = document.getElementById('form-tags').value;

  if (!title) return alert("Please enter a valid title.");

  const processedTags = tagsRaw ? tagsRaw.split(',').map(t => t.trim().replace('#', '').toLowerCase()).filter(t => t) : [];
  const entryDate = dateVal ? new Date(dateVal).toISOString() : new Date().toISOString();

  if (isEditMode && currentActiveItem) {
    let targetArray = currentActiveItem.isPlan ? localPlans : localEntries;
    const index = targetArray.findIndex(i => String(i.id) === String(currentActiveItem.id));

    if (index !== -1) {
      targetArray[index].title = title;
      targetArray[index].location_name = location; 
      targetArray[index].latitude = isNaN(lat) ? null : lat;
      targetArray[index].longitude = isNaN(lng) ? null : lng;
      targetArray[index].notes = notes;
      targetArray[index].visit_date = entryDate;
      targetArray[index].tags = processedTags;
      targetArray[index].synced = false; 
    }
    cancelEditMode();
    alert('Log updated successfully!');
  } else {
    const uniqueId = 'id_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    const newEntry = {
      id: uniqueId,
      title: title,
      latitude: isNaN(lat) ? null : lat,
      longitude: isNaN(lng) ? null : lng,
      location_name: location,
      notes: notes, 
      visit_date: entryDate,
      tags: processedTags,
      synced: false
    };
    localEntries.unshift(newEntry);
    alert('Mission Logged Locally!');
  }

  saveToLocalStorage();
  
  if (typeof renderEntries === 'function') renderEntries(localEntries);
  switchTab('list');
}
