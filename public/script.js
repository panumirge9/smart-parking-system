// 🔒 AUTHENTICATION & MULTI-TENANCY SETUP
const token = localStorage.getItem('token');
const CURRENT_GARAGE_ID = localStorage.getItem('garageId');

// If there is no token, kick them back to the login page immediately
if (!token && !window.location.pathname.includes('login.html')) {
    window.location.href = 'login.html';
}

// Reusable headers for secure API requests
const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
};

// Logout Function
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('garageId');
    window.location.href = 'login.html';
}

const grid = document.getElementById('parkingGrid');
const messageEl = document.getElementById('message');
const historyBody = document.getElementById('historyBody');
const isAdminPage = window.location.pathname.includes('admin.html');
let currentSlots = [];
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

// 🔊 AUDIO ENGINE
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (type === 'park') {
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(150, audioCtx.currentTime); 
        oscillator.frequency.linearRampToValueAtTime(300, audioCtx.currentTime + 0.8);
        oscillator.frequency.setValueAtTime(1200, audioCtx.currentTime + 0.9); 
        oscillator.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 1.1);
        
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.05, audioCtx.currentTime + 0.4);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime + 0.9); 
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.2);
        
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 1.2);
    } else if (type === 'leave') {
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(100, audioCtx.currentTime); 
        oscillator.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 1.0); 
        
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.08, audioCtx.currentTime + 0.2);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.0);
        
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 1.0);
    } else if (type === 'lock') {
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(1800, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime + 0.01);
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime + 0.06); 
        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime + 0.12); 
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime + 0.17);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.2);
    }
}

// 💨 CONTINUOUS EXHAUST & PARTICLE ENGINE
function startExhaust(vehicle, duration) {
    const interval = setInterval(() => {
        const rect = vehicle.getBoundingClientRect();
        if (rect.width === 0) return; 
        
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height; 
        
        const smoke = document.createElement('div');
        smoke.style.position = 'fixed';
        smoke.style.left = `${x + (Math.random() * 10 - 5)}px`;
        smoke.style.top = `${y + (Math.random() * 10 - 5)}px`;
        smoke.style.width = '12px';
        smoke.style.height = '12px';
        smoke.style.background = 'rgba(230, 230, 230, 0.7)'; 
        smoke.style.borderRadius = '50%';
        smoke.style.pointerEvents = 'none';
        smoke.style.zIndex = '9997'; 
        smoke.style.filter = 'blur(3px)';
        document.body.appendChild(smoke);
        
        smoke.animate([
            { transform: 'translate(-50%, -50%) scale(1)', opacity: 0.7 },
            { transform: `translate(-50%, -50%) scale(5) translate(${Math.random()*30-15}px, ${Math.random()*15+15}px)`, opacity: 0 }
        ], { duration: 800 + Math.random()*400, fill: 'forwards' });
        
        setTimeout(() => smoke.remove(), 1300);
    }, 40);

    setTimeout(() => clearInterval(interval), duration);
}

function createDualSkidMarks(x, y, angle) {
    const createMark = (offsetX) => {
        const mark = document.createElement('div');
        mark.style.position = 'fixed';
        mark.style.left = `${x + offsetX}px`;
        mark.style.top = `${y}px`;
        mark.style.width = '8px';
        mark.style.height = '35px';
        mark.style.background = 'rgba(0,0,0,0.25)';
        mark.style.borderRadius = '4px';
        mark.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
        mark.style.pointerEvents = 'none';
        mark.style.zIndex = '9998';
        mark.style.transition = 'opacity 2s ease-out';
        document.body.appendChild(mark);
        
        setTimeout(() => { mark.style.opacity = '0'; }, 1000);
        setTimeout(() => { mark.remove(); }, 3000);
    };
    createMark(-15);
    createMark(15);
}

