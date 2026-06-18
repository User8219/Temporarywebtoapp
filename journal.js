document.addEventListener('DOMContentLoaded', () => {
  const saveLogBtn = document.getElementById('btn-save-log');
  const searchBar = document.getElementById('search-bar');

  if (saveLogBtn) saveLogBtn.addEventListener('click', saveEntryOffline);
  if (searchBar) {
    searchBar.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      const filtered = localEntries.filter(e => 
        e.title.toLowerCase().includes(q) || 
        (e.notes && e.notes.toLowerCase().includes(q)) || 
        (e.location_name && e.location_name.toLowerCase().includes(q))
      );
      renderEntries(filtered);
    });
  }
});

function saveEntryOffline() {
  const title = document.getElementById('form-title').value.trim();
  const lat = parseFloat(document.getElementById('form-lat').value);
  const lng = parseFloat(document.getElementById('form-lng').value);
  const location = document.getElementById('form-location').value.trim();
  const tagsRaw = document.getElementById('form-tags').value;
  const notes = document.getElementById('form-notes').value.trim();
const chosenDate = document.getElementById('form-date').value; 
  if (!title) return alert('Mission Title is required.');

  const uniqueId = 'id_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

  const newEntry = {
    id: uniqueId,
    title: title,
    latitude: isNaN(lat) ? null : lat,
    longitude: isNaN(lng) ? null : lng,
    location_name: location,
    notes: notes,
    tags: tagsRaw.split(',').map(t => t.trim().replace('#', '').toLowerCase()).filter(t => t.length > 0),
    visit_date: chosenDate ? new Date(chosenDate).toISOString() : new Date().toISOString(),
    synced: false
  };

  localEntries.unshift(newEntry);
  saveToLocalStorage();
  renderEntries(localEntries);

  ['form-title', 'form-lat', 'form-lng', 'form-location', 'form-date', 'form-tags', 'form-notes'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.value = '';
  });
  
  alert('Mission Logged Locally!');
  switchTab('list');
}

function renderEntries(list) {
  const container = document.getElementById('entries-container');
  if (!container) return;
  container.innerHTML = '';
  
  if (list.length === 0) {
    container.innerHTML = `<p class="text-gray-500 text-center py-6 text-sm">Empty log database.</p>`;
    return;
  }
  
  list.forEach(entry => {
    const tags = entry.tags.map(t => `<span class="text-[#30D158] bg-[rgba(48,209,88,0.1)] px-1.5 py-0.5 rounded text-[11px]">#${t}</span>`).join('');
    const card = document.createElement('div');
    card.className = 'bg-[#16161A] border border-[#222226] p-4 rounded-xl cursor-pointer';
    card.onclick = () => openDeepView(entry.id, false);
    card.innerHTML = `
      <div class="flex justify-between items-center">
        <h3 class="text-md font-bold text-white">${entry.title}</h3>
        <span class="text-[10px] text-gray-500">${new Date(entry.visit_date).toLocaleDateString()}</span>
      </div>
      <p class="text-xs text-blue-400 mt-0.5">📍 ${entry.location_name || 'Coordinates'}</p>
      <div class="flex flex-wrap gap-1 mt-2">${tags}</div>
    `;
    container.appendChild(card);
  });
}

