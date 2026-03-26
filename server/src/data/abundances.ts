/**
 * IUPAC 2021 recommended natural isotopic abundances.
 * Covers Z=1 through Z=92, excluding synthetic elements with no stable isotopes:
 * Z=43 (Tc), Z=61 (Pm), Z=84 (Po), Z=85 (At), Z=86 (Rn), Z=87 (Fr),
 * Z=88 (Ra), Z=89 (Ac), Z=91 (Pa).
 *
 * Weight fractions are computed from atom fractions and IUPAC atomic masses.
 * Both atom and weight fraction arrays sum to ~1.0 for each element.
 */

interface IsotopeAbundance {
  a: number;
  atomFraction: number;
  weightFraction: number;
}

/**
 * Compute weight fractions from atom fractions using isotopic masses.
 * weightFraction_i = atomFraction_i * mass_i / sum(atomFraction_j * mass_j)
 */
function toWeightFractions(
  isotopes: { a: number; atomFraction: number; mass: number }[]
): IsotopeAbundance[] {
  const totalMass = isotopes.reduce((s, i) => s + i.atomFraction * i.mass, 0);
  return isotopes.map(i => ({
    a: i.a,
    atomFraction: i.atomFraction,
    weightFraction: (i.atomFraction * i.mass) / totalMass,
  }));
}

// Monoisotopic helper
function mono(a: number): IsotopeAbundance[] {
  return [{ a, atomFraction: 1.0, weightFraction: 1.0 }];
}

const abundanceData = new Map<number, IsotopeAbundance[]>();

// Z=1: Hydrogen
abundanceData.set(1, toWeightFractions([
  { a: 1, atomFraction: 0.999885, mass: 1.00782503 },
  { a: 2, atomFraction: 0.000115, mass: 2.01410178 },
]));

// Z=2: Helium
abundanceData.set(2, toWeightFractions([
  { a: 3, atomFraction: 0.00000134, mass: 3.01602932 },
  { a: 4, atomFraction: 0.99999866, mass: 4.00260325 },
]));

// Z=3: Lithium
abundanceData.set(3, toWeightFractions([
  { a: 6, atomFraction: 0.0759, mass: 6.01512279 },
  { a: 7, atomFraction: 0.9241, mass: 7.01600344 },
]));

// Z=4: Beryllium (monoisotopic)
abundanceData.set(4, mono(9));

// Z=5: Boron
abundanceData.set(5, toWeightFractions([
  { a: 10, atomFraction: 0.199, mass: 10.01293695 },
  { a: 11, atomFraction: 0.801, mass: 11.00930536 },
]));

// Z=6: Carbon
abundanceData.set(6, toWeightFractions([
  { a: 12, atomFraction: 0.9893, mass: 12.0 },
  { a: 13, atomFraction: 0.0107, mass: 13.00335484 },
]));

// Z=7: Nitrogen
abundanceData.set(7, toWeightFractions([
  { a: 14, atomFraction: 0.99636, mass: 14.00307400 },
  { a: 15, atomFraction: 0.00364, mass: 15.00010890 },
]));

// Z=8: Oxygen
abundanceData.set(8, toWeightFractions([
  { a: 16, atomFraction: 0.99757, mass: 15.99491462 },
  { a: 17, atomFraction: 0.00038, mass: 16.99913176 },
  { a: 18, atomFraction: 0.00205, mass: 17.99915961 },
]));

// Z=9: Fluorine (monoisotopic)
abundanceData.set(9, mono(19));

// Z=10: Neon
abundanceData.set(10, toWeightFractions([
  { a: 20, atomFraction: 0.9048, mass: 19.99244018 },
  { a: 21, atomFraction: 0.0027, mass: 20.99384668 },
  { a: 22, atomFraction: 0.0925, mass: 21.99138511 },
]));

// Z=11: Sodium (monoisotopic)
abundanceData.set(11, mono(23));

// Z=12: Magnesium
abundanceData.set(12, toWeightFractions([
  { a: 24, atomFraction: 0.7899, mass: 23.98504170 },
  { a: 25, atomFraction: 0.1000, mass: 24.98583698 },
  { a: 26, atomFraction: 0.1101, mass: 25.98259297 },
]));

// Z=13: Aluminium (monoisotopic)
abundanceData.set(13, mono(27));

