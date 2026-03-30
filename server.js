const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
// 1. THIS MUST COME FIRST to load the .env file!
require('dotenv').config(); 

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const twilio = require('twilio');

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const app = express();
const PORT = 3000;
// ... rest of your code

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("Connected to MongoDB Atlas"))
    .catch(err => console.error("MongoDB connection error:", err));

// --- 1. SCHEMAS ---
const garageSchema = new mongoose.Schema({
    name: { type: String, required: true },
    location: { type: String, required: true },
    totalSlots: { type: Number, required: true },
    pricing: { bikeRate: { type: Number, default: 20 }, carRate: { type: Number, default: 50 } },
    createdAt: { type: Date, default: Date.now }
});

const slotSchema = new mongoose.Schema({
    garageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Garage', required: true },
    slotNumber: { type: String, required: true },
    isOccupied: { type: Boolean, default: false },
    vehiclePlate: { type: String, default: null },
    vehicleType: { type: String, default: null },
    activeLogId: { type: mongoose.Schema.Types.ObjectId, ref: 'Log', default: null } 
});

const logSchema = new mongoose.Schema({
    garageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Garage', required: true },
    vehiclePlate: String,
    vehicleType: String,
    phoneNumber: { type: String, default: null }, // <-- NEW
    slotId: { type: mongoose.Schema.Types.ObjectId, ref: 'Slot' },
    entryTime: { type: Date, default: Date.now },
    exitTime: { type: Date, default: null },
    cost: { type: Number, default: 0 } 
});

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['garage_admin', 'attendant'], default: 'attendant' },
    garageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Garage', required: true }
});

const Garage = mongoose.model('Garage', garageSchema);
const Slot = mongoose.model('Slot', slotSchema);
const Log = mongoose.model('Log', logSchema);
const User = mongoose.model('User', userSchema);

// --- 2. SECURITY MIDDLEWARE ---
// This locks down the API so only logged-in users can use it
const requireAuth = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'No token, authorization denied' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_super_secret_key');
        req.user = decoded; 
        next(); 
    } catch (err) {
        res.status(401).json({ message: 'Token is not valid' });
    }
};

