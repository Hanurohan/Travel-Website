// 1. Lenis Scrolling (Guarded)
let lenis = null;
if (typeof Lenis !== "undefined") {
  try {
    lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true
    });

    function raf(time) {
      if (lenis) lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
  } catch (err) {
    console.warn("Lenis bypassed:", err);
  }
}

// 2. Hero Text Animation (Guarded)
if (typeof gsap !== "undefined") {
  try {
    if (typeof ScrollTrigger !== "undefined") {
      gsap.registerPlugin(ScrollTrigger);
    }
    gsap.from("[data-gsap='hero-text']", {
      y: 60,
      opacity: 0,
      duration: 1.4,
      ease: "power3.out"
    });
  } catch (err) {
    console.warn("GSAP bypassed:", err);
  }
}

// 3. Feature Showcase
const captions = document.querySelectorAll(".caption-card");
const featureImages = document.querySelectorAll(".feature-img");

function activateSection(targetCard) {
  captions.forEach((c) => c.classList.remove("active"));
  targetCard.classList.add("active");

  const targetImgId = targetCard.getAttribute("data-img-target");
  featureImages.forEach((img) => {
    if (img.id === targetImgId) {
      img.classList.add("active");
    } else {
      img.classList.remove("active");
    }
  });
}

captions.forEach((caption) => {
  if (typeof ScrollTrigger !== "undefined") {
    try {
      ScrollTrigger.create({
        trigger: caption,
        start: "top 65%",
        end: "bottom 35%",
        onEnter: () => activateSection(caption),
        onEnterBack: () => activateSection(caption)
      });
    } catch (e) {}
  }
  caption.addEventListener("mouseenter", () => activateSection(caption));
});

// 4. 3D Mouse Tilt
const tiltCards = document.querySelectorAll(".tilt-card");
tiltCards.forEach((card) => {
  card.addEventListener("mousemove", (e) => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    card.style.transform = `perspective(800px) rotateX(${-y / 25}deg) rotateY(${x / 25}deg) translateY(-2px)`;
  });

  card.addEventListener("mouseleave", () => {
    card.style.transform = "perspective(800px) rotateX(0deg) rotateY(0deg) translateY(0)";
  });
});

// 5. Map & Routing Engine
let map = null;
let routingControl = null;
let mapInitialized = false;

const mapDrawerWrapper = document.getElementById("mapDrawerWrapper");
const liveMapKm = document.getElementById("liveMapKm");
const mapStatusTag = document.getElementById("mapStatusTag");

const GEO_CACHE = {
  "chennai": [13.0827, 80.2707],
  "ooty": [11.4102, 76.6950],
  "coimbatore": [11.0168, 76.9558],
  "kodaikanal": [10.2381, 77.4892],
  "valparai": [10.3262, 76.9554],
  "pondicherry": [11.9416, 79.8083],
  "munnar": [10.0889, 77.0595],
  "mettupalayam": [11.3004, 76.9429],
  "coonoor": [11.3530, 76.7959],
  "madurai": [9.9252, 78.1198],
  "rameswaram": [9.2876, 79.3129],
  "yercaud": [11.7753, 78.2093],
  "bangalore": [12.9716, 77.5946],
  "karaikal": [10.9254, 79.8380],
  "thanjavur": [10.7870, 79.1378]
};

function initMapIfNeeded() {
  const mapEl = document.getElementById("tripMap");
  if (!mapEl || typeof L === "undefined") return;

  if (map || mapEl._leaflet_id) {
    if (map) map.invalidateSize();
    return;
  }

  try {
    map = L.map("tripMap", { 
      zoomControl: false,
      attributionControl: false 
    }).setView([11.1271, 78.6569], 7);

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      crossOrigin: true
    }).addTo(map);

    mapInitialized = true;
  } catch (err) {
    console.warn("Leaflet container check:", err);
  }
}

function openMapDrawer() {
  if (mapDrawerWrapper) mapDrawerWrapper.classList.add("open");
  if (mapStatusTag) mapStatusTag.innerText = "Interactive Navigation Active";
  setTimeout(() => {
    initMapIfNeeded();
    if (map) map.invalidateSize();
  }, 250);
}

