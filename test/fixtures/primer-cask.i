Use of macrobodies for cask problem
c ****************** BLOCK 1 -- cells
8 0              -18         IMP:P,N=1   $ inside the cask
7 5 -7.86    18 -17         IMP:P,N=1   $ cask iron shell
9 0               17         IMP:P,N=0   $ void outside cask

c ****************** BLOCK 2 -- surfaces/macrobodies
17 RCC  5 5 40   0 0 20   10           $ outer cylinder
18 RCC  5 5 41   0 0 18    9           $ inner cylinder

c ****************** BLOCK 3 -- data cards
c --------------------------------------------------------
c WATER for neutron transport (by mass fraction)
c     (ignore H-2, H-3, O-17, and O-18)
c     Specify S(alpha,beta) treatment for binding effects
c --------------------------------------------------------
M21  1001.80c -0.11190    $ H-1 and mass fraction
     8016.80c -0.88810    $ O-16 and mass fraction
MT21 lwtr.20t              $ light water at 293.6 K
c --- Natural iron (density 7.86 g/cm^3)
M5   26000  -1.00000
MODE P
SDEF  ERG=1.25  PAR=2  POS=5 5 50
NPS  10000
