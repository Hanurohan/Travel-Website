// 1. Lenis Smooth Scrolling Engine
const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true
});

function raf(time) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

// 2. GSAP Animations & Showcase Crossfades
gsap.registerPlugin(ScrollTrigger);

gsap.from("[data-gsap='hero-text']", {
  y: 60,
  opacity: 0,
  duration: 1.4,
  ease: "power3.out"
});

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
  ScrollTrigger.create({
    trigger: caption,
    start: "top 65%",
    end: "bottom 35%",
    onEnter: () => activateSection(caption),
    onEnterBack: () => activateSection(caption)
  });
  caption.addEventListener("mouseenter", () => activateSection(caption));
});

// 3. 3D Card Mouse Tilt
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

// 4. MAP & ROUTING ENGINE (Leaflet + OpenStreetMap)
let map = null;
let routingControl = null;
let mapInitialized = false;

const mapDrawerWrapper = document.getElementById("mapDrawerWrapper");
const liveMapKm = document.getElementById("liveMapKm");
const mapStatusTag = document.getElementById("mapStatusTag");

function initMapIfNeeded() {
  if (mapInitialized) return;
  
  // Center on Tamil Nadu / South India coordinates
  map = L.map("tripMap", { zoomControl: false }).setView([11.1271, 78.6569], 7);

  // CartoDB Dark/Clean Basemap Tiles
  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    maxZoom: 19
  }).addTo(map);

  mapInitialized = true;
}

function openMapDrawer() {
  mapDrawerWrapper.classList.add("open");
  mapStatusTag.innerText = "Interactive Navigation Active";
  setTimeout(() => {
    initMapIfNeeded();
    if (map) map.invalidateSize();
  }, 300);
}