async function geocodePlace(query) {
  if (!query || query.trim().length < 2 || typeof L === "undefined") return null;
  const clean = query.trim().toLowerCase();

  for (const [key, coords] of Object.entries(GEO_CACHE)) {
    if (clean.includes(key) || key.includes(clean)) {
      return L.latLng(coords[0], coords[1]);
    }
  }

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&countrycodes=in&q=${encodeURIComponent(query)}`);
    const data = await res.json();
    if (data && data.length > 0) {
      return L.latLng(parseFloat(data[0].lat), parseFloat(data[0].lon));
    }
  } catch (e) {
    console.warn("Geocoding failed for:", query);
  }
  return null;
}

async function calculateAndRenderMapRoute() {
  openMapDrawer();

  const originVal = originInput ? originInput.value.trim() : "";
  const destVal = destInput ? destInput.value.trim() : "";
  if (!originVal) return;

  const waypoints = [];
  const startCoord = await geocodePlace(originVal);
  if (startCoord) waypoints.push(startCoord);

  for (const stop of customStops) {
    const stopCoord = await geocodePlace(stop);
    if (stopCoord) waypoints.push(stopCoord);
  }

  if (destVal) {
    const endCoord = await geocodePlace(destVal);
    if (endCoord) waypoints.push(endCoord);
  }

  if (routingControl && map) {
    try {
      map.removeControl(routingControl);
    } catch(e) {}
    routingControl = null;
  }

  if (waypoints.length < 2) {
    if (waypoints.length === 1 && map) {
      map.setView(waypoints[0], 12);
      L.marker(waypoints[0], {
        icon: L.divIcon({ className: "custom-gold-pin" })
      }).addTo(map);
    }
    return;
  }

  if (typeof L.Routing !== "undefined") {
    routingControl = L.Routing.control({
      waypoints: waypoints,
      lineOptions: {
        styles: [{ color: "#D4AF37", weight: 5, opacity: 0.95 }]
      },
      createMarker: (i, wp) => L.marker(wp.latLng, {
        icon: L.divIcon({ className: "custom-gold-pin" })
      }),
      addWaypoints: false,
      draggableWaypoints: false,
      fitSelectedRoutes: true,
      show: false
    }).addTo(map);

    routingControl.on("routesfound", (e) => {
      const distanceMeters = e.routes[0].summary.totalDistance;
      const distanceKm = Math.round(distanceMeters / 1000);
      if (liveMapKm) liveMapKm.innerText = `${distanceKm} KM`;
      estimatedKm = distanceKm;
      if (estimatedKmInput) estimatedKmInput.value = distanceKm;
      updatePriceDisplay();
    });

    routingControl.on("routingerror", () => {
      const directDist = Math.round(waypoints[0].distanceTo(waypoints[waypoints.length - 1]) / 1000 * 1.25);
      if (liveMapKm) liveMapKm.innerText = `${directDist} KM`;
      estimatedKm = directDist;
      if (estimatedKmInput) estimatedKmInput.value = directDist;
      updatePriceDisplay();
    });
  }
}

// 6. Autocomplete With Fuzzy Search
const POPULAR_LOCATIONS = [
  { main: "Chennai", sub: "Tamil Nadu, India", aliases: ["madras", "channai", "chenai"] },
  { main: "Ooty", sub: "The Nilgiris, Tamil Nadu", aliases: ["ootie", "udhagamandalam", "uti", "otty"] },
  { main: "Coimbatore", sub: "Tamil Nadu, India", aliases: ["kovai", "coimbatur", "combator", "cbe"] },
  { main: "Kodaikanal", sub: "Dindigul, Tamil Nadu", aliases: ["kodai", "kodaiknal", "kodaikanel"] },
  { main: "Valparai", sub: "Coimbatore, Tamil Nadu", aliases: ["valpari", "valpaarai", "walparai"] },
  { main: "Pondicherry", sub: "Puducherry, India", aliases: ["pondy", "pondi", "puducheri"] },
  { main: "Munnar", sub: "Idukki, Kerala", aliases: ["munar", "moonar"] },
  { main: "Mettupalayam", sub: "Coimbatore, Tamil Nadu", aliases: ["metupalayam", "mtp"] },
  { main: "Coonoor", sub: "The Nilgiris, Tamil Nadu", aliases: ["conoor", "kunur", "koonoor"] },
  { main: "Madurai", sub: "Tamil Nadu, India", aliases: ["madura", "mathurai"] },
  { main: "Rameswaram", sub: "Ramanathapuram, Tamil Nadu", aliases: ["rameshwaram", "ramesvaram"] },
  { main: "Yercaud", sub: "Salem, Tamil Nadu", aliases: ["yercad", "yerkad"] },
  { main: "Bangalore", sub: "Karnataka, India", aliases: ["bengaluru", "banglore", "blr"] },
  { main: "Karaikal", sub: "Puducherry, India", aliases: ["karikal", "karekal"] },
  { main: "Thanjavur", sub: "Tamil Nadu, India", aliases: ["tanjore", "thanjavoor"] }
];

function levenshteinDistance(s1, s2) {
  const a = s1.toLowerCase();
  const b = s2.toLowerCase();
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function getFuzzyMatches(query) {
  const q = query.trim().toLowerCase();
  const results = [];

  POPULAR_LOCATIONS.forEach(loc => {
    const mainLower = loc.main.toLowerCase();
    if (mainLower.includes(q)) {
      results.push({ ...loc, score: 0, isCorrection: false });
      return;
    }
    if (loc.aliases && loc.aliases.some(alias => alias.includes(q) || q.includes(alias))) {
      results.push({ ...loc, score: 0.5, isCorrection: false });
      return;
    }
    const dist = levenshteinDistance(q, mainLower);
    const maxThreshold = q.length <= 4 ? 1 : q.length <= 7 ? 2 : 3;
    if (dist <= maxThreshold) {
      results.push({ ...loc, score: dist, isCorrection: true });
    }
  });

  return results.sort((a, b) => a.score - b.score);
}

async function fetchPlaceSuggestions(query) {
  if (!query || query.trim().length < 2) return [];
  const localFuzzy = getFuzzyMatches(query);

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&countrycodes=in&limit=5&q=${encodeURIComponent(query)}`
    );
    const data = await res.json();
    const onlineMatches = data.map(place => {
      const parts = place.display_name.split(",");
      return {
        main: parts[0].trim(),
        sub: parts.slice(1, 3).join(",").trim(),
        isCorrection: false
      };
    });

    const combined = [...localFuzzy, ...onlineMatches];
    const unique = Array.from(new Map(combined.map(item => [item.main.toLowerCase(), item])).values());
    return unique.slice(0, 6);
  } catch (err) {
    return localFuzzy.slice(0, 5);
  }
}

