export interface CatalogModel {
  name: string;
  bodyType: string;
  variants: string[];
}

export interface CatalogMake {
  name: string;
  models: CatalogModel[];
}

// A static, hand-curated catalog of common India-market makes/models/variants.
// Not exhaustive and not live data — see glovebox-architecture.md for why
// (no free third-party API covers the Indian market; this is the pragmatic
// zero-cost alternative). Extend this array as needed; the form falls back
// to free text for anything not listed here.
export const VEHICLE_CATALOG: CatalogMake[] = [
  {
    name: "Maruti Suzuki",
    models: [
      { name: "Alto K10", bodyType: "Hatchback", variants: ["STD", "LXI", "VXI", "VXI+"] },
      { name: "WagonR", bodyType: "Hatchback", variants: ["LXI", "VXI", "VXI+", "ZXI", "ZXI+", "VXI AMT", "ZXI AMT"] },
      { name: "Swift", bodyType: "Hatchback", variants: ["LXI", "VXI", "ZXI", "ZXI+", "VXI AMT", "ZXI+ AMT"] },
      { name: "Baleno", bodyType: "Hatchback", variants: ["Sigma", "Delta", "Zeta", "Alpha"] },
      { name: "Ignis", bodyType: "Hatchback", variants: ["Sigma", "Delta", "Zeta", "Alpha"] },
      { name: "Dzire", bodyType: "Sedan", variants: ["LXI", "VXI", "ZXI", "ZXI+"] },
      { name: "Brezza", bodyType: "SUV", variants: ["LXI", "VXI", "VXI(O)", "ZXI", "ZXI+", "ZXI+ AT"] },
      { name: "Fronx", bodyType: "SUV", variants: ["Sigma", "Delta", "Delta+", "Zeta", "Alpha", "Alpha Turbo"] },
      { name: "Ertiga", bodyType: "MPV", variants: ["LXI", "VXI", "ZXI", "ZXI+"] },
      { name: "Grand Vitara", bodyType: "SUV", variants: ["Sigma", "Delta", "Zeta", "Alpha", "Zeta+ Hybrid", "Alpha+ Hybrid"] },
    ],
  },
  {
    name: "Hyundai",
    models: [
      { name: "Grand i10 Nios", bodyType: "Hatchback", variants: ["Era", "Magna", "Sportz", "Asta"] },
      { name: "i20", bodyType: "Hatchback", variants: ["Era", "Magna", "Sportz", "Asta", "Asta(O)"] },
      { name: "Aura", bodyType: "Sedan", variants: ["Era", "Magna", "Sportz", "SX", "SX+"] },
      { name: "Exter", bodyType: "SUV", variants: ["EX", "S", "SX", "SX(O)"] },
      { name: "Venue", bodyType: "SUV", variants: ["E", "EX", "S", "S(O)", "SX", "SX(O)"] },
      { name: "Creta", bodyType: "SUV", variants: ["E", "EX", "S", "SX", "SX(O)"] },
      { name: "Verna", bodyType: "Sedan", variants: ["EX", "S", "SX", "SX(O)"] },
      { name: "Alcazar", bodyType: "SUV", variants: ["Prestige", "Platinum", "Signature"] },
      { name: "Tucson", bodyType: "SUV", variants: ["Signature", "Platinum"] },
    ],
  },
  {
    name: "Tata",
    models: [
      { name: "Tiago", bodyType: "Hatchback", variants: ["XE", "XM", "XT", "XZ", "XZ+"] },
      { name: "Altroz", bodyType: "Hatchback", variants: ["XE", "XM", "XT", "XZ", "XZ+"] },
      { name: "Tigor", bodyType: "Sedan", variants: ["XE", "XM", "XZ", "XZ+"] },
      { name: "Punch", bodyType: "SUV", variants: ["Pure", "Adventure", "Accomplished", "Creative"] },
      { name: "Nexon", bodyType: "SUV", variants: ["Smart", "Pure", "Creative", "Fearless"] },
      { name: "Curvv", bodyType: "SUV", variants: ["Creative", "Accomplished"] },
      { name: "Harrier", bodyType: "SUV", variants: ["Smart", "Pure", "Adventure", "Fearless"] },
      { name: "Safari", bodyType: "SUV", variants: ["Smart", "Pure", "Adventure", "Accomplished"] },
    ],
  },
  {
    name: "Mahindra",
    models: [
      { name: "Bolero", bodyType: "SUV", variants: ["B4", "B6"] },
      { name: "Thar", bodyType: "SUV", variants: ["AX(O)", "LX"] },
      { name: "XUV 3XO", bodyType: "SUV", variants: ["MX1", "MX2", "MX3", "AX5", "AX7"] },
      { name: "Scorpio-N", bodyType: "SUV", variants: ["Z2", "Z4", "Z6", "Z8"] },
      { name: "XUV700", bodyType: "SUV", variants: ["MX", "AX3", "AX5", "AX7"] },
      { name: "XUV400", bodyType: "SUV", variants: ["EC", "EL"] },
      { name: "Marazzo", bodyType: "MPV", variants: ["M2", "M4", "M6", "M8"] },
    ],
  },
  {
    name: "Kia",
    models: [
      { name: "Sonet", bodyType: "SUV", variants: ["HTE", "HTK", "HTK+", "HTX", "GTX", "GTX+"] },
      { name: "Seltos", bodyType: "SUV", variants: ["HTE", "HTK", "HTK+", "HTX", "HTX+", "GTX+", "X-Line"] },
      { name: "Carens", bodyType: "MPV", variants: ["Premium", "Prestige", "Prestige+", "Luxury", "Luxury+"] },
      { name: "EV6", bodyType: "SUV", variants: ["GT-Line", "GT-Line AWD"] },
    ],
  },
  {
    name: "Toyota",
    models: [
      { name: "Glanza", bodyType: "Hatchback", variants: ["E", "S", "G", "V"] },
      { name: "Urban Cruiser Taisor", bodyType: "SUV", variants: ["E", "S", "G", "V"] },
      { name: "Hyryder", bodyType: "SUV", variants: ["E", "S", "G", "V"] },
      { name: "Innova Crysta", bodyType: "MPV", variants: ["GX", "VX", "ZX"] },
      { name: "Innova Hycross", bodyType: "MPV", variants: ["GX", "VX", "ZX", "ZX(O)"] },
      { name: "Fortuner", bodyType: "SUV", variants: ["Standard", "MT", "AT", "Legender", "GR-S"] },
    ],
  },
  {
    name: "Honda",
    models: [
      { name: "Amaze", bodyType: "Sedan", variants: ["E", "S", "V", "VX"] },
      { name: "City", bodyType: "Sedan", variants: ["SV", "V", "VX", "ZX"] },
      { name: "Elevate", bodyType: "SUV", variants: ["SV", "V", "VX", "ZX"] },
    ],
  },
  {
    name: "Renault",
    models: [
      { name: "Kwid", bodyType: "Hatchback", variants: ["RXE", "RXL", "RXT", "Climber"] },
      { name: "Triber", bodyType: "MPV", variants: ["RXE", "RXL", "RXT", "RXZ"] },
      { name: "Kiger", bodyType: "SUV", variants: ["RXE", "RXL", "RXT", "RXZ"] },
    ],
  },
  {
    name: "Nissan",
    models: [{ name: "Magnite", bodyType: "SUV", variants: ["XE", "XL", "XV", "XV Premium"] }],
  },
  {
    name: "Skoda",
    models: [
      { name: "Kushaq", bodyType: "SUV", variants: ["Active", "Ambition", "Style"] },
      { name: "Slavia", bodyType: "Sedan", variants: ["Active", "Ambition", "Style"] },
      { name: "Kodiaq", bodyType: "SUV", variants: ["Style", "L&K"] },
    ],
  },
  {
    name: "Volkswagen",
    models: [
      { name: "Virtus", bodyType: "Sedan", variants: ["Comfortline", "Highline", "GT"] },
      { name: "Taigun", bodyType: "SUV", variants: ["Comfortline", "Highline", "GT"] },
      { name: "Tiguan", bodyType: "SUV", variants: ["Elegance"] },
    ],
  },
  {
    name: "MG",
    models: [
      { name: "Comet EV", bodyType: "Hatchback", variants: ["Pace", "Play"] },
      { name: "Astor", bodyType: "SUV", variants: ["Style", "Super", "Smart", "Sharp", "Savvy"] },
      { name: "Hector", bodyType: "SUV", variants: ["Style", "Super", "Smart", "Sharp", "Savvy"] },
      { name: "ZS EV", bodyType: "SUV", variants: ["Excite", "Exclusive", "Essence"] },
      { name: "Gloster", bodyType: "SUV", variants: ["Super", "Smart", "Sharp", "Savvy"] },
    ],
  },
  {
    name: "Citroen",
    models: [
      { name: "C3", bodyType: "Hatchback", variants: ["Live", "Feel", "Shine"] },
      { name: "C3 Aircross", bodyType: "SUV", variants: ["You", "Plus", "Max"] },
      { name: "Basalt", bodyType: "SUV", variants: ["Plus", "Max"] },
    ],
  },
  {
    name: "Jeep",
    models: [
      { name: "Compass", bodyType: "SUV", variants: ["Sport", "Longitude", "Limited", "Trailhawk"] },
      { name: "Meridian", bodyType: "SUV", variants: ["Longitude", "Limited"] },
    ],
  },
  // Discontinued in India (~2021) but large installed base. Confidence: high —
  // cross-checked cardekho.com variant pages, carwale.com, autocarindia.com, team-bhp.com.
  // Figo/EcoSport variant names combine both the pre-2015 and post-2015/2017 facelift
  // generations since both remain common on the road; Endeavour reflects the 2016-2021 gen.
  {
    name: "Ford",
    models: [
      { name: "EcoSport", bodyType: "SUV", variants: ["Ambiente", "Trend", "Titanium", "Titanium+", "S"] },
      { name: "Figo", bodyType: "Hatchback", variants: ["LXI", "EXI", "ZXI", "Ambiente", "Trend", "Titanium", "Titanium Blu"] },
      { name: "Aspire", bodyType: "Sedan", variants: ["Ambiente", "Trend", "Trend+", "Titanium", "Titanium+"] },
      { name: "Freestyle", bodyType: "Hatchback", variants: ["Ambiente", "Trend", "Titanium", "Titanium+"] },
      { name: "Endeavour", bodyType: "SUV", variants: ["Trend", "Titanium", "Titanium+", "Sport"] },
    ],
  },
  // Discontinued in India (Dec 2017) but large installed base. Confidence: medium-high —
  // sourced from cardekho.com variant pages and cartoq.com; exact trim spelling for
  // older BS-III/BS-IV era models is harder to verify than for newer brands.
  {
    name: "Chevrolet",
    models: [
      { name: "Beat", bodyType: "Hatchback", variants: ["PS", "LS", "LT", "LTZ"] },
      { name: "Spark", bodyType: "Hatchback", variants: ["PS", "LS", "LT"] },
      { name: "Sail", bodyType: "Sedan", variants: ["Base", "LS", "LS ABS", "LT", "LT ABS"] },
      { name: "Sail Hatchback", bodyType: "Hatchback", variants: ["Base", "LS", "LS ABS", "LT ABS"] },
      { name: "Cruze", bodyType: "Sedan", variants: ["LT", "LTZ", "LTZ AT"] },
      // Uncertain: Tavera trim naming mixes facelift name ("Neo") with seat-config
      // suffixes (B2/B3/B4 = seating capacity, not really separate trims); omitted those.
      { name: "Tavera", bodyType: "MPV", variants: ["LS", "Neo LS", "Neo LT"] },
      { name: "Enjoy", bodyType: "MPV", variants: ["LS", "LT", "LTZ"] },
    ],
  },
  // Effectively wound down in India; large installed base of older owners.
  // Confidence: medium — sourced from cardekho.com variant pages, team-bhp.com and
  // cartoq.com. Punto sold across multiple sub-generations (Grande Punto/Punto EVO)
  // with some variant-name churn; "Pure" was the base trim on later EVO models.
  {
    name: "Fiat",
    models: [
      { name: "Punto", bodyType: "Hatchback", variants: ["Pure", "Active", "Dynamic", "Emotion"] },
      { name: "Linea", bodyType: "Sedan", variants: ["Active", "Dynamic", "Emotion", "Emotion Pack"] },
      { name: "Avventura", bodyType: "SUV", variants: ["Active", "Dynamic", "Emotion"] },
    ],
  },
  // Discontinued in India (~2020-2022) but recent enough that trim data is well
  // documented. Confidence: high — cross-checked autocarindia.com, cardekho.com,
  // zigwheels.com. GO+ is the MPV/7-seater version of the GO hatchback platform.
  {
    name: "Datsun",
    models: [
      { name: "GO", bodyType: "Hatchback", variants: ["D", "A", "A(O)", "T", "T(O)"] },
      { name: "GO+", bodyType: "MPV", variants: ["D", "D1", "A", "T"] },
      { name: "redi-GO", bodyType: "Hatchback", variants: ["D", "A", "T", "T(O)", "S"] },
    ],
  },
  // Land Rover — verified via CarWale, Autocar India variant pages, and CarDekho (current-gen
  // models). A few recently-superseded trims included where solidly sourced (e.g. Discovery's
  // outgoing S/Metropolitan Edition) since those cars are commonly still owned.
  {
    name: "Land Rover",
    models: [
      {
        name: "Defender",
        bodyType: "SUV",
        variants: ["90 X", "90 V8", "110 X", "110 X-Dynamic HSE", "110 V8 X", "110 Trophy Edition", "110 Octa", "110 Octa Black", "130 X", "130 X-Dynamic HSE", "130 V8"],
      },
      { name: "Discovery", bodyType: "SUV", variants: ["S", "Metropolitan Edition", "Dynamic HSE", "Gemini Edition", "Tempest Edition"] },
      { name: "Discovery Sport", bodyType: "SUV", variants: ["S", "SE R-Dynamic", "Dynamic SE"] },
      { name: "Range Rover", bodyType: "SUV", variants: ["HSE", "Autobiography", "SV", "SV Ultra"] },
      { name: "Range Rover Sport", bodyType: "SUV", variants: ["Dynamic HSE", "Autobiography", "SV", "SV Black", "SV Carbon"] },
      { name: "Range Rover Velar", bodyType: "SUV", variants: ["R-Dynamic HSE", "Dynamic SE", "Autobiography"] },
      { name: "Range Rover Evoque", bodyType: "SUV", variants: ["S", "SE R-Dynamic", "Dynamic SE", "Autobiography"] },
    ],
  },
  // Jaguar — F-Pace confirmed current (single R-Dynamic S trim today); older F-Pace/XF/XE/F-Type
  // trims verified via CarDekho/CarWale/Autocar India historical listings. XF, XE and F-Type are
  // discontinued but commonly owned. F-Type split into Coupe/Convertible (bodyType is per-model).
  {
    name: "Jaguar",
    models: [
      { name: "F-Pace", bodyType: "SUV", variants: ["Prestige", "Portfolio", "R-Sport", "First Edition", "R-Dynamic S", "SVR"] },
      { name: "XF", bodyType: "Sedan", variants: ["Prestige", "Portfolio", "R-Sport", "S"] },
      { name: "XE", bodyType: "Sedan", variants: ["Pure", "Prestige", "Portfolio"] },
      { name: "F-Type Coupe", bodyType: "Coupe", variants: ["R-Dynamic P300", "R-Dynamic P450", "SVR"] },
      { name: "F-Type Convertible", bodyType: "Convertible", variants: ["R-Dynamic P300", "R-Dynamic P450", "SVR"] },
    ],
  },
  // Lexus — verified via Lexus India official price list, Autocar India, Smartprix, CarDekho.
  // LC 500h's "500h" is the only marketed configuration confirmed (single-trim model) —
  // lower confidence on this one entry than the rest of this brand.
  {
    name: "Lexus",
    models: [
      { name: "ES", bodyType: "Sedan", variants: ["Exquisite", "Luxury"] },
      { name: "RX", bodyType: "SUV", variants: ["Exquisite", "Luxury", "500h F-Sport+"] },
      { name: "NX", bodyType: "SUV", variants: ["Exquisite", "Overtrail", "Luxury", "F Sport"] },
      { name: "LX", bodyType: "SUV", variants: ["Urban", "Overtrail"] },
      { name: "LM", bodyType: "MPV", variants: ["7-Seater VIP", "4-Seater Ultra Luxury"] },
      { name: "LC", bodyType: "Coupe", variants: ["500h"] },
    ],
  },
  // Volvo — verified via Autocar India variant pages, MotorBeam, CarWale, CarDekho. Includes
  // current single-trim lineup (Ultra/Ultra B5) plus recently-discontinued Momentum/R-Design/
  // Inscription trims that are commonly owned. V90 Cross Country omitted — doesn't fit any
  // allowed bodyType cleanly (raised estate/wagon).
  {
    name: "Volvo",
    models: [
      { name: "XC40", bodyType: "SUV", variants: ["Momentum", "R-Design", "Inscription", "Ultra"] },
      { name: "XC60", bodyType: "SUV", variants: ["Momentum", "R-Design", "Inscription", "Ultra"] },
      { name: "XC90", bodyType: "SUV", variants: ["Momentum", "Inscription", "Excellence", "Ultra B5"] },
      { name: "S60", bodyType: "Sedan", variants: ["Momentum", "R-Design", "Inscription"] },
      { name: "S90", bodyType: "Sedan", variants: ["Momentum", "Inscription"] },
      { name: "EX30", bodyType: "SUV", variants: ["Ultra"] },
      { name: "EX40", bodyType: "SUV", variants: ["Ultra"] },
      { name: "EC40", bodyType: "SUV", variants: ["Ultra"] },
    ],
  },
  // Isuzu — verified via Autocar India's Aug-2026 D-Max V-Cross buyer's guide and
  // CarDekho/ZigWheels variant pages. MU-X has no named trims in India, just drivetrain.
  {
    name: "Isuzu",
    models: [
      { name: "D-Max V-Cross", bodyType: "Pickup", variants: ["Z Standard", "Z Premium", "Z Prestige Standard", "Z Prestige Premium"] },
      { name: "MU-X", bodyType: "SUV", variants: ["4X2 AT", "4X4 AT"] },
    ],
  },
  // Force Motors — sourced from Force Motors' own official price list. Trax/Traveller are
  // sold primarily as commercial/staff-transport vehicles; their "variants" are genuinely
  // model-line/wheelbase names rather than LXI/VXI-style trims.
  {
    name: "Force Motors",
    models: [
      { name: "Gurkha", bodyType: "SUV", variants: ["3-Door", "5-Door"] },
      { name: "Trax", bodyType: "Van", variants: ["Gama", "Cruiser", "Toofan", "Citiline"] },
      { name: "Traveller", bodyType: "Van", variants: ["3050WB", "3350WB", "3700WB", "4020WB", "4020WB CNG"] },
    ],
  },
  // Porsche India — cross-checked Autocar India and CarDekho variant pages. Note: the ICE
  // "Macan" is currently sold in India as a single variant (no S/GTS trim available there).
  {
    name: "Porsche",
    models: [
      { name: "911", bodyType: "Coupe", variants: ["Carrera", "Carrera 4 GTS", "GT3", "Turbo S"] },
      { name: "Macan", bodyType: "SUV", variants: ["Macan"] },
      { name: "Macan Electric", bodyType: "SUV", variants: ["Macan", "4S", "Turbo"] },
      { name: "Cayenne", bodyType: "SUV", variants: ["Cayenne", "GTS"] },
      { name: "Panamera", bodyType: "Sedan", variants: ["Panamera", "GTS"] },
      { name: "Taycan", bodyType: "Sedan", variants: ["Taycan", "4S", "Turbo"] },
    ],
  },
  // BMW — verified via CarWale India model/variant pages (bmw.in timed out repeatedly, CarWale
  // used as primary source). Z4, M8, i4, iX1 are discontinued-but-recently-owned, included since
  // variant data was solid.
  {
    name: "BMW",
    models: [
      { name: "2 Series Gran Coupe", bodyType: "Sedan", variants: ["218 M Sport", "218 M Sport Pro"] },
      { name: "3 Series", bodyType: "Sedan", variants: ["320Ld M Sport", "330Li M Sport"] },
      { name: "4 Series Convertible", bodyType: "Convertible", variants: ["M440i xDrive"] },
      { name: "5 Series", bodyType: "Sedan", variants: ["530Li M Sport"] },
      { name: "7 Series", bodyType: "Sedan", variants: ["740i M Sport", "740d M Sport"] },
      { name: "X1", bodyType: "SUV", variants: ["sDrive18i M Sport", "sDrive18d M Sport"] },
      { name: "iX1", bodyType: "SUV", variants: ["xDrive30 M Sport"] },
      { name: "X3", bodyType: "SUV", variants: ["xDrive20", "xDrive20d", "xDrive30 M Sport Pro"] },
      { name: "X5", bodyType: "SUV", variants: ["xDrive40i xLine", "xDrive30d xLine", "xDrive40i M Sport Pro", "xDrive30d M Sport Pro"] },
      { name: "X6", bodyType: "SUV", variants: ["M60i"] },
      { name: "X7", bodyType: "SUV", variants: ["xDrive40d DPE", "xDrive40i M Sport", "xDrive40d M Sport"] },
      { name: "Z4", bodyType: "Convertible", variants: ["M40i", "M40i Pure Impulse"] },
      { name: "M2", bodyType: "Coupe", variants: ["M2", "M2 CS"] },
      { name: "M4", bodyType: "Coupe", variants: ["Competition"] },
      { name: "M5", bodyType: "Sedan", variants: ["Competition"] },
      { name: "M8", bodyType: "Coupe", variants: ["Coupe", "50 Jahre M Edition"] },
      { name: "XM", bodyType: "SUV", variants: ["XM"] },
      { name: "i4", bodyType: "Sedan", variants: ["eDrive35 M Sport", "eDrive40", "eDrive40 M Sport"] },
      { name: "i5", bodyType: "Sedan", variants: ["M60 xDrive"] },
      { name: "i7", bodyType: "Sedan", variants: ["eDrive50 M Sport", "M70 xDrive"] },
      { name: "iX", bodyType: "SUV", variants: ["xDrive50"] },
    ],
  },
  // Mercedes-Benz — verified via CarWale India model/variant pages. AMG E53, CLS, AMG GT,
  // GLE Coupe intentionally omitted — no clean, fully-priced variant list found for them.
  {
    name: "Mercedes-Benz",
    models: [
      { name: "A-Class Limousine", bodyType: "Sedan", variants: ["200", "200d"] },
      { name: "CLA", bodyType: "Sedan", variants: ["200", "250 Plus", "250 Plus Launch Edition"] },
      { name: "C-Class", bodyType: "Sedan", variants: ["200", "220d", "300", "200 Celebration Edition"] },
      { name: "AMG C 63", bodyType: "Sedan", variants: ["S E Performance"] },
      { name: "CLE Coupe", bodyType: "Coupe", variants: ["53 AMG"] },
      { name: "CLE Cabriolet", bodyType: "Convertible", variants: ["300 AMG Line"] },
      { name: "E-Class", bodyType: "Sedan", variants: ["200", "220d", "450 4MATIC AMG Line"] },
      { name: "S-Class", bodyType: "Sedan", variants: ["450e Launch Edition", "450e MANUFAKTUR Edition"] },
      { name: "Maybach S-Class", bodyType: "Sedan", variants: ["S580 4MATIC"] },
      { name: "GLA", bodyType: "SUV", variants: ["200", "220d 4MATIC", "220d AMG Line 4MATIC"] },
      { name: "GLC", bodyType: "SUV", variants: ["220d 4MATIC", "300 4MATIC"] },
      { name: "GLE", bodyType: "SUV", variants: ["300d 4MATIC AMG Line", "300d 4MATIC Night Edition", "450 4MATIC", "450 4MATIC Night Edition", "450d 4MATIC"] },
      { name: "GLS", bodyType: "SUV", variants: ["450 4MATIC", "450d 4MATIC", "450 4MATIC AMG Line", "450d 4MATIC AMG Line", "450 4MATIC Night Edition", "450d 4MATIC Night Edition"] },
      { name: "G-Class", bodyType: "SUV", variants: ["450d AMG Line"] },
      { name: "V-Class", bodyType: "MPV", variants: ["300", "300d"] },
      { name: "EQS", bodyType: "Sedan", variants: ["580 4MATIC"] },
      { name: "EQS SUV", bodyType: "SUV", variants: ["450 5-Seater", "450 5-Seater Celebration Edition", "580 4MATIC", "580 4MATIC Celebration Edition"] },
    ],
  },
  // Audi — verified via CarWale India model/variant pages. A5 is discontinued but retained
  // (Sportback body, solid variant data).
  {
    name: "Audi",
    models: [
      { name: "A4", bodyType: "Sedan", variants: ["Premium 40 TFSI", "Premium Plus 40 TFSI", "Signature Edition", "Technology 40 TFSI"] },
      { name: "A5", bodyType: "Sedan", variants: ["Sportback 35 TDI", "Sportback 40 TDI", "S5"] },
      { name: "A6", bodyType: "Sedan", variants: ["Premium Plus 45 TFSI", "Technology 45 TFSI"] },
      { name: "Q3", bodyType: "SUV", variants: ["40 TFSI Premium", "40 TFSI Premium Plus", "Signature Edition", "40 TFSI Technology"] },
      { name: "Q3 Sportback", bodyType: "SUV", variants: ["Signature Edition", "Bold Edition", "Technology Plus S-line"] },
      { name: "Q5", bodyType: "SUV", variants: ["Premium Plus 45 TFSI", "Bold Edition", "Signature Edition", "Technology 45 TFSI"] },
      { name: "Q7", bodyType: "SUV", variants: ["Premium Plus", "Bold Edition", "Signature Edition", "Technology"] },
      { name: "Q8", bodyType: "SUV", variants: ["55 TFSI quattro"] },
      { name: "SQ8", bodyType: "SUV", variants: ["4.0"] },
      { name: "RS Q8", bodyType: "SUV", variants: ["Performance"] },
      { name: "Q8 e-tron", bodyType: "SUV", variants: ["50", "55"] },
      { name: "e-tron GT", bodyType: "Sedan", variants: ["S", "RS"] },
    ],
  },
  // Mini — verified via CarWale India model/variant pages, cross-checked with Team-BHP for
  // the locally-assembled Countryman C launch.
  {
    name: "Mini",
    models: [
      { name: "Cooper", bodyType: "Hatchback", variants: ["S", "Classic Pack", "Favoured Pack", "JCW", "S Victory Edition", "GP Inspired Edition"] },
      { name: "Cooper SE", bodyType: "Hatchback", variants: ["3-Door", "Charged Edition"] },
      { name: "Cooper Convertible", bodyType: "Convertible", variants: ["S"] },
      { name: "Countryman", bodyType: "SUV", variants: ["C", "JCW All4"] },
    ],
  },
];