// Z=14: Silicon
abundanceData.set(14, toWeightFractions([
  { a: 28, atomFraction: 0.92223, mass: 27.97692653 },
  { a: 29, atomFraction: 0.04685, mass: 28.97649472 },
  { a: 30, atomFraction: 0.03092, mass: 29.97377014 },
]));

// Z=15: Phosphorus (monoisotopic)
abundanceData.set(15, mono(31));

// Z=16: Sulfur
abundanceData.set(16, toWeightFractions([
  { a: 32, atomFraction: 0.9499, mass: 31.97207117 },
  { a: 33, atomFraction: 0.0075, mass: 32.97145891 },
  { a: 34, atomFraction: 0.0425, mass: 33.96786700 },
  { a: 36, atomFraction: 0.0001, mass: 35.96708071 },
]));

// Z=17: Chlorine
abundanceData.set(17, toWeightFractions([
  { a: 35, atomFraction: 0.7576, mass: 34.96885268 },
  { a: 37, atomFraction: 0.2424, mass: 36.96590260 },
]));

// Z=18: Argon
abundanceData.set(18, toWeightFractions([
  { a: 36, atomFraction: 0.003336, mass: 35.96754511 },
  { a: 38, atomFraction: 0.000629, mass: 37.96273211 },
  { a: 40, atomFraction: 0.996035, mass: 39.96238312 },
]));

// Z=19: Potassium
abundanceData.set(19, toWeightFractions([
  { a: 39, atomFraction: 0.932581, mass: 38.96370668 },
  { a: 40, atomFraction: 0.000117, mass: 39.96399848 },
  { a: 41, atomFraction: 0.067302, mass: 40.96182576 },
]));

// Z=20: Calcium
abundanceData.set(20, toWeightFractions([
  { a: 40, atomFraction: 0.96941, mass: 39.96259098 },
  { a: 42, atomFraction: 0.00647, mass: 41.95861801 },
  { a: 43, atomFraction: 0.00135, mass: 42.95876644 },
  { a: 44, atomFraction: 0.02086, mass: 43.95548156 },
  { a: 46, atomFraction: 0.00004, mass: 45.95369276 },
  { a: 48, atomFraction: 0.00187, mass: 47.95252276 },
]));

// Z=21: Scandium (monoisotopic)
abundanceData.set(21, mono(45));

// Z=22: Titanium
abundanceData.set(22, toWeightFractions([
  { a: 46, atomFraction: 0.0825, mass: 45.95262772 },
  { a: 47, atomFraction: 0.0744, mass: 46.95175879 },
  { a: 48, atomFraction: 0.7372, mass: 47.94794198 },
  { a: 49, atomFraction: 0.0541, mass: 48.94786568 },
  { a: 50, atomFraction: 0.0518, mass: 49.94478689 },
]));

// Z=23: Vanadium
abundanceData.set(23, toWeightFractions([
  { a: 50, atomFraction: 0.00250, mass: 49.94715601 },
  { a: 51, atomFraction: 0.99750, mass: 50.94395704 },
]));

// Z=24: Chromium
abundanceData.set(24, toWeightFractions([
  { a: 50, atomFraction: 0.04345, mass: 49.94604183 },
  { a: 52, atomFraction: 0.83789, mass: 51.94050623 },
  { a: 53, atomFraction: 0.09501, mass: 52.94064815 },
  { a: 54, atomFraction: 0.02365, mass: 53.93887916 },
]));

// Z=25: Manganese (monoisotopic)
abundanceData.set(25, mono(55));

// Z=26: Iron
abundanceData.set(26, toWeightFractions([
  { a: 54, atomFraction: 0.05845, mass: 53.93960899 },
  { a: 56, atomFraction: 0.91754, mass: 55.93493633 },
  { a: 57, atomFraction: 0.02119, mass: 56.93539284 },
  { a: 58, atomFraction: 0.00282, mass: 57.93327443 },
]));

// Z=27: Cobalt (monoisotopic)
abundanceData.set(27, mono(59));

// Z=28: Nickel
abundanceData.set(28, toWeightFractions([
  { a: 58, atomFraction: 0.68077, mass: 57.93534241 },
  { a: 60, atomFraction: 0.26223, mass: 59.93078589 },
  { a: 61, atomFraction: 0.01140, mass: 60.93105557 },
  { a: 62, atomFraction: 0.03634, mass: 61.92834537 },
  { a: 64, atomFraction: 0.00926, mass: 63.92796682 },
]));

