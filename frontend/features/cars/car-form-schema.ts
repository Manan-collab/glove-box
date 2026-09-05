import { z } from "zod";

const CURRENT_YEAR = new Date().getFullYear();

export const carFormSchema = z.object({
  make: z.string().min(1, "Required"),
  model: z.string().min(1, "Required"),
  year: z.coerce
    .number()
    .int()
    .min(1900, "Too old")
    .max(CURRENT_YEAR + 1, "Not a valid year"),
  variant: z.string().min(1, "Required"),
  vin: z.string().optional(),
  engine: z.string().min(1, "Required"),
  fuelType: z.string().min(1, "Required"),
  transmission: z.string().min(1, "Required"),
  bodyType: z.string().min(1, "Required"),
  powerBhp: z.preprocess(
    (val) => (val === "" || val === undefined ? undefined : Number(val)),
    z.number().int().min(1).optional(),
  ),
  odometerKm: z.coerce.number().int().min(0, "Must be 0 or more"),
  usageTag: z.string().optional(),
  insuranceExpiryDate: z.string().optional(),
});

export type CarFormSchema = z.infer<typeof carFormSchema>;

export const FUEL_TYPES = ["Petrol", "Diesel", "Electric", "Hybrid", "CNG"];
export const TRANSMISSIONS = ["Manual", "Automatic", "CVT", "AMT", "DCT"];
export const BODY_TYPES = [
  "Hatchback",
  "Sedan",
  "SUV",
  "MPV",
  "Coupe",
  "Convertible",
  "Pickup",
  "Van",
];
export const CAR_USAGE_TAGS = [
  "Daily Driver",
  "Weekend Car",
  "Project Car",
  "Garage Queen",
];