function setupAutocomplete(inputEl, listEl, onSelectCallback) {
  if (!inputEl || !listEl) return;
  let timer;
  let activeIndex = -1;

  function highlightItem(items) {
    items.forEach((item, idx) => {
      if (idx === activeIndex) {
        item.classList.add("selected");
        item.scrollIntoView({ block: "nearest" });
      } else {
        item.classList.remove("selected");
      }
    });
  }

  inputEl.addEventListener("input", () => {
    clearTimeout(timer);
    activeIndex = -1;
    const val = inputEl.value.trim();

    if (val.length < 2) {
      listEl.innerHTML = "";
      listEl.classList.add("hidden");
      return;
    }

    timer = setTimeout(async () => {
      const suggestions = await fetchPlaceSuggestions(val);
      listEl.innerHTML = "";

      if (suggestions.length === 0) {
        listEl.classList.add("hidden");
        return;
      }

      suggestions.forEach((item, index) => {
        const li = document.createElement("li");
        li.className = "suggestion-item";
        li.setAttribute("data-index", index);

        const correctionTag = item.isCorrection 
          ? `<span class="typo-tag">Did you mean?</span>` 
          : `<span class="suggestion-pin">📍</span>`;

        li.innerHTML = `
          ${correctionTag}
          <div>
            <span class="suggestion-main">${item.main}</span>
            <span class="suggestion-sub">${item.sub}</span>
          </div>
        `;

        li.addEventListener("click", () => {
          inputEl.value = item.main;
          listEl.innerHTML = "";
          listEl.classList.add("hidden");
          activeIndex = -1;
          if (onSelectCallback) onSelectCallback(item.main);
        });

        listEl.appendChild(li);
      });

      listEl.classList.remove("hidden");
    }, 200);
  });

  inputEl.addEventListener("keydown", (e) => {
    const items = listEl.querySelectorAll(".suggestion-item");
    if (items.length === 0 || listEl.classList.contains("hidden")) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % items.length;
      highlightItem(items);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + items.length) % items.length;
      highlightItem(items);
    } else if (e.key === "Enter") {
      if (activeIndex > -1 && items[activeIndex]) {
        e.preventDefault();
        items[activeIndex].click();
      }
    } else if (e.key === "Escape") {
      listEl.classList.add("hidden");
      activeIndex = -1;
    }
  });

  document.addEventListener("click", (e) => {
    if (!inputEl.contains(e.target) && !listEl.contains(e.target)) {
      listEl.classList.add("hidden");
      activeIndex = -1;
    }
  });
}

// 7. Databases
const HOTEL_DATABASE = [
  { id: "h1", name: "Fortune Resort Sullivan Court", destination: "Ooty", tier: "Luxury", rate: 9200, rating: "4.8 ★", features: "Valley View, Heated Suites, Wellness Spa, Fine Dining" },
  { id: "h2", name: "Sterling Ooty Elk Hill", destination: "Ooty", tier: "Luxury", rate: 8500, rating: "4.7 ★", features: "Panoramic Balconies, Bonfire Deck, Organic Dining" },
  { id: "h3", name: "Savoy - IHCL SeleQtions", destination: "Ooty", tier: "Luxury", rate: 14500, rating: "4.9 ★", features: "180-Year Colonial Heritage, Fireplace Suites, High Tea" },
  { id: "h4", name: "Club Mahindra Derby Green", destination: "Ooty", tier: "Premium", rate: 5800, rating: "4.5 ★", features: "Racecourse Views, Equestrian Grounds, Lawn Cafe" },
  { id: "h5", name: "Sinclairs Retreat", destination: "Ooty", tier: "Premium", rate: 4900, rating: "4.4 ★", features: "Highest Peak Vantage, Garden Gazebos, Badminton" },
  { id: "h6", name: "Hotel Lakeview Ooty", destination: "Ooty", tier: "Standard", rate: 2800, rating: "4.1 ★", features: "Independent Cottages, Private Patio, Lake Proximity" },
  { id: "h7", name: "Heritage Villa by the Woods", destination: "Kodaikanal", tier: "Premium", rate: 4500, rating: "4.6 ★", features: "Pine Forest Walkways, Campfire Patios, Butler" },
  { id: "h8", name: "The Tamara Kodai", destination: "Kodaikanal", tier: "Luxury", rate: 11000, rating: "4.9 ★", features: "French Colonial Luxury, Heated Infinity Pool, Spa" }
];

const DEFAULT_TIER_RATES = { Standard: 2500, Premium: 4500, Luxury: 8500 };
const FLEET_RATES = {
  force_14: { title: "14-Seater Pricing Structure", name: "14-Seater Luxury Traveller", perKm: 26, dailyRate: 7500 },
  force_28: { title: "28-Seater Pricing Structure", name: "28-Seater Executive Coach", perKm: 32, dailyRate: 8000 },
  flight_transfer: { title: "Flight Transfer Combo", name: "Flight Transfer + Van", fixedBase: 32000 }
};

// 8. Customizer State
let selectedTransport = null;
let selectedTransportLabel = "No Fleet Selected";
let billingType = null; 
let rentalDays = 0;
let estimatedKm = 0;
let customStops = [];

let selectedStayTier = null;
let selectedHotel = null;
let guestsCount = 2;
let roomsCount = 1;
let nights = 0;
let calculatedTotal = 0;

// UI Queries
const tariffDrawer = document.getElementById("tariffDrawer");
const selectedFleetTitle = document.getElementById("selectedFleetTitle");
const dailyRateText = document.getElementById("dailyRateText");
const kmRateText = document.getElementById("kmRateText");
const dailyOptionLabel = document.getElementById("dailyOptionLabel");
const kmOptionLabel = document.getElementById("kmOptionLabel");
const dailyInputGroup = document.getElementById("dailyInputGroup");
const kmInputGroup = document.getElementById("kmInputGroup");
const rentalDaysInput = document.getElementById("rentalDaysInput");
const estimatedKmInput = document.getElementById("estimatedKmInput");