// Z=29: Copper
abundanceData.set(29, toWeightFractions([
  { a: 63, atomFraction: 0.6915, mass: 62.92959772 },
  { a: 65, atomFraction: 0.3085, mass: 64.92778970 },
]));

// Z=30: Zinc
abundanceData.set(30, toWeightFractions([
  { a: 64, atomFraction: 0.4917, mass: 63.92914201 },
  { a: 66, atomFraction: 0.2773, mass: 65.92603381 },
  { a: 67, atomFraction: 0.0404, mass: 66.92712775 },
  { a: 68, atomFraction: 0.1845, mass: 67.92484455 },
  { a: 70, atomFraction: 0.0061, mass: 69.92531920 },
]));

// Z=31: Gallium
abundanceData.set(31, toWeightFractions([
  { a: 69, atomFraction: 0.60108, mass: 68.92557350 },
  { a: 71, atomFraction: 0.39892, mass: 70.92470258 },
]));

// Z=32: Germanium
abundanceData.set(32, toWeightFractions([
  { a: 70, atomFraction: 0.2057, mass: 69.92424875 },
  { a: 72, atomFraction: 0.2745, mass: 71.92207583 },
  { a: 73, atomFraction: 0.0775, mass: 72.92345896 },
  { a: 74, atomFraction: 0.3650, mass: 73.92117776 },
  { a: 76, atomFraction: 0.0773, mass: 75.92140273 },
]));

// Z=33: Arsenic (monoisotopic)
abundanceData.set(33, mono(75));

// Z=34: Selenium
abundanceData.set(34, toWeightFractions([
  { a: 74, atomFraction: 0.0089, mass: 73.92247593 },
  { a: 76, atomFraction: 0.0937, mass: 75.91921370 },
  { a: 77, atomFraction: 0.0763, mass: 76.91991415 },
  { a: 78, atomFraction: 0.2377, mass: 77.91730928 },
  { a: 80, atomFraction: 0.4961, mass: 79.91652130 },
  { a: 82, atomFraction: 0.0873, mass: 81.91669948 },
]));

// Z=35: Bromine
abundanceData.set(35, toWeightFractions([
  { a: 79, atomFraction: 0.5069, mass: 78.91833710 },
  { a: 81, atomFraction: 0.4931, mass: 80.91628960 },
]));

// Z=36: Krypton
abundanceData.set(36, toWeightFractions([
  { a: 78, atomFraction: 0.00355, mass: 77.92036494 },
  { a: 80, atomFraction: 0.02286, mass: 79.91637808 },
  { a: 82, atomFraction: 0.11593, mass: 81.91348273 },
  { a: 83, atomFraction: 0.11500, mass: 82.91412716 },
  { a: 84, atomFraction: 0.56987, mass: 83.91149773 },
  { a: 86, atomFraction: 0.17279, mass: 85.91061063 },
]));

// Z=37: Rubidium
abundanceData.set(37, toWeightFractions([
  { a: 85, atomFraction: 0.7217, mass: 84.91178974 },
  { a: 87, atomFraction: 0.2783, mass: 86.90918053 },
]));

// Z=38: Strontium
abundanceData.set(38, toWeightFractions([
  { a: 84, atomFraction: 0.0056, mass: 83.91337500 },
  { a: 86, atomFraction: 0.0986, mass: 85.90926073 },
  { a: 87, atomFraction: 0.0700, mass: 86.90887750 },
  { a: 88, atomFraction: 0.8258, mass: 87.90561226 },
]));

// Z=39: Yttrium (monoisotopic)
abundanceData.set(39, mono(89));

// Z=40: Zirconium
abundanceData.set(40, toWeightFractions([
  { a: 90, atomFraction: 0.5145, mass: 89.90469876 },
  { a: 91, atomFraction: 0.1122, mass: 90.90564022 },
  { a: 92, atomFraction: 0.1715, mass: 91.90503532 },
  { a: 94, atomFraction: 0.1738, mass: 93.90631252 },
  { a: 96, atomFraction: 0.0280, mass: 95.90827762 },
]));

