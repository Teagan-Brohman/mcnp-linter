/**
 * MCNP surface type definitions from Table 5.1.
 * Used for validating surface cards and providing hover info.
 */

interface SurfaceTypeInfo {
  mnemonic: string;
  description: string;
  equation: string;
  paramNames: string[];
}

const surfaceTypes: SurfaceTypeInfo[] = [
  // Planes
  { mnemonic: 'P', description: 'General plane', equation: 'Ax + By + Cz - D = 0', paramNames: ['A', 'B', 'C', 'D'] },
  { mnemonic: 'PX', description: 'Plane normal to x axis', equation: 'x - D = 0', paramNames: ['D'] },
  { mnemonic: 'PY', description: 'Plane normal to y axis', equation: 'y - D = 0', paramNames: ['D'] },
  { mnemonic: 'PZ', description: 'Plane normal to z axis', equation: 'z - D = 0', paramNames: ['D'] },

  // Point-defined axisymmetric surfaces
  { mnemonic: 'X', description: 'Axisymmetric surface defined by points (along x axis)', equation: 'Surface of revolution about x defined by coordinate-radius pairs', paramNames: ['x1', 'R1'] },
  { mnemonic: 'Y', description: 'Axisymmetric surface defined by points (along y axis)', equation: 'Surface of revolution about y defined by coordinate-radius pairs', paramNames: ['y1', 'R1'] },
  { mnemonic: 'Z', description: 'Axisymmetric surface defined by points (along z axis)', equation: 'Surface of revolution about z defined by coordinate-radius pairs', paramNames: ['z1', 'R1'] },

  // Spheres
  { mnemonic: 'SO', description: 'Sphere centered at origin', equation: 'x\u00B2 + y\u00B2 + z\u00B2 - R\u00B2 = 0', paramNames: ['R'] },
  { mnemonic: 'S', description: 'General sphere', equation: '(x-\u0078\u0304)\u00B2 + (y-\u0079\u0304)\u00B2 + (z-\u007A\u0304)\u00B2 - R\u00B2 = 0', paramNames: ['\u0078\u0304', '\u0079\u0304', '\u007A\u0304', 'R'] },
  { mnemonic: 'SX', description: 'Sphere centered on x axis', equation: '(x-\u0078\u0304)\u00B2 + y\u00B2 + z\u00B2 - R\u00B2 = 0', paramNames: ['\u0078\u0304', 'R'] },
  { mnemonic: 'SY', description: 'Sphere centered on y axis', equation: 'x\u00B2 + (y-\u0079\u0304)\u00B2 + z\u00B2 - R\u00B2 = 0', paramNames: ['\u0079\u0304', 'R'] },
  { mnemonic: 'SZ', description: 'Sphere centered on z axis', equation: 'x\u00B2 + y\u00B2 + (z-\u007A\u0304)\u00B2 - R\u00B2 = 0', paramNames: ['\u007A\u0304', 'R'] },

  // Cylinders
  { mnemonic: 'C/X', description: 'Cylinder parallel to x axis', equation: '(y-\u0079\u0304)\u00B2 + (z-\u007A\u0304)\u00B2 - R\u00B2 = 0', paramNames: ['\u0079\u0304', '\u007A\u0304', 'R'] },
  { mnemonic: 'C/Y', description: 'Cylinder parallel to y axis', equation: '(x-\u0078\u0304)\u00B2 + (z-\u007A\u0304)\u00B2 - R\u00B2 = 0', paramNames: ['\u0078\u0304', '\u007A\u0304', 'R'] },
  { mnemonic: 'C/Z', description: 'Cylinder parallel to z axis', equation: '(x-\u0078\u0304)\u00B2 + (y-\u0079\u0304)\u00B2 - R\u00B2 = 0', paramNames: ['\u0078\u0304', '\u0079\u0304', 'R'] },
  { mnemonic: 'CX', description: 'Cylinder on x axis', equation: 'y\u00B2 + z\u00B2 - R\u00B2 = 0', paramNames: ['R'] },
  { mnemonic: 'CY', description: 'Cylinder on y axis', equation: 'x\u00B2 + z\u00B2 - R\u00B2 = 0', paramNames: ['R'] },
  { mnemonic: 'CZ', description: 'Cylinder on z axis', equation: 'x\u00B2 + y\u00B2 - R\u00B2 = 0', paramNames: ['R'] },

  // Cones
  { mnemonic: 'K/X', description: 'Cone parallel to x axis', equation: '(y-\u0079\u0304)\u00B2 + (z-\u007A\u0304)\u00B2 - t\u00B2(x-\u0078\u0304)\u00B2 = 0', paramNames: ['\u0078\u0304', '\u0079\u0304', '\u007A\u0304', 't\u00B2', '\u00B11'] },
  { mnemonic: 'K/Y', description: 'Cone parallel to y axis', equation: '(x-\u0078\u0304)\u00B2 + (z-\u007A\u0304)\u00B2 - t\u00B2(y-\u0079\u0304)\u00B2 = 0', paramNames: ['\u0078\u0304', '\u0079\u0304', '\u007A\u0304', 't\u00B2', '\u00B11'] },
  { mnemonic: 'K/Z', description: 'Cone parallel to z axis', equation: '(x-\u0078\u0304)\u00B2 + (y-\u0079\u0304)\u00B2 - t\u00B2(z-\u007A\u0304)\u00B2 = 0', paramNames: ['\u0078\u0304', '\u0079\u0304', '\u007A\u0304', 't\u00B2', '\u00B11'] },
  { mnemonic: 'KX', description: 'Cone on x axis', equation: 'y\u00B2 + z\u00B2 - t\u00B2(x-\u0078\u0304)\u00B2 = 0', paramNames: ['\u0078\u0304', 't\u00B2', '\u00B11'] },
  { mnemonic: 'KY', description: 'Cone on y axis', equation: 'x\u00B2 + z\u00B2 - t\u00B2(y-\u0079\u0304)\u00B2 = 0', paramNames: ['\u0079\u0304', 't\u00B2', '\u00B11'] },
  { mnemonic: 'KZ', description: 'Cone on z axis', equation: 'x\u00B2 + y\u00B2 - t\u00B2(z-\u007A\u0304)\u00B2 = 0', paramNames: ['\u007A\u0304', 't\u00B2', '\u00B11'] },

  // Quadrics
  { mnemonic: 'SQ', description: 'Ellipsoid/Hyperboloid/Paraboloid (axis-aligned)', equation: 'A(x-\u0078\u0304)\u00B2 + B(y-\u0079\u0304)\u00B2 + C(z-\u007A\u0304)\u00B2 + 2D(x-\u0078\u0304) + 2E(y-\u0079\u0304) + 2F(z-\u007A\u0304) + G = 0', paramNames: ['A', 'B', 'C', 'D', 'E', 'F', 'G', '\u0078\u0304', '\u0079\u0304', '\u007A\u0304'] },
  { mnemonic: 'GQ', description: 'General quadratic', equation: 'Ax\u00B2 + By\u00B2 + Cz\u00B2 + Dxy + Eyz + Fzx + Gx + Hy + Jz + K = 0', paramNames: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K'] },

  // Tori
  { mnemonic: 'TX', description: 'Torus parallel to x axis', equation: 'Torus centered at (\u0078\u0304,\u0079\u0304,\u007A\u0304) with axis along x', paramNames: ['\u0078\u0304', '\u0079\u0304', '\u007A\u0304', 'A', 'B', 'C'] },
  { mnemonic: 'TY', description: 'Torus parallel to y axis', equation: 'Torus centered at (\u0078\u0304,\u0079\u0304,\u007A\u0304) with axis along y', paramNames: ['\u0078\u0304', '\u0079\u0304', '\u007A\u0304', 'A', 'B', 'C'] },
  { mnemonic: 'TZ', description: 'Torus parallel to z axis', equation: 'Torus centered at (\u0078\u0304,\u0079\u0304,\u007A\u0304) with axis along z', paramNames: ['\u0078\u0304', '\u0079\u0304', '\u007A\u0304', 'A', 'B', 'C'] },

  // Macrobodies
  { mnemonic: 'RPP', description: 'Rectangular parallelepiped (macrobody)', equation: 'xmin <= x <= xmax, ymin <= y <= ymax, zmin <= z <= zmax', paramNames: ['xmin', 'xmax', 'ymin', 'ymax', 'zmin', 'zmax'] },
  { mnemonic: 'BOX', description: 'Arbitrarily oriented box (macrobody)', equation: 'Box defined by vertex V and three edge vectors A1, A2, A3', paramNames: ['Vx', 'Vy', 'Vz', 'A1x', 'A1y', 'A1z', 'A2x', 'A2y', 'A2z', 'A3x', 'A3y', 'A3z'] },
  { mnemonic: 'SPH', description: 'Sphere (macrobody)', equation: 'Sphere centered at V with radius R', paramNames: ['Vx', 'Vy', 'Vz', 'R'] },
  { mnemonic: 'RCC', description: 'Right circular cylinder (macrobody)', equation: 'Cylinder with base at V, axis vector H, radius R', paramNames: ['Vx', 'Vy', 'Vz', 'Hx', 'Hy', 'Hz', 'R'] },
  { mnemonic: 'RHP', description: 'Right hexagonal prism (macrobody)', equation: 'Hexagonal prism with base at V, axis H, and cross-section vectors', paramNames: ['Vx', 'Vy', 'Vz', 'Hx', 'Hy', 'Hz', 'R1x', 'R1y', 'R1z', 'R2x', 'R2y', 'R2z', 'R3x', 'R3y', 'R3z'] },
  { mnemonic: 'HEX', description: 'Right hexagonal prism (macrobody)', equation: 'Hexagonal prism with base at V, axis H, and cross-section vectors', paramNames: ['Vx', 'Vy', 'Vz', 'Hx', 'Hy', 'Hz', 'R1x', 'R1y', 'R1z', 'R2x', 'R2y', 'R2z', 'R3x', 'R3y', 'R3z'] },
  { mnemonic: 'REC', description: 'Right elliptical cylinder (macrobody)', equation: 'Elliptical cylinder with base at V, axis H, semi-axes A1 and A2', paramNames: ['Vx', 'Vy', 'Vz', 'Hx', 'Hy', 'Hz', 'A1x', 'A1y', 'A1z', 'A2x', 'A2y', 'A2z'] },
  { mnemonic: 'TRC', description: 'Truncated right-angle cone (macrobody)', equation: 'Truncated cone with base at V, axis H, radii R1 and R2', paramNames: ['Vx', 'Vy', 'Vz', 'Hx', 'Hy', 'Hz', 'R1', 'R2'] },
  { mnemonic: 'ELL', description: 'Ellipsoid (macrobody)', equation: 'Ellipsoid with foci V1 and V2, semi-major axis length Rm', paramNames: ['V1x', 'V1y', 'V1z', 'V2x', 'V2y', 'V2z', 'Rm'] },
  { mnemonic: 'WED', description: 'Wedge (macrobody)', equation: 'Wedge defined by vertex V and three edge vectors', paramNames: ['Vx', 'Vy', 'Vz', 'A1x', 'A1y', 'A1z', 'A2x', 'A2y', 'A2z', 'A3x', 'A3y', 'A3z'] },
  { mnemonic: 'ARB', description: 'Arbitrary polyhedron (macrobody)', equation: 'Polyhedron defined by up to 8 vertices and 6 four-sided faces', paramNames: ['ax', 'ay', 'az', 'bx', 'by', 'bz', 'cx', 'cy', 'cz', 'dx', 'dy', 'dz', 'ex', 'ey', 'ez', 'fx', 'fy', 'fz', 'gx', 'gy', 'gz', 'hx', 'hy', 'hz', 'N1', 'N2', 'N3', 'N4', 'N5', 'N6'] },
];

// Build case-insensitive lookup map
const surfaceTypeMap = new Map<string, SurfaceTypeInfo>();
for (const st of surfaceTypes) {
  surfaceTypeMap.set(st.mnemonic.toUpperCase(), st);
}

/**
 * Look up surface type info by mnemonic (case-insensitive).
 */
export function getSurfaceType(mnemonic: string): SurfaceTypeInfo | undefined {
  return surfaceTypeMap.get(mnemonic.toUpperCase());
}

// Isometric ASCII art for surface types (box-like shapes only)
const surfaceAsciiArt = new Map<string, string>([
  ['RPP', [
    '         +----------+',
    '        /|          /|',
    '       / |  zmax   / |',
    '      /  |        /  |',
    '     +----------+\'   |',
    '     |   |       |   |  ymax',
    '     |   +-------|---+',
    '     |  /  xmin  |  /',
    '     | /    ymin | /',
    '     |/    xmax  |/',
    '     +----------+\'',
    '          zmin',
  ].join('\n')],
  ['BOX', [
    '           +----------+',
    '          /|          /|',
    '         / |   A3    / |',
    '        /  |        /  |',
    '       +----------+\'   |',
    '       |   |       |   |',
    '       |   +-------|---+  A2',
    '       |  /        |  /',
    '       | /         | /',
    '       |/          |/',
    '     V +----------+\'',
    '            A1',
  ].join('\n')],
  ['WED', [
    '            /\\',
    '           / .\\',
    '       A3 / .  \\',
    '         / .    \\',
    '        /.       \\',
    '     V +----------+',
    '       |.        /|',
    '       | .      / |',
    '       |  .    /  |',
    '       |   .  / A2|',
    '       |    ./    |',
    '       |    .     |',
    '       +----.-----+',
    '          A1',
  ].join('\n')],
  ['ARB', [
    '       b--------c',
    '      /|       / |',
    '     / |      /  |',
    '    /  |     /   |',
    '   a--------d    |',
    '   |   f----|----g',
    '   |  /     |   /',
    '   | /      |  /',
    '   |/       | /',
    '   e--------h',
  ].join('\n')],
]);

/** Return ASCII art for a surface type, or undefined if none exists. */
export function getSurfaceAsciiArt(mnemonic: string): string | undefined {
  return surfaceAsciiArt.get(mnemonic.toUpperCase());
}

/** Returns the set of valid parameter counts for a surface mnemonic, or undefined if unknown. */
export function getAcceptedParamCounts(mnemonic: string): number[] | undefined {
  const upper = mnemonic.toUpperCase();
  const VARIABLE_COUNTS: Record<string, number[]> = {
    'P': [4, 9],
    'X': [2, 4, 6], 'Y': [2, 4, 6], 'Z': [2, 4, 6],
    'K/X': [4, 5], 'K/Y': [4, 5], 'K/Z': [4, 5],
    'KX': [2, 3], 'KY': [2, 3], 'KZ': [2, 3],
    'BOX': [9, 12],
    'RHP': [9, 15], 'HEX': [9, 15],
    'REC': [10, 12],
  };
  if (upper in VARIABLE_COUNTS) return VARIABLE_COUNTS[upper];
  const st = getSurfaceType(upper);
  if (!st) return undefined;
  return [st.paramNames.length];
}
