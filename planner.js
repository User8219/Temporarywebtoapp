document.addEventListener('DOMContentLoaded', () => {
  const savePlanBtn = document.getElementById('btn-save-plan');
  if (savePlanBtn) {
    savePlanBtn.addEventListener('click', savePlan);
  }
});

function savePlan() {
  const busDetails = document.getElementById('plan-bus').value.trim();
  const latRaw = document.getElementById('plan-lat').value;
  const lngRaw = document.getElementById('plan-lng').value;
  const dateInput = document.getElementById('plan-date').value; 
  const fileInput = document.getElementById('plan-img');

  if (!busDetails) return alert('Transit Route description is required.');

  // Clean and parse values safely
  const lat = parseFloat(sanitizeCoordinateString(latRaw));
  const lng = parseFloat(sanitizeCoordinateString(lngRaw));

  const executeSave = (base64Image = null) => {
    const planId = 'plan_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    
    const newPlan = {
      id: planId,
      title: busDetails,
      latitude: isNaN(lat) ? null : lat,
      longitude: isNaN(lng) ? null : lng,
      image: base64Image, 
      visit_date: dateInput ? new Date(dateInput).toISOString() : new Date().toISOString(),
      isPlan: true,
      tags: ['transit', 'bus-route'],
      notes: `Bus transit route information to assist navigation vectors.`
    };

    if (typeof localPlans !== 'undefined') {
      localPlans.unshift(newPlan);
    } else {
      window.localPlans = [newPlan];
    }
    
    if (typeof saveToLocalStorage === 'function') saveToLocalStorage();
    renderPlans();
    
    // Clear forms
    document.getElementById('plan-bus').value = '';
    document.getElementById('plan-lat').value = '';
    document.getElementById('plan-lng').value = '';
    document.getElementById('plan-date').value = ''; 
    if (fileInput) fileInput.value = '';
    
    const weatherContainer = document.getElementById('weather-hourly-container');
    if (weatherContainer) {
      weatherContainer.classList.add('hidden');
      weatherContainer.innerHTML = '';
    }
    
    alert('Transit route plan committed offline!');
  };

  if (fileInput && fileInput.files && fileInput.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) { executeSave(e.target.result); };
    reader.readAsDataURL(fileInput.files[0]);
  } else {
    executeSave();
  }
}

function renderPlans() {
  const container = document.getElementById('plans-container');
  if (!container) return;
  container.innerHTML = '';
  
  const targetArray = (typeof localPlans !== 'undefined') ? localPlans : [];
  
  if (targetArray.length === 0) {
    container.innerHTML = `<p class="text-gray-500 text-center py-6 text-sm">No routes charted yet.</p>`;
    return;
  }

  targetArray.forEach(plan => {
    const card = document.createElement('div');
    card.className = 'bg-[#16161A] border border-[#222226] p-4 rounded-xl cursor-pointer active:scale-[0.99] transition';
    card.onclick = () => {
      if (typeof openDeepView === 'function') openDeepView(plan.id, true);
    };
    card.innerHTML = `
      <div class="flex justify-between items-center">
        <h4 class="text-sm font-bold text-white">🚌 ${plan.title}</h4>
        ${plan.image ? '<span class="text-[10px] bg-blue-950 text-blue-400 font-bold px-1.5 py-0.5 rounded">🗺️ Map Image</span>' : ''}
      </div>
      ${plan.latitude ? `<span class="text-[11px] text-gray-500 block mt-1">Station Fix: [${plan.latitude}, ${plan.longitude}]</span>` : ''}
    `;
    container.appendChild(card);
  });
}

function getCurrentGPSLocationForPlanner() {
  if (!navigator.geolocation) {
    alert('Geolocation engine is completely unsupported by your current device host configuration.');
    fallbackManualCoordinatesPlanner();
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      document.getElementById('plan-lat').value = pos.coords.latitude.toFixed(6);
      document.getElementById('plan-lng').value = pos.coords.longitude.toFixed(6);
      alert('Local GPS telemetry locked and auto-routed to input fields!');
    },
    (err) => {
      console.warn(`GPS hardware access-denied/timeout: ${err.message}`);
      alert('Browser security policy blocked live geolocation tracking over raw HTTP. Let\'s manual-override coordinates.');
      fallbackManualCoordinatesPlanner();
    },
    { enableHighAccuracy: true, timeout: 7000 }
  );
}

