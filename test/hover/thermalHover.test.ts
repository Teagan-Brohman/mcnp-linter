import { describe, it, expect } from 'vitest';
import { getThermalHover } from '../../server/src/hover/thermalHover';
import { ThermalTableEntry, ThermalCard, McnpDocument } from '../../server/src/types';

function makeDoc(hasMaterial: boolean): McnpDocument {
  return {
    title: 'test',
    cells: [],
    surfaces: [],
    materials: hasMaterial ? [{ id: 1, components: [], keywords: new Map(), range: { startLine: 0, startCol: 0, endLine: 0, endCol: 10 } }] : [],
    thermalCards: [],
    parameterDataCards: [],
    readCards: [],
    tallyCards: [],
    tallyModifiers: [],
    parseErrors: [],
  };
}

function makeEntry(name: string): ThermalTableEntry {
  const dotIdx = name.indexOf('.');
  return {
    name,
    identifier: dotIdx >= 0 ? name.substring(0, dotIdx) : name,
    suffix: dotIdx >= 0 ? name.substring(dotIdx + 1) : '',
    range: { startLine: 0, startCol: 0, endLine: 0, endCol: name.length },
  };
}

function makeThermalCard(id: number, tables: ThermalTableEntry[]): ThermalCard {
  return { id, tables, range: { startLine: 0, startCol: 0, endLine: 0, endCol: 10 } };
}

describe('getThermalHover', () => {
  it('shows description for known identifier', () => {
    const entry = makeEntry('lwtr.10t');
    const tc = makeThermalCard(1, [entry]);
    const hover = getThermalHover(makeDoc(true), entry, tc);
    expect(hover).toContain('lwtr.10t');
    expect(hover).toContain('Light water');
    expect(hover).toContain('M1');
  });

  it('shows generic description for unknown identifier', () => {
    const entry = makeEntry('custom.10t');
    const tc = makeThermalCard(1, [entry]);
    const hover = getThermalHover(makeDoc(true), entry, tc);
    expect(hover).toContain('thermal scattering');
  });

  it('shows warning when material not defined', () => {
    const entry = makeEntry('lwtr.10t');
    const tc = makeThermalCard(5, [entry]);
    const hover = getThermalHover(makeDoc(false), entry, tc);
    expect(hover).toContain('M5');
    expect(hover).toContain('not defined');
  });

  it('shows description for ENDF81SaB h-ezh identifier', () => {
    const entry = makeEntry('h-ezh.40t');
    const tc = makeThermalCard(1, [entry]);
    const hover = getThermalHover(makeDoc(true), entry, tc);
    expect(hover).toContain('h-ezh.40t');
    expect(hover).toContain('Zirconium hydride, epsilon phase');
    expect(hover).not.toContain('thermal scattering table');
  });

  it('shows description for ENDF81SaB al-27 identifier', () => {
    const entry = makeEntry('al-27.40t');
    const tc = makeThermalCard(2, [entry]);
    const hover = getThermalHover(makeDoc(true), entry, tc);
    expect(hover).toContain('al-27.40t');
    expect(hover).toContain('Aluminium-27 metal');
    expect(hover).not.toContain('thermal scattering table');
  });

  it('shows xsdir data when available', () => {
    const entry = makeEntry('lwtr.10t');
    const tc = makeThermalCard(1, [entry]);
    const xsdirData = {
      entries: new Map([
        ['lwtr', [{ zaid: 'lwtr', suffix: '10t', awr: 0.999, temperature: 293.6, library: 'ENDF70SaB' }]],
      ]),
    };
    const hover = getThermalHover(makeDoc(true), entry, tc, { xsdirData });
    expect(hover).toContain('ENDF70SaB');
    expect(hover).toContain('293.6');
  });
});