const stopsList = document.getElementById("stopsList");
const stopInput = document.getElementById("stopInput");
const addStopBtn = document.getElementById("addStopBtn");
const originInput = document.getElementById("originInput");
const destInput = document.getElementById("destInput");

const originSuggestions = document.getElementById("originSuggestions");
const destSuggestions = document.getElementById("destSuggestions");
const stopSuggestions = document.getElementById("stopSuggestions");

const guestsInput = document.getElementById("guestsInput");
const roomsInput = document.getElementById("roomsInput");
const nightsInput = document.getElementById("nightsInput");
const selectedHotelBadge = document.getElementById("selectedHotelBadge");
const badgeTier = document.getElementById("badgeTier");
const badgeHotelName = document.getElementById("badgeHotelName");
const badgePrice = document.getElementById("badgePrice");
const clearSelectedHotelBtn = document.getElementById("clearSelectedHotelBtn");
const openHotelsModalBtn = document.getElementById("openHotelsModalBtn");

const hotelModal = document.getElementById("hotelModal");
const closeHotelModalBtn = document.getElementById("closeHotelModalBtn");
const hotelCardsGrid = document.getElementById("hotelCardsGrid");
const modalTabs = document.querySelectorAll(".modal-tab");

const summaryTransportName = document.getElementById("summaryTransportName");
const summaryBillingDesc = document.getElementById("summaryBillingDesc");
const baseCostText = document.getElementById("baseCostText");
const stopsCount = document.getElementById("stopsCount");
const stopsCostText = document.getElementById("stopsCostText");
const summaryStayTitle = document.getElementById("summaryStayTitle");
const summaryStayDesc = document.getElementById("summaryStayDesc");
const stayCostText = document.getElementById("stayCostText");
const addonCostText = document.getElementById("addonCostText");
const totalCostText = document.getElementById("totalCostText");
const whatsappBtn = document.getElementById("whatsappBtn");

// Set up autocomplete
setupAutocomplete(originInput, originSuggestions, () => {
  calculateAndRenderMapRoute();
});

setupAutocomplete(destInput, destSuggestions, () => {
  calculateAndRenderMapRoute();
});

setupAutocomplete(stopInput, stopSuggestions, (chosenPlace) => {
  if (stopInput) stopInput.value = chosenPlace;
});

if (originInput) {
  originInput.addEventListener("mouseenter", openMapDrawer);
  originInput.addEventListener("focus", openMapDrawer);
}
if (destInput) {
  destInput.addEventListener("mouseenter", openMapDrawer);
  destInput.addEventListener("focus", openMapDrawer);
}

let debounceTimer;
function triggerRouteCalculation() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(calculateAndRenderMapRoute, 750);
}
if (originInput) originInput.addEventListener("input", triggerRouteCalculation);
if (destInput) destInput.addEventListener("input", triggerRouteCalculation);

if (guestsInput) {
  guestsInput.addEventListener("input", (e) => {
    guestsCount = Math.max(1, parseInt(e.target.value) || 1);
    roomsCount = Math.ceil(guestsCount / 2);
    if (roomsInput) roomsInput.value = roomsCount;
    updatePriceDisplay();
  });
}

if (nightsInput) {
  nightsInput.addEventListener("input", (e) => {
    nights = Math.max(0, parseInt(e.target.value) || 0);
    updatePriceDisplay();
  });
}

function calculateAddonsTotal() {
  let total = 0;
  document.querySelectorAll(".addon-check:checked").forEach((chk) => {
    total += parseInt(chk.getAttribute("data-price")) || 0;
  });
  return total;
}

// Master Pricing Sync
function updatePriceDisplay() {
  let baseTransportCost = 0;
  let billingDescription = "—";

  if (selectedTransport === "flight_transfer") {
    baseTransportCost = FLEET_RATES.flight_transfer.fixedBase;
    billingDescription = "Fixed Airport Escort Base";
  } else if (selectedTransport && FLEET_RATES[selectedTransport]) {
    const fleet = FLEET_RATES[selectedTransport];
    if (billingType === "per_km") {
      baseTransportCost = fleet.perKm * estimatedKm;
      billingDescription = estimatedKm > 0 ? `₹${fleet.perKm}/km × ${estimatedKm} km (from map)` : "Enter route to get KM";
    } else if (billingType === "daily") {
      baseTransportCost = fleet.dailyRate * rentalDays;
      billingDescription = rentalDays > 0 ? `₹${fleet.dailyRate.toLocaleString("en-IN")}/day × ${rentalDays} days` : "Enter rental days";
    }
  }

  const stopsCost = customStops.length * 1500;

  let roomNightRate = 0;
  let stayTitle = "Accommodation";
  let stayDesc = `${roomsCount} Room${roomsCount > 1 ? "s" : ""} × ${nights} Night${nights > 1 ? "s" : ""} (${guestsCount} Guests)`;

  if (selectedHotel) {
    roomNightRate = selectedHotel.rate;
    stayTitle = selectedHotel.name;
  } else if (selectedStayTier && DEFAULT_TIER_RATES[selectedStayTier]) {
    roomNightRate = DEFAULT_TIER_RATES[selectedStayTier];
    stayTitle = `${selectedStayTier} Stays (Avg Online Est.)`;
  }

  const stayCost = (nights > 0) ? (roomNightRate * roomsCount * nights) : 0;
  const addonsCost = calculateAddonsTotal();

  calculatedTotal = baseTransportCost + stopsCost + stayCost + addonsCost;

  if (summaryTransportName) summaryTransportName.innerText = selectedTransportLabel;
  if (summaryBillingDesc) summaryBillingDesc.innerText = billingDescription;
  if (baseCostText) baseCostText.innerText = "₹" + baseTransportCost.toLocaleString("en-IN");
  
  if (stopsCount) stopsCount.innerText = customStops.length;
  if (stopsCostText) stopsCostText.innerText = "₹" + stopsCost.toLocaleString("en-IN");

  if (summaryStayTitle) summaryStayTitle.innerText = stayCost > 0 ? stayTitle : "Accommodation";
  if (summaryStayDesc) summaryStayDesc.innerText = stayCost > 0 ? stayDesc : "0 Rooms × 0 Nights";
  if (stayCostText) stayCostText.innerText = "₹" + stayCost.toLocaleString("en-IN");

  if (addonCostText) addonCostText.innerText = "₹" + addonsCost.toLocaleString("en-IN");
  if (totalCostText) totalCostText.innerText = "₹" + calculatedTotal.toLocaleString("en-IN");
}