// Z=41: Niobium (monoisotopic)
abundanceData.set(41, mono(93));

// Z=42: Molybdenum
abundanceData.set(42, toWeightFractions([
  { a: 92, atomFraction: 0.1453, mass: 91.90680796 },
  { a: 94, atomFraction: 0.0915, mass: 93.90508490 },
  { a: 95, atomFraction: 0.1584, mass: 94.90583877 },
  { a: 96, atomFraction: 0.1667, mass: 95.90467612 },
  { a: 97, atomFraction: 0.0960, mass: 96.90601812 },
  { a: 98, atomFraction: 0.2439, mass: 97.90540482 },
  { a: 100, atomFraction: 0.0982, mass: 99.90747180 },
]));

// Z=43: Technetium — synthetic, skip

// Z=44: Ruthenium
abundanceData.set(44, toWeightFractions([
  { a: 96, atomFraction: 0.0554, mass: 95.90759025 },
  { a: 98, atomFraction: 0.0187, mass: 97.90528681 },
  { a: 99, atomFraction: 0.1276, mass: 98.90593411 },
  { a: 100, atomFraction: 0.1260, mass: 99.90421431 },
  { a: 101, atomFraction: 0.1706, mass: 100.90558370 },
  { a: 102, atomFraction: 0.3155, mass: 101.90434930 },
  { a: 104, atomFraction: 0.1862, mass: 103.90542430 },
]));

// Z=45: Rhodium (monoisotopic)
abundanceData.set(45, mono(103));

// Z=46: Palladium
abundanceData.set(46, toWeightFractions([
  { a: 102, atomFraction: 0.0102, mass: 101.90560900 },
  { a: 104, atomFraction: 0.1114, mass: 103.90403054 },
  { a: 105, atomFraction: 0.2233, mass: 104.90508490 },
  { a: 106, atomFraction: 0.2733, mass: 105.90348610 },
  { a: 108, atomFraction: 0.2646, mass: 107.90389160 },
  { a: 110, atomFraction: 0.1172, mass: 109.90517220 },
]));

// Z=47: Silver
abundanceData.set(47, toWeightFractions([
  { a: 107, atomFraction: 0.51839, mass: 106.90509682 },
  { a: 109, atomFraction: 0.48161, mass: 108.90475528 },
]));

// Z=48: Cadmium
abundanceData.set(48, toWeightFractions([
  { a: 106, atomFraction: 0.0125, mass: 105.90645940 },
  { a: 108, atomFraction: 0.0089, mass: 107.90418344 },
  { a: 110, atomFraction: 0.1249, mass: 109.90300661 },
  { a: 111, atomFraction: 0.1280, mass: 110.90418287 },
  { a: 112, atomFraction: 0.2413, mass: 111.90276287 },
  { a: 113, atomFraction: 0.1222, mass: 112.90440813 },
  { a: 114, atomFraction: 0.2873, mass: 113.90336509 },
  { a: 116, atomFraction: 0.0749, mass: 115.90476315 },
]));

// Z=49: Indium
abundanceData.set(49, toWeightFractions([
  { a: 113, atomFraction: 0.0429, mass: 112.90406184 },
  { a: 115, atomFraction: 0.9571, mass: 114.90387878 },
]));

// Z=50: Tin
abundanceData.set(50, toWeightFractions([
  { a: 112, atomFraction: 0.0097, mass: 111.90482387 },
  { a: 114, atomFraction: 0.0066, mass: 113.90278040 },
  { a: 115, atomFraction: 0.0034, mass: 114.90334469 },
  { a: 116, atomFraction: 0.1454, mass: 115.90174280 },
  { a: 117, atomFraction: 0.0768, mass: 116.90295398 },
  { a: 118, atomFraction: 0.2422, mass: 117.90160657 },
  { a: 119, atomFraction: 0.0859, mass: 118.90331117 },
  { a: 120, atomFraction: 0.3258, mass: 119.90220163 },
  { a: 122, atomFraction: 0.0463, mass: 121.90344380 },
  { a: 124, atomFraction: 0.0579, mass: 123.90527660 },
]));

// Z=51: Antimony
abundanceData.set(51, toWeightFractions([
  { a: 121, atomFraction: 0.5721, mass: 120.90381570 },
  { a: 123, atomFraction: 0.4279, mass: 122.90421320 },
]));