// --- 3. AUTHENTICATION ROUTES ---
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, role, garageId } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ message: 'User already exists' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({ email, password: hashedPassword, role, garageId });
        await newUser.save();
        res.status(201).json({ success: true, message: 'User created successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

        const token = jwt.sign(
            { id: user._id, role: user.role, garageId: user.garageId }, 
            process.env.JWT_SECRET || 'fallback_super_secret_key', 
            { expiresIn: '1d' }
        );

        res.json({ success: true, token, user: { email: user.email, role: user.role, garageId: user.garageId } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// --- 4. SAAS ONBOARDING ROUTE ---
app.post('/api/saas/register-garage', async (req, res) => {
    try {
        const { name, location, totalSlots, bikeRate, carRate, slotPrefix } = req.body;
        const newGarage = new Garage({ name, location, totalSlots, pricing: { bikeRate, carRate } });
        await newGarage.save();

        let slotsToCreate = [];
        const prefix = slotPrefix || 'P'; 
        for (let i = 1; i <= totalSlots; i++) {
            slotsToCreate.push({ garageId: newGarage._id, slotNumber: `${prefix}-${i}` });
        }
        await Slot.insertMany(slotsToCreate);

        res.status(201).json({ success: true, message: 'New Garage onboarded successfully!', garage: newGarage });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
app.get('/api/saas/platform-stats', async (req, res) => {
    try {
        // Fetch all garages onboarded to the SaaS
        const garages = await Garage.find().sort({ createdAt: -1 });
        const totalSlots = await Slot.countDocuments();
        
        // Calculate total platform revenue and volume across ALL garages
        const logs = await Log.find();
        const totalRevenue = logs.reduce((sum, log) => sum + (log.cost || 0), 0);
        const carsProcessed = logs.length;

        res.json({ 
            success: true, 
            stats: { totalGarages: garages.length, totalSlots, totalRevenue, carsProcessed },
            garages 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
// 🗑️ DELETE GARAGE ROUTE
app.delete('/api/saas/delete-garage/:id', async (req, res) => {
    try {
        const garageId = req.params.id;
        
        // 1. Delete the garage profile
        await Garage.findByIdAndDelete(garageId);
        
        // 2. Delete all slots associated with this garage
        await Slot.deleteMany({ garageId });
        
        // 3. (Optional) Delete history logs if you want a full wipe
        // await Log.deleteMany({ garageId });

        res.json({ success: true, message: "Garage and slots deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
// --- 5. SECURE PARKING ROUTES ---
app.get('/api/slots', requireAuth, async (req, res) => {
    const garageId = req.user.garageId; // Uses the secure ID from the token!
    const slots = await Slot.find({ garageId }).sort({ slotNumber: 1 });
    res.json(slots);
});

app.get('/api/stats', requireAuth, async (req, res) => {
    const garageId = req.user.garageId;
    const occupiedSlots = await Slot.countDocuments({ garageId, isOccupied: true });
    const totalSlots = await Slot.countDocuments({ garageId });
    
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const carsToday = await Log.countDocuments({ garageId, entryTime: { $gte: startOfToday } });
    
    res.json({ occupiedSlots, totalSlots, carsToday });
});

app.get('/api/logs', requireAuth, async (req, res) => {
    const garageId = req.user.garageId;
    const logs = await Log.find({ garageId }).sort({ entryTime: -1 }); 
    res.json(logs);
});

app.post('/api/park', requireAuth, async (req, res) => {
    const { vehiclePlate, vehicleType, phoneNumber } = req.body; // Extract phoneNumber
    const garageId = req.user.garageId; 

    if (!vehiclePlate) return res.status(400).json({ message: 'License plate required' });

    const availableSlot = await Slot.findOne({ garageId, isOccupied: false });
    if (availableSlot) {
        const newLog = new Log({ 
            garageId, 
            vehiclePlate, 
            vehicleType, 
            phoneNumber, // Save to database
            slotId: availableSlot._id 
        });
        await newLog.save();

        availableSlot.isOccupied = true;
        availableSlot.vehiclePlate = vehiclePlate;
        availableSlot.vehicleType = vehicleType;
        availableSlot.activeLogId = newLog._id;
        await availableSlot.save();

        // --- FIRE THE SMS E-TICKET ---
        if (phoneNumber && process.env.TWILIO_PHONE_NUMBER) {
            try {
                const garage = await Garage.findById(garageId);
                await twilioClient.messages.create({
                    body: `🅿️ Welcome to ${garage.name}! Your ${vehicleType} (${vehiclePlate}) is securely parked in slot ${availableSlot.slotNumber}.`,
                    from: process.env.TWILIO_PHONE_NUMBER,
                    to: phoneNumber
                });
                console.log(`✅ SMS successfully sent to ${phoneNumber}`);
            } catch (smsError) {
                console.error("⚠️ Failed to send SMS:", smsError.message);
                // We don't fail the whole parking request just because a text failed
            }
        }

        res.json({ success: true, slot: availableSlot });
    } else {
        res.status(400).json({ success: false, message: 'Parking is completely full!' });
    }
});
// ➕ OVERFLOW CAPACITY ROUTE
app.post('/api/expand-capacity', async (req, res) => {
    try {
        const { garageId, amount } = req.body;
        const garage = await Garage.findById(garageId);
        
        if (!garage) return res.status(404).json({ success: false, message: "Garage not found" });

        const currentTotal = garage.totalSlots;
        const newTotal = currentTotal + parseInt(amount);

        // Generate the new slots (e.g., A-11, A-12, etc.)
        const newSlots = [];
        for (let i = currentTotal + 1; i <= newTotal; i++) {
            newSlots.push({
                garageId: garage._id,
                slotNumber: `A-${i}`,
                isOccupied: false
            });
        }
        
        // Save them to the database
        await Slot.insertMany(newSlots);
        
        // Update the garage's master capacity
        garage.totalSlots = newTotal;
        await garage.save();

        res.json({ success: true, newTotal });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
app.post('/api/leave', requireAuth, async (req, res) => {
    const { slotId } = req.body;
    const slot = await Slot.findById(slotId);
    
    if (slot && slot.isOccupied && slot.garageId.toString() === req.user.garageId) {
        let receiptData = null;

        if (slot.activeLogId) {
            const log = await Log.findById(slot.activeLogId);
            if (!log) {
                slot.isOccupied = false;
                slot.vehiclePlate = null;
                slot.vehicleType = null;
                slot.activeLogId = null;
                await slot.save();
                return res.status(404).json({ success: false, message: 'Parking log missing, but slot freed.' });
            }

            const exitTime = new Date();
            const durationMs = exitTime - log.entryTime;
            let durationHours = Math.ceil(durationMs / (1000 * 60 * 60)); 
            if (durationHours < 1) durationHours = 1; 

            const garage = await Garage.findById(slot.garageId);
            const rate = slot.vehicleType === 'Bike' ? garage.pricing.bikeRate : garage.pricing.carRate; 
            const totalCost = durationHours * rate;

            log.exitTime = exitTime;
            log.cost = totalCost;
            await log.save();

            receiptData = {
                plate: log.vehiclePlate,
                type: log.vehicleType,
                slot: slot.slotNumber,
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
        res.status(400).json({ success: false, message: 'Slot is already empty or unauthorized.' });
    }
});

app.listen(PORT, () => {
    console.log(`Smart Parking Server running at http://localhost:${PORT}`);
});