// Hotel Modal
function renderHotelCards(filterTier = "all") {
  if (!hotelCardsGrid) return;
  hotelCardsGrid.innerHTML = "";
  const filtered = filterTier === "all" 
    ? HOTEL_DATABASE 
    : HOTEL_DATABASE.filter(h => h.tier === filterTier);

  filtered.forEach((h) => {
    const card = document.createElement("div");
    card.className = "hotel-item-card";
    card.innerHTML = `
      <div>
        <div class="hotel-card-header">
          <span class="hotel-tag ${h.tier.toLowerCase()}">${h.tier}</span>
          <small style="color:#d4af37; font-weight:600;">${h.rating}</small>
        </div>
        <h4>${h.name}</h4>
        <p class="hotel-location">📍 ${h.destination}</p>
        <p class="hotel-features">${h.features}</p>
      </div>
      <div class="hotel-card-footer">
        <div class="hotel-rate">₹${h.rate.toLocaleString("en-IN")} <span>/ room / nt</span></div>
        <button type="button" class="btn-select-hotel">Select Resort</button>
      </div>
    `;

    card.addEventListener("click", () => {
      selectSpecificHotel(h);
      if (hotelModal) hotelModal.classList.add("hidden");
    });

    hotelCardsGrid.appendChild(card);
  });
}

function selectSpecificHotel(hotel) {
  selectedHotel = hotel;
  selectedStayTier = hotel.tier;

  document.querySelectorAll(".tier-btn").forEach((btn) => {
    if (btn.getAttribute("data-tier") === hotel.tier) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  if (selectedHotelBadge) selectedHotelBadge.classList.remove("hidden");
  if (badgeTier) badgeTier.innerText = hotel.tier;
  if (badgeHotelName) badgeHotelName.innerText = hotel.name;
  if (badgePrice) badgePrice.innerText = `₹${hotel.rate.toLocaleString("en-IN")}/room/night`;

  if (nights === 0) {
    nights = 2;
    if (nightsInput) nightsInput.value = 2;
  }

  updatePriceDisplay();
}

if (clearSelectedHotelBtn) {
  clearSelectedHotelBtn.addEventListener("click", () => {
    selectedHotel = null;
    if (selectedHotelBadge) selectedHotelBadge.classList.add("hidden");
    updatePriceDisplay();
  });
}

if (openHotelsModalBtn) {
  openHotelsModalBtn.addEventListener("click", () => {
    renderHotelCards("all");
    if (hotelModal) hotelModal.classList.remove("hidden");
  });
}

if (closeHotelModalBtn) {
  closeHotelModalBtn.addEventListener("click", () => {
    if (hotelModal) hotelModal.classList.add("hidden");
  });
}

modalTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    modalTabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    renderHotelCards(tab.getAttribute("data-filter"));
  });
});

const tierButtons = document.querySelectorAll(".tier-btn");
tierButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const tier = btn.getAttribute("data-tier");
    if (selectedStayTier === tier && !selectedHotel) {
      btn.classList.remove("active");
      selectedStayTier = null;
      nights = 0;
      if (nightsInput) nightsInput.value = 0;
    } else {
      tierButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      selectedStayTier = tier;
      selectedHotel = null;
      if (selectedHotelBadge) selectedHotelBadge.classList.add("hidden");
      if (nights === 0) {
        nights = 2;
        if (nightsInput) nightsInput.value = 2;
      }
    }
    updatePriceDisplay();
  });
});

// Transport Selection
const transportButtons = document.querySelectorAll(".transport-btn");
transportButtons.forEach((btn) => {
  btn.addEventListener("click", (e) => {
    const currentBtn = e.currentTarget || btn;
    const clickedTransport = currentBtn.getAttribute("data-transport");

    if (!clickedTransport) return;

    if (selectedTransport === clickedTransport) {
      currentBtn.classList.remove("active");
      selectedTransport = null;
      selectedTransportLabel = "No Fleet Selected";
      billingType = null;
      if (tariffDrawer) tariffDrawer.classList.add("hidden");
    } else {
      transportButtons.forEach((b) => b.classList.remove("active"));
      currentBtn.classList.add("active");
      selectedTransport = clickedTransport;
      selectedTransportLabel = currentBtn.querySelector("strong")?.innerText || "Selected Fleet";

      if (selectedTransport === "flight_transfer") {
        if (tariffDrawer) tariffDrawer.classList.add("hidden");
        billingType = null;
      } else {
        if (tariffDrawer) tariffDrawer.classList.remove("hidden");
        const data = FLEET_RATES[selectedTransport];
        if (data) {
          if (selectedFleetTitle) selectedFleetTitle.innerText = data.title;
          if (dailyRateText) dailyRateText.innerText = `Daily Package: ₹${data.dailyRate.toLocaleString("en-IN")} / day`;
          if (kmRateText) kmRateText.innerText = `Per KM Rate: ₹${data.perKm} / km`;
        }

        if (!billingType) {
          billingType = "per_km";
          const kmRadio = document.querySelector("input[value='per_km']");
          if (kmRadio) kmRadio.checked = true;
          if (kmOptionLabel) kmOptionLabel.classList.add("active");
          if (kmInputGroup) kmInputGroup.classList.remove("hidden");
        }
      }
    }
    updatePriceDisplay();
  });
});

