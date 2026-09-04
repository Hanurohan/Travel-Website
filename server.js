import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Tariff Structures
const VEHICLE_RATES = {
  force_14: {
    name: "14-Seater Luxury Traveller",
    perKm: 26,
    dailyRate: 7500,
  },
  force_28: {
    name: "28-Seater Executive Coach",
    perKm: 32,
    dailyRate: 8000,
  },
  flight_transfer: {
    name: "Flight Transfer + Van",
    fixedBase: 32000
  }
};

const PRICING_RULES = {
  costPerCustomStop: 1500,
  stayRates: {
    Standard: 2500,
    Premium: 4500,
    Luxury: 7500
  }
};

app.post('/api/calculate-quote', (req, res) => {
  try {
    const { 
      transportType = null,
      billingType = null, 
      estimatedKm = 0,
      rentalDays = 0,
      stops = [], 
      stayTier = null, 
      nights = 0,
      addonsCost = 0
    } = req.body;

    let baseTransportCost = 0;
    let billingDescription = "—";

    if (transportType === 'flight_transfer') {
      baseTransportCost = VEHICLE_RATES.flight_transfer.fixedBase;
      billingDescription = "Fixed Airport Escort Base";
    } else if (transportType && VEHICLE_RATES[transportType]) {
      const vehicle = VEHICLE_RATES[transportType];
      if (billingType === 'per_km' && Number(estimatedKm) > 0) {
        baseTransportCost = vehicle.perKm * Number(estimatedKm);
        billingDescription = `₹${vehicle.perKm}/km × ${estimatedKm} km (excl. bata & halt)`;
      } else if (billingType === 'daily' && Number(rentalDays) > 0) {
        baseTransportCost = vehicle.dailyRate * Number(rentalDays);
        billingDescription = `₹${vehicle.dailyRate.toLocaleString('en-IN')}/day × ${rentalDays} days (300 km/day)`;
      }
    }

    const stopsCost = (stops.length || 0) * PRICING_RULES.costPerCustomStop;
    
    let stayCost = 0;
    if (stayTier && PRICING_RULES.stayRates[stayTier] && Number(nights) > 0) {
      stayCost = PRICING_RULES.stayRates[stayTier] * Number(nights);
    }
    
    const totalCost = baseTransportCost + stopsCost + stayCost + Number(addonsCost);

    res.json({
      success: true,
      breakdown: {
        baseTransportCost,
        billingDescription,
        stopsCount: stops.length,
        stopsCost,
        stayTier: stayTier || "None",
        nights: Number(nights),
        stayCost,
        addonsCost: Number(addonsCost),
        totalCost
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Calculation failed' });
  }
});

app.listen(PORT, () => {
  console.log(`MoonLight Travels server running on http://localhost:${PORT}`);
});