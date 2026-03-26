/**
 * Complete table of all 118 elements with known isotope mass number ranges.
 * Used for validating ZAIDs in MCNP material cards.
 */

interface Element {
  z: number;
  symbol: string;
  name: string;
  minA: number;
  maxA: number;
}

const elements: Element[] = [
  { z: 1, symbol: 'H', name: 'Hydrogen', minA: 1, maxA: 7 },
  { z: 2, symbol: 'He', name: 'Helium', minA: 2, maxA: 10 },
  { z: 3, symbol: 'Li', name: 'Lithium', minA: 3, maxA: 12 },
  { z: 4, symbol: 'Be', name: 'Beryllium', minA: 5, maxA: 16 },
  { z: 5, symbol: 'B', name: 'Boron', minA: 6, maxA: 21 },
  { z: 6, symbol: 'C', name: 'Carbon', minA: 8, maxA: 22 },
  { z: 7, symbol: 'N', name: 'Nitrogen', minA: 10, maxA: 25 },
  { z: 8, symbol: 'O', name: 'Oxygen', minA: 12, maxA: 28 },
  { z: 9, symbol: 'F', name: 'Fluorine', minA: 14, maxA: 31 },
  { z: 10, symbol: 'Ne', name: 'Neon', minA: 16, maxA: 34 },
  { z: 11, symbol: 'Na', name: 'Sodium', minA: 18, maxA: 37 },
  { z: 12, symbol: 'Mg', name: 'Magnesium', minA: 19, maxA: 40 },
  { z: 13, symbol: 'Al', name: 'Aluminium', minA: 21, maxA: 43 },
  { z: 14, symbol: 'Si', name: 'Silicon', minA: 22, maxA: 44 },
  { z: 15, symbol: 'P', name: 'Phosphorus', minA: 24, maxA: 47 },
  { z: 16, symbol: 'S', name: 'Sulfur', minA: 26, maxA: 49 },
  { z: 17, symbol: 'Cl', name: 'Chlorine', minA: 28, maxA: 51 },
  { z: 18, symbol: 'Ar', name: 'Argon', minA: 30, maxA: 53 },
  { z: 19, symbol: 'K', name: 'Potassium', minA: 32, maxA: 55 },
  { z: 20, symbol: 'Ca', name: 'Calcium', minA: 34, maxA: 57 },
  { z: 21, symbol: 'Sc', name: 'Scandium', minA: 36, maxA: 61 },
  { z: 22, symbol: 'Ti', name: 'Titanium', minA: 38, maxA: 63 },
  { z: 23, symbol: 'V', name: 'Vanadium', minA: 40, maxA: 65 },
  { z: 24, symbol: 'Cr', name: 'Chromium', minA: 42, maxA: 67 },
  { z: 25, symbol: 'Mn', name: 'Manganese', minA: 44, maxA: 69 },
  { z: 26, symbol: 'Fe', name: 'Iron', minA: 45, maxA: 72 },
  { z: 27, symbol: 'Co', name: 'Cobalt', minA: 47, maxA: 75 },
  { z: 28, symbol: 'Ni', name: 'Nickel', minA: 48, maxA: 78 },
  { z: 29, symbol: 'Cu', name: 'Copper', minA: 52, maxA: 80 },
  { z: 30, symbol: 'Zn', name: 'Zinc', minA: 54, maxA: 83 },
  { z: 31, symbol: 'Ga', name: 'Gallium', minA: 56, maxA: 86 },
  { z: 32, symbol: 'Ge', name: 'Germanium', minA: 58, maxA: 89 },
  { z: 33, symbol: 'As', name: 'Arsenic', minA: 60, maxA: 92 },
  { z: 34, symbol: 'Se', name: 'Selenium', minA: 65, maxA: 94 },
  { z: 35, symbol: 'Br', name: 'Bromine', minA: 67, maxA: 97 },
  { z: 36, symbol: 'Kr', name: 'Krypton', minA: 69, maxA: 100 },
  { z: 37, symbol: 'Rb', name: 'Rubidium', minA: 71, maxA: 102 },
  { z: 38, symbol: 'Sr', name: 'Strontium', minA: 73, maxA: 105 },
  { z: 39, symbol: 'Y', name: 'Yttrium', minA: 76, maxA: 108 },
  { z: 40, symbol: 'Zr', name: 'Zirconium', minA: 78, maxA: 110 },
  { z: 41, symbol: 'Nb', name: 'Niobium', minA: 81, maxA: 113 },
  { z: 42, symbol: 'Mo', name: 'Molybdenum', minA: 83, maxA: 115 },
  { z: 43, symbol: 'Tc', name: 'Technetium', minA: 85, maxA: 118 },
  { z: 44, symbol: 'Ru', name: 'Ruthenium', minA: 87, maxA: 120 },
  { z: 45, symbol: 'Rh', name: 'Rhodium', minA: 89, maxA: 122 },
  { z: 46, symbol: 'Pd', name: 'Palladium', minA: 91, maxA: 124 },
  { z: 47, symbol: 'Ag', name: 'Silver', minA: 93, maxA: 130 },
  { z: 48, symbol: 'Cd', name: 'Cadmium', minA: 95, maxA: 132 },
  { z: 49, symbol: 'In', name: 'Indium', minA: 97, maxA: 135 },
  { z: 50, symbol: 'Sn', name: 'Tin', minA: 99, maxA: 137 },
  { z: 51, symbol: 'Sb', name: 'Antimony', minA: 103, maxA: 139 },
  { z: 52, symbol: 'Te', name: 'Tellurium', minA: 105, maxA: 142 },
  { z: 53, symbol: 'I', name: 'Iodine', minA: 108, maxA: 144 },
  { z: 54, symbol: 'Xe', name: 'Xenon', minA: 110, maxA: 147 },
  { z: 55, symbol: 'Cs', name: 'Caesium', minA: 112, maxA: 151 },
  { z: 56, symbol: 'Ba', name: 'Barium', minA: 114, maxA: 153 },
  { z: 57, symbol: 'La', name: 'Lanthanum', minA: 117, maxA: 155 },
  { z: 58, symbol: 'Ce', name: 'Cerium', minA: 119, maxA: 157 },
  { z: 59, symbol: 'Pr', name: 'Praseodymium', minA: 121, maxA: 159 },
  { z: 60, symbol: 'Nd', name: 'Neodymium', minA: 124, maxA: 161 },
  { z: 61, symbol: 'Pm', name: 'Promethium', minA: 126, maxA: 163 },
  { z: 62, symbol: 'Sm', name: 'Samarium', minA: 128, maxA: 165 },
  { z: 63, symbol: 'Eu', name: 'Europium', minA: 130, maxA: 167 },
  { z: 64, symbol: 'Gd', name: 'Gadolinium', minA: 133, maxA: 169 },
  { z: 65, symbol: 'Tb', name: 'Terbium', minA: 135, maxA: 171 },
  { z: 66, symbol: 'Dy', name: 'Dysprosium', minA: 138, maxA: 173 },
  { z: 67, symbol: 'Ho', name: 'Holmium', minA: 140, maxA: 175 },
  { z: 68, symbol: 'Er', name: 'Erbium', minA: 142, maxA: 177 },
  { z: 69, symbol: 'Tm', name: 'Thulium', minA: 144, maxA: 179 },
  { z: 70, symbol: 'Yb', name: 'Ytterbium', minA: 148, maxA: 181 },
  { z: 71, symbol: 'Lu', name: 'Lutetium', minA: 150, maxA: 184 },
  { z: 72, symbol: 'Hf', name: 'Hafnium', minA: 153, maxA: 186 },
  { z: 73, symbol: 'Ta', name: 'Tantalum', minA: 155, maxA: 190 },
  { z: 74, symbol: 'W', name: 'Tungsten', minA: 158, maxA: 192 },
  { z: 75, symbol: 'Re', name: 'Rhenium', minA: 160, maxA: 194 },
  { z: 76, symbol: 'Os', name: 'Osmium', minA: 162, maxA: 196 },
  { z: 77, symbol: 'Ir', name: 'Iridium', minA: 164, maxA: 199 },
  { z: 78, symbol: 'Pt', name: 'Platinum', minA: 166, maxA: 202 },
  { z: 79, symbol: 'Au', name: 'Gold', minA: 169, maxA: 205 },
  { z: 80, symbol: 'Hg', name: 'Mercury', minA: 171, maxA: 210 },
  { z: 81, symbol: 'Tl', name: 'Thallium', minA: 176, maxA: 212 },
  { z: 82, symbol: 'Pb', name: 'Lead', minA: 178, maxA: 215 },
  { z: 83, symbol: 'Bi', name: 'Bismuth', minA: 184, maxA: 218 },
  { z: 84, symbol: 'Po', name: 'Polonium', minA: 186, maxA: 220 },
  { z: 85, symbol: 'At', name: 'Astatine', minA: 191, maxA: 223 },
  { z: 86, symbol: 'Rn', name: 'Radon', minA: 193, maxA: 228 },
  { z: 87, symbol: 'Fr', name: 'Francium', minA: 199, maxA: 232 },
  { z: 88, symbol: 'Ra', name: 'Radium', minA: 202, maxA: 234 },
  { z: 89, symbol: 'Ac', name: 'Actinium', minA: 206, maxA: 236 },
  { z: 90, symbol: 'Th', name: 'Thorium', minA: 208, maxA: 238 },
  { z: 91, symbol: 'Pa', name: 'Protactinium', minA: 212, maxA: 240 },
  { z: 92, symbol: 'U', name: 'Uranium', minA: 217, maxA: 242 },
  { z: 93, symbol: 'Np', name: 'Neptunium', minA: 225, maxA: 244 },
  { z: 94, symbol: 'Pu', name: 'Plutonium', minA: 228, maxA: 247 },
  { z: 95, symbol: 'Am', name: 'Americium', minA: 230, maxA: 249 },
  { z: 96, symbol: 'Cm', name: 'Curium', minA: 233, maxA: 252 },
  { z: 97, symbol: 'Bk', name: 'Berkelium', minA: 235, maxA: 254 },
  { z: 98, symbol: 'Cf', name: 'Californium', minA: 237, maxA: 256 },
  { z: 99, symbol: 'Es', name: 'Einsteinium', minA: 240, maxA: 258 },
  { z: 100, symbol: 'Fm', name: 'Fermium', minA: 242, maxA: 260 },
  { z: 101, symbol: 'Md', name: 'Mendelevium', minA: 245, maxA: 262 },
  { z: 102, symbol: 'No', name: 'Nobelium', minA: 248, maxA: 264 },
  { z: 103, symbol: 'Lr', name: 'Lawrencium', minA: 251, maxA: 266 },
  { z: 104, symbol: 'Rf', name: 'Rutherfordium', minA: 253, maxA: 270 },
  { z: 105, symbol: 'Db', name: 'Dubnium', minA: 255, maxA: 274 },
  { z: 106, symbol: 'Sg', name: 'Seaborgium', minA: 258, maxA: 273 },
  { z: 107, symbol: 'Bh', name: 'Bohrium', minA: 260, maxA: 275 },
  { z: 108, symbol: 'Hs', name: 'Hassium', minA: 263, maxA: 277 },
  { z: 109, symbol: 'Mt', name: 'Meitnerium', minA: 265, maxA: 279 },
  { z: 110, symbol: 'Ds', name: 'Darmstadtium', minA: 267, maxA: 281 },
  { z: 111, symbol: 'Rg', name: 'Roentgenium', minA: 272, maxA: 283 },
  { z: 112, symbol: 'Cn', name: 'Copernicium', minA: 277, maxA: 285 },
  { z: 113, symbol: 'Nh', name: 'Nihonium', minA: 278, maxA: 290 },
  { z: 114, symbol: 'Fl', name: 'Flerovium', minA: 285, maxA: 290 },
  { z: 115, symbol: 'Mc', name: 'Moscovium', minA: 287, maxA: 290 },
  { z: 116, symbol: 'Lv', name: 'Livermorium', minA: 289, maxA: 293 },
  { z: 117, symbol: 'Ts', name: 'Tennessine', minA: 291, maxA: 294 },
  { z: 118, symbol: 'Og', name: 'Oganesson', minA: 293, maxA: 295 },
];

const elementByZ = new Map(elements.map(el => [el.z, el]));

/**
 * Get element data by atomic number.
 */
export function getElement(z: number): Element | undefined {
  return elementByZ.get(z);
}

/**
 * Check if an atomic number is valid (1-118).
 */
export function isValidZ(z: number): boolean {
  return z >= 1 && z <= 118;
}

/**
 * Check if a mass number is plausible for a given element.
 * A=0 means natural composition and is always valid for valid Z.
 */
export function isPlausibleIsotope(z: number, a: number): boolean {
  if (!isValidZ(z)) return false;
  if (a === 0) return true; // natural
  const el = elementByZ.get(z);
  if (!el) return false;
  return a >= el.minA && a <= el.maxA;
}
