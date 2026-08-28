export type SchematicPoint = [number, number];

export type SchematicZone = {
  id: string;
  label: string;
  bounds: SchematicPoint[];
  labelPosition: SchematicPoint;
  tone: string;
};

export type SchematicRoad = {
  id: string;
  points: SchematicPoint[];
};

export type SchematicWalkway = {
  id: string;
  points: SchematicPoint[];
};

export type SchematicLandmark = {
  id: string;
  label: string;
  position: SchematicPoint;
};

// This is a local drawing grid based on the supplied 1852 x 1990 plan. It is
// intentionally not latitude/longitude and must not be used as survey data.
export const schematicImageWidth = 1852;
export const schematicImageHeight = 1990;
export const schematicMapBounds: [SchematicPoint, SchematicPoint] = [[0, 0], [schematicImageHeight, schematicImageWidth]];

const point = (x: number, y: number): SchematicPoint => [schematicImageHeight - y, x];
const polygon = (...points: Array<[number, number]>): SchematicPoint[] => points.map(([x, y]) => point(x, y));

// Major garden footprints traced from the visible plan relationships.
export const schematicZones: SchematicZone[] = [
  // These polygons intentionally cover only the green lawn interiors. Gray
  // roadways are left outside the hit areas so they separate neighboring lots.
  { id: "dpg", label: "Dates Palm Garden", bounds: polygon([215, 505], [500, 490], [550, 535], [545, 680], [500, 745], [300, 755], [220, 720], [200, 620]), labelPosition: point(355, 570), tone: "var(--map-zone-date)" },
  { id: "hpg", label: "Hawaiian Palm Garden", bounds: polygon([640, 250], [1160, 265], [1175, 500], [1110, 550], [650, 545], [585, 475]), labelPosition: point(835, 340), tone: "var(--map-zone-hawaiian)" },
  { id: "ypg", label: "Yellow Palm Garden", bounds: polygon([1240, 320], [1640, 340], [1670, 760], [1590, 825], [1260, 800], [1210, 650]), labelPosition: point(1450, 480), tone: "var(--map-zone-yellow)" },
  { id: "rpg", label: "Royal Palm Garden", bounds: polygon([660, 655], [1090, 675], [1145, 920], [1080, 975], [700, 940], [640, 875]), labelPosition: point(900, 770), tone: "var(--map-zone-royal)" },
  { id: "bpg", label: "Butterfly Palm Garden", bounds: polygon([1240, 1080], [1570, 1060], [1640, 1330], [1540, 1415], [1260, 1400], [1180, 1280]), labelPosition: point(1450, 1210), tone: "var(--map-zone-butterfly)" },
  { id: "mpg", label: "Majestic Palm Garden", bounds: polygon([920, 1570], [1500, 1540], [1700, 1610], [1780, 1930], [1000, 1970], [870, 1800]), labelPosition: point(1320, 1700), tone: "var(--map-zone-majestic)" },
];

// Vehicle road centerlines traced from the loops and junctions in the plan.
export const schematicRoads: SchematicRoad[] = [
  { id: "north-road", points: [point(565, 205), point(520, 315), point(500, 470), point(560, 555), point(1120, 610), point(1195, 560), point(1195, 300), point(1680, 325), point(1710, 470), point(1715, 800), point(1630, 900), point(1280, 1010)] },
  { id: "dates-loop", points: [point(565, 205), point(500, 350), point(425, 515), point(250, 555), point(190, 640), point(205, 755), point(430, 805), point(570, 785)] },
  { id: "royal-road", points: [point(560, 555), point(650, 600), point(1120, 640), point(1190, 700), point(1190, 900), point(1100, 1015), point(850, 1000), point(610, 930)] },
  { id: "west-connector", points: [point(610, 930), point(650, 795), point(690, 650), point(705, 500), point(700, 330)] },
  { id: "south-road", points: [point(1280, 1010), point(1370, 1080), point(1395, 1210), point(1320, 1345), point(1180, 1435), point(980, 1470)] },
  { id: "majestic-road", points: [point(980, 1470), point(1180, 1470), point(1450, 1410), point(1630, 1335), point(1760, 1450), point(1690, 1585), point(1450, 1650)] },
];

// Narrow internal garden walkways shown separately from the vehicle roads.
export const schematicWalkways: SchematicWalkway[] = [
  { id: "hpg-horizontal", points: [point(555, 365), point(785, 380), point(1010, 395)] },
  { id: "hpg-vertical", points: [point(790, 205), point(780, 390), point(770, 605)] },
  { id: "ypg-horizontal", points: [point(1195, 525), point(1420, 525), point(1660, 540)] },
  { id: "ypg-vertical", points: [point(1420, 355), point(1420, 525), point(1415, 765)] },
  { id: "rpg-left", points: [point(650, 595), point(615, 760), point(585, 910)] },
  { id: "rpg-horizontal", points: [point(650, 720), point(805, 735), point(1125, 765)] },
  { id: "rpg-vertical", points: [point(805, 650), point(795, 825), point(780, 1010)] },
  { id: "mpg-vertical", points: [point(1225, 1450), point(1225, 1680), point(1220, 1900)] },
];

export const schematicLandmarks: SchematicLandmark[] = [
  { id: "hpg-landmark", label: "Hawaiian Palm landmark", position: point(790, 390) },
  { id: "ypg-landmark", label: "Yellow Palm landmark", position: point(1420, 525) },
  { id: "rpg-landmark", label: "Royal Palm landmark", position: point(805, 825) },
  { id: "main-entrance", label: "Main entrance", position: point(1280, 1010) },
];