// Worldwide Make -> Model names sourced from Wikidata (models with a real English
// Wikipedia article, i.e. independently verifiable — not hand-curated, and NOT
// including variant/trim data, which Wikidata doesn't reliably have). Loaded lazily
// from a static public JSON file rather than bundled, since it's ~4,000 entries.
// See glovebox-architecture.md for how this was built and its known rough edges
// (it spans a century of global models, so it includes some genuinely obscure
// historical trims/codes alongside the familiar ones).
export type GlobalCatalog = Record<string, string[]>;

let globalCatalogCache: GlobalCatalog | null = null;
let globalCatalogPromise: Promise<GlobalCatalog> | null = null;

export function loadGlobalCatalog(): Promise<GlobalCatalog> {
  if (globalCatalogCache) return Promise.resolve(globalCatalogCache);
  if (!globalCatalogPromise) {
    globalCatalogPromise = fetch("/vehicle-catalog-global.json")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load global vehicle catalog");
        return res.json() as Promise<GlobalCatalog>;
      })
      .then((data) => {
        globalCatalogCache = data;
        return data;
      })
      .catch((err: unknown) => {
        globalCatalogPromise = null;
        throw err;
      });
  }
  return globalCatalogPromise;
}

function findMake(make: string): CatalogMake | undefined {
  return VEHICLE_CATALOG.find((m) => m.name.toLowerCase() === make.trim().toLowerCase());
}

