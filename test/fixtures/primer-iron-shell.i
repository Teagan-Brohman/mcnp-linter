Point isotropic 7-MeV photon sources in iron shell:  (analog base case):
c ********************  BLOCK 1: CELL CARDS  ********************************
c GEOMETRY:   X isotropic point source (7-MeV)
c             D ambient dose 100 cm from outer shield surface (160 cm)
c             iron shield 30-cm thick (r=30 to 60 cm)
c             (without shield, dose is 6.013x10^{-17} Sv/gamma)
c
c              z-axis  ^
c                      |  \    \         void
c                      |    \  Fe  \
c                      | void  |      |
c              X ------|-------|---------|--------D----> x-axis
c             source        |      |
c                           /    /
c                         /    /
c
c ********************  BLOCK 1: CELLS  *************************************
10 0              -10         imp:p=1   $ inside of shield
20 1  -7.86    10 -20         imp:p=1   $ iron shell
30 0           20 -50         imp:p=1   $ void outside shld and inside detect
40 0           50 -100        imp:p=1   $ void past detector
50 0              100         imp:p=0   $ vacuum outside problem boundary

c ********************  BLOCK 2: SURFACE CARDS  ****************************
10  so  30.0             $ inner shield surface
20  so  60.0             $ outer shield surface
50  so  160.0            $ detector surface
100 so  10.E+02          $ spherical problem boundary (at 10 m)

c ********************  BLOCK 3: DATA CARDS  ********************************
SDEF  erg=7.00  par=2          $ 7-Mev pt photon source at origin
c
mode p
phys:p 100 1 1     $ no bremsstrahlung; no coherent scattering
nps   10000         $ 10000 particle cutoff
f2:p   50           $ tally on surface 50 as ambient dose
c
c ---- Photon ambient dose equivalent H*(10mm)  Sv cm^2; ICRP [1987]
de2   0.100E-01 0.150E-01 0.200E-01 0.300E-01 0.400E-01 0.500E-01
      0.600E-01 0.800E-01 0.100E+00 0.150E+00 0.200E+00 0.300E+00
      0.400E+00 0.500E+00 0.600E+00 0.800E+00 0.100E+01 0.150E+01
      0.200E+01 0.300E+01 0.400E+01 0.500E+01 0.600E+01 0.800E+01
      0.100E+02
df2   0.769E-13 0.846E-12 0.101E-11 0.785E-12 0.614E-12 0.526E-12
      0.504E-12 0.532E-12 0.611E-12 0.890E-12 0.118E-11 0.181E-11
      0.238E-11 0.289E-11 0.338E-11 0.429E-11 0.511E-11 0.692E-11
      0.848E-11 0.111E-10 0.133E-10 0.154E-10 0.174E-10 0.212E-10
      0.252E-10
c
c --- Natural iron  (density 7.86 g/cm^3)
m1     26000  -1.00000
