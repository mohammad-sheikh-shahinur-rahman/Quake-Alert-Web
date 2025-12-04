# 🌍 ভূমিকম্প অ্যালার্ট (Bhumikompo Alert)

A real-time, AI-powered earthquake tracking and safety application built for Bangladesh and Bengali-speaking users. This app provides live earthquake updates, custom geographic alerts, and AI-driven safety advice using the Google Gemini API.

## 👨‍💻 Developer / Creator

**Designed and Developed by [Mohammad Sheikh Shahinur Rahman](https://shahinurrahman.com/)**

---

## ✨ Key Features

### 📡 Real-Time Tracking
- **Live Data:** Fetches real-time data from the USGS (United States Geological Survey).
- **Bangla UI:** Fully localized interface in Bengali.
- **Filtering & Sorting:** Filter by magnitude, time range (6h, 12h, 24h), and event type. Sort by time or severity.
- **Search:** Search historical earthquake data by city or country name.

### 🗺️ Interactive Map View
- **Visual Markers:** Dynamic markers change size and color based on earthquake magnitude.
- **Alert Zones:** Users can define custom circular zones (e.g., Home, Office). If an earthquake occurs within the radius, the app triggers an alert.
- **AI-Powered Zone Creation:** Capture a photo of a location, and Gemini AI will identify the place and create an alert zone automatically.
- **Layers:** Switch between Standard, Satellite, and Dark mode map styles.
- **User Location:** Real-time "Blue Dot" tracking of the user's location.

### 🚨 Alerts & Safety
- **Custom Notifications:** Audio sirens and visual alerts when an earthquake enters your defined zones.
- **Voice Alert (TTS):** The app speaks out alert details in Bangla (Text-to-Speech).
- **SOS Siren:** A dedicated emergency tool that plays a loud siren and flashes the screen to attract rescue teams.
- **Emergency Kit Checklist:** Interactive checklist for disaster preparedness (Water, First Aid, etc.).

### 🤖 AI Intelligence (Powered by Gemini)
- **Safety Chatbot:** Ask questions like "What to do if I am on the 10th floor?" and get instant answers in Bangla.
- **Seismic Analysis:** AI analyzes recent quake patterns and provides a summary.
- **Image Recognition:** Identifies locations from camera photos to set up alert zones.

## 🛠️ Tech Stack

- **Frontend:** React 19, TypeScript
- **Styling:** Tailwind CSS
- **Maps:** Leaflet, React-Leaflet
- **AI:** Google GenAI SDK (Gemini 2.5 Flash)
- **Icons:** Lucide React
- **Data Source:** USGS Earthquake Hazards Program API

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- A Google AI Studio API Key (for Gemini features)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/shahinurrahman/bhumikompo-alert.git
    cd bhumikompo-alert
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure API Key:**
    *   Create a `.env` file in the root directory.
    *   Add your Gemini API key:
        ```env
        API_KEY=your_google_ai_studio_api_key_here
        ```
    *   *Note: In the current web-container environment, the key is accessed via `process.env.API_KEY`.*

4.  **Run the application:**
    ```bash
    npm start
    ```
    Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

## 📱 Permissions

The app requests the following permissions for full functionality:
- **Geolocation:** To show your position on the map and calculate distances to earthquakes.
- **Camera:** To capture images for AI location identification.

## 📄 License

This project is created by [Mohammad Sheikh Shahinur Rahman](https://shahinurrahman.com/). All rights reserved.