// Z=52: Tellurium
abundanceData.set(52, toWeightFractions([
  { a: 120, atomFraction: 0.0009, mass: 119.90405930 },
  { a: 122, atomFraction: 0.0255, mass: 121.90304340 },
  { a: 123, atomFraction: 0.0089, mass: 122.90427050 },
  { a: 124, atomFraction: 0.0474, mass: 123.90281950 },
  { a: 125, atomFraction: 0.0707, mass: 124.90443060 },
  { a: 126, atomFraction: 0.1884, mass: 125.90331080 },
  { a: 128, atomFraction: 0.3174, mass: 127.90446128 },
  { a: 130, atomFraction: 0.3408, mass: 129.90622275 },
]));

// Z=53: Iodine (monoisotopic)
abundanceData.set(53, mono(127));

// Z=54: Xenon
abundanceData.set(54, toWeightFractions([
  { a: 124, atomFraction: 0.000952, mass: 123.90589300 },
  { a: 126, atomFraction: 0.000890, mass: 125.90427420 },
  { a: 128, atomFraction: 0.019102, mass: 127.90353130 },
  { a: 129, atomFraction: 0.264006, mass: 128.90478086 },
  { a: 130, atomFraction: 0.040710, mass: 129.90350935 },
  { a: 131, atomFraction: 0.212324, mass: 130.90508406 },
  { a: 132, atomFraction: 0.269086, mass: 131.90415509 },
  { a: 134, atomFraction: 0.104357, mass: 133.90539466 },
  { a: 136, atomFraction: 0.088573, mass: 135.90721448 },
]));

// Z=55: Caesium (monoisotopic)
abundanceData.set(55, mono(133));

// Z=56: Barium
abundanceData.set(56, toWeightFractions([
  { a: 130, atomFraction: 0.00106, mass: 129.90632080 },
  { a: 132, atomFraction: 0.00101, mass: 131.90506130 },
  { a: 134, atomFraction: 0.02417, mass: 133.90450818 },
  { a: 135, atomFraction: 0.06592, mass: 134.90568838 },
  { a: 136, atomFraction: 0.07854, mass: 135.90457573 },
  { a: 137, atomFraction: 0.11232, mass: 136.90582714 },
  { a: 138, atomFraction: 0.71698, mass: 137.90524700 },
]));

// Z=57: Lanthanum
abundanceData.set(57, toWeightFractions([
  { a: 138, atomFraction: 0.000888, mass: 137.90711490 },
  { a: 139, atomFraction: 0.999112, mass: 138.90636360 },
]));

// Z=58: Cerium
abundanceData.set(58, toWeightFractions([
  { a: 136, atomFraction: 0.00185, mass: 135.90712921 },
  { a: 138, atomFraction: 0.00251, mass: 137.90599110 },
  { a: 140, atomFraction: 0.88450, mass: 139.90544310 },
  { a: 142, atomFraction: 0.11114, mass: 141.90925040 },
]));

// Z=59: Praseodymium (monoisotopic)
abundanceData.set(59, mono(141));

// Z=60: Neodymium
abundanceData.set(60, toWeightFractions([
  { a: 142, atomFraction: 0.27152, mass: 141.90773250 },
  { a: 143, atomFraction: 0.12174, mass: 142.90982000 },
  { a: 144, atomFraction: 0.23798, mass: 143.91009930 },
  { a: 145, atomFraction: 0.08293, mass: 144.91257930 },
  { a: 146, atomFraction: 0.17189, mass: 145.91312260 },
  { a: 148, atomFraction: 0.05756, mass: 147.91689930 },
  { a: 150, atomFraction: 0.05638, mass: 149.92090220 },
]));

// Z=61: Promethium — synthetic, skip

// Z=62: Samarium
abundanceData.set(62, toWeightFractions([
  { a: 144, atomFraction: 0.0307, mass: 143.91200640 },
  { a: 147, atomFraction: 0.1499, mass: 146.91490440 },
  { a: 148, atomFraction: 0.1124, mass: 147.91482920 },
  { a: 149, atomFraction: 0.1382, mass: 148.91719330 },
  { a: 150, atomFraction: 0.0738, mass: 149.91727640 },
  { a: 152, atomFraction: 0.2675, mass: 151.91973970 },
  { a: 154, atomFraction: 0.2275, mass: 153.92221690 },
]));