document.querySelectorAll("input[name='billingChoice']").forEach((radio) => {
  radio.addEventListener("change", (e) => {
    billingType = e.target.value;
    if (billingType === "daily") {
      if (dailyOptionLabel) dailyOptionLabel.classList.add("active");
      if (kmOptionLabel) kmOptionLabel.classList.remove("active");
      if (dailyInputGroup) dailyInputGroup.classList.remove("hidden");
      if (kmInputGroup) kmInputGroup.classList.add("hidden");
      rentalDays = parseInt(rentalDaysInput?.value) || 1;
      if (rentalDaysInput) rentalDaysInput.value = rentalDays;
    } else {
      if (kmOptionLabel) kmOptionLabel.classList.add("active");
      if (dailyOptionLabel) dailyOptionLabel.classList.remove("active");
      if (kmInputGroup) kmInputGroup.classList.remove("hidden");
      if (dailyInputGroup) dailyInputGroup.classList.add("hidden");
      openMapDrawer();
    }
    updatePriceDisplay();
  });
});

if (rentalDaysInput) {
  rentalDaysInput.addEventListener("input", (e) => {
    rentalDays = Math.max(0, parseInt(e.target.value) || 0);
    updatePriceDisplay();
  });
}

function renderStops() {
  if (!stopsList) return;
  stopsList.innerHTML = "";
  customStops.forEach((stop, index) => {
    const tag = document.createElement("div");
    tag.className = "tag";
    tag.innerHTML = `${stop} <span onclick="removeStop(${index})">&times;</span>`;
    stopsList.appendChild(tag);
  });
  triggerRouteCalculation();
  updatePriceDisplay();
}

if (addStopBtn) {
  addStopBtn.addEventListener("click", () => {
    const val = stopInput?.value.trim();
    if (val) {
      customStops.push(val);
      if (stopInput) stopInput.value = "";
      renderStops();
    }
  });
}

window.removeStop = function(idx) {
  customStops.splice(idx, 1);
  renderStops();
};

document.querySelectorAll(".addon-check").forEach((chk) => {
  chk.addEventListener("change", updatePriceDisplay);
});

// 9. Prompt Extraction
function parseUserPrompt(promptText) {
  const text = promptText.toLowerCase();

  const extracted = {
    origin: null,
    destination: null,
    guestCount: null,
    nights: null,
    fleetType: null,
    isFlightTransfer: false,
    addons: []
  };

  const paxMatch = text.match(/(\d+)\s*(persons|person|people|pax|members|guests)/) || text.match(/(\d+)\s*(of us|including me)/);
  if (paxMatch) {
    extracted.guestCount = parseInt(paxMatch[1]);
  }

  const durationMatch = text.match(/(\d+)\s*(days|day|nights|night)/);
  if (durationMatch) {
    extracted.nights = parseInt(durationMatch[1]);
  }

  if (text.includes("flight") || text.includes("airport") || text.includes("landing")) {
    extracted.isFlightTransfer = true;
  }

  for (const loc of POPULAR_LOCATIONS) {
    const checks = [loc.main.toLowerCase(), ...(loc.aliases || [])];
    for (const name of checks) {
      if (text.includes(`to ${name}`) || text.includes(`visit ${name}`) || text.includes(`reach ${name}`)) {
        extracted.destination = loc.main;
        break;
      }
      if (text.includes(`from ${name}`) || text.includes(`at ${name}`) || text.includes(`in ${name}`)) {
        extracted.origin = loc.main;
        break;
      }
    }
  }

  if (text.includes("forest ride") || text.includes("safari") || text.includes("tea estate")) {
    extracted.addons.push("Guided Forest Safari");
  }
  if (text.includes("campfire") || text.includes("bbq") || text.includes("bonfire")) {
    extracted.addons.push("Campfire & BBQ Night");
  }

  if (extracted.isFlightTransfer) {
    extracted.fleetType = "flight_transfer";
  } else if (extracted.guestCount && extracted.guestCount > 15) {
    extracted.fleetType = "force_28";
  } else {
    extracted.fleetType = "force_14";
  }

  return extracted;
}

const naturalPromptInput = document.getElementById("naturalPromptInput");
const parsePromptBtn = document.getElementById("parsePromptBtn");

