let currentCalendarDate = new Date();

function changeMonth(direction) {
  currentCalendarDate.setMonth(currentCalendarDate.getMonth() + direction);
  renderCalendar();
}

function renderCalendar() {
  const grid = document.getElementById('calendar-grid');
  const monthYearLabel = document.getElementById('calendar-month-year');
  if (!grid || !monthYearLabel) return;

  grid.innerHTML = '';

  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();

  // Set header label textual string mapping
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  monthYearLabel.innerText = `${monthNames[month]} ${year}`;

  // Get index layout structural padding calculations
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  // Combine both arrays to parse historical footprint timelines
  const allEvents = localEntries.concat(localPlans);

  // Pad blank grid spaces for offset week alignments
  for (let i = 0; i < firstDayIndex; i++) {
    const blank = document.createElement('div');
    blank.className = 'h-14';
    grid.appendChild(blank);
  }

  // Build Day Block Nodes
  for (let day = 1; day <= totalDays; day++) {
    const dayBox = document.createElement('div');
    dayBox.className = 'h-14 bg-[#16161A] border border-[#222226] rounded-lg p-1 flex flex-col justify-between items-start cursor-pointer transition active:border-blue-500 hover:border-neutral-700';
    
    // Number Label layout
    const numLabel = document.createElement('span');
    numLabel.className = 'text-xs text-gray-400 font-medium';
    numLabel.innerText = day;
    dayBox.appendChild(numLabel);

    // Filter timeline objects matching this exact date stamp parameters
    const targetDateString = new Date(year, month, day).toDateString();
    const matches = allEvents.filter(item => {
      if (!item.visit_date) return false;
      return new Date(item.visit_date).toDateString() === targetDateString;
    });

    // Indication Layout Engine Marker Builder
    if (matches.length > 0) {
      const dotContainer = document.createElement('div');
      dotContainer.className = 'flex flex-wrap gap-0.5 w-full overflow-hidden max-h-4';
      
      matches.forEach(match => {
        const indicator = document.createElement('span');
        // Colors: Blue indicators for bus routes, green indicators for hiking log points!
        indicator.className = match.isPlan 
          ? 'w-1.5 h-1.5 bg-blue-500 rounded-full inline-block' 
          : 'w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block';
        dotContainer.appendChild(indicator);
      });
      dayBox.appendChild(dotContainer);

      // Make day box clickable to view logs/plans if they exist
      dayBox.onclick = () => {
        if (matches.length === 1) {
          openDeepView(matches[0].id, !!matches[0].isPlan);
        } else {
          // If multiple items exist on one day, alert descriptions summaries list
          const lines = matches.map((m, idx) => `${idx + 1}. [${m.isPlan ? 'Bus' : 'Log'}] ${m.title}`).join('\n');
          alert(`Events on ${monthNames[month]} ${day}:\n\n${lines}\n\nUse the tabs or search menu to inspect specific files.`);
        }
      };
    }

    // Highlight current real-world day if visible in calendar grid
    const realToday = new Date();
    if (day === realToday.getDate() && month === realToday.getMonth() && year === realToday.getFullYear()) {
      dayBox.classList.add('border-blue-600', 'bg-blue-950/10');
      numLabel.classList.remove('text-gray-400');
      numLabel.classList.add('text-blue-400', 'font-bold');
    }

    grid.appendChild(dayBox);
  }
}
