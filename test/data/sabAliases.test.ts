import { describe, it, expect } from 'vitest';
import { LEGACY_TO_ENDF8, ENDF8_TO_LEGACY, SAB_ALIASES } from '../../server/src/data/sabAliases';

describe('sabAliases', () => {
  describe('LEGACY_TO_ENDF8', () => {
    it('maps lwtr to h-h2o', () => {
      expect(LEGACY_TO_ENDF8['lwtr']).toBe('h-h2o');
    });
    it('maps hwtr to d-d2o', () => {
      expect(LEGACY_TO_ENDF8['hwtr']).toBe('d-d2o');
    });
    it('maps poly to h-poly', () => {
      expect(LEGACY_TO_ENDF8['poly']).toBe('h-poly');
    });
    it('maps zrh to h-zrh', () => {
      expect(LEGACY_TO_ENDF8['zrh']).toBe('h-zrh');
    });
    it('maps slash-format h/zr to h-zrh', () => {
      expect(LEGACY_TO_ENDF8['h/zr']).toBe('h-zrh');
    });
    it('maps hyphen-format beo to be-beo', () => {
      expect(LEGACY_TO_ENDF8['beo']).toBe('be-beo');
    });
  });

  describe('ENDF8_TO_LEGACY', () => {
    it('maps h-h2o to lwtr', () => {
      expect(ENDF8_TO_LEGACY['h-h2o']).toBe('lwtr');
    });
    it('maps d-d2o to hwtr', () => {
      expect(ENDF8_TO_LEGACY['d-d2o']).toBe('hwtr');
    });
    it('maps c-graphite to grph', () => {
      expect(ENDF8_TO_LEGACY['c-graphite']).toBe('grph');
    });
    it('maps h-poly to poly', () => {
      expect(ENDF8_TO_LEGACY['h-poly']).toBe('poly');
    });
  });

  describe('SAB_ALIASES bidirectional consistency', () => {
    it('every LEGACY_TO_ENDF8 key exists in SAB_ALIASES', () => {
      for (const key of Object.keys(LEGACY_TO_ENDF8)) {
        expect(SAB_ALIASES, `missing SAB_ALIASES entry for legacy key "${key}"`).toHaveProperty(key);
      }
    });
    it('every ENDF8_TO_LEGACY key exists in SAB_ALIASES', () => {
      for (const key of Object.keys(ENDF8_TO_LEGACY)) {
        expect(SAB_ALIASES, `missing SAB_ALIASES entry for ENDF8 key "${key}"`).toHaveProperty(key);
      }
    });
    it('no alias array contains the key itself', () => {
      for (const [key, aliases] of Object.entries(SAB_ALIASES)) {
        expect(aliases, `SAB_ALIASES["${key}"] should not contain itself`).not.toContain(key);
      }
    });
    it('aliases are bidirectional — each alias lists the key among its own aliases', () => {
      for (const [key, aliases] of Object.entries(SAB_ALIASES)) {
        for (const alias of aliases) {
          expect(SAB_ALIASES, `SAB_ALIASES["${alias}"] should exist (alias of "${key}")`).toHaveProperty(alias);
          expect(SAB_ALIASES[alias], `SAB_ALIASES["${alias}"] should include "${key}"`).toContain(key);
        }
      }
    });
    it('has entries for at least 20 thermal scatterers', () => {
      expect(Object.keys(SAB_ALIASES).length).toBeGreaterThanOrEqual(20);
    });
  });
});