function fallbackManualCoordinatesPlanner() {
  const coords = prompt("Enter coordinates manually (e.g., 16.4023, 120.5963):");
  if (coords && coords.includes(',')) {
    const parts = coords.split(',');
    document.getElementById('plan-lat').value = parts[0].trim();
    document.getElementById('plan-lng').value = parts[1].trim();
  }
}

// 🟢 New sanitization helper to fix improper decimal strings automatically
function sanitizeCoordinateString(val) {
  let clean = val.replace(/[^0-9.-]/g, '').trim();
  if (!clean) return "";
  
  // If user entered numbers like 163637 without a dot, insert a proper decimal context
  if (!clean.includes('.') && clean.length > 4) {
    return clean.slice(0, 2) + '.' + clean.slice(2);
  }
  return clean;
}

async function fetchHourlyWeatherForecast() {
  const latRaw = document.getElementById('plan-lat').value;
  const lngRaw = document.getElementById('plan-lng').value;
  const dateInput = document.getElementById('plan-date').value;
  const container = document.getElementById('weather-hourly-container');

  if (!container) return;

  const lat = sanitizeCoordinateString(latRaw);
  const lng = sanitizeCoordinateString(lngRaw);

  if (!lat || !lng || isNaN(parseFloat(lat)) || isNaN(parseFloat(lng))) {
    container.classList.add('hidden');
    return alert("Missing or invalid target vectors. Ensure Latitude and Longitude are in decimal form (e.g. 16.4023).");
  }

  // Update visual inputs with sanitized strings
  document.getElementById('plan-lat').value = lat;
  document.getElementById('plan-lng').value = lng;

  const targetDate = dateInput ? dateInput : new Date().toISOString().split('T')[0];
  
  container.classList.remove('hidden');
  container.innerHTML = `<span class="text-xs text-gray-500 animate-pulse py-1">Querying Open-Meteo satellite vectors...</span>`;

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${parseFloat(lat)}&longitude=${parseFloat(lng)}&hourly=temperature_2m,precipitation_probability,wind_speed_10m&start_date=${targetDate}&end_date=${targetDate}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Network grid rejected packet");
    
    const data = await response.json();
    const hourly = data.hourly;
    
    if (!hourly || !hourly.time) {
      container.innerHTML = `<span class="text-xs text-red-400 py-1">No forecast timeline mapped for this location framework.</span>`;
      return;
    }

    container.innerHTML = ''; 

    for (let h = 0; h < hourly.time.length; h++) {
      const timeStr = new Date(hourly.time[h]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const temp = Math.round(hourly.temperature_2m[h]);
      const rainProb = hourly.precipitation_probability[h];
      const wind = Math.round(hourly.wind_speed_10m[h]);

      const hourCard = document.createElement('div');
      hourCard.className = 'bg-[#1C1C1E] border border-[#2C2C2E] p-2 rounded-md min-w-[75px] text-center flex-shrink-0 space-y-0.5';
      
      const rainColor = rainProb > 30 ? 'text-blue-400 font-semibold' : 'text-gray-500';

      hourCard.innerHTML = `
        <div class="text-[10px] text-gray-500 font-mono">${timeStr}</div>
        <div class="text-sm font-bold text-white">${temp}°C</div>
        <div class="text-[10px] ${rainColor}">💧 ${rainProb}%</div>
        <div class="text-[10px] text-gray-400">💨 ${wind}km/h</div>
      `;
      container.appendChild(hourCard);
    }
  } catch (error) {
    console.error(error);
    container.innerHTML = `<span class="text-xs text-red-500 py-1">Forecast fetch failed offline.</span>`;
  }
}