function runPromptExtraction(inputText) {
  if (!inputText || !inputText.trim()) return;

  const plan = parseUserPrompt(inputText);

  if (plan.origin && originInput) originInput.value = plan.origin;
  if (plan.destination && destInput) destInput.value = plan.destination;

  if (plan.fleetType) {
    document.querySelectorAll(".transport-btn").forEach((btn) => {
      if (btn.getAttribute("data-transport") === plan.fleetType) {
        btn.click();
      }
    });
  }

  if (plan.guestCount) {
    guestsCount = plan.guestCount;
    if (guestsInput) guestsInput.value = guestsCount;
    roomsCount = Math.ceil(guestsCount / 2);
    if (roomsInput) roomsInput.value = roomsCount;
  }

  if (plan.nights) {
    nights = plan.nights;
    if (nightsInput) nightsInput.value = nights;
    rentalDays = nights;
    if (rentalDaysInput) rentalDaysInput.value = nights;
  }

  if (!selectedStayTier) {
    const premiumBtn = document.querySelector(".tier-btn[data-tier='Premium']");
    if (premiumBtn) premiumBtn.click();
  }

  document.querySelectorAll(".addon-check").forEach((chk) => {
    const addonName = chk.getAttribute("data-name");
    chk.checked = plan.addons.includes(addonName);
  });

  calculateAndRenderMapRoute();
  updatePriceDisplay();

  const customizerEl = document.getElementById("routeControlBox");
  if (customizerEl) {
    customizerEl.scrollIntoView({ behavior: "smooth" });
  }
}

if (parsePromptBtn) {
  parsePromptBtn.addEventListener("click", () => {
    runPromptExtraction(naturalPromptInput?.value);
  });
}

if (naturalPromptInput) {
  naturalPromptInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      runPromptExtraction(naturalPromptInput.value);
    }
  });
}

document.querySelectorAll(".ai-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const text = chip.getAttribute("data-prompt");
    if (naturalPromptInput) naturalPromptInput.value = text;
    runPromptExtraction(text);
  });
});

// 10. Drawer Auth & Persistence (Decoupled from WhatsApp)
let authToken = localStorage.getItem("moonlight_token") || null;
let currentUser = null;
let drawerMode = "login";

const authNavBtn = document.getElementById("authNavBtn");
const slideDrawerBackdrop = document.getElementById("slideDrawerBackdrop");
const closeDrawerBtn = document.getElementById("closeDrawerBtn");
const tabSignIn = document.getElementById("tabSignIn");
const tabSignUp = document.getElementById("tabSignUp");
const drawerAuthForm = document.getElementById("drawerAuthForm");
const drawerTitle = document.getElementById("drawerTitle");
const drawerSubtitle = document.getElementById("drawerSubtitle");
const signUpNameField = document.getElementById("signUpNameField");
const signUpPhoneField = document.getElementById("signUpPhoneField");
const drawerSubmitBtn = document.getElementById("drawerSubmitBtn");
const drawerError = document.getElementById("drawerError");

function updateAuthUI() {
  if (!authNavBtn) return;
  if (currentUser) {
    authNavBtn.innerText = `${currentUser.name.split(' ')[0]} (Sign Out)`;
  } else {
    authNavBtn.innerText = 'Sign In';
  }
}

function openSlideDrawer() {
  if (slideDrawerBackdrop) slideDrawerBackdrop.classList.remove("hidden");
}

function closeSlideDrawer() {
  if (slideDrawerBackdrop) slideDrawerBackdrop.classList.add("hidden");
  if (drawerError) drawerError.classList.add("hidden");
}

if (closeDrawerBtn) closeDrawerBtn.addEventListener("click", closeSlideDrawer);

if (slideDrawerBackdrop) {
  slideDrawerBackdrop.addEventListener("click", (e) => {
    if (e.target === slideDrawerBackdrop) {
      closeSlideDrawer();
    }
  });
}

if (authNavBtn) {
  authNavBtn.addEventListener("click", () => {
    if (currentUser) {
      if (confirm("Log out from MoonLight Concierge?")) {
        authToken = null;
        currentUser = null;
        localStorage.removeItem("moonlight_token");
        updateAuthUI();
      }
    } else {
      openSlideDrawer();
    }
  });
}

if (tabSignIn) {
  tabSignIn.addEventListener("click", () => {
    drawerMode = "login";
    tabSignIn.classList.add("active");
    if (tabSignUp) tabSignUp.classList.remove("active");
    if (signUpNameField) signUpNameField.classList.add("hidden");
    if (signUpPhoneField) signUpPhoneField.classList.add("hidden");
    if (drawerTitle) drawerTitle.innerText = "Sign In to Continue";
    if (drawerSubtitle) drawerSubtitle.innerText = "Save your route and reserve your chauffeur.";
    if (drawerSubmitBtn) drawerSubmitBtn.innerText = "Sign In →";
    if (drawerError) drawerError.classList.add("hidden");
  });
}

if (tabSignUp) {
  tabSignUp.addEventListener("click", () => {
    drawerMode = "register";
    tabSignUp.classList.add("active");
    if (tabSignIn) tabSignIn.classList.remove("active");
    if (signUpNameField) signUpNameField.classList.remove("hidden");
    if (signUpPhoneField) signUpPhoneField.classList.remove("hidden");
    if (drawerTitle) drawerTitle.innerText = "Create Account";
    if (drawerSubtitle) drawerSubtitle.innerText = "Quick registration to save your account.";
    if (drawerSubmitBtn) drawerSubmitBtn.innerText = "Register →";
    if (drawerError) drawerError.classList.add("hidden");
  });
}

