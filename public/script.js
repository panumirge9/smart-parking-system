const grid = document.getElementById('parkingGrid');
const messageEl = document.getElementById('message');
const historyBody = document.getElementById('historyBody');
const isAdminPage = window.location.pathname.includes('admin.html');

// 🌗 DARK MODE
const htmlEl = document.documentElement;
const themeIcon = document.getElementById('themeIcon');
if (localStorage.getItem('theme') === 'dark') {
    htmlEl.classList.add('dark');
    if(themeIcon) themeIcon.textContent = '☀️';
}
function toggleTheme() {
    htmlEl.classList.toggle('dark');
    if (htmlEl.classList.contains('dark')) {
        localStorage.setItem('theme', 'dark');
        themeIcon.textContent = '☀️';
    } else {
        localStorage.setItem('theme', 'light');
        themeIcon.textContent = '🌙';
    }
}

// 🔊 AUDIO
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (type === 'park') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime + 0.1); 
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime + 0.15);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'leave') {
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(400, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.3);
    }
}

// 🚗 API LOGIC
async function fetchSlots() {
    try {
        const response = await fetch('/api/slots');
        const slots = await response.json();
        renderGrid(slots);
        if (isAdminPage) {
            fetchLogs();
            fetchStats();
        }
    } catch (error) {}
}

async function fetchStats() {
    try {
        const response = await fetch('/api/stats');
        const stats = await response.json();
        document.getElementById('statOccupancy').textContent = `${stats.occupiedSlots} / ${stats.totalSlots}`;
        document.getElementById('statToday').textContent = stats.carsToday;
    } catch (error) {}
}

async function fetchLogs() {
    try {
        const response = await fetch('/api/logs');
        const logs = await response.json();
        
        historyBody.innerHTML = '';
        logs.forEach(log => {
            const entryTime = new Date(log.entryTime).toLocaleString();
            const exitTime = log.exitTime ? new Date(log.exitTime).toLocaleString() : '---';
            const status = log.exitTime 
                ? '<span class="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-3 py-1 rounded-full text-xs font-bold">Completed</span>' 
                : '<span class="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 px-3 py-1 rounded-full text-xs font-bold animate-pulse">Parked</span>';
            const typeIcon = log.vehicleType === 'Bike' ? '🏍️ Bike' : '🚗 Car';
            const costText = log.cost > 0 ? `₹${log.cost}` : '---';

            const tr = document.createElement('tr');
            tr.className = "hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors log-row";
            tr.innerHTML = `
                <td class="px-6 py-4 font-bold text-slate-800 dark:text-white plate-cell">${log.vehiclePlate}</td>
                <td class="px-6 py-4">${typeIcon}</td>
                <td class="px-6 py-4">P-${log.slotId}</td>
                <td class="px-6 py-4">${entryTime}</td>
                <td class="px-6 py-4">${exitTime}</td>
                <td class="px-6 py-4 font-bold text-green-600 dark:text-green-400">${costText}</td>
                <td class="px-6 py-4">${status}</td>
            `;
            historyBody.appendChild(tr);
        });
    } catch (error) {}
}

function renderGrid(slots) {
    grid.innerHTML = '';
    slots.forEach(slot => {
        const div = document.createElement('div');
        let baseClasses = "relative flex flex-col items-center justify-center min-h-[120px] rounded-2xl font-bold transition-all duration-500 ease-out overflow-hidden border-2 ";
        
        if (slot.isOccupied) {
            const isBike = slot.vehicleType === 'Bike';
            const accentColor = isBike ? "purple" : "blue"; 
            const icon = isBike ? '🏍️' : '🚗';

            div.className = baseClasses + `bg-${accentColor}-50/10 dark:bg-${accentColor}-900/20 text-${accentColor}-700 dark:text-${accentColor}-300 border-${accentColor}-500/50 shadow-lg scale-100 hover:scale-[1.03]`;
            
            let content = `
                <div class="absolute top-2 left-2 text-[10px] uppercase tracking-widest opacity-50">P-${slot.id}</div>
                
                <div class="text-4xl mb-1 drop-shadow-md animate-bounce-slow">${icon}</div>
                
                <div class="mt-1 font-mono text-[11px] bg-slate-900/10 dark:bg-white/10 px-2 py-1 rounded-lg border border-white/5 backdrop-blur-sm">
                    ${slot.vehiclePlate}
                </div>
            `;
            
            if (isAdminPage) {
                content += `
                    <button class="mt-3 w-[80%] py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-[10px] font-black uppercase tracking-tighter hover:bg-blue-600 dark:hover:bg-blue-500 hover:text-white transition-all shadow-sm active:scale-90 no-print" 
                            onclick="freeSlot(${slot.id})">
                        Clear & Bill
                    </button>`;
            }
            div.innerHTML = content;
        } else {

            div.className = baseClasses + "bg-transparent border-dashed border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-600 hover:border-green-500/50 hover:bg-green-500/5";
            div.innerHTML = `
                <div class="text-xs font-medium tracking-widest opacity-40 mb-1">P-${slot.id}</div>
                <div class="text-sm font-black uppercase tracking-widest text-slate-300 dark:text-slate-700">VACANT</div>
                <div class="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <span class="text-xs text-green-500 font-bold">READY TO PARK</span>
                </div>
            `;
        }
        grid.appendChild(div);
    });
}