// Z=63: Europium
abundanceData.set(63, toWeightFractions([
  { a: 151, atomFraction: 0.4781, mass: 150.91985700 },
  { a: 153, atomFraction: 0.5219, mass: 152.92124300 },
]));

// Z=64: Gadolinium
abundanceData.set(64, toWeightFractions([
  { a: 152, atomFraction: 0.0020, mass: 151.91979950 },
  { a: 154, atomFraction: 0.0218, mass: 153.92087340 },
  { a: 155, atomFraction: 0.1480, mass: 154.92263050 },
  { a: 156, atomFraction: 0.2047, mass: 155.92213050 },
  { a: 157, atomFraction: 0.1565, mass: 156.92396160 },
  { a: 158, atomFraction: 0.2484, mass: 157.92411230 },
  { a: 160, atomFraction: 0.2186, mass: 159.92706240 },
]));

// Z=65: Terbium (monoisotopic)
abundanceData.set(65, mono(159));

// Z=66: Dysprosium
abundanceData.set(66, toWeightFractions([
  { a: 156, atomFraction: 0.00056, mass: 155.92428280 },
  { a: 158, atomFraction: 0.00095, mass: 157.92441560 },
  { a: 160, atomFraction: 0.02329, mass: 159.92520450 },
  { a: 161, atomFraction: 0.18889, mass: 160.92694030 },
  { a: 162, atomFraction: 0.25475, mass: 161.92681350 },
  { a: 163, atomFraction: 0.24896, mass: 162.92873830 },
  { a: 164, atomFraction: 0.28260, mass: 163.92918190 },
]));

// Z=67: Holmium (monoisotopic)
abundanceData.set(67, mono(165));

// Z=68: Erbium
abundanceData.set(68, toWeightFractions([
  { a: 162, atomFraction: 0.00139, mass: 161.92878770 },
  { a: 164, atomFraction: 0.01601, mass: 163.92920880 },
  { a: 166, atomFraction: 0.33503, mass: 165.93029940 },
  { a: 167, atomFraction: 0.22869, mass: 166.93205460 },
  { a: 168, atomFraction: 0.26978, mass: 167.93237740 },
  { a: 170, atomFraction: 0.14910, mass: 169.93546340 },
]));

// Z=69: Thulium (monoisotopic)
abundanceData.set(69, mono(169));

// Z=70: Ytterbium
abundanceData.set(70, toWeightFractions([
  { a: 168, atomFraction: 0.00123, mass: 167.93389050 },
  { a: 170, atomFraction: 0.02982, mass: 169.93476180 },
  { a: 171, atomFraction: 0.14086, mass: 170.93633150 },
  { a: 172, atomFraction: 0.21686, mass: 171.93638590 },
  { a: 173, atomFraction: 0.16103, mass: 172.93821560 },
  { a: 174, atomFraction: 0.32025, mass: 173.93886740 },
  { a: 176, atomFraction: 0.12995, mass: 175.94257360 },
]));

// Z=71: Lutetium
abundanceData.set(71, toWeightFractions([
  { a: 175, atomFraction: 0.97401, mass: 174.94077520 },
  { a: 176, atomFraction: 0.02599, mass: 175.94268950 },
]));

// Z=72: Hafnium
abundanceData.set(72, toWeightFractions([
  { a: 174, atomFraction: 0.0016, mass: 173.94004780 },
  { a: 176, atomFraction: 0.0526, mass: 175.94140860 },
  { a: 177, atomFraction: 0.1860, mass: 176.94322770 },
  { a: 178, atomFraction: 0.2728, mass: 177.94370530 },
  { a: 179, atomFraction: 0.1362, mass: 178.94582320 },
  { a: 180, atomFraction: 0.3508, mass: 179.94655500 },
]));

// Z=73: Tantalum
abundanceData.set(73, toWeightFractions([
  { a: 180, atomFraction: 0.0001201, mass: 179.94746440 },
  { a: 181, atomFraction: 0.9998799, mass: 180.94799580 },
]));

// Z=74: Tungsten
abundanceData.set(74, toWeightFractions([
  { a: 180, atomFraction: 0.0012, mass: 179.94671080 },
  { a: 182, atomFraction: 0.2650, mass: 181.94820394 },
  { a: 183, atomFraction: 0.1431, mass: 182.95022275 },
  { a: 184, atomFraction: 0.3064, mass: 183.95093092 },
  { a: 186, atomFraction: 0.2843, mass: 185.95436360 },
]));

