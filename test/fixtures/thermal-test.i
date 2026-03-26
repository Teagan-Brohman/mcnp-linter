thermal scattering test
c --- cell cards ---
1  1  -1.0   -1     IMP:N=1
2  2  -2.7   -2     IMP:N=1
3  0          1 2    IMP:N=0

c --- surface cards ---
1  SO   5.0
2  SO  10.0

c --- data cards ---
c water material
M1   1001.80c  0.6667
     8016.80c  0.3333
MT1  lwtr.10t
c aluminum — mixed libraries (should warn)
M2   13027.80c  0.5
     13027.70c  0.5
c MT without matching material (should error)
MT5  grph.10t
NPS  100000
