# 🅿️ Smart Parking SaaS Platform

A full-stack, multi-tenant Software-as-a-Service (SaaS) solution designed to modernize parking garage operations. Featuring **Google Gemini AI** for dynamic user interactions, **Twilio SMS** for e-ticketing, and dynamic **UPI QR Codes** for frictionless payments.

![Smart Parking UI](https://img.shields.io/badge/UI-Glassmorphism-blue?style=flat-square)
![Architecture](https://img.shields.io/badge/Architecture-Multi--Tenant-success?style=flat-square)
![Status](https://img.shields.io/badge/Status-Active-brightgreen?style=flat-square)

---

## 🚀 Key Features

* **Multi-Tenant Architecture:** Securely onboard multiple independent parking garages. Each garage has fully isolated data, slots, and revenue metrics secured by JWT authentication.
* **SMS E-Ticketing:** Automatically dispatches a welcome text message to the driver's phone upon entry via the Twilio API.
* **Frictionless UPI Payments:** Generates dynamic, exact-amount UPI QR codes on the checkout receipt for instant scanning via GPay, PhonePe, or Paytm.
* **Three-Tier Dashboard System:**
  * **1. Kiosk Portal (`index.html`):** For attendants to log vehicle plates, types, and phone numbers with realistic CSS/audio animations.
  * **2. Garage Admin (`admin.html`):** Role-based dashboard for garage owners to view live occupancy, daily revenue, searchable parking logs, and print receipts.
  * **3. Superadmin Command Center (`superadmin.html`):** The SaaS master view tracking global platform revenue, total vehicles processed, and active client garages.
* **Modern UI/UX:** Fully responsive, dark/light mode toggleable interface built with Tailwind CSS, featuring glassmorphism elements and Web Audio API sound effects.

---

## 🛠️ Technology Stack

**Frontend:**
* HTML5, CSS3, Vanilla JavaScript
* Tailwind CSS (for rapid, utility-first styling)
* QRious.js (for client-side QR code generation)

**Backend:**
* Node.js & Express.js (RESTful API architecture)
* JSON Web Tokens (JWT) & Bcrypt (Secure Auth & Password Hashing)

**Database:**
* MongoDB Atlas & Mongoose ODM (NoSQL Schema Management)

**Third-Party Integrations:**
* Twilio Programmable SMS API

---

## ⚙️ Local Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/YourUsername/smart-parking-system.git](https://github.com/YourUsername/smart-parking-system.git)
   cd smart-parking-system