// Geocode place names to Lat/Lng via Nominatim (Free, no API key needed)
async function geocodePlace(query) {
  if (!query || query.trim().length < 2) return null;
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ", India")}`);
    const data = await res.json();
    if (data && data.length > 0) {
      return L.latLng(parseFloat(data[0].lat), parseFloat(data[0].lon));
    }
  } catch (e) {
    console.warn("Geocoding failed for", query);
  }
  return null;
}

// Recalculate and Draw Road Route on Map
async function calculateAndRenderMapRoute() {
  openMapDrawer();

  const originVal = originInput.value.trim();
  const destVal = destInput.value.trim();

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

  if (waypoints.length < 2) {
    if (waypoints.length === 1 && map) {
      map.setView(waypoints[0], 11);
      L.marker(waypoints[0]).addTo(map);
    }
    return;
  }

  if (routingControl) {
    map.removeControl(routingControl);
  }

  routingControl = L.Routing.control({
    waypoints: waypoints,
    lineOptions: {
      styles: [{ color: "#D4AF37", weight: 5, opacity: 0.9 }]
    },
    createMarker: function(i, wp) {
      return L.marker(wp.latLng, {
        icon: L.divIcon({ className: "custom-gold-pin" })
      });
    },
    addWaypoints: false,
    draggableWaypoints: false,
    fitSelectedRoutes: true,
    show: false
  }).addTo(map);

  // Extract Actual Road Kilometers from Directions Result
  routingControl.on("routesfound", function(e) {
    const routes = e.routes;
    const distanceMeters = routes[0].summary.totalDistance;
    const distanceKm = Math.round(distanceMeters / 1000);

    // Update Display & Estimated KM state
    liveMapKm.innerText = `${distanceKm} KM`;
    estimatedKm = distanceKm;
    estimatedKmInput.value = distanceKm;
    
    updatePriceDisplay();
  });
}

// 5. Pricing & Customizer Logic
const FLEET_RATES = {
  force_14: {
    title: "14-Seater Pricing Structure",
    name: "14-Seater Luxury Traveller",
    perKm: 26,
    dailyRate: 7500
  },
  force_28: {
    title: "28-Seater Pricing Structure",
    name: "28-Seater Executive Coach",
    perKm: 32,
    dailyRate: 8000
  },
  flight_transfer: {
    title: "Flight Transfer Combo",
    name: "Flight Transfer + Van",
    fixedBase: 32000
  }
};

const STAY_RATES = {
  Standard: 2500,
  Premium: 4500,
  Luxury: 7500
};

let selectedTransport = null;
let selectedTransportLabel = "No Fleet Selected";
let billingType = null; 
let rentalDays = 0;
let estimatedKm = 0;
let customStops = [];
let selectedStayTier = null;
let nights = 0;
let calculatedTotal = 0;

// Elements
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
const nightsInput = document.getElementById("nightsInput");
const originInput = document.getElementById("originInput");
const destInput = document.getElementById("destInput");

const summaryTransportName = document.getElementById("summaryTransportName");
const summaryBillingDesc = document.getElementById("summaryBillingDesc");
const baseCostText = document.getElementById("baseCostText");
const stopsCount = document.getElementById("stopsCount");
const stopsCostText = document.getElementById("stopsCostText");
const summaryTier = document.getElementById("summaryTier");
const summaryNights = document.getElementById("summaryNights");
const stayCostText = document.getElementById("stayCostText");
const addonCostText = document.getElementById("addonCostText");
const totalCostText = document.getElementById("totalCostText");
const whatsappBtn = document.getElementById("whatsappBtn");

// Slide Map In when hovering or clicking the route box
originInput.addEventListener("mouseenter", openMapDrawer);
originInput.addEventListener("focus", openMapDrawer);
destInput.addEventListener("mouseenter", openMapDrawer);
destInput.addEventListener("focus", openMapDrawer);

// Debounced input to auto-draw route when user stops typing
let debounceTimer;
function triggerRouteCalculation() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    calculateAndRenderMapRoute();
  }, 750);
}

originInput.addEventListener("input", triggerRouteCalculation);
destInput.addEventListener("input", triggerRouteCalculation);

function calculateAddonsTotal() {
  let total = 0;
  document.querySelectorAll(".addon-check:checked").forEach((chk) => {
    total += parseInt(chk.getAttribute("data-price")) || 0;
  });
  return total;
}

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

  let stayCost = 0;
  if (selectedStayTier && STAY_RATES[selectedStayTier]) {
    stayCost = STAY_RATES[selectedStayTier] * nights;
  }

  const addonsCost = calculateAddonsTotal();
  calculatedTotal = baseTransportCost + stopsCost + stayCost + addonsCost;

  summaryTransportName.innerText = selectedTransportLabel;
  if (summaryBillingDesc) summaryBillingDesc.innerText = billingDescription;
  baseCostText.innerText = "₹" + baseTransportCost.toLocaleString("en-IN");
  
  stopsCount.innerText = customStops.length;
  stopsCostText.innerText = "₹" + stopsCost.toLocaleString("en-IN");

  summaryTier.innerText = selectedStayTier || "None";
  summaryNights.innerText = nights;
  stayCostText.innerText = "₹" + stayCost.toLocaleString("en-IN");

  addonCostText.innerText = "₹" + addonsCost.toLocaleString("en-IN");
  totalCostText.innerText = "₹" + calculatedTotal.toLocaleString("en-IN");
}

function updateTariffDrawer(fleetKey) {
  if (!fleetKey || fleetKey === "flight_transfer") {
    tariffDrawer.classList.add("hidden");
    billingType = null;
    return;
  }

  tariffDrawer.classList.remove("hidden");
  const data = FLEET_RATES[fleetKey];
  selectedFleetTitle.innerText = data.title;
  dailyRateText.innerText = `Daily Package: ₹${data.dailyRate.toLocaleString("en-IN")} / day`;
  kmRateText.innerText = `Per KM Rate: ₹${data.perKm} / km`;
}

function renderStops() {
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

addStopBtn.addEventListener("click", () => {
  const val = stopInput.value.trim();
  if (val) {
    customStops.push(val);
    stopInput.value = "";
    renderStops();
  }
});

window.removeStop = function(idx) {
  customStops.splice(idx, 1);
  renderStops();
};

// Transport Button Handlers
const transportButtons = document.querySelectorAll(".transport-btn");
transportButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const clickedTransport = btn.getAttribute("data-transport");

    if (selectedTransport === clickedTransport) {
      btn.classList.remove("active");
      selectedTransport = null;
      selectedTransportLabel = "No Fleet Selected";
      billingType = null;
      updateTariffDrawer(null);
    } else {
      transportButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      selectedTransport = clickedTransport;
      selectedTransportLabel = btn.querySelector("strong").innerText;

      if (selectedTransport === "flight_transfer") {
        billingType = null;
        updateTariffDrawer(null);
      } else {
        updateTariffDrawer(selectedTransport);
        if (!billingType) {
          billingType = "per_km";
          document.querySelector("input[value='per_km']").checked = true;
          kmOptionLabel.classList.add("active");
          kmInputGroup.classList.remove("hidden");
        }
      }
    }
    updatePriceDisplay();
  });
});

// Billing Radio Buttons
document.querySelectorAll("input[name='billingChoice']").forEach((radio) => {
  radio.addEventListener("change", (e) => {
    billingType = e.target.value;
    if (billingType === "daily") {
      dailyOptionLabel.classList.add("active");
      kmOptionLabel.classList.remove("active");
      dailyInputGroup.classList.remove("hidden");
      kmInputGroup.classList.add("hidden");
      rentalDays = parseInt(rentalDaysInput.value) || 1;
      rentalDaysInput.value = rentalDays;
    } else {
      kmOptionLabel.classList.add("active");
      dailyOptionLabel.classList.remove("active");
      kmInputGroup.classList.remove("hidden");
      dailyInputGroup.classList.add("hidden");
      openMapDrawer();
    }
    updatePriceDisplay();
  });
});

rentalDaysInput.addEventListener("input", (e) => {
  rentalDays = Math.max(0, parseInt(e.target.value) || 0);
  updatePriceDisplay();
});

// Accommodation Tier Buttons
const tierButtons = document.querySelectorAll(".tier-btn");
tierButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const tier = btn.getAttribute("data-tier");
    if (selectedStayTier === tier) {
      btn.classList.remove("active");
      selectedStayTier = null;
      nights = 0;
      nightsInput.value = "";
    } else {
      tierButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      selectedStayTier = tier;
      if (!nights || nights === 0) {
        nights = 1;
        nightsInput.value = 1;
      }
    }
    updatePriceDisplay();
  });
});

nightsInput.addEventListener("input", (e) => {
  nights = Math.max(0, parseInt(e.target.value) || 0);
  updatePriceDisplay();
});

document.querySelectorAll(".addon-check").forEach((chk) => {
  chk.addEventListener("change", updatePriceDisplay);
});

// WhatsApp Booking Dispatch
whatsappBtn.addEventListener("click", () => {
  if (calculatedTotal === 0) {
    alert("Please select your transport mode or route before booking.");
    return;
  }

  const origin = originInput.value || "Not specified";
  const dest = destInput.value || "Not specified";
  const stops = customStops.length > 0 ? customStops.join(", ") : "Direct";

  const selectedAddons = [];
  document.querySelectorAll(".addon-check:checked").forEach((chk) => {
    selectedAddons.push(chk.getAttribute("data-name"));
  });

  const billingSummary = billingType === "daily" 
    ? `${rentalDays} Days Package` 
    : billingType === "per_km" 
      ? `Per KM (${estimatedKm} KM via Map Route)` 
      : "Direct Transfer";

  const message = 
    `*MoonLight Travels Reservation*%0A` +
    `*Fleet:* ${selectedTransportLabel}%0A` +
    `*Billing Model:* ${billingSummary}%0A` +
    `*Route:* ${origin} to ${dest}%0A` +
    `*Total Highway Distance:* ${estimatedKm} KM%0A` +
    `*Waypoints:* ${stops}%0A` +
    `*Stay Tier:* ${selectedStayTier ? `${selectedStayTier} (${nights} Nights)` : "None"}%0A` +
    `*Add-on Services:* ${selectedAddons.join(", ") || "None"}%0A` +
    `*Estimated Total:* ₹${calculatedTotal.toLocaleString("en-IN")}`;

  window.open(`https://wa.me/916383347760?text=${message}`, "_blank");
});

// Initial Setup
updatePriceDisplay();