import { ThermalTableEntry, ThermalCard, McnpDocument } from '../types';
import { XsdirData, getAvailableLibraries } from '../data/xsdirParser';

/**
 * Known S(a,b) identifier descriptions.
 */
const THERMAL_IDENTIFIERS: Record<string, string> = {
  // Legacy (ENDF/B-VI, VII) identifiers
  lwtr: 'Light water (H in H\u2082O)',
  hwtr: 'Heavy water (D in D\u2082O)',
  grph: 'Graphite (C in graphite)',
  poly: 'Polyethylene (H in CH\u2082)',
  benz: 'Benzene (H in C\u2086H\u2086)',
  'o-d2': 'Ortho deuterium',
  'p-d2': 'Para deuterium',
  'o-h2': 'Ortho hydrogen',
  'p-h2': 'Para hydrogen',
  zrh: 'Zirconium hydride (H in ZrH)',
  'zr-h': 'Zirconium hydride (Zr in ZrH)',
  be: 'Beryllium metal',
  'be-o': 'Beryllium oxide (Be in BeO)',
  'o-be': 'Beryllium oxide (O in BeO)',
  al27: 'Aluminium metal',
  fe56: 'Iron',
  sio2: 'Silicon dioxide',
  uuo2: 'Uranium dioxide (U in UO\u2082)',
  ouo2: 'Uranium dioxide (O in UO\u2082)',
  // ENDF/B-VIII identifiers
  'h-h2o': 'Light water (H in H\u2082O)',
  'h-zrh': 'Zirconium hydride (H in ZrH)',
  'h-poly': 'Polyethylene (H in CH\u2082)',
  'h-benz': 'Benzene (H in C\u2086H\u2086)',
  'h-ice': 'Ice (H in ice-Ih)',
  'o-ice': 'Ice (O in ice-Ih)',
  'h-yh2': 'Yttrium hydride (H in YH\u2082)',
  'h-cah2': 'Calcium hydride (H in CaH\u2082)',
  'c-graphite': 'Graphite (C in graphite)',
  'd-d2o': 'Heavy water (D in D\u2082O)',
  'o-d2o': 'Heavy water (O in D\u2082O)',
  'zr-zrh': 'Zirconium hydride (Zr in ZrH)',
  'y-yh2': 'Yttrium hydride (Y in YH\u2082)',
  'n-un': 'Uranium nitride (N in UN)',
  'u-un': 'Uranium nitride (U in UN)',
  'u-uo2': 'Uranium dioxide (U in UO\u2082)',
  'o-uo2': 'Uranium dioxide (O in UO\u2082)',
  'be-beo': 'Beryllium oxide (Be in BeO)',
  'o-beo': 'Beryllium oxide (O in BeO)',
  'be-met': 'Beryllium metal',
  'al-met': 'Aluminium metal',
  'fe-met': 'Iron metal',
  'si-sio2': 'Silicon dioxide (Si in SiO\u2082)',
  'o-sio2': 'Silicon dioxide (O in SiO\u2082)',
  'ca-cah': 'Calcium hydride (Ca in CaH\u2082)',
  'mg-met': 'Magnesium metal',
  // ENDF81SaB identifiers
  'al-27': 'Aluminium-27 metal',
  'fe-56': 'Iron-56 metal',
  '7l-7ld': 'Lithium-7 deuteride (\u2077Li in \u2077LiD)',
  '7l-7lh': 'Lithium-7 hydride (\u2077Li in \u2077LiH)',
  'al-sap': 'Sapphire (Al in Al\u2082O\u2083)',
  'be-bec': 'Beryllium carbide (Be in Be\u2082C)',
  'be-bef': 'Beryllium fluoride (Be in BeF\u2082)',
  'be-flb': 'FLiBe (Be in \u00b2LiF-BeF\u2082)',
  'c-bec': 'Beryllium carbide (C in Be\u2082C)',
  'c-luci': 'Lucite (C in C\u2085O\u2082H\u2088)',
  'c-styr': 'Polystyrene (C in C\u2088H\u2088)',
  'c-ptfe': 'Teflon (C in CF\u2082)',
  'c-sic': 'Silicon carbide (C in SiC)',
  'c-uc1': 'Uranium carbide (C in UC, natural U)',
  'c-uc2': 'Uranium carbide (C in UC, 5% \u00b2\u00b3\u2075U)',
  'c-uc3': 'Uranium carbide (C in UC, 10% \u00b2\u00b3\u2075U)',
  'c-uc4': 'Uranium carbide (C in UC, 19.75% \u00b2\u00b3\u2075U)',
  'c-uc5': 'Uranium carbide (C in UC, 93% \u00b2\u00b3\u2075U)',
  'c-uc6': 'Uranium carbide (C in UC, 100% \u00b2\u00b3\u2075U)',
  'c-zrc': 'Zirconium carbide (C in ZrC)',
  'd-7ld': 'Lithium-7 deuteride (D in \u2077LiD)',
  'f-bef': 'Beryllium fluoride (F in BeF\u2082)',
  'f-flb': 'FLiBe (F in \u00b2LiF-BeF\u2082)',
  'f-hf': 'Hydrogen fluoride (F in HF)',
  'f-mgf': 'Magnesium fluoride (F in MgF\u2082)',
  'f-ptfe': 'Teflon (F in CF\u2082)',
  'h-7lh': 'Lithium-7 hydride (H in \u2077LiH)',
  'h-luci': 'Lucite (H in C\u2085O\u2082H\u2088)',
  'h-styr': 'Polystyrene (H in C\u2088H\u2088)',
  'h-hf': 'Hydrogen fluoride (H in HF)',
  'h-poil': 'Heavy paraffinic oil (H)',
  'h-uh3': 'Uranium hydride (H in UH\u2083)',
  'h-ezh': 'Zirconium hydride, epsilon phase (H in ZrH\u2082)',
  'h-dzh': 'Zirconium hydride, delta phase (H in ZrHx)',
  'li-flb': 'FLiBe (Li in \u00b2LiF-BeF\u2082)',
  'mg-mgf': 'Magnesium fluoride (Mg in MgF\u2082)',
  'mg-mgo': 'Magnesium oxide (Mg in MgO)',
  'n-un1': 'Uranium nitride (N in UN, natural U)',
  'n-un2': 'Uranium nitride (N in UN, 5% \u00b2\u00b3\u2075U)',
  'n-un3': 'Uranium nitride (N in UN, 10% \u00b2\u00b3\u2075U)',
  'n-un4': 'Uranium nitride (N in UN, 19.75% \u00b2\u00b3\u2075U)',
  'n-un5': 'Uranium nitride (N in UN, 93% \u00b2\u00b3\u2075U)',
  'n-un6': 'Uranium nitride (N in UN, 100% \u00b2\u00b3\u2075U)',
  'o-sap': 'Sapphire (O in Al\u2082O\u2083)',
  'o-luci': 'Lucite (O in C\u2085O\u2082H\u2088)',
  'o-mgo': 'Magnesium oxide (O in MgO)',
  'o-puo': 'Plutonium oxide (O in PuO\u2082)',
  'o-aqu': 'Alpha quartz (O in SiO\u2082)',
  'o-uo1': 'Uranium oxide (O in UO\u2082, natural U)',
  // 'o-uo2' omitted — already defined above as generic "Uranium dioxide (O in UO₂)"
  'o-uo3': 'Uranium oxide (O in UO\u2082, 10% \u00b2\u00b3\u2075U)',
  'o-uo4': 'Uranium oxide (O in UO\u2082, 19.75% \u00b2\u00b3\u2075U)',
  'o-uo5': 'Uranium oxide (O in UO\u2082, 93% \u00b2\u00b3\u2075U)',
  'o-uo6': 'Uranium oxide (O in UO\u2082, 100% \u00b2\u00b3\u2075U)',
  'pu-puo': 'Plutonium oxide (Pu in PuO\u2082)',
  'si-sic': 'Silicon carbide (Si in SiC)',
  'si-aqu': 'Alpha quartz (Si in SiO\u2082)',
  'u-met1': 'Uranium metal (natural U)',
  'u-met2': 'Uranium metal (5% \u00b2\u00b3\u2075U)',
  'u-met3': 'Uranium metal (10% \u00b2\u00b3\u2075U)',
  'u-met4': 'Uranium metal (19.75% \u00b2\u00b3\u2075U)',
  'u-met5': 'Uranium metal (93% \u00b2\u00b3\u2075U)',
  'u-met6': 'Uranium metal (100% \u00b2\u00b3\u2075U)',
  'u-uc1': 'Uranium carbide (U in UC, natural U)',
  'u-uc2': 'Uranium carbide (U in UC, 5% \u00b2\u00b3\u2075U)',
  'u-uc3': 'Uranium carbide (U in UC, 10% \u00b2\u00b3\u2075U)',
  'u-uc4': 'Uranium carbide (U in UC, 19.75% \u00b2\u00b3\u2075U)',
  'u-uc5': 'Uranium carbide (U in UC, 93% \u00b2\u00b3\u2075U)',
  'u-uc6': 'Uranium carbide (U in UC, 100% \u00b2\u00b3\u2075U)',
  'u-un1': 'Uranium nitride (U in UN, natural U)',
  'u-un2': 'Uranium nitride (U in UN, 5% \u00b2\u00b3\u2075U)',
  'u-un3': 'Uranium nitride (U in UN, 10% \u00b2\u00b3\u2075U)',
  'u-un4': 'Uranium nitride (U in UN, 19.75% \u00b2\u00b3\u2075U)',
  'u-un5': 'Uranium nitride (U in UN, 93% \u00b2\u00b3\u2075U)',
  'u-un6': 'Uranium nitride (U in UN, 100% \u00b2\u00b3\u2075U)',
  'u-uo1': 'Uranium oxide (U in UO\u2082, natural U)',
  // 'u-uo2' omitted — already defined above as generic "Uranium dioxide (U in UO₂)"
  'u-uo3': 'Uranium oxide (U in UO\u2082, 10% \u00b2\u00b3\u2075U)',
  'u-uo4': 'Uranium oxide (U in UO\u2082, 19.75% \u00b2\u00b3\u2075U)',
  'u-uo5': 'Uranium oxide (U in UO\u2082, 93% \u00b2\u00b3\u2075U)',
  'u-uo6': 'Uranium oxide (U in UO\u2082, 100% \u00b2\u00b3\u2075U)',
  'zr-zrc': 'Zirconium carbide (Zr in ZrC)',
  'zr-ezh': 'Zirconium hydride, epsilon phase (Zr in ZrH\u2082)',
  'zr-dzh': 'Zirconium hydride, delta phase (Zr in ZrHx)',
  grph10: '10% porous graphite',
  grph20: '20% porous graphite',
  grph30: '30% porous graphite',
  orthoh: 'Liquid ortho-hydrogen',
  orthod: 'Liquid ortho-deuterium',
  parah: 'Liquid para-hydrogen',
  parad: 'Liquid para-deuterium',
  hortho: 'Liquid ortho-hydrogen',
  hpara: 'Liquid para-hydrogen',
  dortho: 'Liquid ortho-deuterium',
  dpara: 'Liquid para-deuterium',
  lmeth: 'Liquid methane (H in l-CH\u2084)',
  smeth: 'Solid methane (H in s-CH\u2084)',
  'h-lch4': 'Liquid methane (H in l-CH\u2084)',
  'h-sch4': 'Solid methane (H in s-CH\u2084)',
};