function openDeepView(id, isPlan = false) {
  const dataset = isPlan ? localPlans : localEntries;
  const entry = dataset.find(e => e.id === id);
  if (!entry) return;

  document.getElementById('modal-title').innerText = entry.title;
  document.getElementById('modal-date').innerText = new Date(entry.visit_date).toLocaleDateString();
  document.getElementById('modal-location').innerText = entry.location_name || (isPlan ? 'Bus Transit Route' : '');
  document.getElementById('modal-notes').innerText = entry.notes || '';
  document.getElementById('modal-tags').innerHTML = entry.tags.map(t => `<span class="text-blue-400 bg-blue-950/40 px-2 py-0.5 rounded text-xs font-semibold">#${t}</span>`).join('');
  document.getElementById('modal-sync-badge').innerHTML = isPlan ? '' : (entry.synced ? '☁️ Synced' : '📱 Local');
  
  document.getElementById('modal-delete-btn').onclick = () => {
    if (!confirm("Remove this document permanently?")) return;
    if (isPlan) {
      localPlans = localPlans.filter(p => p.id !== id);
      renderPlans();
    } else {
      localEntries = localEntries.filter(e => e.id !== id);
      renderEntries(localEntries);
    }
    saveToLocalStorage();
    closeDeepView();
  };

  const imgWrapper = document.getElementById('modal-image-wrapper');
  if (entry.image) {
    imgWrapper.classList.remove('hidden');
    document.getElementById('modal-img-display').src = entry.image;
  } else {
    imgWrapper.classList.add('hidden');
  }

  const mapWrapper = document.getElementById('modal-map-wrapper');
  if (entry.latitude && entry.longitude) {
    mapWrapper.classList.remove('hidden');
    setTimeout(() => {
      if (!modalMap) {
        modalMap = L.map('modal-mini-map', { zoomControl: false, attributionControl: false }).setView([entry.latitude, entry.longitude], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(modalMap);
        modalMarker = L.marker([entry.latitude, entry.longitude]).addTo(modalMap);
      } else {
        modalMap.setView([entry.latitude, entry.longitude], 12);
        modalMarker.setLatLng([entry.latitude, entry.longitude]);
      }
      modalMap.invalidateSize();
    }, 150);
  } else { mapWrapper.classList.add('hidden'); }

  document.getElementById('deep-view-modal').classList.remove('hidden');
}

function getCurrentGPSLocation() {
  if (!navigator.geolocation) return alert("Geolocation unsupported.");
  navigator.geolocation.getCurrentPosition((pos) => {
    document.getElementById('form-lat').value = pos.coords.latitude.toFixed(6);
    document.getElementById('form-lng').value = pos.coords.longitude.toFixed(6);
  }, (err) => alert("GPS fix failed: " + err.message), { enableHighAccuracy: true });
}

async function syncWithCloud() {
  const unsynced = localEntries.filter(e => !e.synced);
  if (unsynced.length === 0) return alert('Cloud sync up-to-date.');
  const syncBtn = document.getElementById('btn-sync');
  syncBtn.innerText = "Syncing...";
  for (let entry of unsynced) {
    try {
      const { synced, ...payload } = entry;
      const { error } = await _supabase.from('entries').insert([{ ...payload, user_id: MY_USER_ID }]);
      if (error) throw error;
      entry.synced = true;
    } catch (err) { console.error(err); }
  }
  saveToLocalStorage();
  renderEntries(localEntries);
  alert('Sync complete!');
}

// Data Backups Fallbacks
function exportToJSONFile() {
  const complexData = { journals: localEntries, plans: localPlans };
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(complexData, null, 2));
  const anchor = document.createElement('a');
  anchor.setAttribute("href", dataStr);
  anchor.setAttribute("download", `adventure_backup_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function importFromJSONFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const parsed = JSON.parse(e.target.result);
      if (parsed.journals && parsed.plans) {
        localEntries = parsed.journals;
        localPlans = parsed.plans;
      } else { localEntries = parsed; }
      saveToLocalStorage();
      renderEntries(localEntries);
      alert('Import completed successfully!');
    } catch(err) { alert('Invalid layout schema.'); }
  };
  reader.readAsText(file);
}
async function fetchHourlyWeatherForecast() {
  const lat = document.getElementById('form-lat').value;
  const lng = document.getElementById('form-lng').value;
  const dateInput = document.getElementById('form-date').value;
  const container = document.getElementById('weather-hourly-container');

  if (!lat || !lng) {
    return alert("Missing coordinates. Provide a Latitude and Longitude mapping point first.");
  }

  // Fallback to current real-world date if no date is picked yet
  const targetDate = dateInput ? dateInput : new Date().toISOString().split('T')[0];
  
  container.classList.remove('hidden');
  container.innerHTML = `<span class="text-xs text-gray-500 animate-pulse py-1">Querying Open-Meteo satellite vectors...</span>`;

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,precipitation_probability,wind_speed_10m&start_date=${targetDate}&end_date=${targetDate}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Network grid rejected packet");
    
    const data = await response.json();
    const hourly = data.hourly;
    
    if (!hourly || !hourly.time) {
      container.innerHTML = `<span class="text-xs text-red-400 py-1">No forecast timeline mapped for this frame.</span>`;
      return;
    }

    container.innerHTML = ''; // Wipe out loading message

    // Loop through the 24 hours of that day matrix
    for (let h = 0; h < hourly.time.length; h++) {
      const timeStr = new Date(hourly.time[h]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const temp = Math.round(hourly.temperature_2m[h]);
      const rainProb = hourly.precipitation_probability[h];
      const wind = Math.round(hourly.wind_speed_10m[h]);

      const hourCard = document.createElement('div');
      hourCard.className = 'bg-[#16161A] border border-[#222226] p-2 rounded-md min-w-[75px] text-center flex-shrink-0 space-y-0.5';
      
      // Dynamic rain drops alert context coloring
      const rainColor = rainProb > 30 ? 'text-blue-400 font-semibold' : 'text-gray-500';

      hourCard.innerHTML = `
        <div class="text-[10px] text-gray-500 font-mono">${timeStr}</div>
        <div class="text-sm font-bold text-white">${temp}°C</div>
        <div class="text-[10px] ${rainColor}">💧 ${rainProb}%</div>
        <div class="text-[10px] text-gray-400">💨 ${wind}km/h</div>
      `;
      
      hourCard.onclick = () => {
        // Auto-inject clicked hour text data snapshot straight into field notes to save typing!
        const notesArea = document.getElementById('form-notes');
        const appendText = `[Weather Snapshot @ ${timeStr}: ${temp}°C, Rain Chance: ${rainProb}%, Wind: ${wind} km/h]\n`;
        if(!notesArea.value.includes(appendText)) {
           notesArea.value = appendText + notesArea.value;
        }
      };

      container.appendChild(hourCard);
    }
  } catch (error) {
    console.error(error);
    container.innerHTML = `<span class="text-xs text-red-500 py-1">Forecast fetch failed offline.</span>`;
  }
}