// 🎬 ANIMATIONS
function playRealisticParkingAnimation(slotId, vehicleType, onComplete) {
    const targetSlot = document.getElementById(`slot-${slotId}`);
    if (!targetSlot) {
        if (onComplete) onComplete(); 
        return;
    }
    const slotRect = targetSlot.getBoundingClientRect();

    const vehicle = document.createElement('div');
    vehicle.textContent = vehicleType === 'Bike' ? '🏍️' : '🚗';
    vehicle.style.position = 'fixed';
    vehicle.style.left = '0px';
    vehicle.style.top = '0px';
    vehicle.style.fontSize = '3.5rem'; 
    vehicle.style.zIndex = '9999';
    vehicle.style.pointerEvents = 'none'; 
    document.body.appendChild(vehicle);

    const startX = window.innerWidth / 2;
    const startY = window.innerHeight + 150; 
    const endX = slotRect.left + (slotRect.width / 2);
    const endY = slotRect.top + (slotRect.height / 2) - 10; 

    const isLeft = endX < startX;
    const sway = isLeft ? -25 : 25; 

    startExhaust(vehicle, 1000); 
    setTimeout(() => createDualSkidMarks(endX, endY + 20, 0), 1050); 
    setTimeout(() => playSound('lock'), 1700); 

    const animation = vehicle.animate([
        { transform: `translate(calc(${startX}px - 50%), calc(${startY}px - 50%)) scale(2.5) rotate(${sway}deg)`, filter: 'drop-shadow(0 40px 20px rgba(0,0,0,0.4)) drop-shadow(0 0 0px rgba(255,0,0,0))', opacity: 0 },
        { transform: `translate(calc(${startX + sway}px - 50%), calc(${startY - 200}px - 50%)) scale(2) rotate(${sway/2}deg)`, filter: 'drop-shadow(0 30px 15px rgba(0,0,0,0.4)) drop-shadow(0 0 0px rgba(255,0,0,0))', opacity: 1, offset: 0.3 },
        { transform: `translate(calc(${endX}px - 50%), calc(${endY + 80}px - 50%)) scale(1.2) rotate(0deg)`, filter: 'drop-shadow(0 10px 8px rgba(0,0,0,0.3)) drop-shadow(0 0 0px rgba(255,0,0,0))', offset: 0.75 },
        { transform: `translate(calc(${endX}px - 50%), calc(${endY - 8}px - 50%)) scale(1.05) rotate(0deg)`, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.5)) drop-shadow(0 15px 30px rgba(239,68,68,0.9))', offset: 0.90 }, 
        { transform: `translate(calc(${endX}px - 50%), calc(${endY}px - 50%)) scale(1) rotate(0deg)`, filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.2)) drop-shadow(0 0 0px rgba(239,68,68,0))', opacity: 1 }
    ], { duration: 1400, easing: 'cubic-bezier(0.25, 1, 0.4, 1)', fill: 'forwards' });

    animation.onfinish = () => {
        vehicle.remove();
        if (onComplete) onComplete();
    };
}

function playLeavingAnimation(slotId, vehicleType, onComplete) {
    const targetSlot = document.getElementById(`slot-${slotId}`);
    if (!targetSlot) {
        if (onComplete) onComplete();
        return;
    }
    const slotRect = targetSlot.getBoundingClientRect();

    const vehicle = document.createElement('div');
    vehicle.textContent = vehicleType === 'Bike' ? '🏍️' : '🚗';
    vehicle.style.position = 'fixed';
    vehicle.style.left = '0px';
    vehicle.style.top = '0px';
    vehicle.style.fontSize = '3.5rem';
    vehicle.style.zIndex = '9999';
    vehicle.style.pointerEvents = 'none';
    document.body.appendChild(vehicle);

    const startX = slotRect.left + (slotRect.width / 2);
    const startY = slotRect.top + (slotRect.height / 2) - 10;
    const endX = window.innerWidth / 2;
    const endY = window.innerHeight + 150;
    
    const isLeft = startX < endX;
    const sway = isLeft ? -20 : 20;

    const gridEmoji = targetSlot.querySelector('.text-4xl');
    if (gridEmoji) gridEmoji.style.opacity = '0';

    playSound('lock'); 
    setTimeout(() => startExhaust(vehicle, 1000), 200); 

    const animation = vehicle.animate([
        { transform: `translate(calc(${startX}px - 50%), calc(${startY}px - 50%)) scale(1) rotate(0deg)`, filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.2)) drop-shadow(0 0 20px rgba(255,255,255,0.9))', opacity: 1 },
        { transform: `translate(calc(${startX}px - 50%), calc(${startY + 30}px - 50%)) scale(1.05) rotate(0deg)`, filter: 'drop-shadow(0 8px 10px rgba(0,0,0,0.3)) drop-shadow(0 15px 25px rgba(255,255,255,0.8))', offset: 0.2 },
        { transform: `translate(calc(${startX + sway}px - 50%), calc(${startY + 150}px - 50%)) scale(1.5) rotate(${-sway}deg)`, filter: 'drop-shadow(0 20px 15px rgba(0,0,0,0.4)) drop-shadow(0 0 0px rgba(255,255,255,0))', offset: 0.5 },
        { transform: `translate(calc(${endX}px - 50%), calc(${endY}px - 50%)) scale(3) rotate(${-sway/2}deg)`, filter: 'drop-shadow(0 40px 20px rgba(0,0,0,0.5))', opacity: 0, offset: 1 }
    ], { duration: 1200, easing: 'cubic-bezier(0.5, 0, 0.2, 1)', fill: 'forwards' });

    animation.onfinish = () => {
        vehicle.remove();
        if (onComplete) onComplete();
    };
}

