
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("Connected to MongoDB"))
    .catch(err => console.error("MongoDB connection error:", err));

const slotSchema = new mongoose.Schema({
    id: Number,
    isOccupied: { type: Boolean, default: false },
    vehiclePlate: { type: String, default: null },
    vehicleType: { type: String, default: null },
    activeLogId: { type: String, default: null } 
});

const logSchema = new mongoose.Schema({
    vehiclePlate: String,
    vehicleType: String,
    slotId: Number,
    entryTime: { type: Date, default: Date.now },
    exitTime: { type: Date, default: null },
    cost: { type: Number, default: 0 } 
});

const Slot = mongoose.model('Slot', slotSchema);
const Log = mongoose.model('Log', logSchema);

async function initSlots() {
    const count = await Slot.countDocuments();
    const totalSlotsNeeded = 20; 
    if (count < totalSlotsNeeded) {
        let slots = [];
        for (let i = count + 1; i <= totalSlotsNeeded; i++) {
            slots.push({ id: i });
        }
        await Slot.insertMany(slots);
        console.log(`Initialized to ${totalSlotsNeeded} parking slots.`);
    }
}
initSlots();

app.get('/api/slots', async (req, res) => {
    const slots = await Slot.find().sort({ id: 1 });
    res.json(slots);
});

app.get('/api/stats', async (req, res) => {
    const occupiedSlots = await Slot.countDocuments({ isOccupied: true });
    const totalSlots = await Slot.countDocuments();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const carsToday = await Log.countDocuments({ entryTime: { $gte: startOfToday } });
    res.json({ occupiedSlots, totalSlots, carsToday });
});

app.get('/api/logs', async (req, res) => {
    const logs = await Log.find().sort({ entryTime: -1 }); 
    res.json(logs);
});

app.post('/api/park', async (req, res) => {
    const { vehiclePlate, vehicleType } = req.body;
    if (!vehiclePlate) return res.status(400).json({ message: 'License plate required' });

    const availableSlot = await Slot.findOne({ isOccupied: false });
    if (availableSlot) {
        const newLog = new Log({ vehiclePlate, vehicleType, slotId: availableSlot.id });
        await newLog.save();

        availableSlot.isOccupied = true;
        availableSlot.vehiclePlate = vehiclePlate;
        availableSlot.vehicleType = vehicleType;
        availableSlot.activeLogId = newLog._id;
        await availableSlot.save();

        res.json({ success: true, slot: availableSlot });
    } else {
        res.status(400).json({ success: false, message: 'Parking is completely full!' });
    }
});

app.post('/api/leave', async (req, res) => {
    const { slotId } = req.body;
    const slot = await Slot.findOne({ id: parseInt(slotId) });
    
    if (slot && slot.isOccupied) {
        let receiptData = null;

        if (slot.activeLogId) {
            const log = await Log.findById(slot.activeLogId);
            

            if (!log) {
                
                slot.isOccupied = false;
                slot.vehiclePlate = null;
                slot.vehicleType = null;
                slot.activeLogId = null;
                await slot.save();
                return res.status(404).json({ success: false, message: 'Parking log was missing, but the slot has been freed up.' });
            }
        

            const exitTime = new Date();
            
        
            const durationMs = exitTime - log.entryTime;
            let durationHours = Math.ceil(durationMs / (1000 * 60 * 60)); 
            if (durationHours < 1) durationHours = 1; 

    
            const rate = slot.vehicleType === 'Bike' ? 20 : 50; 
            const totalCost = durationHours * rate;

            log.exitTime = exitTime;
            log.cost = totalCost;
            await log.save();

        
            receiptData = {
                plate: log.vehiclePlate,
                type: log.vehicleType,
                slot: log.slotId,
                entry: log.entryTime,
                exit: exitTime,
                duration: durationHours,
                rate: rate,
                total: totalCost
            };
        }

        slot.isOccupied = false;
        slot.vehiclePlate = null;
        slot.vehicleType = null;
        slot.activeLogId = null;
        await slot.save();

        res.json({ success: true, slot, receipt: receiptData });
    } else {
        res.status(400).json({ success: false, message: 'Slot is already empty.' });
    }
});

app.get('/api/greeting', async (req, res) => {
    try {
        
        const occupiedSlots = await Slot.countDocuments({ isOccupied: true });
        const totalSlots = await Slot.countDocuments();
        const currentHour = new Date().getHours();
        
        let timeOfDay = 'morning';
        if (currentHour >= 12 && currentHour < 17) timeOfDay = 'afternoon';
        if (currentHour >= 17 || currentHour < 5) timeOfDay = 'night';

    
        const prompt = `
            You are the witty, friendly AI brain of a smart parking garage. 
            It is currently the ${timeOfDay}. 
            The garage has ${occupiedSlots} out of ${totalSlots} slots filled.
            Write a single, punchy 1-2 sentence welcome message for a driver pulling up to the screen. 
            Be creative, conversational, and mention the time of day or how busy the lot is. Do not use emojis.
        `;


        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();

        res.json({ message: text });
    } catch (error) {
        console.error("AI Greeting Error:", error);

        res.json({ message: "Welcome to the Smart Parking System! Find an empty slot and park." });
    }
});
app.listen(PORT, () => {
    console.log(`Smart Parking Server running at http://localhost:${PORT}`);
});