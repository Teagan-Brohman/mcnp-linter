universe lattice test deck
c === cell cards ===
c real world
1  0     1 -2 -3  4 -5  6     FILL=1     IMP:N=1
5  0    -1:2:3:-4:5:-6                    IMP:N=0
c universe 1 — lattice
2  0    -7  1 -3  8       U=1  FILL=2  LAT=1  IMP:N=1
c universe 2 — fuel and moderator
3  1  -10.97  -11          U=2           IMP:N=1  $ fuel
4  2  -1.0     11          U=2           IMP:N=1  $ moderator

c === surface cards ===
1  PX   0.0
2  PX  10.0
3  PY  10.0
4  PY   0.0
5  PZ  10.0
6  PZ   0.0
7  SO   1.0
8  PX   5.0
11 SO   0.5

c === data cards ===
M1   92235.80c  0.04  92238.80c  0.96    $ UO2
M2   1001.80c   0.6667  8016.80c  0.3333 $ water
NPS  100000