async function fetchSlots() {
    if (!CURRENT_GARAGE_ID) return;
    try {
        const response = await fetch(`/api/slots?garageId=${CURRENT_GARAGE_ID}`, {
            headers: authHeaders 
        });
        
        currentSlots = await response.json(); 
        renderGrid(currentSlots);             
        
        if (isAdminPage) {
            fetchLogs();
            fetchStats();
        }
    } catch (error) { console.error(error); }
}

async function fetchStats() {
    try {
        const response = await fetch(`/api/stats?garageId=${CURRENT_GARAGE_ID}`, {
            headers: authHeaders // <-- Added Auth
        });
        const stats = await response.json();
        document.getElementById('statOccupancy').textContent = `${stats.occupiedSlots} / ${stats.totalSlots}`;
        document.getElementById('statToday').textContent = stats.carsToday;
    } catch (error) { console.error(error); }
}

async function fetchLogs() {
    try {
        const response = await fetch(`/api/logs?garageId=${CURRENT_GARAGE_ID}`, {
            headers: authHeaders // <-- Added Auth
        });
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
                <td class="px-6 py-4">${entryTime}</td>
                <td class="px-6 py-4">${exitTime}</td>
                <td class="px-6 py-4 font-bold text-green-600 dark:text-green-400">${costText}</td>
                <td class="px-6 py-4">${status}</td>
            `;
            historyBody.appendChild(tr);
        });
    } catch (error) { console.error(error); }
}

function renderGrid(slots) {
    grid.innerHTML = '';
    slots.forEach(slot => {
        const div = document.createElement('div');
        div.id = `slot-${slot._id}`; 
        div.dataset.type = slot.vehicleType || 'Car'; 
        
        let baseClasses = "relative flex flex-col items-center justify-center min-h-[120px] rounded-2xl font-bold transition-all duration-500 ease-out overflow-hidden border-2 ";
        
        if (slot.isOccupied) {
            const isBike = slot.vehicleType === 'Bike';
            const accentColor = isBike ? "purple" : "blue"; 
            const icon = isBike ? '🏍️' : '🚗';

            div.className = baseClasses + `bg-${accentColor}-50/10 dark:bg-${accentColor}-900/20 text-${accentColor}-700 dark:text-${accentColor}-300 border-${accentColor}-500/50 shadow-lg scale-100 hover:scale-[1.03]`;
            
            let content = `
                <div class="absolute top-2 left-2 text-[10px] uppercase tracking-widest opacity-50">${slot.slotNumber}</div>
                <div class="text-4xl mb-1 drop-shadow-md animate-bounce-slow transition-opacity duration-300">${icon}</div>
                <div class="mt-1 font-mono text-[11px] bg-slate-900/10 dark:bg-white/10 px-2 py-1 rounded-lg border border-white/5 backdrop-blur-sm">
                    ${slot.vehiclePlate}
                </div>
            `;
            
            if (isAdminPage) {
                content += `
                    <button class="mt-3 w-[80%] py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-[10px] font-black uppercase tracking-tighter hover:bg-blue-600 dark:hover:bg-blue-500 hover:text-white transition-all shadow-sm active:scale-90 no-print" 
                            onclick="freeSlot('${slot._id}')">
                        Clear & Bill
                    </button>`;
            }
            div.innerHTML = content;
        } else {
            div.className = baseClasses + "bg-transparent border-dashed border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-600 hover:border-green-500/50 hover:bg-green-500/5";
            div.innerHTML = `
                <div class="text-xs font-medium tracking-widest opacity-40 mb-1">${slot.slotNumber}</div>
                <div class="text-sm font-black uppercase tracking-widest text-slate-300 dark:text-slate-700">VACANT</div>
                <div class="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <span class="text-xs text-green-500 font-bold">READY TO PARK</span>
                </div>
            `;
        }
        grid.appendChild(div);
    });
}

// 🚗 PARK FUNCTION (Updated for E-Ticketing)
async function parkVehicle() {
    const input = document.getElementById('plateInput');
    const typeInput = document.getElementById('typeInput');
    const phoneInput = document.getElementById('phoneInput'); 

    const plate = input ? input.value.trim() : '';
    const type = typeInput ? typeInput.value : 'Car'; 
    
    // Format the phone number (Twilio requires the +91 country code for India)
    let phone = phoneInput ? phoneInput.value.trim() : ''; 
    if (phone && !phone.startsWith('+')) {
        phone = '+91' + phone; 
    }

    if (!plate) return showMessage('Please enter a license plate number.', 'text-red-500');

    // 4. UPDATE THIS LINE TO USE currentSlots
    const emptySlots = currentSlots.filter(slot => !slot.isOccupied);

    if (emptySlots.length === 0) {
        // Hide standard message, show the new Overflow button
        // Hide standard message, show the new Overflow button
        document.getElementById('message').textContent = "";
        document.getElementById('fullMessage').classList.remove('hidden');
        document.getElementById('fullMessage').classList.add('flex');
        return; // 🛑 Stop the function here so it doesn't call the API!
    } else {
        // Ensure the overflow button stays hidden if there is space
        document.getElementById('fullMessage').classList.add('hidden');
        document.getElementById('fullMessage').classList.remove('flex');
    }
    // ==========================================

    try {
        const response = await fetch('/api/park', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ 
                garageId: CURRENT_GARAGE_ID, 
                vehiclePlate: plate, 
                vehicleType: type,
                phoneNumber: phone
            })
        });
        const data = await response.json();

        if (data.success) {
            playSound('park');
            playRealisticParkingAnimation(data.slot._id, type, () => {
                showMessage(`Success! Parked in slot ${data.slot.slotNumber}`, 'text-green-600 dark:text-green-400');
                input.value = '';
                if (phoneInput) phoneInput.value = ''; 
                fetchSlots(); 
            });
        } else {
            showMessage(data.message, 'text-red-500');
        }
    } catch (error) { console.error(error); }
}

// 🚗 LEAVE FUNCTION (Updated)
async function freeSlot(slotId) {
    try {
        const targetSlot = document.getElementById(`slot-${slotId}`);
        const vehicleType = targetSlot ? targetSlot.dataset.type : 'Car';

        const response = await fetch('/api/leave', {
            method: 'POST',
            headers: authHeaders, // <-- Added Auth
            body: JSON.stringify({ slotId })
        });
        const data = await response.json();

        if (data.success) {
            playSound('leave');
            playLeavingAnimation(slotId, vehicleType, () => {
                showMessage(`Slot ${data.slot.slotNumber} cleared.`, 'text-green-600 dark:text-green-400');
                fetchSlots();

                if (data.receipt) {
                    showReceipt(data.receipt);
                }
            });
        } else {
            showMessage(data.message, 'text-red-500');
        }
    } catch (error) { console.error(error); }
}

// 🧾 RECEIPT LOGIC (Updated with Dynamic UPI QR)
function showReceipt(receipt) {
    document.getElementById('recPlate').textContent = receipt.plate;
    document.getElementById('recEntry').textContent = new Date(receipt.entry).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    document.getElementById('recExit').textContent = new Date(receipt.exit).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    document.getElementById('recDuration').textContent = `${receipt.duration}h`;
    document.getElementById('recRate').textContent = `Rate: ₹${receipt.rate}/hr`;
    document.getElementById('recTotal').textContent = `₹${receipt.total}`;

   // 📱 GENERATE THE DYNAMIC UPI QR CODE
    const merchantUPI = "panumirge9@okaxis"; // <-- MUST BE A REAL UPI ID
    const merchantName = "SmartParking";
    
    // 1. Encode the name so the space doesn't break the URL
    const encodedName = encodeURIComponent(merchantName);
    
    // 2. Format the amount to two decimal places (e.g., 60.00)
    const formattedAmount = Number(receipt.total).toFixed(2);
    
    // 3. Create the strict UPI URL
    const upiString = `upi://pay?pa=${merchantUPI}&pn=${encodedName}&am=${formattedAmount}&cu=INR`;

    // Draw the QR Code to the canvas
    new QRious({
        element: document.getElementById('upiQRCode'),
        value: upiString,
        size: 120,
        background: 'white',
        foreground: '#0f172a' 
    });

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
// 🚀 EXPAND OVERFLOW CAPACITY
async function expandCapacity(amount) {
    if (!CURRENT_GARAGE_ID) return;
    
    const btn = document.getElementById('expandBtn');
    if(btn) btn.innerHTML = `<span class="animate-pulse">Adding Slots...</span>`;

    try {
        const res = await fetch('/api/expand-capacity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ garageId: CURRENT_GARAGE_ID, amount: amount })
        });
        const data = await res.json();
        
        if (data.success) {
            // Restore button text
            if(btn) btn.innerHTML = `<span>+ Add 5 Overflow Slots</span>`;
            // Magically fetch the new slots and redraw the UI!
            fetchSlots(); 
        } else {
            alert("Failed to expand capacity: " + data.message);
        }
    } catch (err) {
        console.error("Error expanding capacity:", err);
        alert("Server error while adding slots.");
    }
}

// Init
fetchSlots();