// Z=75: Rhenium
abundanceData.set(75, toWeightFractions([
  { a: 185, atomFraction: 0.3740, mass: 184.95295570 },
  { a: 187, atomFraction: 0.6260, mass: 186.95575060 },
]));

// Z=76: Osmium
abundanceData.set(76, toWeightFractions([
  { a: 184, atomFraction: 0.0002, mass: 183.95248910 },
  { a: 186, atomFraction: 0.0159, mass: 185.95383830 },
  { a: 187, atomFraction: 0.0196, mass: 186.95575010 },
  { a: 188, atomFraction: 0.1324, mass: 187.95583620 },
  { a: 189, atomFraction: 0.1615, mass: 188.95814470 },
  { a: 190, atomFraction: 0.2626, mass: 189.95844880 },
  { a: 192, atomFraction: 0.4078, mass: 191.96148060 },
]));

// Z=77: Iridium
abundanceData.set(77, toWeightFractions([
  { a: 191, atomFraction: 0.373, mass: 190.96059140 },
  { a: 193, atomFraction: 0.627, mass: 192.96292430 },
]));

// Z=78: Platinum
abundanceData.set(78, toWeightFractions([
  { a: 190, atomFraction: 0.00012, mass: 189.95993490 },
  { a: 192, atomFraction: 0.00782, mass: 191.96104170 },
  { a: 194, atomFraction: 0.32864, mass: 193.96268090 },
  { a: 195, atomFraction: 0.33775, mass: 194.96479120 },
  { a: 196, atomFraction: 0.25211, mass: 195.96495150 },
  { a: 198, atomFraction: 0.07356, mass: 197.96789490 },
]));

// Z=79: Gold (monoisotopic)
abundanceData.set(79, mono(197));

// Z=80: Mercury
abundanceData.set(80, toWeightFractions([
  { a: 196, atomFraction: 0.0015, mass: 195.96583280 },
  { a: 198, atomFraction: 0.0997, mass: 197.96676860 },
  { a: 199, atomFraction: 0.1687, mass: 198.96828064 },
  { a: 200, atomFraction: 0.2310, mass: 199.96832659 },
  { a: 201, atomFraction: 0.1318, mass: 200.97030284 },
  { a: 202, atomFraction: 0.2986, mass: 201.97064340 },
  { a: 204, atomFraction: 0.0687, mass: 203.97349398 },
]));

// Z=81: Thallium
abundanceData.set(81, toWeightFractions([
  { a: 203, atomFraction: 0.2952, mass: 202.97234420 },
  { a: 205, atomFraction: 0.7048, mass: 204.97442750 },
]));

// Z=82: Lead
abundanceData.set(82, toWeightFractions([
  { a: 204, atomFraction: 0.014, mass: 203.97304360 },
  { a: 206, atomFraction: 0.241, mass: 205.97446530 },
  { a: 207, atomFraction: 0.221, mass: 206.97589680 },
  { a: 208, atomFraction: 0.524, mass: 207.97665190 },
]));

// Z=83: Bismuth (monoisotopic — Bi-209 is effectively stable)
abundanceData.set(83, mono(209));

// Z=84: Polonium — synthetic/radioactive, skip
// Z=85: Astatine — synthetic/radioactive, skip
// Z=86: Radon — synthetic/radioactive, skip
// Z=87: Francium — synthetic/radioactive, skip
// Z=88: Radium — synthetic/radioactive, skip
// Z=89: Actinium — synthetic/radioactive, skip

// Z=90: Thorium (Th-232 effectively 100%)
abundanceData.set(90, mono(232));

// Z=91: Protactinium — synthetic/radioactive, skip

// Z=92: Uranium
abundanceData.set(92, toWeightFractions([
  { a: 234, atomFraction: 0.000054, mass: 234.04095040 },
  { a: 235, atomFraction: 0.007204, mass: 235.04392820 },
  { a: 238, atomFraction: 0.992742, mass: 238.05078826 },
]));

export function getAbundances(z: number): IsotopeAbundance[] | undefined {
  return abundanceData.get(z);
}