/**
 * Generate hover text for a thermal table entry within an MT card.
 */
export function getThermalHover(
  doc: McnpDocument,
  entry: ThermalTableEntry,
  thermalCard: ThermalCard,
  options: { xsdirData?: XsdirData } = {},
): string {
  const { xsdirData } = options;
  const lines: string[] = [];

  // Header: table name + identifier description
  const description = THERMAL_IDENTIFIERS[entry.identifier.toLowerCase()];
  if (description) {
    lines.push(`**${entry.name}** \u2014 ${description}`);
  } else {
    lines.push(`**${entry.name}** \u2014 S(\u03b1,\u03b2) thermal scattering table`);
  }

  // Associated material
  const matExists = doc.materials.some(m => m.id === thermalCard.id);
  lines.push('');
  if (matExists) {
    lines.push(`**Associated material:** M${thermalCard.id}`);
  } else {
    lines.push(`**Associated material:** M${thermalCard.id} (not defined)`);
  }

  // xsdir lookup — S(a,b) entries use identifier keys (e.g., "lwtr"), not numeric ZAIDs
  if (xsdirData && entry.suffix) {
    const xsdirEntries = getAvailableLibraries(xsdirData, entry.identifier);
    const xsdirMatch = xsdirEntries.find(e => e.suffix === entry.suffix);
    if (xsdirMatch) {
      if (xsdirMatch.library) {
        lines.push('');
        lines.push(`**Data library:** ${xsdirMatch.library} (.${entry.suffix})`);
      }
      lines.push('');
      lines.push(`**Temperature:** ${xsdirMatch.temperature.toFixed(1)} K`);
    }
  }

  return lines.join('\n');
}
