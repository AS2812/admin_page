import buildingInfrastructure from "../assets/category_icons/BUILDING_&INFRASTRUCTURE.png";
import environmentWeather from "../assets/category_icons/ENVIRONMENT_&_WEATHER.png";
import fireExplosion from "../assets/category_icons/FIRE_&_EXPLOSION.png";
import marineWaterway from "../assets/category_icons/MARINE_&_WATERWAY.png";
import medicalEmergency from "../assets/category_icons/MEDICAL_EMERGENCY.png";
import occupationalIndustrial from "../assets/category_icons/OCCUPATIONAL_&_INDUSTRIAL.png";
import publicSafetyCrime from "../assets/category_icons/PUBLIC_SAFETY_&_CRIME.png";
import railTransport from "../assets/category_icons/RAIL_&_PUBLIC_TRANSPORT.png";
import roadwayHazard from "../assets/category_icons/ROADWAY_HAZARD.png";
import roadTraffic from "../assets/category_icons/ROAD_TRAFFIC.png";
import utilitiesIcon from "../assets/category_icons/UTILITIES.png";

type IconKey =
  | "building_infrastructure"
  | "environment_weather"
  | "fire_explosion"
  | "marine_waterway"
  | "medical_emergency"
  | "occupational_industrial"
  | "public_safety_crime"
  | "rail_public_transport"
  | "roadway_hazard"
  | "road_traffic"
  | "utilities";

const iconMap: Record<IconKey, string> = {
  building_infrastructure: buildingInfrastructure,
  environment_weather: environmentWeather,
  fire_explosion: fireExplosion,
  marine_waterway: marineWaterway,
  medical_emergency: medicalEmergency,
  occupational_industrial: occupationalIndustrial,
  public_safety_crime: publicSafetyCrime,
  rail_public_transport: railTransport,
  roadway_hazard: roadwayHazard,
  road_traffic: roadTraffic,
  utilities: utilitiesIcon,
};

const keywordMap: Array<{ keyword: RegExp; icon: IconKey }> = [
  { keyword: /fire|explosion|burn/i, icon: "fire_explosion" },
  { keyword: /road|traffic|vehicle|transport/i, icon: "road_traffic" },
  { keyword: /hazard|collision/i, icon: "roadway_hazard" },
  { keyword: /health|medical|injur|clinic/i, icon: "medical_emergency" },
  { keyword: /build|infra|structure/i, icon: "building_infrastructure" },
  { keyword: /utility|power|water|electric|gas/i, icon: "utilities" },
  { keyword: /weather|storm|flood|environment/i, icon: "environment_weather" },
  { keyword: /marine|waterway|port/i, icon: "marine_waterway" },
  { keyword: /occupational|industrial|factory/i, icon: "occupational_industrial" },
  { keyword: /rail|metro|train|public\s+transport/i, icon: "rail_public_transport" },
  { keyword: /safety|crime|security|law/i, icon: "public_safety_crime" },
];

function slugifyCategory(input?: string | null): IconKey | undefined {
  if (!input) return undefined;
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const direct = slug as IconKey;
  if (direct && iconMap[direct]) return direct;

  for (const { keyword, icon } of keywordMap) {
    if (keyword.test(input)) return icon;
  }
  return undefined;
}

export function getCategoryIcon(categoryName?: string | null): string {
  const key = slugifyCategory(categoryName);
  if (key && iconMap[key]) return iconMap[key];
  return publicSafetyCrime;
}