function findGlobalBrandKey(global: GlobalCatalog, make: string): string | undefined {
  return Object.keys(global).find((b) => b.toLowerCase() === make.trim().toLowerCase());
}

function mergeCaseInsensitive(primary: string[], secondary: string[]): string[] {
  const merged = [...primary];
  const lower = new Set(primary.map((s) => s.toLowerCase()));
  for (const s of secondary) {
    if (!lower.has(s.toLowerCase())) {
      merged.push(s);
      lower.add(s.toLowerCase());
    }
  }
  return merged.sort((a, b) => a.localeCompare(b));
}

export function getMakeNames(global?: GlobalCatalog): string[] {
  const curated = VEHICLE_CATALOG.map((make) => make.name);
  return global ? mergeCaseInsensitive(curated, Object.keys(global)) : curated;
}

export function getModelNames(make: string, global?: GlobalCatalog): string[] {
  const curated = findMake(make)?.models.map((model) => model.name) ?? [];
  if (!global) return curated;
  const brandKey = findGlobalBrandKey(global, make);
  return brandKey ? mergeCaseInsensitive(curated, global[brandKey]) : curated;
}

function findModel(make: string, model: string): CatalogModel | undefined {
  return findMake(make)?.models.find(
    (m) => m.name.toLowerCase() === model.trim().toLowerCase(),
  );
}

// Variant and body-type data only exists for the hand-curated (India-focused) makes
// above — the global Wikidata-sourced catalog has no trim-level data, so these
// intentionally don't take a `global` parameter. The form falls back to free text
// for variant when nothing is found here.
export function getVariantNames(make: string, model: string): string[] {
  return findModel(make, model)?.variants ?? [];
}

export function getBodyTypeFor(make: string, model: string): string | undefined {
  return findModel(make, model)?.bodyType;
}