async function checkAuthSession() {
  if (!authToken) return;
  try {
    const res = await fetch("/api/auth/me", {
      headers: { "Authorization": `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (data.success) {
      currentUser = data.user;
      updateAuthUI();
    } else {
      localStorage.removeItem("moonlight_token");
      authToken = null;
      updateAuthUI();
    }
  } catch (e) {
    authToken = null;
    updateAuthUI();
  }
}
checkAuthSession();

async function finalizeBooking() {
  const origin = originInput?.value || "Not specified";
  const dest = destInput?.value || "Not specified";
  const stops = customStops.length > 0 ? customStops.join(", ") : "Direct";

  const selectedAddons = [];
  document.querySelectorAll(".addon-check:checked").forEach((chk) => {
    selectedAddons.push(chk.getAttribute("data-name"));
  });

  const hotelDetail = selectedHotel 
    ? `${selectedHotel.name} (${roomsCount} Rooms, ${nights} Nights, ${guestsCount} Guests)`
    : selectedStayTier 
      ? `${selectedStayTier} Class (${roomsCount} Rooms, ${nights} Nights, ${guestsCount} Guests)`
      : "None";

  const billingSummary = billingType === "daily" 
    ? `${rentalDays} Days Daily Package` 
    : billingType === "per_km" 
      ? `Per KM (${estimatedKm} KM via Map Route)` 
      : "Direct Transfer";

  if (authToken) {
    try {
      await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        },
        body: JSON.stringify({
          origin,
          destination: dest,
          fleet_name: selectedTransportLabel,
          billing_type: billingSummary,
          distance_km: estimatedKm,
          hotel_details: hotelDetail,
          total_cost: calculatedTotal
        })
      });
    } catch(err) {
      console.warn("Could not save to DB:", err);
    }
  }

  const message = 
    `*MoonLight Travels Reservation Inquiry*%0A` +
    `*Customer:* ${currentUser ? currentUser.name : "Guest"}%0A` +
    `*Fleet:* ${selectedTransportLabel}%0A` +
    `*Billing Model:* ${billingSummary}%0A` +
    `*Route:* ${origin} to ${dest}%0A` +
    `*Highway Distance:* ${estimatedKm} KM%0A` +
    `*Custom Waypoints:* ${stops}%0A` +
    `*Accommodation:* ${hotelDetail}%0A` +
    `*Add-on Services:* ${selectedAddons.join(", ") || "None"}%0A` +
    `*Total Estimated Package:* ₹${calculatedTotal.toLocaleString("en-IN")}`;

  window.open(`https://wa.me/916383347760?text=${message}`, "_blank");
}

// Only triggers booking dispatch when Reserve is clicked
if (whatsappBtn) {
  whatsappBtn.addEventListener("click", () => {
    if (calculatedTotal === 0) {
      alert("Please configure your fleet or route parameters before booking.");
      return;
    }

    if (!currentUser) {
      alert("Please sign in or create an account first before reserving.");
      openSlideDrawer();
      return;
    }

    finalizeBooking();
  });
}

// Submitting login / signup ONLY authenticates and closes the drawer
if (drawerAuthForm) {
  drawerAuthForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (drawerError) drawerError.classList.add("hidden");

    const email = document.getElementById("drawerEmail")?.value;
    const password = document.getElementById("drawerPassword")?.value;
    const name = document.getElementById("drawerName")?.value;
    const phone = document.getElementById("drawerPhone")?.value;

    const endpoint = drawerMode === "login" ? "/api/auth/login" : "/api/auth/register";
    const payload = drawerMode === "login" ? { email, password } : { name, email, password, phone };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!data.success) {
        if (drawerError) {
          drawerError.innerText = data.message || "Authentication failed.";
          drawerError.classList.remove("hidden");
        }
        return;
      }

      authToken = data.token;
      currentUser = data.user;
      localStorage.setItem("moonlight_token", authToken);

      updateAuthUI();
      closeSlideDrawer();
    } catch (err) {
      console.error("Auth request failure:", err);
      if (drawerError) {
        drawerError.innerText = "Cannot connect to server at http://localhost:5000. Ensure node is running.";
        drawerError.classList.remove("hidden");
      }
    }
  });
}

// Initial Run
updatePriceDisplay();
const express = require('express');
const path = require('path');
const db = require('./db');
const authRoutes = require('./auth');

const app = express();
const PORT = process.env.PORT || 5000;

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets from public folder
app.use(express.static(path.join(__dirname, 'public')));

// Authentication & Booking routes
app.use('/api/auth', authRoutes);

// Save booking record endpoint
app.post('/api/bookings', (req, res) => {
  const { origin, destination, fleet_name, billing_type, distance_km, hotel_details, total_cost } = req.body;
  
  // Extract user ID if Bearer token is provided
  let userId = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'moonlight_secret_jwt_key_2025');
      userId = decoded.id;
    } catch (e) {
      // Allow booking insertion even without strict token validation
    }
  }

  try {
    const insertBooking = db.prepare(`
      INSERT INTO bookings (user_id, origin, destination, fleet_name, billing_type, distance_km, hotel_details, total_cost)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertBooking.run(
      userId,
      origin || 'Not specified',
      destination || 'Not specified',
      fleet_name || 'Standard Fleet',
      billing_type || 'Standard',
      distance_km || 0,
      hotel_details || 'None',
      total_cost || 0
    );

    res.json({ success: true, bookingId: result.lastInsertRowid });
  } catch (err) {
    console.error('Error writing booking:', err);
    res.status(500).json({ success: false, message: 'Database insert failed' });
  }
});

// Admin endpoint: supplies registered users and trips directly to admin.html
app.get('/api/admin/data', (req, res) => {
  try {
    const users = db.prepare('SELECT id, name, email, phone, role, created_at FROM users ORDER BY id DESC').all();
    const bookings = db.prepare('SELECT * FROM bookings ORDER BY id DESC').all();
    res.json({ success: true, users, bookings });
  } catch (err) {
    console.error('Admin fetch error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Root fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`MoonLight Server live at http://localhost:${PORT}`);
  console.log(`Database Admin View live at http://localhost:${PORT}/admin.html`);
});