async function parkVehicle() {
    const input = document.getElementById('plateInput');
    const typeInput = document.getElementById('typeInput');
    const plate = input ? input.value.trim() : '';
    const type = typeInput ? typeInput.value : 'Car'; 

    if (!plate) return showMessage('Please enter a license plate number.', 'text-red-500');

    try {
        const response = await fetch('/api/park', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vehiclePlate: plate, vehicleType: type })
        });
        const data = await response.json();

        if (data.success) {
            playSound('park');
            showMessage(`Success! Parked in slot P-${data.slot.id}`, 'text-green-600 dark:text-green-400');
            input.value = '';
            fetchSlots();
        } else {
            showMessage(data.message, 'text-red-500');
        }
    } catch (error) {}
}

async function freeSlot(slotId) {
    try {
        const response = await fetch('/api/leave', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slotId })
        });
        const data = await response.json();

        if (data.success) {
            playSound('leave');
            showMessage(`Slot P-${slotId} cleared.`, 'text-green-600 dark:text-green-400');
            fetchSlots();

            if (data.receipt) {
                showReceipt(data.receipt);
            }
        } else {
            showMessage(data.message, 'text-red-500');
        }
    } catch (error) {}
}

// 🧾 RECEIPT LOGIC
function showReceipt(receipt) {

    document.getElementById('recPlate').textContent = receipt.plate;
    document.getElementById('recEntry').textContent = new Date(receipt.entry).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    document.getElementById('recExit').textContent = new Date(receipt.exit).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    document.getElementById('recDuration').textContent = `${receipt.duration}h`;
    document.getElementById('recRate').textContent = `Rate: ₹${receipt.rate}/hr`;
    document.getElementById('recTotal').textContent = `₹${receipt.total}`;

    const modal = document.getElementById('receiptModal');
    const ticket = modal.querySelector('.relative');

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    ticket.style.opacity = "0";
    ticket.style.transform = "scale(0.9) translateY(20px)";

    setTimeout(() => {
        ticket.style.transition = "all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
        ticket.style.opacity = "1";
        ticket.style.transform = "scale(1) translateY(0)";
    }, 10);
}

function closeReceipt() {
    document.getElementById('receiptModal').classList.add('hidden');
    document.getElementById('receiptModal').classList.remove('flex');
}

function filterTable() {
    const input = document.getElementById("searchInput").value.toUpperCase();
    const rows = document.querySelectorAll(".log-row");
    rows.forEach(row => {
        const plateCell = row.querySelector(".plate-cell").textContent.toUpperCase();
        row.style.display = plateCell.includes(input) ? "" : "none";
    });
}

function showMessage(msg, colorClass) {
    messageEl.textContent = msg;
    messageEl.className = `h-6 font-bold text-sm mb-4 ${colorClass}`;
    setTimeout(() => { messageEl.textContent = ''; }, 4000);
}

fetchSlots();
// 🧠 AI GREETING LOGIC
async function fetchGreeting() {
    const welcomeEl = document.getElementById('aiWelcome');
    if (!welcomeEl) return;

    try {
        const response = await fetch('/api/greeting');
        const data = await response.json();
        
        welcomeEl.classList.remove('animate-pulse', 'italic');
        welcomeEl.textContent = ""; 
        
        let i = 0;
        const message = `"${data.message}"`;
        function typeWriter() {
            if (i < message.length) {
                welcomeEl.textContent += message.charAt(i);
                i++;
                setTimeout(typeWriter, 40); 
            }
        }
        typeWriter();
        
    } catch (error) {
        welcomeEl.classList.remove('animate-pulse');
        welcomeEl.textContent = "Welcome! Find an empty slot and park your vehicle.";
    }
}